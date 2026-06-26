import { fetchPortalDashboard } from "../../../src/portal/fetch-dashboard";

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

    const dashboard = await fetchPortalDashboard(
      lat,
      lon,
      warmGrass,
      coolGrass
    );

    return Response.json({
      success: true,
      weather: dashboard.weather,
      diseaseRisk: dashboard.diseaseRisk,
      growthPotential: dashboard.growthPotential,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
