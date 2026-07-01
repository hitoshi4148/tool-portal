document.addEventListener("DOMContentLoaded", async () => {
  const pesticideKeywordInput = document.getElementById("pesticideKeyword");
  const targetKeywordInput = document.getElementById("targetKeyword");
  const searchBtn = document.getElementById("searchBtn");
  const resultsDiv = document.getElementById("results");
  const loadingDiv = document.getElementById("loadingStatus");

  let latestSearchItems = [];

  searchBtn.disabled = true;

  try {
    await RacEngine.init("data");
    loadingDiv.hidden = true;
    searchBtn.disabled = false;
    runSearchFromUrl();
  } catch (err) {
    loadingDiv.innerHTML = `<div class="rac-message rac-message--error">データ読み込みエラー: ${escapeHtml(err.message)}</div>`;
    return;
  }

  searchBtn.addEventListener("click", doSearch);
  pesticideKeywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
  targetKeywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  function getRacClassByCode(racCode) {
    const code = String(racCode || "").toUpperCase();
    if (code.startsWith("FRAC-")) return "rac-frac";
    if (code.startsWith("IRAC-")) return "rac-irac";
    if (code.startsWith("HRAC-")) return "rac-hrac";
    return "rac-frac";
  }

  function getRacOrderValue(code) {
    const c = String(code || "").toUpperCase();
    if (c.startsWith("FRAC-")) return 1;
    if (c.startsWith("IRAC-")) return 2;
    if (c.startsWith("HRAC-")) return 3;
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

  function sortRacList(racList) {
    return [...(racList || [])].sort((a, b) => {
      const ca = `${a.rac_type}-${a.rac_code}`;
      const cb = `${b.rac_type}-${b.rac_code}`;
      const oa = getRacOrderValue(ca);
      const ob = getRacOrderValue(cb);
      if (oa !== ob) return oa - ob;
      return ca.localeCompare(cb);
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isEmptyRemarks(text) {
    const trimmed = String(text || "").trim();
    return trimmed === "" || trimmed === "-" || trimmed === "－";
  }

  function colorizeRemarksText(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/未発生|高|中|低/g, (match) => {
      const classMap = {
        高: "remarks-high",
        中: "remarks-medium",
        低: "remarks-low",
        未発生: "remarks-mihassei",
      };
      return `<span class="${classMap[match]}">${match}</span>`;
    });
  }

  function renderRemarks(remarks) {
    if (isEmptyRemarks(remarks)) return escapeHtml(remarks || "－");
    const colored = colorizeRemarksText(remarks);
    return `<strong>${colored}</strong>`;
  }

  function countMatchedRacCodes(sameGroupData) {
    const matched = new Set();
    (sameGroupData || []).forEach((p) => {
      (p.matchedRacCodes || []).forEach((code) => matched.add(code));
    });
    return matched.size;
  }

  function renderRacBadges(racCodes, matchedCodes = []) {
    if (!racCodes || racCodes.length === 0) return "－";
    const matched = new Set(matchedCodes || []);
    return racCodes
      .map((code) => {
        const matchClass = matched.has(code) ? " rac-match" : "";
        return `<span class="rac-badge ${getRacClassByCode(code)}${matchClass}"><strong>${code}</strong></span>`;
      })
      .join("");
  }

  function runSearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const pesticide = params.get("pesticide") ?? "";
    const target = params.get("target") ?? "";
    if (!pesticide && !target) {
      return;
    }

    pesticideKeywordInput.value = pesticide;
    targetKeywordInput.value = target;
    doSearch();
  }

  function doSearch() {
    if (!RacEngine.isReady()) return;

    const pesticideKeyword = pesticideKeywordInput.value.trim();
    const targetKeyword = targetKeywordInput.value.trim();
    const hasOneCharKeyword =
      (pesticideKeyword.length > 0 && pesticideKeyword.length < 2) ||
      (targetKeyword.length > 0 && targetKeyword.length < 2);

    if (hasOneCharKeyword) {
      resultsDiv.innerHTML = '<div class="rac-message rac-message--warning">2文字以上で検索してください</div>';
      return;
    }

    try {
      const data = RacEngine.search(pesticideKeyword, targetKeyword);
      latestSearchItems = data;
      renderResults(data);
    } catch (err) {
      resultsDiv.innerHTML = `<div class="rac-message rac-message--error">検索エラー: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderResults(items) {
    if (items.length === 0) {
      resultsDiv.innerHTML = '<div class="rac-message rac-message--info">該当する農薬が見つかりませんでした。</div>';
      return;
    }

    let html = `<p class="rac-result-count">${items.length} 件の農薬が見つかりました</p>`;
    html += '<div class="rac-panel"><div class="rac-table-wrap"><table class="rac-table">';
    html += "<thead><tr><th>登録番号</th><th>用途</th><th>農薬名称</th><th>メーカー名</th><th>RACコード</th><th>選択</th></tr></thead><tbody>";
    items.forEach((item) => {
      const sortedCodes = sortRacCodes(item.racCodes || []);
      html += `<tr>
        <td>${escapeHtml(item.登録番号)}</td>
        <td>${escapeHtml(item.用途_x)}</td>
        <td>${escapeHtml(item.農薬の名称_x)}</td>
        <td>${escapeHtml(item.正式名称)}</td>
        <td>${renderRacBadges(sortedCodes)}</td>
        <td><button type="button" class="btn-primary rac-btn-sm" onclick="loadDetail('${escapeHtml(item.登録番号)}')">選択</button></td>
      </tr>`;
    });
    html += "</tbody></table></div></div>";
    resultsDiv.innerHTML = html;
  }

  function renderDetailTable(detailRows) {
    let html = '<div class="rac-table-wrap"><table class="rac-table rac-table--compact">';
    html += "<thead><tr>";
    html +=
      "<th>作物名</th><th>適用場所</th><th>適用病害虫雑草名</th><th>有効成分</th><th>濃度</th><th>希釈倍数</th><th>使用時期</th><th>使用方法</th><th>総使用回数</th>";
    html += "</tr></thead><tbody>";
    detailRows.forEach((row) => {
      html += `<tr>
        <td>${escapeHtml(row.作物名)}</td><td>${escapeHtml(row.適用場所)}</td><td>${escapeHtml(row.適用病害虫雑草名)}</td>
        <td>${escapeHtml(row.有効成分)}</td><td>${escapeHtml(row.濃度)}</td><td>${escapeHtml(row.希釈倍数使用量)}</td>
        <td>${escapeHtml(row.使用時期)}</td><td>${escapeHtml(row.使用方法)}</td><td>${escapeHtml(row.総使用回数)}</td>
      </tr>`;
    });
    html += "</tbody></table></div>";
    return html;
  }

  function renderRacTables(racList) {
    if (!racList || racList.length === 0) return '<p class="rac-muted">RAC情報なし</p>';
    let html = "";
    sortRacList(racList).forEach((rac) => {
      const code = `${rac.rac_type}-${rac.rac_code}`;
      html += '<div class="rac-kv-block"><div class="rac-table-wrap"><table class="rac-table rac-table--compact rac-table--kv">';
      html += "<tbody>";
      html += `<tr><th>RACコード</th><td>${renderRacBadges([code])}</td></tr>`;
      html += `<tr><th>グループ名</th><td>${escapeHtml(rac.group_name || "－")}</td></tr>`;
      html += `<tr><th>作用機作</th><td>${escapeHtml(rac.made_of_action || "－")}</td></tr>`;
      html += `<tr><th>代表成分</th><td>${escapeHtml(rac.examples || "－")}</td></tr>`;
      html += `<tr><th>備考</th><td>${renderRemarks(rac.remarks)}</td></tr>`;
      html += "</tbody></table></div></div>";
    });
    return html;
  }

  window.loadDetail = function (regNo) {
    try {
      const data = RacEngine.getDetail(regNo);
      if (!data || !data.detail || data.detail.length === 0) {
        resultsDiv.innerHTML = '<div class="rac-message rac-message--warning">詳細情報が見つかりませんでした。</div>';
        return;
      }

      const first = data.detail[0];
      const allRacCodes = sortRacCodes((data.racList || []).map((r) => `${r.rac_type}-${r.rac_code}`));
      const safeRegNo = escapeHtml(first.登録番号);

      let html = '<div class="rac-panel rac-detail-panel">';
      html += '<button type="button" class="btn-secondary rac-btn-sm rac-back-btn" onclick="backToResults()">一覧へ戻る</button>';
      html += `<h2 class="rac-detail-title">${escapeHtml(first.農薬の名称_x)}</h2>`;
      html += `<p class="rac-detail-meta">登録番号: ${safeRegNo} ／ 用途: ${escapeHtml(first.用途_x)} ／ メーカー: ${escapeHtml(first.正式名称)}</p>`;
      html += '<p class="rac-detail-label">RACコード</p>';
      if (allRacCodes.length > 0) {
        html += `<div class="rac-detail-block">${renderRacBadges(allRacCodes)}</div>`;
      } else {
        html += '<div class="rac-detail-block rac-muted">RAC情報なし</div>';
      }
      html += `<div class="rac-detail-block"><button type="button" class="btn-analysis" onclick="showRacAndRotation('${safeRegNo}')">同一グループを含む農薬</button></div>`;
      html += '<h3 class="rac-subsection-title">適用情報</h3>';
      html += renderDetailTable(data.detail);
      html += '<hr class="rac-divider">';
      html += '<h3 class="rac-subsection-title">RAC情報</h3>';
      html += renderRacTables(data.racList || []);
      html += '<div id="racAndRotationArea"></div>';
      html += "</div>";

      resultsDiv.innerHTML = html;
    } catch (err) {
      resultsDiv.innerHTML = `<div class="rac-message rac-message--error">詳細取得エラー: ${escapeHtml(err.message)}</div>`;
    }
  };

  window.backToResults = function () {
    renderResults(latestSearchItems);
  };

  window.showRacAndRotation = function (regNo) {
    const area = document.getElementById("racAndRotationArea");
    if (!area) return;

    try {
      const detailData = RacEngine.getDetail(regNo);
      const sourceRacCodes = sortRacCodes((detailData.racList || []).map((r) => `${r.rac_type}-${r.rac_code}`));
      const sameGroupData = RacEngine.findPesticidesIncludingSameGroup(regNo);
      const rotationData = RacEngine.findRecommendedRotations(regNo);
      const sameGroupDupCount = countMatchedRacCodes(sameGroupData);

      let html = "";
      html += '<div class="rotation-grid" id="rac-rotation-results">';
      html += '<div class="rac-panel rac-rotation-panel">';
      html += `<h3 class="rac-section-heading">同一グループを含む農薬 <span class="rac-dup-count">RAC重複：${sameGroupDupCount}</span></h3><ul class="rac-list">`;
      if (!sameGroupData || sameGroupData.length === 0) {
        html += '<li class="rac-list-item">該当なし</li>';
      } else {
        sameGroupData.forEach((p) => {
          const codes = sortRacCodes(p.racCodes || []);
          const matched = sortRacCodes((p.matchedRacCodes || []).filter((code) => sourceRacCodes.includes(code)));
          const safeReg = escapeHtml(p.登録番号);
          html += `<li class="rac-list-item detail-expand" onclick="loadDetail('${safeReg}')">${safeReg} ${escapeHtml(p.農薬の名称_x)} (${escapeHtml(p.正式名称)})<div class="rac-detail-block">${renderRacBadges(codes, matched)}</div></li>`;
        });
      }
      html += "</ul></div>";

      html += '<div class="rac-panel rac-rotation-panel">';
      html += '<h3 class="rac-section-heading">次回のおすすめローテーション <span class="rac-dup-count">RAC重複：0</span></h3><ul class="rac-list">';
      if (!rotationData || rotationData.length === 0) {
        html += '<li class="rac-list-item">該当なし</li>';
      } else {
        rotationData.forEach((p) => {
          const badges = renderRacBadges(sortRacCodes(p.racCodes || []));
          const safeReg = escapeHtml(p.登録番号);
          html += `<li class="rac-list-item detail-expand" onclick="loadDetail('${safeReg}')">${safeReg} ${escapeHtml(p.農薬の名称_x)} (${escapeHtml(p.正式名称)})<div class="rac-detail-block">${badges}</div></li>`;
        });
      }
      html += "</ul></div>";
      html += "</div>";

      area.innerHTML = html;

      const rotationResults = document.getElementById("rac-rotation-results");
      if (rotationResults) {
        requestAnimationFrame(() => {
          rotationResults.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (err) {
      area.innerHTML = `<div class="rac-message rac-message--error">RAC/ローテーション取得エラー: ${escapeHtml(err.message)}</div>`;
    }
  };
});
