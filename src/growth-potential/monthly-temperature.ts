import { DailyWeatherRecord, fetchNasaPowerDaily } from "../disease/nasa-power";

export function getLastCalendarYearJst(reference = new Date()): number {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
    })
      .formatToParts(reference)
      .find((part) => part.type === "year")?.value
  );
  return year - 1;
}

export function aggregateMonthlyAverageTemperatures(
  daily: DailyWeatherRecord[],
  year: number
): Array<number | null> {
  const buckets = Array.from({ length: 12 }, () => [] as number[]);
  const yearPrefix = String(year);

  for (const row of daily) {
    if (!row.date.startsWith(yearPrefix)) {
      continue;
    }

    const month = Number(row.date.split("-")[1]) - 1;
    if (
      month < 0 ||
      month > 11 ||
      row.temperature_avg === null ||
      Number.isNaN(row.temperature_avg)
    ) {
      continue;
    }

    buckets[month].push(row.temperature_avg);
  }

  return buckets.map((temps) =>
    temps.length
      ? temps.reduce((sum, value) => sum + value, 0) / temps.length
      : null
  );
}

export async function fetchLastYearMonthlyAverageTemperatures(
  latitude: number,
  longitude: number,
  year = getLastCalendarYearJst()
): Promise<{ year: number; monthlyTemperatures: Array<number | null> }> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const daily = await fetchNasaPowerDaily(
    latitude,
    longitude,
    startDate,
    endDate
  );

  return {
    year,
    monthlyTemperatures: aggregateMonthlyAverageTemperatures(daily, year),
  };
}
