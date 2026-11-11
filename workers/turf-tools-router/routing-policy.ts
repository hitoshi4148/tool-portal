/**
 * turf-tools.jp → Pages の振り分けポリシー（芝しごと / 果樹園の境界）
 *
 * 変更時は routing-policy.test.ts を通すこと。
 * 果樹製品本体: https://github.com/hitoshi4148/orchard
 */

export const TURF_PORTAL_ORIGIN = "https://tool-portal-9y2.pages.dev";
export const ORCHARD_PAGES_ORIGIN = "https://orchard-aa7.pages.dev";

/** orchard へプロキシしてよいパス（API のみ。UI パスは禁止） */
export const ORCHARD_PROXY_PATHS: ReadonlyArray<string | RegExp> = [
  "/portal/api/orchard-risk",
  /^\/portal\/api\/orchard-risk\//,
];

/** 芝専用 UI（orchard に向けないことをテストで明示） */
export const TURF_ONLY_PATH_PREFIXES: readonly string[] = [
  "/portal/risk",
  "/portal/spray",
  "/portal/rac",
  "/portal/diagnosis",
];

export function isOrchardProxiedPath(pathname: string): boolean {
  return ORCHARD_PROXY_PATHS.some((rule) =>
    typeof rule === "string" ? pathname === rule : rule.test(pathname)
  );
}

export function isTurfOnlyPath(pathname: string): boolean {
  return TURF_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function resolveUpstreamOrigin(pathname: string): string {
  if (isOrchardProxiedPath(pathname)) {
    return ORCHARD_PAGES_ORIGIN;
  }
  return TURF_PORTAL_ORIGIN;
}
