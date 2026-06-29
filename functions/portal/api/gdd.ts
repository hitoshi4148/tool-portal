import { fetchGdd } from "../../../src/gdd/fetch-gdd";

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lon = parseFloat(url.searchParams.get("lon") ?? "");
    const startDate = url.searchParams.get("start_date") ?? "";
    const baseTemp = parseFloat(url.searchParams.get("base_temp") ?? "0");

    if (Number.isNaN(lat) || Number.isNaN(lon) || !startDate) {
      return Response.json(
        { success: false, error: "lat, lon, start_date are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return Response.json(
        { success: false, error: "start_date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const result = await fetchGdd(lat, lon, startDate, baseTemp);

    return Response.json({
      success: true,
      gdd: result.gdd,
      start_date: result.startDate,
      end_date: result.endDate,
      base_temp: result.baseTemp,
      lat: result.lat,
      lon: result.lon,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("取得できません") ? 503 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
};
