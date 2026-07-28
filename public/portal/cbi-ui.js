const CbiUI = (() => {
  function renderStarRating(stars) {
    const count = Math.max(1, Math.min(5, stars));
    return "★".repeat(count) + "☆".repeat(5 - count);
  }

  function forecastHeading(forecast) {
    if (forecast.daysFromToday === 1) {
      return `明日 ${forecast.targetLabel}`;
    }
    if (forecast.daysFromToday === 2) {
      return `明後日 ${forecast.targetLabel}`;
    }
    return forecast.targetLabel;
  }

  function buildForecastBlock(forecast) {
    return `<div class="cbi-forecast-block">
      <h4 class="cbi-forecast-subtitle">${forecastHeading(forecast)}</h4>
      <div class="cbi-stars" aria-label="${forecast.starLabel}">${renderStarRating(forecast.stars)}</div>
      <p class="cbi-star-label">${forecast.starLabel}</p>
      <p class="cbi-comment">${forecast.comment}</p>
      <p class="cbi-meta">CBI ${forecast.cbi.toFixed(2)} ／ 光補正 ${forecast.lightFactor.toFixed(2)}</p>
    </div>`;
  }

  function buildForecastPanel(forecasts) {
    const blocks = forecasts.map((forecast) => buildForecastBlock(forecast)).join("");
    return `<div class="cbi-panel cbi-panel--forecast">
      <h3 class="cbi-title">ベント炭素収支予測</h3>
      <div class="cbi-forecast-list">${blocks}</div>
    </div>`;
  }

  function buildEnergyPanel(energy) {
    return `<div class="cbi-panel cbi-panel--energy">
      <h3 class="cbi-title">ベント体力指数</h3>
      <div class="cbi-energy-value" aria-label="${energy.label}">${energy.percent}%</div>
      <p class="cbi-energy-label">${energy.label}</p>
      <p class="cbi-comment">${energy.comment}</p>
      <p class="cbi-meta">7日加重平均 CBI ${energy.weightedCbi.toFixed(2)}</p>
    </div>`;
  }

  function renderCbiPanels(container, report) {
    if (!container) {
      return;
    }

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
    container.innerHTML = `<p class="weather-placeholder">${message}</p>`;
  }

  return {
    renderCbiPanels,
    renderCbiPlaceholder,
  };
})();
