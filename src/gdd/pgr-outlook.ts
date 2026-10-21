import { addDaysToDateString, jstTodayString } from "../disease/met-norway-forecast";
import { fetchNasaPowerDaily } from "../disease/nasa-power";
import { fetchMet } from "../spray/met";
import { jstDateKey, toJst } from "../spray/timezone";
import { projectPgrOutlook, type PgrOutlook } from "./pgr-project";

const CLIMATOLOGY_LOOKBACK_DAYS = 400;

export type { PgrOutlook };
export { projectPgrOutlook };

export function dailyMeanTemperaturesFromMet(
  timeseries: Array<{
    time: string;
    data?: { instant?: { details?: { air_temperature?: number } } };
  }>
): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const entry of timeseries) {
    const temperature = entry.data?.instant?.details?.air_temperature;
    if (temperature == null || Number.isNaN(Number(temperature))) {
      continue;
    }
    const date = jstDateKey(toJst(entry.time));
    const values = buckets.get(date) ?? [];
    values.push(Number(temperature));
    buckets.set(date, values);
  }

  const means = new Map<string, number>();
  for (const [date, values] of buckets) {
    const sum = values.reduce((total, value) => total + value, 0);
    means.set(date, sum / values.length);
  }
  return means;
}

export async function fetchPgrOutlook(
  lat: number,
  lon: number,
  startDate: string,
  target: number,
  secondaryTarget: number | null,
  baseTemp = 0
): Promise<PgrOutlook> {
  const today = jstTodayString();
  const yesterday = addDaysToDateString(today, -1);
  const historyStart = [
    startDate,
    addDaysToDateString(today, -CLIMATOLOGY_LOOKBACK_DAYS),
  ].sort()[0];

  const nasaPromise =
    historyStart <= yesterday
      ? fetchNasaPowerDaily(lat, lon, historyStart, yesterday)
      : Promise.resolve([]);

  const metPromise = fetchMet(lat, lon).catch(() => null);
  const [nasaDaily, met] = await Promise.all([nasaPromise, metPromise]);
  const forecastDaily = met
    ? dailyMeanTemperaturesFromMet(met.properties.timeseries)
    : new Map<string, number>();

  return projectPgrOutlook({
    startDate,
    today,
    target,
    secondaryTarget,
    baseTemp,
    observedRecords: nasaDaily,
    forecastDaily,
    climatologyRecords: nasaDaily,
  });
}
