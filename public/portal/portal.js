const COOKIE_NAME = "portalSettings";
const DASHBOARD_API = "/portal/api/dashboard";
const GEOCODE_API = "/portal/api/geocode";

const WEATHER_ICONS = {
  晴れ: "☀️",
  くもり: "☁️",
  弱い雨: "🌦️",
  雨強め: "🌧️",
};

function setCookie(name, value, days = 30) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie =
    name + "=" + encodeURIComponent(value) + ";expires=" + date.toUTCString() + ";path=/";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    let c = part;
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }
  return null;
}

function getDefaultSettings() {
  return {
    facilityName: "",
    lat: "",
    lon: "",
    locationType: "未指定",
    greenType: "未指定",
    overseed: "無",
    warmGrass: "未指定(C4)",
    coolGrass: "未指定(C3)",
    locationName: "",
  };
}

function formatPortalTitle(facilityName) {
  const name = facilityName.trim();
  return name ? `${name}　芝しごとポータル` : "芝しごとポータル";
}

function updatePortalTitle(facilityName) {
  const title = formatPortalTitle(facilityName);
  document.getElementById("portal-title").textContent = title;
  document.title = title;
}

const WARM_GRASS_LEGACY = {
  未指定: "未指定(C4)",
};

const COOL_GRASS_LEGACY = {
  未指定: "未指定(C3)",
  ベント: "ベントグラス",
  ニューベント: "クリーピングベントグラス",
  ライグラス: "ペレニアルライグラス",
  ブルーグラス: "ケンタッキーブルーグラス",
  フェスク: "トールフェスク",
};

function normalizeGrassSettings(settings) {
  return {
    ...settings,
    warmGrass: WARM_GRASS_LEGACY[settings.warmGrass] ?? settings.warmGrass,
    coolGrass: COOL_GRASS_LEGACY[settings.coolGrass] ?? settings.coolGrass,
  };
}

function loadSettings() {
  const defaults = getDefaultSettings();

  const legacyLat = getCookie("forecast_lat");
  const legacyLon = getCookie("forecast_lon");
  if (legacyLat && legacyLon) {
    defaults.lat = legacyLat;
    defaults.lon = legacyLon;
  }

  const raw = getCookie(COOKIE_NAME);
  if (!raw) {
    return defaults;
  }

  try {
    return normalizeGrassSettings({ ...defaults, ...JSON.parse(raw) });
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  setCookie(COOKIE_NAME, JSON.stringify(settings));
}

function hasLocation(settings) {
  return settings.lat !== "" && settings.lon !== "";
}

function applySettingsToForm(settings) {
  document.getElementById("settings-facility-name").value = settings.facilityName ?? "";
  document.getElementById("settings-lat").value = settings.lat;
  document.getElementById("settings-lon").value = settings.lon;

  document
    .querySelector(`input[name="locationType"][value="${settings.locationType}"]`)
    ?.click();
  document
    .querySelector(`input[name="greenType"][value="${settings.greenType}"]`)
    ?.click();
  document
    .querySelector(`input[name="overseed"][value="${settings.overseed}"]`)
    ?.click();

  document.getElementById("warmGrass").value = settings.warmGrass;
  document.getElementById("coolGrass").value = settings.coolGrass;
}

function readSettingsFromForm() {
  const previous = loadSettings();
  return {
    facilityName: document.getElementById("settings-facility-name").value.trim(),
    lat: document.getElementById("settings-lat").value.trim(),
    lon: document.getElementById("settings-lon").value.trim(),
    locationType: document.querySelector('input[name="locationType"]:checked').value,
    greenType: document.querySelector('input[name="greenType"]:checked').value,
    overseed: document.querySelector('input[name="overseed"]:checked').value,
    warmGrass: document.getElementById("warmGrass").value,
    coolGrass: document.getElementById("coolGrass").value,
    locationName: previous.locationName,
  };
}

function openSettingsModal() {
  applySettingsToForm(loadSettings());
  document.getElementById("settings-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function showLocationStatus(message, isError = false) {
  const el = document.getElementById("location-status");
  el.textContent = message;
  el.className = "location-status" + (isError ? " error" : "");
}

function renderWeatherPlaceholder(message) {
  const area = document.getElementById("weather-area");
  area.innerHTML = `<p class="weather-placeholder">${message}</p>`;
}

function formatHourLabel(hour) {
  return `${hour}時`;
}

function formatDayTitle(dateKey, dayIndex) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[dt.getDay()];
  const prefix = dayIndex === 0 ? "今日" : dayIndex === 1 ? "明日" : "";
  const dateText = `${month}/${day}(${weekday})`;
  return prefix ? `${prefix} ${dateText}` : dateText;
}

function getJstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatDiseaseTargetLabel(daysFromToday, hour = 6) {
  const { year, month, day } = getJstDateParts();
  const target = new Date(Date.UTC(year, month - 1, day));
  target.setUTCDate(target.getUTCDate() + daysFromToday);
  const m = target.getUTCMonth() + 1;
  const d = target.getUTCDate();
  return `${m}/${d} ${hour}:00`;
}

function renderWeatherWidget(hourly, days, locationName) {
  const area = document.getElementById("weather-area");

  if (hourly.length === 0) {
    renderWeatherPlaceholder("該当する天気予報が見つかりませんでした。");
    return;
  }

  const dayMap = new Map(days.map((day, index) => [day.dateKey, { ...day, index }]));
  const grouped = new Map();

  hourly.forEach((row) => {
    if (!grouped.has(row.dateKey)) {
      grouped.set(row.dateKey, []);
    }
    grouped.get(row.dateKey).push(row);
  });

  let html = '<div class="weather-widget"><div class="weather-scroll">';

  grouped.forEach((rows, dateKey) => {
    const day = dayMap.get(dateKey);
    if (!day) {
      return;
    }

    const icon = WEATHER_ICONS[day.condition] || "☁️";
    const placeHtml =
      day.index === 0 && locationName
        ? `<div class="weather-day-place">${locationName}</div>`
        : "";

    html += `<div class="weather-day-block">
      <div class="weather-day-summary">
        <div class="weather-day-main">
          <div class="weather-day-date">${formatDayTitle(dateKey, day.index)}</div>
          ${placeHtml}
          <div class="weather-day-icon">${icon}</div>
        </div>
        <div class="weather-day-stats">
          <span class="weather-day-stat">平均気温 ${day.avgTemp.toFixed(1)}°C</span>
          <span class="weather-day-stat">平均湿度 ${Math.round(day.avgHumidity)}%</span>
          <span class="weather-day-stat">平均風速 ${day.avgWind.toFixed(1)}m/s</span>
        </div>
      </div>
      <div class="weather-hour-row">`;

    rows.forEach((row) => {
      const hourIcon = WEATHER_ICONS[row.condition] || "☁️";
      html += `<div class="weather-hour-cell">
        <div class="weather-hour-time">${formatHourLabel(row.hour)}</div>
        <div class="weather-hour-icon">${hourIcon}</div>
        <div class="weather-hour-temp">${row.temp.toFixed(0)}°</div>
        <div class="weather-hour-meta">${Math.round(row.humidity)}%</div>
        <div class="weather-hour-meta">${row.wind.toFixed(1)}m/s</div>
        <div class="weather-hour-precip">${row.precip.toFixed(1)}mm</div>
      </div>`;
    });

    html += "</div></div>";
  });

  html += "</div></div>";
  area.innerHTML = html;
}

async function fetchLocationName(lat, lon) {
  const response = await fetch(
    `${GEOCODE_API}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
  );
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "地名の取得に失敗しました");
  }

  return data.name || "";
}

async function ensureLocationName(settings) {
  if (settings.locationName || !hasLocation(settings)) {
    return settings;
  }

  try {
    settings.locationName = await fetchLocationName(settings.lat, settings.lon);
    if (settings.locationName) {
      saveSettings(settings);
    }
  } catch {
    // 地名取得失敗時も天気予報は表示する
  }

  return settings;
}

async function loadPortalData() {
  let settings = loadSettings();

  if (!hasLocation(settings)) {
    renderWeatherPlaceholder("緯度・経度未設定");
    renderDiseaseRiskPlaceholder("緯度・経度未設定");
    renderGpPlaceholder("緯度・経度未設定");
    return;
  }

  settings = await ensureLocationName(settings);

  const weatherLoading = document.getElementById("weather-loading");
  const insightsLoading = document.getElementById("disease-risk-loading");
  const weatherError = document.getElementById("weather-error");
  const diseaseError = document.getElementById("disease-risk-error");
  const gpError = document.getElementById("gp-chart-error");

  weatherLoading.classList.remove("hidden");
  insightsLoading.classList.remove("hidden");
  weatherError.classList.add("hidden");
  diseaseError.classList.add("hidden");
  gpError.classList.add("hidden");
  renderWeatherPlaceholder("");
  renderDiseaseRiskPlaceholder("");
  renderGpPlaceholder("");

  try {
    const params = new URLSearchParams({
      lat: settings.lat,
      lon: settings.lon,
      warmGrass: settings.warmGrass,
      coolGrass: settings.coolGrass,
    });
    const response = await fetch(`${DASHBOARD_API}?${params.toString()}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "データの取得に失敗しました");
    }

    renderWeatherWidget(
      data.weather.hourly,
      data.weather.days,
      settings.locationName || ""
    );
    renderDiseaseRiskPanels(
      {
        tomorrow: data.diseaseRisk.tomorrow,
        dayAfterTomorrow: data.diseaseRisk.dayAfterTomorrow,
      },
      settings.locationName || ""
    );
    renderGpChart(data.growthPotential);
  } catch (err) {
    weatherError.textContent = err.message;
    diseaseError.textContent = err.message;
    gpError.textContent = err.message;
    weatherError.classList.remove("hidden");
    diseaseError.classList.remove("hidden");
    gpError.classList.remove("hidden");
    renderWeatherPlaceholder("天気予報を表示できませんでした。");
    renderDiseaseRiskPlaceholder("病害リスクを表示できませんでした。");
    renderGpPlaceholder("GPを表示できませんでした。");
  } finally {
    weatherLoading.classList.add("hidden");
    insightsLoading.classList.add("hidden");
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    showLocationStatus("このブラウザは位置情報をサポートしていません", true);
    return;
  }

  showLocationStatus("位置情報を取得中...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude.toFixed(4);
      const lon = position.coords.longitude.toFixed(4);
      document.getElementById("settings-lat").value = lat;
      document.getElementById("settings-lon").value = lon;

      showLocationStatus("地名を取得中...");
      try {
        const name = await fetchLocationName(lat, lon);
        showLocationStatus(
          name ? `現在地を取得しました（${name}）` : "現在地を取得しました"
        );
      } catch {
        showLocationStatus("現在地を取得しました（地名は取得できませんでした）");
      }
    },
    (err) => {
      showLocationStatus("位置情報の取得に失敗しました: " + err.message, true);
    }
  );
}

async function handleSaveSettings() {
  const settings = readSettingsFromForm();

  if (!settings.lat || !settings.lon) {
    showLocationStatus("緯度と経度を入力してください", true);
    return;
  }

  showLocationStatus("地名を取得中...");
  try {
    settings.locationName = await fetchLocationName(settings.lat, settings.lon);
  } catch {
    settings.locationName = "";
  }

  saveSettings(settings);
  updatePortalTitle(settings.facilityName);
  showLocationStatus(
    settings.locationName
      ? `設定を保存しました（${settings.locationName}）`
      : "設定を保存しました"
  );

  const btn = document.getElementById("save-settings-btn");
  const originalText = btn.textContent;
  btn.textContent = "保存しました";
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
    closeSettingsModal();
    loadPortalData();
  }, 600);
}

function getRiskColor(risk) {
  if (risk === null || risk === undefined || Number.isNaN(risk)) {
    return "#808080";
  }
  if (risk < 20) return "#3B82F6";
  if (risk < 40) return "#10B981";
  if (risk < 60) return "#FBBF24";
  if (risk < 80) return "#F97316";
  return "#EF4444";
}

const DISEASE_ITEMS = [
  { key: "dollarSpot", name: "ダラースポット" },
  { key: "brownPatch", name: "ブラウンパッチ" },
  { key: "pythium", name: "ピシウム" },
  { key: "anthracnose", name: "炭疽病" },
  { key: "largePatch", name: "ラージパッチ" },
];

const DISEASE_LOGIC = {
  dollarSpot: {
    title: "ダラースポット",
    subtitle: "Dollar Spot",
    description: "日次データを使用した5日移動平均による評価",
    formula: "移動平均(5日) = Σ(気温・湿度) / 5",
    conditions: [
      "気温: 15-30℃でリスク上昇",
      "湿度: 60%以上でリスク上昇",
      "気温30℃以上で減衰",
      "リスク = 気温リスク(50%) + 湿度リスク(50%)",
    ],
    calculationHtml: `<div class="disease-logic-calc-block">
      <div>気温リスク:</div>
      <div>15-25℃: 線形上昇 (0→50%)</div>
      <div>25-30℃: 線形減少 (50%→0%)</div>
      <div class="disease-logic-calc-gap">湿度リスク:</div>
      <div>60-100%: 線形上昇 (0→50%)</div>
      <div class="disease-logic-calc-gap">減衰係数:</div>
      <div>30℃超: (40-気温)/10倍</div>
    </div>`,
  },
  brownPatch: {
    title: "ブラウンパッチ",
    subtitle: "Brown Patch",
    description: "時間単位データによる夜間条件評価",
    formula: "リスク比 = 該当時間数 / 夜間総時間数",
    conditions: [
      "評価時間: 20:00-翌6:00",
      "条件: 気温≥20℃ かつ 湿度≥90%",
      "リスク = 該当時間の割合×2",
      "50%以上で最大リスク",
    ],
    calculationHtml: `<div class="disease-logic-calc-block">
      <div>夜間時間を抽出</div>
      <div>条件該当時間をカウント</div>
      <div class="disease-logic-calc-gap">リスク計算:</div>
      <div>割合 = 該当/夜間総数</div>
      <div>リスク% = 割合×100 ×2</div>
      <div class="disease-logic-calc-gap">上限: 100%</div>
    </div>`,
  },
  pythium: {
    title: "ピシウム",
    subtitle: "Pythium",
    description: "直近7日間の条件該当日数による指数評価",
    formula: "リスク = 100 × (1 - e^(-0.3×日数))",
    conditions: [
      "評価期間: 直近7日",
      "条件: 気温≥25℃ かつ 湿度≥85%",
      "該当日数を指数関数で評価",
      "7日間で最大リスク",
    ],
    calculationHtml: `<div class="disease-logic-calc-block">
      <div>条件該当日数をカウント</div>
      <div class="disease-logic-calc-gap">指数関数:</div>
      <div>risk = 100×(1-e^(-0.3×days))</div>
      <div class="disease-logic-calc-gap">例:</div>
      <div>1日: ~26%</div>
      <div>3日: ~59%</div>
      <div>7日: ~88%</div>
    </div>`,
  },
  anthracnose: {
    title: "炭疽病",
    subtitle: "Anthracnose",
    description: "日次データによる気温・高温継続評価",
    formula: "リスク = 気温リスク + 高温継続リスク + 湿度補助",
    conditions: [
      "評価期間: 直近10日",
      "気温: 15-30℃でリスク上昇",
      "高温: 25℃超が5日以上継続で高リスク",
      "湿度: 70%以上で補助",
    ],
    calculationHtml: `<div class="disease-logic-calc-block">
      <div>1. 気温リスク:</div>
      <div>15-25℃: 線形 (0→10点/日)</div>
      <div>25-30℃: 線形 (10→0点/日)</div>
      <div class="disease-logic-calc-gap">2. 高温継続:</div>
      <div>5日以上: +(日数-5)×10点</div>
      <div class="disease-logic-calc-gap">3. 湿度補助:</div>
      <div>70%以上: +(湿度-70)/3%</div>
    </div>`,
  },
  largePatch: {
    title: "ラージパッチ",
    subtitle: "Large Patch",
    description: "直近8-10日間の気温積算評価",
    formula: "リスク = Σ(日リスク) / (評価日数×10) × 100",
    conditions: [
      "評価期間: 直近8-10日",
      "気温: 10-20℃でリスク上昇",
      "リセット: 25℃超 または 8℃未満",
      "積算値で評価",
    ],
    calculationHtml: `<div class="disease-logic-calc-block">
      <div>日リスク計算:</div>
      <div>10-15℃: 線形 (0→10点)</div>
      <div>15-20℃: 線形 (10→0点)</div>
      <div class="disease-logic-calc-gap">リセット条件:</div>
      <div>25℃超 または 8℃未満</div>
      <div class="disease-logic-calc-gap">リスク =</div>
      <div>積算値 / (日数×10) ×100%</div>
    </div>`,
  },
};

function buildDiseaseLogicHtml(key) {
  const logic = DISEASE_LOGIC[key];
  if (!logic) {
    return "";
  }

  const conditionsHtml = logic.conditions
    .map((condition) => `<li>${condition}</li>`)
    .join("");

  return `<article class="disease-logic-content">
    <p class="disease-logic-subtitle">${logic.subtitle}</p>
    <p class="disease-logic-description">${logic.description}</p>
    <div class="disease-logic-formula">${logic.formula}</div>
    <section class="disease-logic-section">
      <h3>条件</h3>
      <ul class="disease-logic-list">${conditionsHtml}</ul>
    </section>
    <section class="disease-logic-section disease-logic-calculation">
      <h3>計算式</h3>
      ${logic.calculationHtml}
    </section>
    <p class="disease-logic-note">※ すべてのリスク値は0-100%に正規化されます</p>
    <p class="disease-logic-note">※ データ不足の場合は表示されません</p>
  </article>`;
}

function openDiseaseLogicModal(key) {
  const logic = DISEASE_LOGIC[key];
  if (!logic) {
    return;
  }

  document.getElementById("disease-logic-title").textContent = `${logic.title} — 判定ロジック`;
  document.getElementById("disease-logic-body").innerHTML = buildDiseaseLogicHtml(key);
  document.getElementById("disease-logic-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeDiseaseLogicModal() {
  document.getElementById("disease-logic-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function renderDiseaseRiskPlaceholder(message) {
  const area = document.getElementById("disease-risk-area");
  area.innerHTML = `<p class="weather-placeholder">${message}</p>`;
}

function buildRiskValueHtml(risk) {
  const riskValue =
    risk !== null && risk !== undefined && !Number.isNaN(risk)
      ? Math.round(risk)
      : null;
  const color = getRiskColor(risk);
  return `<div class="disease-risk-item-value" style="background-color: ${color}">
    ${riskValue !== null ? `${riskValue}%` : "?"}
  </div>`;
}

function buildCombinedDiseaseRiskPanelHtml(
  title,
  footerLabel,
  firstLabel,
  secondLabel,
  firstRisks,
  secondRisks
) {
  let html = `<div class="disease-risk-panel disease-risk-panel--combined">
    <h3 class="disease-risk-title">${title}</h3>
    <div class="disease-risk-table">
      <div class="disease-risk-table-header">
        <div class="disease-risk-table-name"></div>
        <div class="disease-risk-table-col">${firstLabel}</div>
        <div class="disease-risk-table-col">${secondLabel}</div>
      </div>
      <div class="disease-risk-list">`;

  DISEASE_ITEMS.forEach(({ key, name }) => {
    html += `<div class="disease-risk-item">
      <div class="disease-risk-item-name">
        <span class="disease-risk-item-label">${name}</span>
        <button type="button" class="disease-logic-btn" data-disease-key="${key}">判定ロジック</button>
      </div>
      <div class="disease-risk-item-values">
        ${buildRiskValueHtml(firstRisks[key])}
        ${buildRiskValueHtml(secondRisks[key])}
      </div>
    </div>`;
  });

  html += `</div>
    </div>
    <p class="disease-risk-footer">${footerLabel}</p>
  </div>`;

  return html;
}

function renderDiseaseRiskPanels(forecast, locationName) {
  const area = document.getElementById("disease-risk-area");
  const titleSuffix = locationName ? ` — ${locationName}` : "";
  const tomorrowLabel = formatDiseaseTargetLabel(1);
  const dayAfterTomorrowLabel = formatDiseaseTargetLabel(2);

  area.innerHTML = buildCombinedDiseaseRiskPanelHtml(
    `病害リスク${titleSuffix}`,
    `予測時刻: ${tomorrowLabel} / ${dayAfterTomorrowLabel} 時点`,
    tomorrowLabel,
    dayAfterTomorrowLabel,
    forecast.tomorrow,
    forecast.dayAfterTomorrow
  );
}

function renderGpPlaceholder(message) {
  const area = document.getElementById("gp-chart-area");
  area.innerHTML = `<p class="weather-placeholder">${message}</p>`;
}

function buildGpSeriesPoints(monthlyGp, padLeft, padTop, chartWidth, chartHeight) {
  return monthlyGp.map((gp, index) => {
    const value = gp ?? 0;
    const x = padLeft + (index / 11) * chartWidth;
    const y = padTop + chartHeight - value * chartHeight;
    return { x, y, value: gp, month: index + 1 };
  });
}

function buildSmoothCurvePath(points) {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(index - 1, 0)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(index + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function getTodayChartX(padLeft, chartWidth, date = new Date()) {
  const { year, month, day } = getJstDateParts(date);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthProgress = month - 1 + (day - 1) / daysInMonth;
  return padLeft + (monthProgress / 11) * chartWidth;
}

function formatTodayChartLabel(date = new Date()) {
  const { month, day } = getJstDateParts(date);
  return `${month}/${day}`;
}

function buildTodayAnnotationSvg(padLeft, padTop, chartWidth, chartHeight) {
  const x = getTodayChartX(padLeft, chartWidth);
  const label = formatTodayChartLabel();
  const lineBottom = padTop + chartHeight;
  const labelY = padTop - 4;

  return `<g class="gp-today-annotation" aria-label="今日 ${label}">
    <line x1="${x.toFixed(1)}" y1="${padTop.toFixed(1)}" x2="${x.toFixed(1)}" y2="${lineBottom.toFixed(1)}" class="gp-today-line"></line>
    <rect x="${(x - 17).toFixed(1)}" y="${(labelY - 11).toFixed(1)}" width="34" height="13" rx="3" class="gp-today-label-bg"></rect>
    <text x="${x.toFixed(1)}" y="${(labelY - 1).toFixed(1)}" class="gp-today-label" text-anchor="middle">${label}</text>
  </g>`;
}

const GP_SERIES_STYLES = {
  warm: {
    lineClass: "gp-line-warm",
    pointClass: "gp-point-warm",
    legendClass: "gp-legend-warm",
    showPoints: true,
  },
  cool: {
    lineClass: "gp-line-cool",
    pointClass: "gp-point-cool",
    legendClass: "gp-legend-cool",
    showPoints: true,
  },
  warmDefault: {
    lineClass: "gp-line-warm-default",
    pointClass: "gp-point-warm-default",
    legendClass: "gp-legend-warm-default",
    showPoints: false,
  },
  coolDefault: {
    lineClass: "gp-line-cool-default",
    pointClass: "gp-point-cool-default",
    legendClass: "gp-legend-cool-default",
    showPoints: false,
  },
};

function buildGpChartSvg(data) {
  const width = 340;
  const height = 228;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 20;
  const padBottom = 28;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const monthLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const gridLines = [0, 0.5, 1]
    .map((tick) => {
      const y = padTop + chartHeight - tick * chartHeight;
      const label = `${Math.round(tick * 100)}%`;
      return `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${(padLeft + chartWidth).toFixed(1)}" y2="${y.toFixed(1)}" class="gp-grid-line"></line>
        <text x="${padLeft - 6}" y="${(y + 4).toFixed(1)}" class="gp-axis-label" text-anchor="end">${label}</text>`;
    })
    .join("");

  const monthTicks = monthLabels
    .map((label, index) => {
      const x = padLeft + (index / 11) * chartWidth;
      return `<text x="${x.toFixed(1)}" y="${(height - 8).toFixed(1)}" class="gp-month-label" text-anchor="middle">${label}</text>`;
    })
    .join("");

  const seriesPaths = data.series
    .map((series) => {
      const style = GP_SERIES_STYLES[series.key] ?? GP_SERIES_STYLES.warm;
      const points = buildGpSeriesPoints(
        series.monthlyGp,
        padLeft,
        padTop,
        chartWidth,
        chartHeight
      );
      const curvePath = buildSmoothCurvePath(points);
      const markers = style.showPoints
        ? points
            .map((point) => {
              if (point.value === null || Number.isNaN(point.value)) {
                return "";
              }
              const percent = Math.round(point.value * 100);
              return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3" class="${style.pointClass}"></circle>
                <title>${series.label} ${point.month}月: ${percent}%</title>`;
            })
            .join("")
        : "";

      return `<path d="${curvePath}" class="gp-line ${style.lineClass}"></path>${markers}`;
    })
    .join("");

  const todayAnnotation = buildTodayAnnotationSvg(padLeft, padTop, chartWidth, chartHeight);

  return `<svg class="gp-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Growth Potential グラフ">
    ${gridLines}
    ${seriesPaths}
    ${todayAnnotation}
    ${monthTicks}
  </svg>`;
}

function renderGpChart(data) {
  const area = document.getElementById("gp-chart-area");
  const legendHtml = data.series
    .map((series) => {
      const style = GP_SERIES_STYLES[series.key] ?? GP_SERIES_STYLES.warm;
      return `<span class="gp-legend-item ${style.legendClass}">${series.label}</span>`;
    })
    .join("");

  const tableHeaders = data.series
    .map((series) => `<th>${series.label}</th>`)
    .join("");

  const gpTableRows = data.monthlyTemperatures
    .map((temp, index) => {
      const tempText = temp === null ? "—" : `${temp.toFixed(1)}℃`;
      const gpCells = data.series
        .map((series) => {
          const gp = series.monthlyGp[index];
          const gpText = gp === null ? "—" : `${Math.round(gp * 100)}%`;
          return `<td>${gpText}</td>`;
        })
        .join("");
      return `<tr>
        <td>${index + 1}月</td>
        <td>${tempText}</td>
        ${gpCells}
      </tr>`;
    })
    .join("");

  const footerText = data.series
    .map(
      (series) =>
        `${series.label} 育成適温 ${series.optimum}℃ / 分散 ${series.variance}`
    )
    .join(" — ");

  area.innerHTML = `<div class="gp-chart-panel">
    <h3 class="gp-chart-title">Growth Potential (GP)</h3>
    <p class="gp-chart-subtitle">${data.year}年 月平均気温</p>
    <div class="gp-chart-legend">${legendHtml}</div>
    <div class="gp-chart-body">
      ${buildGpChartSvg(data)}
    </div>
    <details class="gp-chart-details">
      <summary>月別データ</summary>
      <table class="gp-chart-table">
        <thead>
          <tr><th>月</th><th>気温</th>${tableHeaders}</tr>
        </thead>
        <tbody>${gpTableRows}</tbody>
      </table>
    </details>
    <p class="gp-chart-footer">${footerText}</p>
  </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("settings-open-btn").addEventListener("click", openSettingsModal);
  document.getElementById("settings-close-btn").addEventListener("click", closeSettingsModal);
  document.getElementById("settings-backdrop").addEventListener("click", closeSettingsModal);
  document.getElementById("get-current-location-btn").addEventListener("click", getCurrentLocation);
  document.getElementById("save-settings-btn").addEventListener("click", handleSaveSettings);
  document.getElementById("disease-logic-close-btn").addEventListener("click", closeDiseaseLogicModal);
  document.getElementById("disease-logic-backdrop").addEventListener("click", closeDiseaseLogicModal);

  document.getElementById("disease-risk-area").addEventListener("click", (event) => {
    const button = event.target.closest(".disease-logic-btn");
    if (!button) {
      return;
    }
    openDiseaseLogicModal(button.dataset.diseaseKey);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSettingsModal();
      closeDiseaseLogicModal();
    }
  });

  loadPortalData();
  updatePortalTitle(loadSettings().facilityName);
});
