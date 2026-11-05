import { buildGpSeriesList } from "../../../src/growth-potential/gp-calculator";
import { fetchLastYearMonthlyAverageTemperatures } from "../../../src/growth-potential/monthly-temperature";
import { toPublicWeatherError } from "../../../src/shared/public-weather-error";

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lon = parseFloat(url.searchParams.get("lon") ?? "");
    const warmGrass = url.searchParams.get("warmGrass") ?? "未指定(C4)";
    const coolGrass = url.searchParams.get("coolGrass") ?? "未指定(C3)";

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return Response.json(
        { success: false, error: "Invalid lat/lon" },
        { status: 400 }
      );
    }

    const { year, monthlyTemperatures } =
      await fetchLastYearMonthlyAverageTemperatures(lat, lon);
    const series = buildGpSeriesList(warmGrass, coolGrass, monthlyTemperatures);

    return Response.json({
      success: true,
      year,
      monthlyTemperatures,
      series,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: toPublicWeatherError(error) },
      { status: 500 }
    );
  }
};
