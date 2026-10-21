const HORIZON_DAYS = 180;

export interface PgrDailyTemperature {
  date: string;
  temperature_avg: number | null;
}

export interface PgrOutlook {
  status: "pending" | "predicted" | "exceeded" | "unknown";
  observedGdd: number;
  target: number;
  secondaryTarget: number | null;
  today: string;
  reboundDate: string | null;
  reboundDays: number | null;
  fadeDate: string | null;
  fadeDays: number | null;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function daysBetweenDateStrings(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const fromMs = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toMs = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toMs - fromMs) / 86400000);
}

export function sameCalendarDayLastYear(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year - 1, month - 1, day));
  if (shifted.getUTCMonth() !== month - 1) {
    return `${year - 1}-${String(month).padStart(2, "0")}-28`;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function sumDailyGdd(
  records: PgrDailyTemperature[],
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

function temperatureOnDate(
  date: string,
  records: PgrDailyTemperature[]
): number | null {
  const row = records.find((record) => record.date === date);
  const temperature = row?.temperature_avg;
  if (temperature == null || temperature <= -900) {
    return null;
  }
  return temperature;
}

export function projectPgrOutlook(input: {
  startDate: string;
  today: string;
  target: number;
  secondaryTarget?: number | null;
  baseTemp?: number;
  observedRecords: PgrDailyTemperature[];
  forecastDaily: Map<string, number>;
  climatologyRecords: PgrDailyTemperature[];
}): PgrOutlook {
  const secondaryTarget = input.secondaryTarget ?? null;
  const baseTemp = input.baseTemp ?? 0;
  const yesterday = addDaysToDateString(input.today, -1);
  const base = {
    target: input.target,
    secondaryTarget,
    today: input.today,
    reboundDate: null,
    reboundDays: null,
    fadeDate: null,
    fadeDays: null,
  };

  if (input.startDate > input.today) {
    return { ...base, status: "pending", observedGdd: 0 };
  }

  const observedGdd =
    input.startDate <= yesterday
      ? sumDailyGdd(input.observedRecords, input.startDate, yesterday, baseTemp)
      : 0;

  if (observedGdd >= input.target) {
    return { ...base, status: "exceeded", observedGdd };
  }

  let running = observedGdd;
  let day = input.today;
  let reboundDate: string | null = null;
  let fadeDate: string | null = null;

  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const forecast = input.forecastDaily.get(day);
    const climatology = temperatureOnDate(
      sameCalendarDayLastYear(day),
      input.climatologyRecords
    );
    const temperature = forecast ?? climatology;
    if (temperature != null) {
      running += Math.max(0, temperature - baseTemp);
    }
    if (reboundDate == null && running >= input.target) {
      reboundDate = day;
    }
    if (
      secondaryTarget != null &&
      fadeDate == null &&
      running >= secondaryTarget
    ) {
      fadeDate = day;
    }
    const done =
      reboundDate != null && (secondaryTarget == null || fadeDate != null);
    if (done) {
      break;
    }
    day = addDaysToDateString(day, 1);
  }

  if (reboundDate == null) {
    return { ...base, status: "unknown", observedGdd };
  }

  return {
    ...base,
    status: "predicted",
    observedGdd,
    reboundDate,
    reboundDays: daysBetweenDateStrings(input.today, reboundDate),
    fadeDate,
    fadeDays:
      fadeDate == null ? null : daysBetweenDateStrings(input.today, fadeDate),
  };
}
