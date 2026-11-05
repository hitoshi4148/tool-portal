import { fetchDiseaseRiskForecast } from "../../../src/disease/prepare-data";
import { toPublicWeatherError } from "../../../src/shared/public-weather-error";

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lon = parseFloat(url.searchParams.get("lon") ?? "");

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return Response.json(
        { success: false, error: "Invalid lat/lon" },
        { status: 400 }
      );
    }

    const forecast = await fetchDiseaseRiskForecast(lat, lon);

    return Response.json({
      success: true,
      tomorrow: forecast.tomorrow,
      dayAfterTomorrow: forecast.dayAfterTomorrow,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: toPublicWeatherError(error) },
      { status: 500 }
    );
  }
};
