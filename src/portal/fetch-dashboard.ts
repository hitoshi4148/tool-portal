import {
  addDaysToDateString,
  extractMetNorwayForecast,
  jstTodayString,
} from "../disease/met-norway-forecast";
import {
  DailyWeatherRecord,
  fetchNasaPowerDaily,
  fetchNasaPowerHourly,
  filterDailyByDateRange,
} from "../disease/nasa-power";
import { computeDiseaseRiskForecast } from "../disease/prepare-data";
import { buildGpSeriesList } from "../growth-potential/gp-calculator";
import {
  buildMonthlyAverageTemperatures,
  getLastCalendarYearJst,
} from "../growth-potential/monthly-temperature";
import { fetchMet } from "../spray/met";
import { judge } from "../spray/judge";
import { extractHourlyWeather } from "../weather/hourly";

export interface PortalDashboardData {
  weather: ReturnType<typeof extractHourlyWeather>;
  diseaseRisk: ReturnType<typeof computeDiseaseRiskForecast>;
  growthPotential: {
    year: number;
    monthlyTemperatures: Array<number | null>;
    series: ReturnType<typeof buildGpSeriesList>;
  };
  sprayForecast: ReturnType<typeof judge>;
}

export async function fetchPortalDashboard(
  latitude: number,
  longitude: number,
  warmGrass: string,
  coolGrass: string
): Promise<PortalDashboardData> {
  const lastYear = getLastCalendarYearJst();
  const today = jstTodayString();
  const endDate = addDaysToDateString(today, -1);
  const diseaseStartDate = addDaysToDateString(today, -7);

  const [metData, nasaDailyAll, nasaHourly] = await Promise.all([
    fetchMet(latitude, longitude),
    fetchNasaPowerDaily(
      latitude,
      longitude,
      `${lastYear}-01-01`,
      endDate
    ),
    fetchNasaPowerHourly(latitude, longitude, diseaseStartDate, endDate),
  ]);

  const weather = extractHourlyWeather(metData.properties.timeseries, 48);
  const forecastHourly = extractMetNorwayForecast(metData, 72);
  const nasaDailyForDisease = filterDailyByDateRange(
    nasaDailyAll,
    diseaseStartDate,
    endDate
  );
  const diseaseRisk = computeDiseaseRiskForecast(
    nasaDailyForDisease,
    nasaHourly,
    forecastHourly
  );

  const lastYearDaily = nasaDailyAll.filter((row: DailyWeatherRecord) =>
    row.date.startsWith(String(lastYear))
  );
  const { year, monthlyTemperatures } = buildMonthlyAverageTemperatures(
    lastYearDaily,
    lastYear
  );

  return {
    weather,
    diseaseRisk,
    growthPotential: {
      year,
      monthlyTemperatures,
      series: buildGpSeriesList(warmGrass, coolGrass, monthlyTemperatures),
    },
    sprayForecast: judge(metData.properties.timeseries),
  };
}
