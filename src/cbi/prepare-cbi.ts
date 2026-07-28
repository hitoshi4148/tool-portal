import {
  addDaysToDateString,
  extractMetNorwayForecast,
  jstTodayString,
} from "../disease/met-norway-forecast";
import { HourlyWeatherRecord } from "../disease/nasa-power";
import { MetResponse } from "../spray/met";
import {
  BentCarbonBalanceForecast,
  BentCbiReport,
  buildEnergyComment,
  buildForecastComment,
  computeDailyCbi,
  computeWeightedCbi,
  cbiToEnergyPercent,
  DailyCbiResult,
  energyReserveLabel,
} from "./cbi-calculator";
import { CBI_VERSION } from "./cbi-config";

function formatTargetLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${month}/${day} 6:00`;
}

function buildForecastEntry(
  daily: DailyCbiResult,
  daysFromToday: number
): BentCarbonBalanceForecast {
  return {
    targetDate: daily.date,
    targetLabel: formatTargetLabel(daily.date),
    daysFromToday,
    cbi: daily.cbi,
    stars: daily.stars,
    starLabel: daily.starLabel,
    comment: buildForecastComment(daily.stars, daysFromToday),
    photosynthesisIndex: daily.photosynthesisIndex,
    respirationLoadIndex: daily.respirationLoadIndex,
    lightFactor: daily.lightFactor,
  };
}

export function computeBentCbiReport(
  metData: MetResponse,
  nasaHourlyHistory: HourlyWeatherRecord[]
): BentCbiReport | null {
  const today = jstTodayString();
  const tomorrow = addDaysToDateString(today, 1);
  const dayAfterTomorrow = addDaysToDateString(today, 2);
  const twoDaysAfterTomorrow = addDaysToDateString(today, 3);

  const forecastHourly = extractMetNorwayForecast(metData, 96);

  const forecasts: BentCarbonBalanceForecast[] = [];

  const tomorrowResult = computeDailyCbi(
    forecastHourly,
    tomorrow,
    dayAfterTomorrow
  );
  if (tomorrowResult) {
    forecasts.push(buildForecastEntry(tomorrowResult, 1));
  }

  const dayAfterResult = computeDailyCbi(
    forecastHourly,
    dayAfterTomorrow,
    twoDaysAfterTomorrow
  );
  if (dayAfterResult) {
    forecasts.push(buildForecastEntry(dayAfterResult, 2));
  }

  if (forecasts.length === 0) {
    return null;
  }

  const history: DailyCbiResult[] = [];

  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const targetDate = addDaysToDateString(today, -daysAgo);
    const nextDate = addDaysToDateString(targetDate, 1);
    const daily = computeDailyCbi(nasaHourlyHistory, targetDate, nextDate);
    if (daily) {
      history.push(daily);
    }
  }

  const weightedCbi = computeWeightedCbi(history);
  const energyPercent =
    weightedCbi == null ? null : cbiToEnergyPercent(weightedCbi);

  return {
    version: CBI_VERSION,
    forecasts,
    energyReserve: {
      percent: energyPercent ?? 0,
      label: energyReserveLabel(energyPercent ?? 0),
      comment: buildEnergyComment(energyPercent ?? 0),
      weightedCbi: weightedCbi == null ? 0 : Math.round(weightedCbi * 1000) / 1000,
      history,
    },
  };
}
