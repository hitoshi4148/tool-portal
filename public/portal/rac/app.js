document.addEventListener("DOMContentLoaded", async () => {
  const pesticideKeywordInput = document.getElementById("pesticideKeyword");
  const targetKeywordInput = document.getElementById("targetKeyword");
  const cropTextInput = document.getElementById("cropText");
  const cropTextWrap = document.getElementById("cropTextWrap");
  const cropFieldset = document.getElementById("cropFieldset");
  const cropRadioRow = document.getElementById("cropRadioRow");
  const searchBtn = document.getElementById("searchBtn");
  const resultsDiv = document.getElementById("results");
  const loadingDiv = document.getElementById("loadingStatus");
  const cropHint = document.getElementById("cropHint");

  const API_BASE = "/portal/api/pesticides";

  let latestSearchItems = [];
  let lastQuery = null;
  let presets = [];

  if (window.VoiceInput) {
    window.VoiceInput.bindVoiceField({
      input: pesticideKeywordInput,
      micBtn: document.getElementById("pesticideKeywordMic"),
      micStatus: document.getElementById("pesticideKeywordMicStatus"),
      maxLength: 80,
    });
    window.VoiceInput.bindVoiceField({
      input: targetKeywordInput,
      micBtn: document.getElementById("targetKeywordMic"),
      micStatus: document.getElementById("targetKeywordMicStatus"),
      maxLength: 80,
    });
  }

  searchBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/presets`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "プリセット取得に失敗しました");
    presets = data.presets || [];
    applyUrlParams();
    updateCropUi();
    loadingDiv.hidden = true;
    searchBtn.disabled = false;
    if (hasSearchIntentFromUrl()) {
      doSearch();
    }
  } catch (err) {
    loadingDiv.innerHTML = `<div class="rac-message rac-message--error">データ読み込みエラー: ${escapeHtml(err.message)}</div>`;
    return;
  }

  document.querySelectorAll('input[name="category"]').forEach((el) => {
    el.addEventListener("change", () => {
      syncCropRadiosForCategory();
      updateCropUi();
    });
  });
  document.querySelectorAll('input[name="crop"]').forEach((el) => {
    el.addEventListener("change", updateCropUi);
  });

  searchBtn.addEventListener("click", doSearch);
  [pesticideKeywordInput, targetKeywordInput, cropTextInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  });

  function getSelectedCategory() {
    return document.querySelector('input[name="category"]:checked')?.value || "turf";
  }

  function getSelectedCrop() {
    const category = getSelectedCategory();
    if (category === "turf") return "shiba";
    if (category === "other") return "other";
    return document.querySelector('input[name="crop"]:checked')?.value || "mikan";
  }

  function cropsForCategory(category) {
    return presets.filter((p) => p.category === category);
  }

  function setCropOptionVisibility(visibleKeys) {
    const allowed = new Set(visibleKeys);
    document.querySelectorAll(".rac-crop-option").forEach((label) => {
      const key = label.getAttribute("data-crop");
      label.hidden = !allowed.has(key);
    });
  }

  function syncCropRadiosForCategory() {
    const category = getSelectedCategory();
    if (category === "turf") {
      setCropOptionVisibility([]);
      const shiba = document.querySelector('input[name="crop"][value="shiba"]');
      if (shiba) shiba.checked = true;
      return;
    }
    if (category === "other") {
      setCropOptionVisibility([]);
      const other = document.querySelector('input[name="crop"][value="other"]');
      if (other) other.checked = true;
      return;
    }

    const fruitKeys = ["mikan", "ringo", "nashi", "kaki", "budo", "other_fruit"];
    setCropOptionVisibility(fruitKeys);
    const current = document.querySelector('input[name="crop"]:checked')?.value;
    if (!fruitKeys.includes(current)) {
      const mikan = document.querySelector('input[name="crop"][value="mikan"]');
      if (mikan) mikan.checked = true;
    }
  }

  function updateCropUi() {
    const category = getSelectedCategory();
    syncCropRadiosForCategory();
    const crop = getSelectedCrop();

    if (category === "turf") {
      cropFieldset.hidden = true;
      cropRadioRow.hidden = true;
      cropTextWrap.hidden = true;
      cropTextInput.value = "";
      cropHint.hidden = true;
      cropHint.textContent = "";
      return;
    }

    cropFieldset.hidden = false;

    if (category === "other") {
      cropRadioRow.hidden = true;
      setCropOptionVisibility([]);
      cropTextWrap.hidden = false;
      cropTextInput.placeholder = "例：トマト、なす、きゅうり、キャベツ";
      cropHint.textContent = "FAMIC の作物名表記で入力してください（野菜・その他）。";
      cropHint.hidden = false;
      return;
    }

    // fruit
    cropRadioRow.hidden = false;
    const isFree = crop === "other_fruit";
    cropTextWrap.hidden = !isFree;
    if (!isFree) cropTextInput.value = "";

    if (crop === "mikan") {
      cropHint.textContent = "かんきつ類の登録を含みます（みかんを除く表記は除外）。";
      cropHint.hidden = false;
    } else if (crop === "ringo" || crop === "nashi") {
      cropHint.textContent = "仁果類などグループ登録を含むことがあります。使用前はラベルの適用作物を確認してください。";
      cropHint.hidden = false;
    } else if (isFree) {
      cropTextInput.placeholder = "例：もも、キウイ、ゆず、うめ";
      cropHint.textContent = "FAMIC の果樹の作物名表記で入力してください。";
      cropHint.hidden = false;
    } else {
      cropHint.hidden = true;
      cropHint.textContent = "";
    }
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category") || "turf";
    const crop = params.get("crop") || "shiba";
    const cropText = params.get("cropText") || params.get("crop_text") || "";
    const pesticide = params.get("pesticide") ?? "";
    const target = params.get("target") ?? "";

    const catRadio = document.querySelector(`input[name="category"][value="${category}"]`);
    if (catRadio) catRadio.checked = true;
    syncCropRadiosForCategory();
    const cropRadio = document.querySelector(`input[name="crop"][value="${crop}"]`);
    if (cropRadio) cropRadio.checked = true;
    else {
      const first = cropsForCategory(getSelectedCategory())[0];
      if (first) {
        const r = document.querySelector(`input[name="crop"][value="${first.key}"]`);
        if (r) r.checked = true;
      }
    }
    if (cropText) cropTextInput.value = cropText;
    pesticideKeywordInput.value = pesticide;
    targetKeywordInput.value = target;
  }

  function hasSearchIntentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("pesticide") || params.get("target") || params.get("cropText") || params.get("crop_text") || params.get("auto") === "1");
  }

  function buildQuery() {
    const category = getSelectedCategory();
    const crop = getSelectedCrop();
    const cropText = cropTextInput.value.trim();
    const pesticide = pesticideKeywordInput.value.trim();
    const target = targetKeywordInput.value.trim();
    return { category, crop, cropText, pesticide, target };
  }

  function queryString(q) {
    const params = new URLSearchParams();
    params.set("category", q.category);
    params.set("crop", q.crop);
    if (q.cropText) params.set("cropText", q.cropText);
    if (q.pesticide) params.set("pesticide", q.pesticide);
    if (q.target) params.set("target", q.target);
    return params.toString();
  }

  function getRacClassByCode(racCode) {
    const code = String(racCode || "").toUpperCase();
    if (code.startsWith("FRAC")) return "rac-frac";
    if (code.startsWith("IRAC")) return "rac-irac";
    if (code.startsWith("HRAC")) return "rac-hrac";
    return "rac-frac";
  }

  function getRacOrderValue(code) {
    const c = String(code || "").toUpperCase();
    if (c.startsWith("FRAC")) return 1;
    if (c.startsWith("IRAC")) return 2;
    if (c.startsWith("HRAC")) return 3;
    return 9;
  }

  function sortRacCodes(racCodes) {
    return [...(racCodes || [])].sort((a, b) => {
      const oa = getRacOrderValue(a);
      const ob = getRacOrderValue(b);
      if (oa !== ob) return oa - ob;
      return String(a).localeCompare(String(b));
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderRacBadges(racCodes, matchedCodes = []) {
    if (!racCodes || racCodes.length === 0) return '<span class="rac-muted">未収載</span>';
    const matched = new Set(matchedCodes || []);
    return racCodes
      .map((code) => {
        const matchClass = matched.has(code) ? " rac-match" : "";
        return `<span class="rac-badge ${getRacClassByCode(code)}${matchClass}"><strong>${escapeHtml(code)}</strong></span>`;
      })
      .join("");
  }

  function countMatchedRacCodes(sameGroupData) {
    const matched = new Set();
    (sameGroupData || []).forEach((p) => {
      (p.matchedRacCodes || []).forEach((code) => matched.add(code));
    });
    return matched.size;
  }

  async function doSearch() {
    const q = buildQuery();
    const preset = presets.find((p) => p.key === q.crop);
    if (preset?.isFreeText && q.cropText.length < 2) {
      resultsDiv.innerHTML =
        '<div class="rac-message rac-message--warning">作物名を2文字以上入力してください</div>';
      return;
    }
    if ((q.pesticide && q.pesticide.length < 2) || (q.target && q.target.length < 2)) {
      resultsDiv.innerHTML =
        '<div class="rac-message rac-message--warning">農薬名・病害虫名は2文字以上で検索してください</div>';
      return;
    }

    searchBtn.disabled = true;
    resultsDiv.innerHTML = '<div class="rac-message rac-message--loading">検索中…</div>';

    try {
      const res = await fetch(`${API_BASE}/search?${queryString(q)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "検索に失敗しました");
      lastQuery = q;
      latestSearchItems = data.items || [];
      renderResults(latestSearchItems, data);
      const urlQs = queryString(q);
      history.replaceState(null, "", `${window.location.pathname}?${urlQs}`);
    } catch (err) {
      resultsDiv.innerHTML = `<div class="rac-message rac-message--error">検索エラー: ${escapeHtml(err.message)}</div>`;
    } finally {
      searchBtn.disabled = false;
    }
  }

  function renderResults(items, meta = {}) {
    if (!items || items.length === 0) {
      const note = meta.note
        ? `<p class="rac-muted">${escapeHtml(meta.note)}</p>`
        : "";
      resultsDiv.innerHTML = `<div class="rac-message rac-message--info">該当する農薬が見つかりませんでした。${note}</div>`;
      return;
    }

    const truncated = meta.truncated
      ? `<p class="rac-muted">表示は先頭 ${items.length} 件です（全 ${meta.total} 件）。キーワードで絞り込んでください。</p>`
      : "";

    let html = `<p class="rac-result-count">${meta.total ?? items.length} 件の農薬が見つかりました</p>${truncated}`;
    html += '<p class="rac-crop-note">登録上の作物名は「かんきつ」「仁果類」などグループ表記のことがあります。使用前はラベルの適用作物を確認してください。</p>';
    html += '<div class="rac-panel"><div class="rac-table-wrap"><table class="rac-table">';
    html += "<thead><tr><th>登録番号</th><th>用途</th><th>農薬名称</th><th>メーカー名</th><th>マッチ作物</th><th>RACコード</th><th>選択</th></tr></thead><tbody>";
    items.forEach((item) => {
      const sortedCodes = sortRacCodes(item.racCodes || []);
      const crops = (item.matchedCrops || []).slice(0, 3).map(escapeHtml).join("、");
      const more = (item.matchedCrops || []).length > 3 ? "…" : "";
      html += `<tr>
        <td>${escapeHtml(item.regNo)}</td>
        <td>${escapeHtml(item.useCategory || "－")}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.holder || "－")}</td>
        <td class="rac-matched-crops">${crops}${more}</td>
        <td>${item.racMissing ? '<span class="rac-muted">未収載</span>' : renderRacBadges(sortedCodes)}</td>
        <td><button type="button" class="btn-primary rac-btn-sm" data-reg="${escapeHtml(item.regNo)}">選択</button></td>
      </tr>`;
    });
    html += "</tbody></table></div></div>";
    resultsDiv.innerHTML = html;
    resultsDiv.querySelectorAll("button[data-reg]").forEach((btn) => {
      btn.addEventListener("click", () => loadDetail(btn.getAttribute("data-reg")));
    });
  }

  function totalUsesText(app) {
    return (
      app.ingredient1TotalUses ||
      app.ingredient2TotalUses ||
      app.timesPerCrop ||
      "－"
    );
  }

  function renderDetailTable(apps) {
    let html = '<div class="rac-table-wrap"><table class="rac-table rac-table--compact">';
    html += "<thead><tr>";
    html +=
      "<th>作物名</th><th>適用場所</th><th>適用病害虫雑草名</th><th>希釈倍数</th><th>使用時期</th><th>使用方法</th><th>総使用回数</th>";
    html += "</tr></thead><tbody>";
    apps.forEach((row) => {
      html += `<tr>
        <td>${escapeHtml(row.cropName)}</td>
        <td>${escapeHtml(row.place || "－")}</td>
        <td>${escapeHtml(row.targetPest || "－")}</td>
        <td>${escapeHtml(row.dilution || "－")}</td>
        <td>${escapeHtml(row.timing || "－")}</td>
        <td>${escapeHtml(row.method || "－")}</td>
        <td>${escapeHtml(totalUsesText(row))}</td>
      </tr>`;
    });
    html += "</tbody></table></div>";
    return html;
  }

  function renderRacTables(racList) {
    if (!racList || racList.length === 0) return '<p class="rac-muted">RAC未収載</p>';
    let html = "";
    [...racList]
      .sort((a, b) => a.slot - b.slot)
      .forEach((rac) => {
        html += '<div class="rac-kv-block"><div class="rac-table-wrap"><table class="rac-table rac-table--compact rac-table--kv">';
        html += "<tbody>";
        html += `<tr><th>スロット</th><td>${rac.slot}</td></tr>`;
        html += `<tr><th>有効成分</th><td>${escapeHtml(rac.ingredient || "－")}</td></tr>`;
        html += `<tr><th>RACコード</th><td>${renderRacBadges([rac.displayCode || rac.racCode || "－"])}</td></tr>`;
        html += "</tbody></table></div></div>";
      });
    return html;
  }

  async function loadDetail(regNo) {
    resultsDiv.innerHTML = '<div class="rac-message rac-message--loading">詳細を読み込み中…</div>';
    const q = lastQuery || buildQuery();
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(regNo)}?${queryString(q)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "詳細取得に失敗しました");
      const product = data.product;
      const allRacCodes = sortRacCodes(product.racCodes || []);
      const safeRegNo = escapeHtml(product.regNo);

      let html = '<div class="rac-panel rac-detail-panel">';
      html += '<button type="button" class="btn-secondary rac-btn-sm rac-back-btn" id="backToResultsBtn">一覧へ戻る</button>';
      html += `<h2 class="rac-detail-title">${escapeHtml(product.name)}</h2>`;
      html += `<p class="rac-detail-meta">登録番号: ${safeRegNo} ／ 用途: ${escapeHtml(product.useCategory || "－")} ／ メーカー: ${escapeHtml(product.holder || "－")}</p>`;
      html += '<p class="rac-detail-label">RACコード</p>';
      if (allRacCodes.length > 0) {
        html += `<div class="rac-detail-block">${renderRacBadges(allRacCodes)}</div>`;
      } else {
        html += '<div class="rac-detail-block rac-muted">RAC未収載</div>';
      }
      html += `<div class="rac-detail-block"><button type="button" class="btn-analysis" id="showRotationBtn" data-reg="${safeRegNo}">同一グループを含む農薬</button></div>`;
      if (product.ingredients?.length) {
        html += '<h3 class="rac-subsection-title">有効成分</h3><ul class="rac-list">';
        product.ingredients.forEach((ing) => {
          html += `<li class="rac-list-item">${escapeHtml(ing.ingredient)}</li>`;
        });
        html += "</ul>";
      }
      html += '<h3 class="rac-subsection-title">適用情報</h3>';
      html += renderDetailTable(product.applications || []);
      html += '<hr class="rac-divider">';
      html += '<h3 class="rac-subsection-title">RAC情報</h3>';
      html += renderRacTables(product.rac || []);
      html += '<div id="racAndRotationArea"></div>';
      html += "</div>";

      resultsDiv.innerHTML = html;
      document.getElementById("backToResultsBtn")?.addEventListener("click", () => {
        renderResults(latestSearchItems, { total: latestSearchItems.length });
      });
      document.getElementById("showRotationBtn")?.addEventListener("click", () => {
        showRacAndRotation(product.regNo);
      });
    } catch (err) {
      resultsDiv.innerHTML = `<div class="rac-message rac-message--error">詳細取得エラー: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function showRacAndRotation(regNo) {
    const area = document.getElementById("racAndRotationArea");
    if (!area) return;
    area.innerHTML = '<div class="rac-message rac-message--loading">ローテーション候補を検索中…</div>';

    const q = lastQuery || buildQuery();
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(regNo)}/rotation?${queryString(q)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "取得に失敗しました");

      const sourceRacCodes = sortRacCodes(data.source?.racCodes || []);
      const sameGroupData = data.sameGroup || [];
      const rotationData = data.recommended || [];
      const sameGroupDupCount = countMatchedRacCodes(sameGroupData);

      let html = "";
      html += '<div class="rotation-grid" id="rac-rotation-results">';
      html += '<div class="rac-panel rac-rotation-panel">';
      html += `<h3 class="rac-section-heading">同一グループを含む農薬 <span class="rac-dup-count">RAC重複：${sameGroupDupCount}</span></h3><ul class="rac-list">`;
      if (sameGroupData.length === 0) {
        html += '<li class="rac-list-item">該当なし</li>';
      } else {
        sameGroupData.forEach((p) => {
          const codes = sortRacCodes(p.racCodes || []);
          const matched = sortRacCodes((p.matchedRacCodes || []).filter((code) => sourceRacCodes.includes(code)));
          html += `<li class="rac-list-item detail-expand" data-reg="${escapeHtml(p.regNo)}">${escapeHtml(p.regNo)} ${escapeHtml(p.name)} (${escapeHtml(p.holder || "－")})<div class="rac-detail-block">${renderRacBadges(codes, matched)}</div></li>`;
        });
      }
      html += "</ul></div>";

      html += '<div class="rac-panel rac-rotation-panel">';
      html += '<h3 class="rac-section-heading">次回のおすすめローテーション <span class="rac-dup-count">RAC重複：0</span></h3><ul class="rac-list">';
      if (rotationData.length === 0) {
        html += '<li class="rac-list-item">該当なし</li>';
      } else {
        rotationData.forEach((p) => {
          const badges = renderRacBadges(sortRacCodes(p.racCodes || []));
          html += `<li class="rac-list-item detail-expand" data-reg="${escapeHtml(p.regNo)}">${escapeHtml(p.regNo)} ${escapeHtml(p.name)} (${escapeHtml(p.holder || "－")})<div class="rac-detail-block">${badges}</div></li>`;
        });
      }
      html += "</ul></div>";
      html += "</div>";

      area.innerHTML = html;
      area.querySelectorAll(".detail-expand[data-reg]").forEach((el) => {
        el.addEventListener("click", () => loadDetail(el.getAttribute("data-reg")));
      });

      const rotationResults = document.getElementById("rac-rotation-results");
      if (rotationResults) {
        requestAnimationFrame(() => {
          rotationResults.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (err) {
      area.innerHTML = `<div class="rac-message rac-message--error">RAC/ローテーション取得エラー: ${escapeHtml(err.message)}</div>`;
    }
  }
});
