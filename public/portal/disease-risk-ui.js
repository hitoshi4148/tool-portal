const DiseaseRiskUI = (() => {
  function getJstDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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
    if (!logic) return "";

    const conditionsHtml = logic.conditions.map((condition) => `<li>${condition}</li>`).join("");

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
    if (!logic) return;

    document.getElementById("disease-logic-title").textContent = `${logic.title} — 判定ロジック`;
    document.getElementById("disease-logic-body").innerHTML = buildDiseaseLogicHtml(key);
    document.getElementById("disease-logic-modal").classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeDiseaseLogicModal() {
    document.getElementById("disease-logic-modal").classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function buildRiskValueHtml(risk) {
    const riskValue =
      risk !== null && risk !== undefined && !Number.isNaN(risk) ? Math.round(risk) : null;
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

  function buildForecastPanelHtml(forecast, options = {}) {
    const title = options.title ?? "病害リスク";
    const tomorrowLabel = formatDiseaseTargetLabel(1);
    const dayAfterTomorrowLabel = formatDiseaseTargetLabel(2);
    const footerLabel =
      options.footerLabel ??
      `予測時刻: ${tomorrowLabel} / ${dayAfterTomorrowLabel} 時点`;

    return buildCombinedDiseaseRiskPanelHtml(
      title,
      footerLabel,
      tomorrowLabel,
      dayAfterTomorrowLabel,
      forecast.tomorrow,
      forecast.dayAfterTomorrow
    );
  }

  function renderDiseaseRiskPanels(container, forecast) {
    if (!container) return;
    container.innerHTML = buildForecastPanelHtml(forecast);
  }

  function getRiskValues(risks) {
    if (!risks) return [];
    return Object.values(risks).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  }

  function getMaxRisk(risks) {
    const values = getRiskValues(risks);
    return values.length > 0 ? Math.max(...values) : null;
  }

  function getMaxRiskFromForecast(forecast) {
    const tomorrowMax = getMaxRisk(forecast?.tomorrow);
    const dayAfterMax = getMaxRisk(forecast?.dayAfterTomorrow);
    const values = [tomorrowMax, dayAfterMax].filter((v) => v !== null);
    return values.length > 0 ? Math.max(...values) : null;
  }

  function getMaxRiskDiseaseFromForecast(forecast) {
    let maxRisk = null;
    let maxKey = null;

    for (const dayKey of ["tomorrow", "dayAfterTomorrow"]) {
      const risks = forecast?.[dayKey];
      if (!risks) continue;
      for (const { key, name } of DISEASE_ITEMS) {
        const value = risks[key];
        if (value !== null && value !== undefined && !Number.isNaN(value)) {
          if (maxRisk === null || value > maxRisk) {
            maxRisk = value;
            maxKey = name;
          }
        }
      }
    }

    return {
      name: maxKey,
      risk: maxRisk !== null ? Math.round(maxRisk) : null,
    };
  }

  function buildFacilityPopupHtml(facilityName, forecast) {
    const escapedName = String(facilityName)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="risk-popup">
      <h3 class="risk-popup-title">${escapedName}</h3>
      ${buildForecastPanelHtml(forecast)}
    </div>`;
  }

  function bindLogicButtons(container) {
    if (!container || container.dataset.logicBound === "true") return;
    container.dataset.logicBound = "true";
    container.addEventListener("click", (event) => {
      const button = event.target.closest(".disease-logic-btn");
      if (!button) return;
      openDiseaseLogicModal(button.dataset.diseaseKey);
    });
  }

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    const closeBtn = document.getElementById("disease-logic-close-btn");
    const backdrop = document.getElementById("disease-logic-backdrop");
    if (closeBtn) closeBtn.addEventListener("click", closeDiseaseLogicModal);
    if (backdrop) backdrop.addEventListener("click", closeDiseaseLogicModal);
  }

  return {
    DISEASE_ITEMS,
    getRiskColor,
    formatDiseaseTargetLabel,
    buildForecastPanelHtml,
    renderDiseaseRiskPanels,
    getMaxRisk,
    getMaxRiskFromForecast,
    getMaxRiskDiseaseFromForecast,
    buildFacilityPopupHtml,
    bindLogicButtons,
    openDiseaseLogicModal,
    closeDiseaseLogicModal,
    init,
  };
})();
