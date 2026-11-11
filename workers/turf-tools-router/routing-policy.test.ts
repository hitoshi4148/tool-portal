import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORCHARD_PAGES_ORIGIN,
  TURF_PORTAL_ORIGIN,
  isOrchardProxiedPath,
  isTurfOnlyPath,
  resolveUpstreamOrigin,
} from "./routing-policy";

describe("turf-tools routing policy", () => {
  it("keeps turf disease risk map on tool-portal", () => {
    assert.equal(resolveUpstreamOrigin("/portal/risk/"), TURF_PORTAL_ORIGIN);
    assert.equal(resolveUpstreamOrigin("/portal/risk"), TURF_PORTAL_ORIGIN);
    assert.ok(isTurfOnlyPath("/portal/risk"));
    assert.ok(!isOrchardProxiedPath("/portal/risk"));
  });

  it("proxies only orchard-risk API to orchard", () => {
    assert.equal(
      resolveUpstreamOrigin("/portal/api/orchard-risk"),
      ORCHARD_PAGES_ORIGIN
    );
    assert.ok(isOrchardProxiedPath("/portal/api/orchard-risk"));
  });

  it("routes lab and dashboard to turf portal by default", () => {
    assert.equal(resolveUpstreamOrigin("/portal/lab/"), TURF_PORTAL_ORIGIN);
    assert.equal(
      resolveUpstreamOrigin("/portal/api/dashboard"),
      TURF_PORTAL_ORIGIN
    );
  });
});
