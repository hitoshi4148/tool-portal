import { fetchMet, MetResponse } from "../spray/met";
import { jstIsoString, toJst, utcToJst } from "../spray/timezone";
import { HourlyWeatherRecord } from "./nasa-power";

export function normalizeMetNorwayForecast(
  timeseries: Array<{
    time: string;
    data?: {
      instant?: {
        details?: {
          air_temperature?: number;
          relative_humidity?: number;
        };
      };
    };
  }>,
  startDateTime: string,
  endDateTime: string
): HourlyWeatherRecord[] {
  const startMs = new Date(startDateTime).getTime();
  const endMs = new Date(endDateTime).getTime();
  const normalized: HourlyWeatherRecord[] = [];

  for (const entry of timeseries) {
    const jst = toJst(entry.time);
    const datetime = jstIsoString(jst);
    const timestamp = new Date(datetime).getTime();

    if (timestamp < startMs || timestamp > endMs) {
      continue;
    }

    const instant = entry.data?.instant?.details;
    if (!instant) {
      continue;
    }

    const temperature = instant.air_temperature;
    const humidity = instant.relative_humidity;

    if (temperature == null || humidity == null) {
      continue;
    }

    normalized.push({
      datetime,
      temperature: Number(temperature),
      humidity: Number(humidity),
    });
  }

  return normalized.sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );
}

export function jstTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function extractMetNorwayForecast(
  metData: MetResponse,
  hours = 48
): HourlyWeatherRecord[] {
  const today = jstTodayString();
  const startDateTime = `${today}T00:00:00+09:00`;
  const startMs = new Date(startDateTime).getTime();
  const endIso = jstIsoString(
    utcToJst(new Date(startMs + hours * 60 * 60 * 1000))
  );
  return normalizeMetNorwayForecast(
    metData.properties.timeseries,
    startDateTime,
    endIso
  );
}

export async function fetchMetNorwayFromToday(
  latitude: number,
  longitude: number,
  hours = 48
): Promise<HourlyWeatherRecord[]> {
  const data = await fetchMet(latitude, longitude);
  return extractMetNorwayForecast(data, hours);
}
