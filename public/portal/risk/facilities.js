const Facilities = (() => {
  const MAX_CSV_FACILITIES = 3;
  const MAX_MANUAL_FACILITIES = 1;
  const MAX_TOTAL_FACILITIES = MAX_CSV_FACILITIES + MAX_MANUAL_FACILITIES;
  const COOKIE_USER_FACILITIES = "userFacilities";
  const LEGACY_COOKIE_USER_FACILITY = "userFacility";
  const PORTAL_SETTINGS_COOKIE = "portalSettings";

  function loadPortalSettingsAsFacilityItem() {
    const cookies = document.cookie.split(";");
    const match = cookies.find((c) =>
      c.trim().startsWith(`${PORTAL_SETTINGS_COOKIE}=`)
    );
    if (!match) return null;

    try {
      const jsonStr = decodeURIComponent(match.split("=").slice(1).join("="));
      const settings = JSON.parse(jsonStr);
      const lat = parseFloat(settings.lat);
      const lon = parseFloat(settings.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

      const name =
        String(settings.facilityName || settings.locationName || "").trim() ||
        "ポータル設定の施設";

      return {
        source: "manual",
        id: "portal:settings",
        name,
        latitude: lat,
        longitude: lon,
        fromPortalSettings: true,
      };
    } catch (e) {
      console.error("portalSettings Cookie解析エラー:", e);
      return null;
    }
  }

  function getDisplayFacilityItems() {
    const saved = loadFacilityItemsFromCookie();
    if (saved.length > 0) return saved;

    const portalItem = loadPortalSettingsAsFacilityItem();
    return portalItem ? [portalItem] : [];
  }

  function makeCsvFacilityId(region1, region2, name) {
    const payload = JSON.stringify({ r1: region1, r2: region2, n: name });
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    const urlSafe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `csv:${urlSafe}`;
  }

  function facilityToMapEntry(item, index) {
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    return {
      id: item.id || `slot-${index}`,
      name: item.name,
      latitude: lat,
      longitude: lon,
      source: item.source,
    };
  }

  function normalizeFacilityItems(items) {
    const csv = [];
    const manual = [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      if (raw.source === "manual" && manual.length < MAX_MANUAL_FACILITIES) {
        manual.push({
          source: "manual",
          id: typeof raw.id === "string" ? raw.id : "manual:1",
          name: String(raw.name || ""),
          latitude: Number(raw.latitude),
          longitude: Number(raw.longitude),
        });
      } else if (raw.source === "csv" && csv.length < MAX_CSV_FACILITIES) {
        csv.push({
          source: "csv",
          id:
            typeof raw.id === "string"
              ? raw.id
              : makeCsvFacilityId(raw.region1, raw.region2, raw.name),
          region1: String(raw.region1 || ""),
          region2: String(raw.region2 || ""),
          name: String(raw.name || ""),
          latitude: Number(raw.latitude),
          longitude: Number(raw.longitude),
        });
      }
    }

    const merged = [...csv, ...manual];
    return merged.length > MAX_TOTAL_FACILITIES
      ? merged.slice(0, MAX_TOTAL_FACILITIES)
      : merged;
  }

  function loadFacilityItemsFromCookie() {
    const cookies = document.cookie.split(";");
    const modern = cookies.find((c) =>
      c.trim().startsWith(`${COOKIE_USER_FACILITIES}=`)
    );

    if (modern) {
      try {
        const jsonStr = decodeURIComponent(modern.split("=").slice(1).join("="));
        const parsed = JSON.parse(jsonStr);
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        return normalizeFacilityItems(items);
      } catch (e) {
        console.error("userFacilities Cookie解析エラー:", e);
        return [];
      }
    }

    const legacy = cookies.find((c) =>
      c.trim().startsWith(`${LEGACY_COOKIE_USER_FACILITY}=`)
    );
    if (legacy) {
      try {
        const jsonStr = decodeURIComponent(legacy.split("=").slice(1).join("="));
        const f = JSON.parse(jsonStr);
        if (f && typeof f.name === "string" && f.latitude != null && f.longitude != null) {
          return [
            {
              source: "manual",
              id: "manual:1",
              name: f.name,
              latitude: Number(f.latitude),
              longitude: Number(f.longitude),
            },
          ];
        }
      } catch (e) {
        console.error("userFacility Cookie解析エラー:", e);
      }
    }

    return [];
  }

  function saveFacilityItemsToCookie(items) {
    const normalized = normalizeFacilityItems(items);
    const jsonStr = JSON.stringify({ version: 1, items: normalized });
    const expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `${COOKIE_USER_FACILITIES}=${encodeURIComponent(jsonStr)}; expires=${expires.toUTCString()}; path=/`;
    document.cookie = `${LEGACY_COOKIE_USER_FACILITY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  function getForecastFacilities() {
    return getDisplayFacilityItems().map((item, index) =>
      facilityToMapEntry(item, index)
    );
  }

  function usesPortalSettingsFallback() {
    return (
      loadFacilityItemsFromCookie().length === 0 &&
      loadPortalSettingsAsFacilityItem() !== null
    );
  }

  function getManualFacilityFromCookie() {
    return loadFacilityItemsFromCookie().find((i) => i.source === "manual") || null;
  }

  function clearAllFacilitiesCookie() {
    document.cookie = `${COOKIE_USER_FACILITIES}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `${LEGACY_COOKIE_USER_FACILITY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  return {
    MAX_CSV_FACILITIES,
    MAX_TOTAL_FACILITIES,
    makeCsvFacilityId,
    loadFacilityItemsFromCookie,
    saveFacilityItemsToCookie,
    getForecastFacilities,
    getDisplayFacilityItems,
    loadPortalSettingsAsFacilityItem,
    usesPortalSettingsFallback,
    getManualFacilityFromCookie,
    clearAllFacilitiesCookie,
  };
})();
