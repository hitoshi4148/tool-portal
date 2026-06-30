import { fetchDiseaseRiskForecast } from "../../../src/disease/prepare-data";

interface RiskMapFacilityInput {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const body = (await context.request.json()) as {
      facilities?: RiskMapFacilityInput[];
    };
    const facilities = Array.isArray(body.facilities)
      ? body.facilities.slice(0, 4)
      : [];

    if (facilities.length === 0) {
      return Response.json({ success: true, results: [] });
    }

    const results = await Promise.all(
      facilities.map(async (facility) => {
        const lat = Number(facility.latitude);
        const lon = Number(facility.longitude);

        if (
          !facility.id ||
          !facility.name ||
          Number.isNaN(lat) ||
          Number.isNaN(lon)
        ) {
          return {
            id: facility.id ?? "",
            name: facility.name ?? "",
            latitude: lat,
            longitude: lon,
            success: false,
            error: "Invalid facility data",
          };
        }

        try {
          const forecast = await fetchDiseaseRiskForecast(lat, lon);
          return {
            id: facility.id,
            name: facility.name,
            latitude: lat,
            longitude: lon,
            success: true,
            tomorrow: forecast.tomorrow,
            dayAfterTomorrow: forecast.dayAfterTomorrow,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            id: facility.id,
            name: facility.name,
            latitude: lat,
            longitude: lon,
            success: false,
            error: message,
          };
        }
      })
    );

    return Response.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
