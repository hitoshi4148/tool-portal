import { addDaysToDateString, jstTodayString } from "../disease/met-norway-forecast";
import {
  DailyWeatherRecord,
  fetchNasaPowerDaily,
  filterDailyByDateRange,
} from "../disease/nasa-power";

export function calculateGddFromDaily(
  records: DailyWeatherRecord[],
  startDate: string,
  endDate: string,
  baseTemp = 0
): number {
  let total = 0;

  for (const row of records) {
    if (row.date < startDate || row.date > endDate) {
      continue;
    }

    const temp = row.temperature_avg;
    if (temp == null || Number.isNaN(temp) || temp <= -900) {
      continue;
    }

    total += Math.max(0, temp - baseTemp);
  }

  return Math.round(total * 10) / 10;
}

export function jstYesterdayString(): string {
  return addDaysToDateString(jstTodayString(), -1);
}

export interface GddResult {
  gdd: number;
  startDate: string;
  endDate: string;
  baseTemp: number;
  lat: number;
  lon: number;
}

export async function fetchGdd(
  lat: number,
  lon: number,
  startDate: string,
  baseTemp = 0
): Promise<GddResult> {
  const endDate = jstYesterdayString();

  if (startDate > endDate) {
    return { gdd: 0, startDate, endDate, baseTemp, lat, lon };
  }

  const daily = await fetchNasaPowerDaily(lat, lon, startDate, endDate);
  const filtered = filterDailyByDateRange(daily, startDate, endDate);

  if (filtered.length === 0) {
    throw new Error("気温データを取得できませんでした");
  }

  const gdd = calculateGddFromDaily(filtered, startDate, endDate, baseTemp);

  return { gdd, startDate, endDate, baseTemp, lat, lon };
}
