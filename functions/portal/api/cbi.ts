import { computeBentCbiReport } from "../../../src/cbi/prepare-cbi";
import {
  addDaysToDateString,
  jstTodayString,
} from "../../../src/disease/met-norway-forecast";
import { fetchNasaPowerHourly } from "../../../src/disease/nasa-power";
import { fetchMet } from "../../../src/spray/met";

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

    const today = jstTodayString();
    const endDate = addDaysToDateString(today, -1);
    const cbiHistoryStartDate = addDaysToDateString(today, -8);

    const [metData, nasaHourly] = await Promise.all([
      fetchMet(lat, lon),
      fetchNasaPowerHourly(lat, lon, cbiHistoryStartDate, endDate),
    ]);

    const report = computeBentCbiReport(metData, nasaHourly);

    if (!report) {
      return Response.json(
        { success: false, error: "CBI を算出するための気象データが不足しています" },
        { status: 503 }
      );
    }

    return Response.json({
      success: true,
      ...report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
