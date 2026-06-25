import { fetchMet } from "../../../../src/spray/met";
import { judge } from "../../../../src/spray/judge";

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "35.5");
    const lon = parseFloat(url.searchParams.get("lon") ?? "139.6");

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return Response.json(
        { success: false, error: "Invalid lat/lon" },
        { status: 400 }
      );
    }

    const data = await fetchMet(lat, lon);
    const results = judge(data.properties.timeseries);

    return Response.json({
      success: true,
      results,
      location: { lat, lon },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
