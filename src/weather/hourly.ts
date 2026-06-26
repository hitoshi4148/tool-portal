import { MetTimeseriesEntry } from "../spray/met";
import { jstDateKey, jstIsoString, JstDateTime, toJst } from "../spray/timezone";

export interface HourlyWeather {
  time: string;
  dateKey: string;
  hour: number;
  condition: string;
  wind: number;
  temp: number;
  humidity: number;
  precip: number;
}

export interface DailySummary {
  dateKey: string;
  condition: string;
  avgTemp: number;
  avgHumidity: number;
  avgWind: number;
}

export interface WeatherForecast {
  hourly: HourlyWeather[];
  days: DailySummary[];
}

const CONDITION_PRIORITY: Record<string, number> = {
  雨強め: 4,
  弱い雨: 3,
  くもり: 2,
  晴れ: 1,
};

function getPrecip(entry: MetTimeseriesEntry): number {
  if (entry.data.next_1_hours) {
    return entry.data.next_1_hours.details.precipitation_amount ?? 0;
  }
  if (entry.data.next_6_hours) {
    return entry.data.next_6_hours.details.precipitation_amount ?? 0;
  }
  return 0;
}

function getWeatherCondition(precipAmount: number, cloudiness: number): string {
  if (precipAmount > 1.0) {
    return "雨強め";
  }
  if (precipAmount > 0.2) {
    return "弱い雨";
  }
  if (cloudiness < 20) {
    return "晴れ";
  }
  return "くもり";
}

function pickDayCondition(conditions: string[]): string {
  return conditions.reduce((best, current) => {
    const bestScore = CONDITION_PRIORITY[best] ?? 0;
    const currentScore = CONDITION_PRIORITY[current] ?? 0;
    return currentScore > bestScore ? current : best;
  }, "晴れ");
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDailySummaries(hourly: HourlyWeather[]): DailySummary[] {
  const grouped = new Map<
    string,
    { temps: number[]; humidities: number[]; winds: number[]; conditions: string[] }
  >();

  for (const row of hourly) {
    if (!grouped.has(row.dateKey)) {
      grouped.set(row.dateKey, {
        temps: [],
        humidities: [],
        winds: [],
        conditions: [],
      });
    }

    const bucket = grouped.get(row.dateKey)!;
    bucket.temps.push(row.temp);
    bucket.humidities.push(row.humidity);
    bucket.winds.push(row.wind);
    bucket.conditions.push(row.condition);
  }

  return Array.from(grouped.entries()).map(([dateKey, bucket]) => ({
    dateKey,
    condition: pickDayCondition(bucket.conditions),
    avgTemp: average(bucket.temps),
    avgHumidity: average(bucket.humidities),
    avgWind: average(bucket.winds),
  }));
}

export function extractHourlyWeather(
  timeseries: MetTimeseriesEntry[],
  hoursAhead = 48
): WeatherForecast {
  const now = Date.now();
  const end = now + hoursAhead * 60 * 60 * 1000;
  const hourly: HourlyWeather[] = [];

  for (const entry of timeseries) {
    const jst = toJst(entry.time);
    const timestamp = jst.utcDate.getTime();

    if (timestamp < now || timestamp > end) {
      continue;
    }

    const inst = entry.data.instant.details;
    const precip = getPrecip(entry);
    const cloudiness = inst.cloud_area_fraction ?? 0;

    hourly.push({
      time: jstIsoString(jst),
      dateKey: jstDateKey(jst),
      hour: jst.hour,
      condition: getWeatherCondition(precip, cloudiness),
      wind: inst.wind_speed ?? 0,
      temp: inst.air_temperature ?? 0,
      humidity: inst.relative_humidity ?? 0,
      precip,
    });
  }

  return {
    hourly,
    days: buildDailySummaries(hourly),
  };
}
