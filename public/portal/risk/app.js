document.addEventListener("DOMContentLoaded", () => {
  const mapContainer = document.getElementById("risk-map");
  const mapStatus = document.getElementById("map-status");
  const settingsPanel = document.getElementById("facility-settings-panel");
  const settingsToggleBtn = document.getElementById("settings-toggle-btn");
  const facilitySummary = document.getElementById("facility-summary");

  let map = null;
  let markersLayer = null;

  DiseaseRiskUI.init();

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      DiseaseRiskUI.closeDiseaseLogicModal();
    }
  });

  settingsToggleBtn.addEventListener("click", () => {
    const hidden = settingsPanel.classList.toggle("hidden");
    settingsToggleBtn.textContent = hidden ? "施設を設定" : "施設設定を閉じる";
    window.setTimeout(() => refreshMapLayout(), 150);
  });

  function updateFacilitySummary() {
    const saved = Facilities.loadFacilityItemsFromCookie();
    if (saved.length > 0) {
      facilitySummary.textContent = saved.map((i) => i.name).join("、");
    } else if (Facilities.usesPortalSettingsFallback()) {
      const portal = Facilities.loadPortalSettingsAsFacilityItem();
      facilitySummary.textContent = `${portal.name}（ポータル設定）`;
    } else {
      facilitySummary.textContent = "なし";
    }
    settingsToggleBtn.textContent =
      saved.length > 0 || Facilities.usesPortalSettingsFallback()
        ? "施設設定を変更"
        : "施設を設定";
  }

  function setMapStatus(message, isError = false) {
    mapStatus.textContent = message;
    mapStatus.classList.toggle("map-status--error", isError);
    mapStatus.classList.remove("hidden");
  }

  function clearMapStatus() {
    mapStatus.classList.add("hidden");
  }

  function initMap() {
    map = L.map(mapContainer, {
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView([36.5, 138.0], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    window.setTimeout(() => {
      map.invalidateSize(true);
    }, 0);
    window.setTimeout(() => {
      map.invalidateSize(true);
    }, 250);
  }

  function refreshMapLayout() {
    if (map) {
      map.invalidateSize(true);
    }
  }

  if (!mapContainer || typeof L === "undefined") {
    setMapStatus(
      typeof L === "undefined"
        ? "地図ライブラリの読み込みに失敗しました。ページを再読み込みしてください。"
        : "地図コンテナが見つかりません。",
      true
    );
  } else {
    initMap();
  }

  FacilitySettings.init({
    panel: settingsPanel,
    onUpdated: () => {
      updateFacilitySummary();
      loadMapData();
    },
  });

  updateFacilitySummary();
  loadMapData();

  function getRadiusFromRisk(maxRisk) {
    if (maxRisk === null || maxRisk === undefined || Number.isNaN(maxRisk)) {
      return 12.5;
    }
    return 12.5 + (maxRisk / 100) * 12.5;
  }

  function createDiseaseLabelIcon(diseaseName, riskValue, radius) {
    if (!diseaseName || riskValue === null) {
      return L.divIcon({ className: "disease-label-marker", html: "", iconSize: [0, 0] });
    }
    return L.divIcon({
      className: "disease-label-marker",
      html: `<div class="disease-label">${escapeHtml(diseaseName)} ${riskValue}%</div>`,
      iconSize: [120, 24],
      iconAnchor: [0, 12],
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadMapData() {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const facilities = Facilities.getForecastFacilities();

    if (facilities.length === 0) {
      setMapStatus("施設を設定すると、地図上に病害リスクが表示されます。");
      return;
    }

    setMapStatus("病害リスクを取得中…");

    try {
      const response = await fetch("/portal/api/risk-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilities: facilities.map((f) => ({
            id: f.id,
            name: f.name,
            latitude: f.latitude,
            longitude: f.longitude,
          })),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "病害リスクの取得に失敗しました");
      }

      const resultMap = new Map(
        (data.results || []).map((item) => [item.id, item])
      );

      const bounds = [];

      facilities.forEach((facility) => {
        const result = resultMap.get(facility.id);
        if (!result || !result.success) {
          return;
        }

        const forecast = {
          tomorrow: result.tomorrow,
          dayAfterTomorrow: result.dayAfterTomorrow,
        };

        const maxRisk = DiseaseRiskUI.getMaxRiskFromForecast(forecast);
        const maxDisease = DiseaseRiskUI.getMaxRiskDiseaseFromForecast(forecast);
        const color = DiseaseRiskUI.getRiskColor(maxRisk);
        const radius = getRadiusFromRisk(maxRisk);

        const marker = L.circleMarker([facility.latitude, facility.longitude], {
          radius,
          fillColor: color,
          fillOpacity: 0.7,
          color: "#FFFFFF",
          weight: 3,
          opacity: 1,
        });

        marker.bindTooltip(facility.name, {
          permanent: true,
          direction: "top",
          offset: [0, -radius - 5],
          className: "facility-name-tooltip",
        });

        const popupContent = document.createElement("div");
        popupContent.innerHTML = DiseaseRiskUI.buildFacilityPopupHtml(
          facility.name,
          forecast
        );
        DiseaseRiskUI.bindLogicButtons(popupContent);

        marker.bindPopup(popupContent, {
          maxWidth: 420,
          minWidth: 280,
          className: "risk-map-popup",
        });

        marker.addTo(markersLayer);

        if (maxDisease.name && maxDisease.risk !== null) {
          L.marker([facility.latitude, facility.longitude], {
            icon: createDiseaseLabelIcon(maxDisease.name, maxDisease.risk, radius),
            interactive: false,
          }).addTo(markersLayer);
        }

        bounds.push([facility.latitude, facility.longitude]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 10);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      } else {
        setMapStatus("施設は見つかりましたが、リスクデータを地図に反映できませんでした。", true);
        refreshMapLayout();
        return;
      }

      clearMapStatus();
      refreshMapLayout();
    } catch (err) {
      setMapStatus(err.message || "データ取得に失敗しました", true);
    }
  }
});
