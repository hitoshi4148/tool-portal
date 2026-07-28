const CbiUI = (() => {
  const CBI_GP = { optimum: 20, variance: 10 };
  const CBI_RESPIRATION = { q10: 2, nightOptimum: 15 };
  const CBI_STAR_THRESHOLDS = [2.0, 1.5, 1.0, 0.7, 0.4];
  const CBI_STAR_LABELS = ["非常に良好", "良好", "注意", "かなり危険", "危険"];
  const CBI_HISTORY_WEIGHTS = [0.3, 0.25, 0.2, 0.1, 0.07, 0.05, 0.03];
  const CBI_ENERGY_RANGE = { highCbi: 2.0, lowCbi: 0.4, highPercent: 100, lowPercent: 20 };

  let currentReport = null;

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

  function formatTargetLabel(daysFromToday, hour = 6) {
    const { year, month, day } = getJstDateParts();
    const target = new Date(Date.UTC(year, month - 1, day));
    target.setUTCDate(target.getUTCDate() + daysFromToday);
    const m = target.getUTCMonth() + 1;
    const d = target.getUTCDate();
    return `${m}/${d} ${hour}:00`;
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const [, month, day] = dateStr.split("-").map(Number);
    return `${month}/${day}`;
  }

  function renderStarRating(stars) {
    const count = Math.max(1, Math.min(5, stars));
    return "★".repeat(count) + "☆".repeat(5 - count);
  }

  function getStarColor(stars) {
    if (stars >= 5) return "#10B981";
    if (stars >= 4) return "#34D399";
    if (stars >= 3) return "#FBBF24";
    if (stars >= 2) return "#F97316";
    return "#EF4444";
  }

  function getEnergyColor(percent) {
    if (percent >= 80) return "#10B981";
    if (percent >= 60) return "#34D399";
    if (percent >= 40) return "#FBBF24";
    if (percent >= 20) return "#F97316";
    return "#EF4444";
  }

  function getForecastByDay(forecasts, daysFromToday) {
    return forecasts.find((entry) => entry.daysFromToday === daysFromToday) ?? null;
  }

  function buildStarThresholdListHtml() {
    return CBI_STAR_THRESHOLDS.map((threshold, index) => {
      const stars = 5 - index;
      return `<div>CBI ≥ ${threshold.toFixed(1)} → ${stars}つ星（${CBI_STAR_LABELS[index]}）</div>`;
    }).join("");
  }

  function buildForecastDayCalcHtml(forecast, dayLabel) {
    if (!forecast) {
      return `<section class="disease-logic-section">
        <h3>${dayLabel}</h3>
        <p class="disease-logic-note">気象データ不足のため計算できませんでした。</p>
      </section>`;
    }

    const p = forecast.photosynthesisIndex.toFixed(2);
    const l = forecast.lightFactor.toFixed(3);
    const rli = forecast.respirationLoadIndex.toFixed(2);
    const cbi = forecast.cbi.toFixed(3);

    return `<section class="disease-logic-section disease-logic-calculation">
      <h3>${dayLabel}（${forecast.targetLabel}）</h3>
      <div class="disease-logic-calc-block">
        <div><strong>1. 光合成指数 P</strong></div>
        <div>P = Σ GP(T<sub>h</sub>) × L　（昼間 6:00–18:00）</div>
        <div>GP(T) = exp(−0.5 × ((T − ${CBI_GP.optimum}) / ${CBI_GP.variance})²)</div>
        <div class="disease-logic-calc-gap">L（光補正）= ${l}</div>
        <div>→ P = ${p}</div>
        <div class="disease-logic-calc-gap"><strong>2. 呼吸負荷指数 RLI</strong></div>
        <div>RLI = Σ ${CBI_RESPIRATION.q10}^((T − ${CBI_RESPIRATION.nightOptimum}) / 10)　（夜間 18:00–翌6:00）</div>
        <div>→ RLI = ${rli}</div>
        <div class="disease-logic-calc-gap"><strong>3. 炭素収支指数 CBI</strong></div>
        <div>CBI = P / RLI = ${p} / ${rli} = <strong>${cbi}</strong></div>
        <div class="disease-logic-calc-gap"><strong>4. 判定</strong></div>
        <div>${renderStarRating(forecast.stars)} ${forecast.starLabel}（${forecast.stars}つ星）</div>
      </div>
    </section>`;
  }

  function buildForecastLogicHtml(report) {
    const tomorrow = getForecastByDay(report.forecasts, 1);
    const dayAfter = getForecastByDay(report.forecasts, 2);

    return `<article class="disease-logic-content">
      <p class="disease-logic-subtitle">Bent Carbon Balance Index (CBI)</p>
      <p class="disease-logic-description">MET Norway 96時間予報から、翌日・明後日の昼夜別気温と日射（または雲量）を用いて炭素収支を推定します。</p>
      <div class="disease-logic-formula">CBI = P / RLI</div>
      <section class="disease-logic-section">
        <h3>評価時間帯</h3>
        <ul class="disease-logic-list">
          <li>昼間（光合成）: 6:00–18:00 の気温・日射</li>
          <li>夜間（呼吸）: 18:00–翌6:00 の気温</li>
          <li>芝種: ベントグラス（T<sub>opt</sub>=${CBI_GP.optimum}℃, σ=${CBI_GP.variance}）</li>
        </ul>
      </section>
      <section class="disease-logic-section">
        <h3>光補正 L</h3>
        <div class="disease-logic-calc-block">
          <div>日射あり: L = clamp(0.5 + 0.5 × DLI / 20, 0.5, 1.0)</div>
          <div>雲量のみ: L = clamp(1 − 0.5 × 雲量, 0.5, 1.0)</div>
        </div>
      </section>
      <section class="disease-logic-section">
        <h3>星評価の閾値</h3>
        <div class="disease-logic-calc-block">${buildStarThresholdListHtml()}</div>
      </section>
      ${buildForecastDayCalcHtml(tomorrow, "明日")}
      ${buildForecastDayCalcHtml(dayAfter, "明後日")}
      <p class="disease-logic-note">※ 予測値は気象予報に基づく推定です</p>
    </article>`;
  }

  function buildEnergyHistoryRowsHtml(history) {
    if (!history || history.length === 0) {
      return `<tr><td colspan="4">履歴データがありません</td></tr>`;
    }

    return history
      .map((entry, index) => {
        const weight = CBI_HISTORY_WEIGHTS[index] ?? 0;
        const contribution = (entry.cbi * weight).toFixed(3);
        return `<tr>
          <td>${formatShortDate(entry.date)}</td>
          <td>${entry.cbi.toFixed(2)}</td>
          <td>${(weight * 100).toFixed(0)}%</td>
          <td>${contribution}</td>
        </tr>`;
      })
      .join("");
  }

  function buildEnergyLogicHtml(report) {
    const energy = report.energyReserve;
    const history = energy.history ?? [];
    const weightedCbi = energy.weightedCbi.toFixed(3);
    const { highCbi, lowCbi, highPercent, lowPercent } = CBI_ENERGY_RANGE;
    const ratio = ((energy.weightedCbi - lowCbi) / (highCbi - lowCbi)).toFixed(3);

    return `<article class="disease-logic-content">
      <p class="disease-logic-subtitle">Bent Energy Reserve</p>
      <p class="disease-logic-description">NASA POWER の過去7日間の実績気象から日次 CBI を算出し、直近ほど重みを大きくした加重平均から体力指数（%）を求めます。</p>
      <div class="disease-logic-formula">体力指数 = clamp(${lowPercent} + (CBI<sub>加重</sub> − ${lowCbi}) / (${highCbi} − ${lowCbi}) × ${highPercent - lowPercent}, 0, 100)</div>
      <section class="disease-logic-section">
        <h3>日次 CBI の重み（新しい順）</h3>
        <div class="disease-logic-calc-block">
          <div>CBI<sub>加重</sub> = Σ(CBI<sub>i</sub> × w<sub>i</sub>) / Σw<sub>i</sub></div>
          <div>重み w = ${CBI_HISTORY_WEIGHTS.map((w) => (w * 100).toFixed(0) + "%").join(", ")}</div>
        </div>
      </section>
      <section class="disease-logic-section disease-logic-calculation">
        <h3>過去7日の計算内訳</h3>
        <table class="cbi-logic-table">
          <thead>
            <tr><th>日付</th><th>CBI</th><th>重み</th><th>寄与</th></tr>
          </thead>
          <tbody>${buildEnergyHistoryRowsHtml(history)}</tbody>
        </table>
      </section>
      <section class="disease-logic-section disease-logic-calculation">
        <h3>今回の計算結果</h3>
        <div class="disease-logic-calc-block">
          <div>CBI<sub>加重</sub> = <strong>${weightedCbi}</strong></div>
          <div class="disease-logic-calc-gap">比率 = (${weightedCbi} − ${lowCbi}) / (${highCbi} − ${lowCbi}) = ${ratio}</div>
          <div>体力指数 = ${lowPercent} + ${ratio} × ${highPercent - lowPercent} = <strong>${energy.percent}%</strong>（${energy.label}）</div>
        </div>
      </section>
      <p class="disease-logic-note">※ 日次 CBI の算出式は炭素収支予測と同じ（P / RLI）</p>
    </article>`;
  }

  function openCbiLogicModal(kind) {
    if (!currentReport) return;

    const modal = document.getElementById("disease-logic-modal");
    const titleEl = document.getElementById("disease-logic-title");
    const bodyEl = document.getElementById("disease-logic-body");
    if (!modal || !titleEl || !bodyEl) return;

    if (kind === "forecast") {
      titleEl.textContent = "ベント炭素収支予測 — 判定ロジック";
      bodyEl.innerHTML = buildForecastLogicHtml(currentReport);
    } else if (kind === "energy") {
      titleEl.textContent = "ベント体力指数 — 判定ロジック";
      bodyEl.innerHTML = buildEnergyLogicHtml(currentReport);
    } else {
      return;
    }

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeCbiLogicModal() {
    const modal = document.getElementById("disease-logic-modal");
    if (!modal || modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function buildCbiValueCell(forecast) {
    if (!forecast) {
      return `<div class="disease-risk-item-value cbi-value-cell cbi-value-cell--empty">—</div>`;
    }

    const color = getStarColor(forecast.stars);
    return `<div class="disease-risk-item-value cbi-value-cell" style="background-color: ${color}" aria-label="${forecast.starLabel}">
      <span class="cbi-cell-stars">${renderStarRating(forecast.stars)}</span>
      <span class="cbi-cell-label">${forecast.starLabel}</span>
      <span class="cbi-cell-meta">CBI ${forecast.cbi.toFixed(2)}</span>
    </div>`;
  }

  function buildForecastPanel(forecasts) {
    const tomorrow = getForecastByDay(forecasts, 1);
    const dayAfter = getForecastByDay(forecasts, 2);
    const tomorrowLabel = tomorrow?.targetLabel ?? formatTargetLabel(1);
    const dayAfterLabel = dayAfter?.targetLabel ?? formatTargetLabel(2);
    const comments = [tomorrow, dayAfter]
      .filter(Boolean)
      .map((entry) => {
        const prefix = entry.daysFromToday === 2 ? "明後日" : "明日";
        return `${prefix}: ${entry.comment}`;
      })
      .join(" ");

    return `<div class="disease-risk-panel disease-risk-panel--combined cbi-panel">
      <h3 class="disease-risk-title cbi-panel-title">
        <span>ベント炭素収支予測</span>
        <button type="button" class="disease-logic-btn" data-cbi-logic="forecast">判定ロジック</button>
      </h3>
      <div class="disease-risk-table">
        <div class="disease-risk-table-header">
          <div class="disease-risk-table-name"></div>
          <div class="disease-risk-table-col">${tomorrowLabel}</div>
          <div class="disease-risk-table-col">${dayAfterLabel}</div>
        </div>
        <div class="disease-risk-list">
          <div class="disease-risk-item cbi-item">
            <div class="disease-risk-item-name">
              <span class="disease-risk-item-label">炭素収支</span>
            </div>
            <div class="disease-risk-item-values">
              ${buildCbiValueCell(tomorrow)}
              ${buildCbiValueCell(dayAfter)}
            </div>
          </div>
        </div>
      </div>
      <p class="disease-risk-footer">${comments || "予測コメントを取得できませんでした。"}</p>
    </div>`;
  }

  function buildEnergyPanel(energy) {
    const color = getEnergyColor(energy.percent);
    return `<div class="disease-risk-panel disease-risk-panel--combined cbi-panel">
      <h3 class="disease-risk-title cbi-panel-title">
        <span>ベント体力指数</span>
        <button type="button" class="disease-logic-btn" data-cbi-logic="energy">判定ロジック</button>
      </h3>
      <div class="disease-risk-table">
        <div class="disease-risk-list">
          <div class="disease-risk-item cbi-item">
            <div class="disease-risk-item-name">
              <span class="disease-risk-item-label">過去7日</span>
            </div>
            <div class="disease-risk-item-values cbi-energy-values">
              <div class="disease-risk-item-value cbi-value-cell cbi-value-cell--energy" style="background-color: ${color}" aria-label="${energy.label}">
                <span class="cbi-cell-percent">${energy.percent}%</span>
                <span class="cbi-cell-label">${energy.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p class="disease-risk-footer">${energy.comment}（加重平均 CBI ${energy.weightedCbi.toFixed(2)}）</p>
    </div>`;
  }

  function renderCbiPanels(container, report) {
    if (!container) {
      return;
    }

    currentReport = report;

    if (!report || !report.forecasts || report.forecasts.length === 0) {
      container.innerHTML =
        '<p class="weather-placeholder">ベント炭素収支を表示できませんでした（気象データ不足、またはサーバー更新反映待ち）。</p>';
      return;
    }

    container.innerHTML = `<div class="cbi-row-inner">
      ${buildForecastPanel(report.forecasts)}
      ${buildEnergyPanel(report.energyReserve)}
    </div>`;
  }

  function renderCbiPlaceholder(container, message) {
    if (!container) {
      return;
    }
    currentReport = null;
    container.innerHTML = `<p class="weather-placeholder">${message}</p>`;
  }

  function bindLogicButtons(container) {
    if (!container || container.dataset.cbiLogicBound === "true") return;
    container.dataset.cbiLogicBound = "true";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cbi-logic]");
      if (!button) return;
      openCbiLogicModal(button.dataset.cbiLogic);
    });
  }

  return {
    renderCbiPanels,
    renderCbiPlaceholder,
    bindLogicButtons,
    openCbiLogicModal,
    closeCbiLogicModal,
  };
})();
