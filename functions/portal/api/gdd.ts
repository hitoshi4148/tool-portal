import { fetchGdd } from "../../../src/gdd/fetch-gdd";
import { fetchPgrOutlook } from "../../../src/gdd/pgr-outlook";

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lon = parseFloat(url.searchParams.get("lon") ?? "");
    const startDate = url.searchParams.get("start_date") ?? "";
    const baseTemp = parseFloat(url.searchParams.get("base_temp") ?? "0");
    const outlook = url.searchParams.get("outlook") ?? "";

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

    if (outlook === "pgr") {
      const target = parseFloat(url.searchParams.get("target") ?? "");
      const secondaryRaw = url.searchParams.get("secondary");
      const secondary =
        secondaryRaw == null || secondaryRaw === ""
          ? null
          : parseFloat(secondaryRaw);

      if (!Number.isFinite(target) || target <= 0 || target > 2000) {
        return Response.json(
          { success: false, error: "target must be a positive number" },
          { status: 400 }
        );
      }
      if (
        secondary != null &&
        (!Number.isFinite(secondary) || secondary <= target || secondary > 2000)
      ) {
        return Response.json(
          { success: false, error: "secondary must be greater than target" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(baseTemp) || baseTemp < 0 || baseTemp > 40) {
        return Response.json(
          { success: false, error: "base_temp must be between 0 and 40" },
          { status: 400 }
        );
      }

      const projection = await fetchPgrOutlook(
        lat,
        lon,
        startDate,
        target,
        secondary,
        baseTemp
      );
      return Response.json({ success: true, ...projection });
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
