import {
  EARLY_MORNING,
  EVENING,
  HIGH_TEMP_DURATION_HOURS,
  HIGH_TEMP_THRESHOLD,
  MAX_PRECIP_OK,
  MAX_TEMP,
  MAX_WIND_FOLIAR,
  MAX_WIND_OK,
  MIN_TEMP,
  RAIN_AFTER_HOURS,
} from "./config";
import { MetTimeseriesEntry } from "./met";
import {
  addHoursJst,
  isAfterJst,
  isBeforeJst,
  isSameJstDay,
  JstDateTime,
  jstIsoString,
  toJst,
} from "./timezone";

export interface SprayResult {
  time: string;
  wind: number;
  temp: number;
  precip: number;
  cloudiness: number;
  condition: string;
  status: "GREEN" | "YELLOW" | "RED";
  reason: string[];
  recommendations: string[];
  warnings: string[];
  is_spray_time: boolean;
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

function inTimeWindow(jst: JstDateTime): boolean {
  const hour = jst.hour;
  return (
    (EARLY_MORNING[0] <= hour && hour < EARLY_MORNING[1]) ||
    (EVENING[0] <= hour && hour < EVENING[1])
  );
}

function getPrecip(entry: MetTimeseriesEntry): number {
  if (entry.data.next_1_hours) {
    return entry.data.next_1_hours.details.precipitation_amount ?? 0;
  }
  if (entry.data.next_6_hours) {
    return entry.data.next_6_hours.details.precipitation_amount ?? 0;
  }
  return 0;
}

function shouldDisplayHour(jst: JstDateTime): boolean {
  const hour = jst.hour;
  return (
    (hour >= 4 && hour <= 7) ||
    (hour >= 8 && hour <= 15) ||
    (hour >= 16 && hour <= 19) ||
    (hour >= 20 && hour <= 23)
  );
}

/** Limit CPU on Workers free tier: keep roughly the next 3 days of points. */
const MAX_TIMESERIES = 72;

/**
 * Precompute same-day forward rain / high-temp flags per index.
 * Avoids the previous O(n²) full-timeseries scans that triggered Cloudflare error 1102.
 */
function buildDayForwardFlags(timeseries: MetTimeseriesEntry[], jsts: JstDateTime[]) {
  const n = timeseries.length;
  const rainLaterSameDay = new Array<boolean>(n).fill(false);
  const highTempDuration = new Array<boolean>(n).fill(false);

  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && isSameJstDay(jsts[j], jsts[i])) {
      j += 1;
    }

    // rain later: any rain strictly after k on the same day
    let anyRainAfter = false;
    for (let k = j - 1; k >= i; k--) {
      rainLaterSameDay[k] = anyRainAfter;
      if (getPrecip(timeseries[k]) > MAX_PRECIP_OK) {
        anyRainAfter = true;
      }
    }

    // high-temp streak looking strictly forward within the day (day length is small)
    for (let k = i; k < j; k++) {
      let streak = 0;
      let maxStreak = 0;
      for (let t = k + 1; t < j; t++) {
        const tTemp = timeseries[t].data.instant.details.air_temperature ?? 0;
        if (tTemp >= HIGH_TEMP_THRESHOLD) {
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      highTempDuration[k] = maxStreak >= HIGH_TEMP_DURATION_HOURS;
    }

    i = j;
  }

  return { rainLaterSameDay, highTempDuration };
}

function checkRainWithinHours(
  timeseries: MetTimeseriesEntry[],
  jsts: JstDateTime[],
  index: number,
  hours = RAIN_AFTER_HOURS
): boolean {
  const currentDt = jsts[index];
  const timeLimit = addHoursJst(currentDt, -hours);

  for (let i = index - 1; i >= 0; i--) {
    const dt = jsts[i];
    if (isBeforeJst(dt, timeLimit)) {
      break;
    }

    const entry = timeseries[i];
    if (entry.data.next_1_hours) {
      const precip = entry.data.next_1_hours.details.precipitation_amount ?? 0;
      const periodEnd = addHoursJst(dt, 1);

      if (
        !isBeforeJst(periodEnd, timeLimit) &&
        !isAfterJst(dt, currentDt) &&
        precip > MAX_PRECIP_OK
      ) {
        return true;
      }
    }
  }

  return false;
}

export function judge(timeseries: MetTimeseriesEntry[]): SprayResult[] {
  const limited =
    timeseries.length > MAX_TIMESERIES
      ? timeseries.slice(0, MAX_TIMESERIES)
      : timeseries;

  const jsts = limited.map((entry) => toJst(entry.time));
  const { rainLaterSameDay, highTempDuration } = buildDayForwardFlags(
    limited,
    jsts
  );

  const results: SprayResult[] = [];

  for (let idx = 0; idx < limited.length; idx++) {
    const entry = limited[idx];
    const dt = jsts[idx];
    const isSprayTime = inTimeWindow(dt);

    if (!shouldDisplayHour(dt)) {
      continue;
    }

    const inst = entry.data.instant.details;
    const wind = inst.wind_speed ?? 0;
    const temp = inst.air_temperature ?? 0;
    const cloudiness = inst.cloud_area_fraction ?? 0;
    const precip = getPrecip(entry);
    const condition = getWeatherCondition(precip, cloudiness);

    let status: SprayResult["status"] = "GREEN";
    const reason: string[] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    if (wind > MAX_WIND_OK) {
      status = "RED";
      reason.push("風が強い");
    } else if (isSprayTime && wind < MAX_WIND_FOLIAR) {
      recommendations.push("葉面散布肥料に適した風速です（0.5m/s未満）");
    }

    if (precip > MAX_PRECIP_OK) {
      status = "RED";
      reason.push("降雨リスク");
    }

    if (temp < MIN_TEMP || temp > MAX_TEMP) {
      status = "YELLOW";
      reason.push("気温注意");
    }

    if (rainLaterSameDay[idx]) {
      warnings.push(
        "⚠️ 当日中に雨の予報があります。農薬・葉面散布肥料が流亡する可能性があるため注意してください。"
      );
    }

    if (highTempDuration[idx]) {
      warnings.push(
        "⚠️ 日中30度以上が3時間以上続く予報です。肥料やけ・農薬やけの注意が必要です。"
      );
    }

    if (checkRainWithinHours(limited, jsts, idx, RAIN_AFTER_HOURS)) {
      recommendations.push(
        "🌧️ 雨の後6時間以内です。殺虫剤散布に適したタイミングです。"
      );
    }

    results.push({
      time: jstIsoString(dt),
      wind,
      temp,
      precip,
      cloudiness,
      condition,
      status,
      reason,
      recommendations,
      warnings,
      is_spray_time: isSprayTime,
    });
  }

  return results;
}
