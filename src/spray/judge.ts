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

function checkPrecipitationToday(
  timeseries: MetTimeseriesEntry[],
  currentDt: JstDateTime
): boolean {
  for (const entry of timeseries) {
    const dt = toJst(entry.time);

    if (!isSameJstDay(dt, currentDt)) {
      continue;
    }

    if (!isAfterJst(dt, currentDt)) {
      continue;
    }

    if (getPrecip(entry) > MAX_PRECIP_OK) {
      return true;
    }
  }

  return false;
}

function checkHighTempDuration(
  timeseries: MetTimeseriesEntry[],
  currentDt: JstDateTime
): boolean {
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (const entry of timeseries) {
    const dt = toJst(entry.time);

    if (!isSameJstDay(dt, currentDt)) {
      continue;
    }

    if (!isAfterJst(dt, currentDt)) {
      continue;
    }

    const temp = entry.data.instant.details.air_temperature ?? 0;

    if (temp >= HIGH_TEMP_THRESHOLD) {
      currentConsecutive += 1;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return maxConsecutive >= HIGH_TEMP_DURATION_HOURS;
}

function checkRainWithinHours(
  timeseries: MetTimeseriesEntry[],
  currentDt: JstDateTime,
  hours = RAIN_AFTER_HOURS
): boolean {
  const timeLimit = addHoursJst(currentDt, -hours);

  for (const entry of timeseries) {
    const dt = toJst(entry.time);

    if (isAfterJst(dt, currentDt)) {
      break;
    }

    if (isBeforeJst(dt, timeLimit)) {
      continue;
    }

    if (entry.data.next_1_hours) {
      const precip =
        entry.data.next_1_hours.details.precipitation_amount ?? 0;
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
  const results: SprayResult[] = [];

  for (const entry of timeseries) {
    const dt = toJst(entry.time);
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

    if (checkPrecipitationToday(timeseries, dt)) {
      warnings.push(
        "⚠️ 当日中に雨の予報があります。農薬・葉面散布肥料が流亡する可能性があるため注意してください。"
      );
    }

    if (checkHighTempDuration(timeseries, dt)) {
      warnings.push(
        "⚠️ 日中30度以上が3時間以上続く予報です。肥料やけ・農薬やけの注意が必要です。"
      );
    }

    if (checkRainWithinHours(timeseries, dt, RAIN_AFTER_HOURS)) {
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
