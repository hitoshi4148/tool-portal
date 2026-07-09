import { fetchPortalDashboard } from "../../../src/portal/fetch-dashboard";

const DASHBOARD_CACHE_TTL_SECONDS = 30 * 60;
const DASHBOARD_LOCK_TTL_SECONDS = 120;
const CACHE_POLL_INTERVAL_MS = 500;
const CACHE_POLL_MAX_ATTEMPTS = 60;

const inFlightByUrl = new Map<string, Promise<Response>>();

function dashboardCacheKey(request: Request): Request {
  return new Request(request.url, { method: "GET" });
}

function dashboardLockKey(cacheKey: Request): Request {
  return new Request(`${cacheKey.url}:inflight`, { method: "GET" });
}

function inflightKey(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function cachedDashboardResponse(
  cached: Response,
  cacheStatus: "HIT" | "HIT-WAIT"
): Response {
  const headers = new Headers(cached.headers);
  headers.set("X-Portal-Cache", cacheStatus);
  return new Response(cached.body, {
    status: cached.status,
    headers,
  });
}

async function waitForCachedDashboard(
  cache: Cache,
  cacheKey: Request,
  lockKey: Request
): Promise<
  | { status: "hit"; cached: Response }
  | { status: "lock-released" }
  | { status: "timeout" }
> {
  for (let attempt = 0; attempt < CACHE_POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(CACHE_POLL_INTERVAL_MS);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return { status: "hit", cached };
    }
    const lockHeld = await cache.match(lockKey);
    if (!lockHeld) {
      return { status: "lock-released" };
    }
  }
  return { status: "timeout" };
}

async function buildDashboardResponse(request: Request): Promise<Response> {
  const cache = caches.default;
  const cacheKey = dashboardCacheKey(request);
  const lockKey = dashboardLockKey(cacheKey);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cachedDashboardResponse(cached, "HIT");
  }

  const existingLock = await cache.match(lockKey);
  if (existingLock) {
    const waitResult = await waitForCachedDashboard(cache, cacheKey, lockKey);
    if (waitResult.status === "hit") {
      return cachedDashboardResponse(waitResult.cached, "HIT-WAIT");
    }
    if (waitResult.status === "timeout") {
      const lockStillHeld = await cache.match(lockKey);
      if (lockStillHeld) {
        return jsonResponse(
          {
            success: false,
            error:
              "Dashboard is still being prepared. Please retry shortly.",
          },
          503,
          { "Retry-After": "2", "X-Portal-Cache": "WAIT-TIMEOUT" }
        );
      }
    }
  }

  await cache.put(
    lockKey,
    new Response("1", {
      headers: {
        "Cache-Control": `max-age=${DASHBOARD_LOCK_TTL_SECONDS}`,
      },
    })
  );

  try {
    const cachedAfterLock = await cache.match(cacheKey);
    if (cachedAfterLock) {
      return cachedDashboardResponse(cachedAfterLock, "HIT");
    }

    const url = new URL(request.url);
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
  } finally {
    await cache.delete(lockKey);
  }
}

async function runDashboardRequest(request: Request): Promise<Response> {
  try {
    return await buildDashboardResponse(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  const key = inflightKey(context.request);
  const existing = inFlightByUrl.get(key);
  if (existing) {
    return existing;
  }

  const pending = runDashboardRequest(context.request).then(
    (response) => {
      inFlightByUrl.delete(key);
      return response;
    },
    (error) => {
      inFlightByUrl.delete(key);
      throw error;
    }
  );

  inFlightByUrl.set(key, pending);
  return pending;
};
