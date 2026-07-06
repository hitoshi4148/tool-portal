import { fetchPortalDashboard } from "../../../src/portal/fetch-dashboard";

const DASHBOARD_CACHE_TTL_SECONDS = 30 * 60;

function dashboardCacheKey(request: Request): Request {
  return new Request(request.url, { method: "GET" });
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const cache = caches.default;
  const cacheKey = dashboardCacheKey(context.request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Portal-Cache", "HIT");
    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  }

  try {
    const url = new URL(context.request.url);
    const lat = parseFloat(url.searchParams.get("lat") ?? "");
    const lon = parseFloat(url.searchParams.get("lon") ?? "");
    const warmGrass = url.searchParams.get("warmGrass") ?? "未指定(C4)";
    const coolGrass = url.searchParams.get("coolGrass") ?? "未指定(C3)";

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return jsonResponse({ success: false, error: "Invalid lat/lon" }, 400);
    }

    const dashboard = await fetchPortalDashboard(
      lat,
      lon,
      warmGrass,
      coolGrass
    );

    const payload = {
      success: true,
      weather: dashboard.weather,
      diseaseRisk: dashboard.diseaseRisk,
      growthPotential: dashboard.growthPotential,
      sprayForecast: dashboard.sprayForecast,
    };

    const response = jsonResponse(payload, 200, {
      "Cache-Control": `public, max-age=${DASHBOARD_CACHE_TTL_SECONDS}`,
      "CDN-Cache-Control": `max-age=${DASHBOARD_CACHE_TTL_SECONDS}`,
      "X-Portal-Cache": "MISS",
    });

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
};
