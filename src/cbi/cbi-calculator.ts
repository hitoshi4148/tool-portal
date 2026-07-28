import { HourlyWeatherRecord } from "../disease/nasa-power";
import { calculateGrowthPotential } from "../growth-potential/gp-calculator";
import {
  CBI_DAY_END_HOUR,
  CBI_DAY_START_HOUR,
  CBI_DLI,
  CBI_ENERGY_CBI_RANGE,
  CBI_ENERGY_PERCENT_LEVELS,
  CBI_GP_GRASS,
  CBI_HISTORY_WEIGHTS,
  CBI_MIN_RESPIRATION_LOAD_INDEX,
  CBI_STAR_LABELS,
  CBI_STAR_THRESHOLDS,
} from "./cbi-config";
import {
  lightCorrectionFromCloudFraction,
  lightCorrectionFromDliMj,
  sumHourlyShortwaveToMj,
} from "./dli-correction";
import { computeRespirationLoadIndex } from "./respiration-load-index";

export interface DailyCbiResult {
  date: string;
  photosynthesisIndex: number;
  respirationLoadIndex: number;
  lightFactor: number;
  cbi: number;
  stars: number;
  starLabel: string;
}

export interface BentCarbonBalanceForecast {
  targetDate: string;
  targetLabel: string;
  daysFromToday: number;
  cbi: number;
  stars: number;
  starLabel: string;
  comment: string;
  photosynthesisIndex: number;
  respirationLoadIndex: number;
  lightFactor: number;
}

export interface BentEnergyReserve {
  percent: number;
  label: string;
  comment: string;
  weightedCbi: number;
  history: DailyCbiResult[];
}

export interface BentCbiReport {
  version: number;
  forecasts: BentCarbonBalanceForecast[];
  energyReserve: BentEnergyReserve;
}

function getJstDate(datetime: string): string {
  return datetime.split("T")[0];
}

function getJstHour(datetime: string): number {
  return Number.parseInt(datetime.split("T")[1].slice(0, 2), 10);
}

function isDaytimeHour(datetime: string): boolean {
  const hour = getJstHour(datetime);
  return hour >= CBI_DAY_START_HOUR && hour < CBI_DAY_END_HOUR;
}

function isNightHourForTarget(
  datetime: string,
  targetDate: string,
  nextDate: string
): boolean {
  const date = getJstDate(datetime);
  const hour = getJstHour(datetime);
  return (
    (date === targetDate && hour >= CBI_DAY_END_HOUR) ||
    (date === nextDate && hour < CBI_DAY_START_HOUR)
  );
}

function resolveLightFactor(
  daytimeRows: HourlyWeatherRecord[]
): number {
  const radiationValues = daytimeRows
    .map((row) => row.shortwaveRadiation)
    .filter((value): value is number => value != null && !Number.isNaN(value));

  if (radiationValues.length > 0) {
    const dliMj = sumHourlyShortwaveToMj(radiationValues);
    return lightCorrectionFromDliMj(dliMj);
  }

  const cloudValues = daytimeRows
    .map((row) => row.cloudAreaFraction)
    .filter((value): value is number => value != null && !Number.isNaN(value));

  if (cloudValues.length > 0) {
    const avgCloud =
      cloudValues.reduce((sum, value) => sum + value, 0) / cloudValues.length;
    return lightCorrectionFromCloudFraction(avgCloud);
  }

  return CBI_DLI.defaultLightFactor;
}

export function computeDailyCbi(
  hourlyRecords: HourlyWeatherRecord[],
  targetDate: string,
  nextDate: string
): DailyCbiResult | null {
  const daytimeRows = hourlyRecords.filter(
    (row) =>
      getJstDate(row.datetime) === targetDate && isDaytimeHour(row.datetime)
  );
  const nightRows = hourlyRecords.filter((row) =>
    isNightHourForTarget(row.datetime, targetDate, nextDate)
  );

  const daytimeTemps = daytimeRows
    .map((row) => row.temperature)
    .filter((value): value is number => value != null && !Number.isNaN(value));
  const nightTemps = nightRows
    .map((row) => row.temperature)
    .filter((value): value is number => value != null && !Number.isNaN(value));

  if (daytimeTemps.length === 0 || nightTemps.length === 0) {
    return null;
  }

  const gpSum = daytimeTemps.reduce(
    (sum, temp) =>
      sum +
      calculateGrowthPotential(
        temp,
        CBI_GP_GRASS.optimum,
        CBI_GP_GRASS.variance
      ),
    0
  );
  const lightFactor = resolveLightFactor(daytimeRows);
  const photosynthesisIndex = gpSum * lightFactor;
  const respirationLoadIndex = computeRespirationLoadIndex(nightTemps);

  if (respirationLoadIndex < CBI_MIN_RESPIRATION_LOAD_INDEX) {
    return null;
  }

  const cbi = photosynthesisIndex / respirationLoadIndex;
  const stars = rateCbiStars(cbi);

  return {
    date: targetDate,
    photosynthesisIndex: round(cbiDetail(photosynthesisIndex)),
    respirationLoadIndex: round(cbiDetail(respirationLoadIndex)),
    lightFactor: round(lightFactor, 3),
    cbi: round(cbi, 3),
    stars,
    starLabel: CBI_STAR_LABELS[5 - stars],
  };
}

export function rateCbiStars(cbi: number): number {
  for (let index = 0; index < CBI_STAR_THRESHOLDS.length; index += 1) {
    if (cbi >= CBI_STAR_THRESHOLDS[index]) {
      return 5 - index;
    }
  }
  return 1;
}

export function cbiToEnergyPercent(weightedCbi: number): number {
  const { highCbi, lowCbi, highPercent, lowPercent } = CBI_ENERGY_CBI_RANGE;
  const ratio = (weightedCbi - lowCbi) / (highCbi - lowCbi);
  const percent = lowPercent + ratio * (highPercent - lowPercent);
  return Math.round(clamp(percent, 0, 100));
}

export function energyReserveLabel(percent: number): string {
  for (const level of CBI_ENERGY_PERCENT_LEVELS) {
    if (percent >= level.minPercent) {
      return level.label;
    }
  }
  return CBI_ENERGY_PERCENT_LEVELS[CBI_ENERGY_PERCENT_LEVELS.length - 1].label;
}

export function buildForecastComment(stars: number, daysFromToday = 1): string {
  const dayLabel = daysFromToday === 2 ? "明後日" : "明日";

  if (stars >= 5) {
    return `${dayLabel}は炭素収支が非常に良好で、糖の蓄積が十分見込まれます。`;
  }
  if (stars >= 4) {
    return `${dayLabel}は概ね良好な炭素収支が期待できます。`;
  }
  if (stars >= 3) {
    return `${dayLabel}は夜温に注意。炭素収支はやや不安定です。`;
  }
  if (stars >= 2) {
    return `${dayLabel}は夜温が高く、炭素収支は悪化する見込みです。`;
  }
  return `${dayLabel}は夜間呼吸負荷が高く、炭素が消耗する恐れがあります。`;
}

export function buildEnergyComment(percent: number): string {
  if (percent >= 80) {
    return "ここ1週間の炭素収支は非常に良好です。";
  }
  if (percent >= 60) {
    return "ここ1週間の炭素収支は比較的良好です。";
  }
  if (percent >= 40) {
    return "ここ1週間の炭素収支はやや不安定です。夜温と日射に注意してください。";
  }
  if (percent >= 20) {
    return "ここ1週間の炭素収支は悪化気味です。夏越し管理に注意が必要です。";
  }
  return "ここ1週間の炭素収支は危険な状態です。冷却・日陰・刈高の見直しを検討してください。";
}

export function computeWeightedCbi(history: DailyCbiResult[]): number | null {
  if (history.length === 0) {
    return null;
  }

  let weightedSum = 0;
  let weightTotal = 0;

  history.forEach((entry, index) => {
    const weight = CBI_HISTORY_WEIGHTS[index] ?? 0;
    if (weight <= 0) {
      return;
    }
    weightedSum += entry.cbi * weight;
    weightTotal += weight;
  });

  if (weightTotal <= 0) {
    return null;
  }

  return weightedSum / weightTotal;
}

export function renderStarRating(stars: number): string {
  const filled = "★".repeat(Math.max(1, Math.min(5, stars)));
  const empty = "☆".repeat(5 - filled.length);
  return filled + empty;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cbiDetail(value: number): number {
  return round(value, 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
