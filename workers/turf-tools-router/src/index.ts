import {
  ORCHARD_PAGES_ORIGIN,
  TURF_PORTAL_ORIGIN,
  resolveUpstreamOrigin,
} from "../routing-policy";

function portalTargetUrl(requestUrl: URL): URL {
  const origin = resolveUpstreamOrigin(requestUrl.pathname);
  const target = new URL(requestUrl.pathname + requestUrl.search, origin);
  if (target.pathname === "/portal") {
    target.pathname = "/portal/";
  }
  return target;
}

function rewriteLocationHeader(location: string, requestUrl: URL): string {
  try {
    const parsed = new URL(location, requestUrl.origin);
    for (const origin of [ORCHARD_PAGES_ORIGIN, TURF_PORTAL_ORIGIN]) {
      const pagesHost = new URL(origin).host;
      if (parsed.host === pagesHost) {
        parsed.host = requestUrl.host;
        parsed.protocol = requestUrl.protocol;
        return parsed.toString();
      }
    }
  } catch {
    /* keep original */
  }
  return location;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    const target = portalTargetUrl(requestUrl);
    const originHost = target.host;

    const headers = new Headers(request.headers);
    headers.set("Host", originHost);

    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers(upstream.headers);
    const location = responseHeaders.get("Location");
    if (location) {
      responseHeaders.set("Location", rewriteLocationHeader(location, requestUrl));
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
