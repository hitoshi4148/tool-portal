import {
  DailyWeatherRecord,
  fetchNasaPowerDaily,
  fetchNasaPowerHourly,
  HourlyWeatherRecord,
} from "./nasa-power";
import {
  addDaysToDateString,
  fetchMetNorwayFromToday,
  jstTodayString,
} from "./met-norway-forecast";
import {
  calculateAllDiseaseRisks,
  DiseaseRiskResult,
  DiseaseWeatherInput,
} from "./disease-risk-calculator";

export interface MultiDayDiseaseRiskForecast {
  tomorrow: DiseaseRiskResult;
  dayAfterTomorrow: DiseaseRiskResult;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateHourlyToDaily(
  hourly: HourlyWeatherRecord[]
): DailyWeatherRecord[] {
  const byDate = new Map<string, { temps: number[]; humids: number[] }>();

  for (const row of hourly) {
    const date = row.datetime.split("T")[0];
    if (!byDate.has(date)) {
      byDate.set(date, { temps: [], humids: [] });
    }

    const bucket = byDate.get(date)!;
    if (row.temperature != null && !Number.isNaN(row.temperature)) {
      bucket.temps.push(row.temperature);
    }
    if (row.humidity != null && !Number.isNaN(row.humidity)) {
      bucket.humids.push(row.humidity);
    }
  }

  return Array.from(byDate.entries()).map(([date, bucket]) => ({
    date,
    temperature_avg: bucket.temps.length ? average(bucket.temps) : null,
    humidity_avg: bucket.humids.length ? average(bucket.humids) : null,
    temperature_max: bucket.temps.length ? Math.max(...bucket.temps) : null,
    temperature_min: bucket.temps.length ? Math.min(...bucket.temps) : null,
  }));
}

function buildTargetDateTimeJst(daysFromToday: number, hour = 6): string {
  const dateStr = addDaysToDateString(jstTodayString(), daysFromToday);
  const hourText = String(hour).padStart(2, "0");
  return `${dateStr}T${hourText}:00:00+09:00`;
}

function prepareWeatherAtTarget(
  nasaDaily: DailyWeatherRecord[],
  nasaHourly: HourlyWeatherRecord[],
  forecastHourly: HourlyWeatherRecord[],
  targetDateTime: string
): DiseaseWeatherInput {
  const targetMs = new Date(targetDateTime).getTime();
  const today = jstTodayString();
  const yesterday = addDaysToDateString(today, -1);

  const hourly = [...nasaHourly, ...forecastHourly]
    .filter((row) => new Date(row.datetime).getTime() <= targetMs)
    .sort(
      (a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

  const dailyMap = new Map<string, DailyWeatherRecord>();

  for (const row of nasaDaily) {
    if (row.date <= yesterday) {
      dailyMap.set(row.date, row);
    }
  }

  const forecastForDaily = forecastHourly.filter(
    (row) => new Date(row.datetime).getTime() <= targetMs
  );
  const forecastDaily = aggregateHourlyToDaily(forecastForDaily);

  for (const row of forecastDaily) {
    if (row.date < today) {
      continue;
    }

    const dayEndMs = new Date(`${row.date}T23:59:59+09:00`).getTime();
    if (targetMs >= dayEndMs) {
      dailyMap.set(row.date, row);
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { daily, hourly };
}

export function computeDiseaseRiskForecast(
  nasaDaily: DailyWeatherRecord[],
  nasaHourly: HourlyWeatherRecord[],
  forecastHourly: HourlyWeatherRecord[]
): MultiDayDiseaseRiskForecast {
  const tomorrowTarget = buildTargetDateTimeJst(1, 6);
  const dayAfterTomorrowTarget = buildTargetDateTimeJst(2, 6);

  const tomorrowWeather = prepareWeatherAtTarget(
    nasaDaily,
    nasaHourly,
    forecastHourly,
    tomorrowTarget
  );
  const dayAfterTomorrowWeather = prepareWeatherAtTarget(
    nasaDaily,
    nasaHourly,
    forecastHourly,
    dayAfterTomorrowTarget
  );

  return {
    tomorrow: calculateAllDiseaseRisks(tomorrowWeather),
    dayAfterTomorrow: calculateAllDiseaseRisks(dayAfterTomorrowWeather),
  };
}

export async function fetchDiseaseRiskForecast(
  latitude: number,
  longitude: number
): Promise<MultiDayDiseaseRiskForecast> {
  const today = jstTodayString();
  const endDate = addDaysToDateString(today, -1);
  const startDate = addDaysToDateString(today, -7);

  const [nasaDaily, nasaHourly, forecastHourly] = await Promise.all([
    fetchNasaPowerDaily(latitude, longitude, startDate, endDate),
    fetchNasaPowerHourly(latitude, longitude, startDate, endDate),
    fetchMetNorwayFromToday(latitude, longitude, 72),
  ]);

  return computeDiseaseRiskForecast(nasaDaily, nasaHourly, forecastHourly);
}
