const FacilitySettings = (() => {
  let rows = [];
  let tree = {};
  let facilityItems = [];
  let modal = null;
  let onUpdated = null;

  let region1 = "";
  let region2 = "";
  let courseKey = "";
  let facilityName = "";
  let latitude = "";
  let longitude = "";
  let showManualInput = false;
  let errorMessage = "";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function notifyParent() {
    facilityItems = Facilities.loadFacilityItemsFromCookie();
    const panel = document.getElementById("facility-settings-panel");
    if (panel) render(panel);
    if (onUpdated) onUpdated();
  }

  function renderSelectOptions(options, selected, placeholder) {
    let html = `<option value="">${placeholder}</option>`;
    options.forEach((value) => {
      html += `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`;
    });
    return html;
  }

  function renderCourseOptions() {
    const courses = tree[region1]?.[region2] || [];
    let html = '<option value="">選択してください</option>';
    courses.forEach((row) => {
      html += `<option value="${escapeHtml(row.rowKey)}"${row.rowKey === courseKey ? " selected" : ""}>${escapeHtml(row.name)}</option>`;
    });
    return html;
  }

  function renderFacilityList() {
    const displayItems = Facilities.getDisplayFacilityItems();
    if (displayItems.length === 0) {
      return '<p class="settings-muted">施設が登録されていません。</p>';
    }
    return `<ul class="settings-facility-list">${displayItems
      .map(
        (item) => `<li class="settings-facility-item">
        <span><strong>${escapeHtml(item.name)}</strong>
          <span class="settings-muted"> (${item.fromPortalSettings ? "ポータル設定" : item.source === "csv" ? "リスト" : "手動"}) ${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}</span>
        </span>
        ${item.fromPortalSettings ? "" : `<button type="button" class="settings-remove-btn" data-remove-id="${escapeHtml(item.id)}">削除</button>`}
      </li>`
      )
      .join("")}</ul>`;
  }

  function renderModal() {
    if (!modal) return "";
    const title =
      modal.replaceMode === "manual"
        ? "登録上限のため、削除する施設を1つ選んでください"
        : "リストから追加するには、削除する施設を1つ選んでください";
    return `<div class="settings-modal-backdrop" id="facilityReplaceModal" role="dialog" aria-modal="true">
      <div class="settings-modal-panel">
        <h4>${title}</h4>
        <p class="settings-muted">追加: <strong>${escapeHtml(modal.newItem.name)}</strong></p>
        <ul class="settings-replace-list">${modal.current
          .map(
            (item) => `<li><button type="button" class="settings-replace-btn" data-replace-id="${escapeHtml(item.id)}" data-replace-mode="${modal.replaceMode ? "manual" : "csv"}">
              削除して入れ替え: ${escapeHtml(item.name)} (${item.source === "csv" ? "リスト" : "手動"})
            </button></li>`
          )
          .join("")}</ul>
        <button type="button" class="settings-cancel-btn" id="facilityModalCancel">キャンセル</button>
      </div>
    </div>`;
  }

  function render(panel) {
    const region1Options = Object.keys(tree);
    const region2Options = region1 && tree[region1] ? Object.keys(tree[region1]) : [];

    panel.innerHTML = `<div class="settings-panel">
      <h2 class="settings-title">施設の設定（リストから最大3件 + 手動1件）</h2>
      ${Facilities.usesPortalSettingsFallback() ? '<p class="settings-portal-note">ポータル TOP の設定（施設名・緯度経度）を地図の初期表示に利用しています。保存するとこのページ専用の施設として登録されます。</p>' : ""}
      <div class="settings-section">
        <h3>現在の予報対象</h3>
        ${renderFacilityList()}
      </div>
      <div class="settings-box">
        <h3>リストから追加（最大3件）</h3>
        <label class="settings-label">地方</label>
        <select id="csvRegion1" class="settings-select">${renderSelectOptions(region1Options, region1, "選択してください")}</select>
        <label class="settings-label">地域</label>
        <select id="csvRegion2" class="settings-select" ${region1 ? "" : "disabled"}>${renderSelectOptions(region2Options, region2, "選択してください")}</select>
        <label class="settings-label">ゴルフコース</label>
        <select id="csvCourse" class="settings-select" ${region2 ? "" : "disabled"}>${renderCourseOptions()}</select>
        <button type="button" class="settings-primary-btn" id="addCsvFacilityBtn">リストの施設を追加</button>
      </div>
      <div class="settings-section">
        <h3>手動で緯度経度を指定（1件まで）</h3>
        <label class="settings-label">施設名 <span class="settings-required">*</span></label>
        <input type="text" id="manualFacilityName" class="settings-input" value="${escapeHtml(facilityName)}" placeholder="例: 〇〇ゴルフクラブ">
        <button type="button" class="settings-primary-btn" id="getLocationBtn">現在地から位置情報を取得</button>
        <button type="button" class="settings-outline-btn" id="showManualInputBtn">緯度・経度を手入力する</button>
        <div id="manualLatLonFields" class="${showManualInput ? "" : "hidden"}">
          <div class="settings-latlon-grid">
            <div><label class="settings-label">緯度</label><input type="number" id="manualLatitude" class="settings-input" step="any" value="${escapeHtml(latitude)}"></div>
            <div><label class="settings-label">経度</label><input type="number" id="manualLongitude" class="settings-input" step="any" value="${escapeHtml(longitude)}"></div>
          </div>
        </div>
        <button type="button" class="settings-save-btn" id="saveManualFacilityBtn">手動施設を保存</button>
      </div>
      ${errorMessage ? `<div class="settings-error">${escapeHtml(errorMessage)}</div>` : ""}
      <button type="button" class="settings-danger-btn" id="clearAllFacilitiesBtn">すべての施設をクリア</button>
      ${renderModal()}
    </div>`;

    bindEvents(panel);
  }

  function bindEvents(panel) {
    panel.querySelector("#csvRegion1")?.addEventListener("change", (e) => {
      region1 = e.target.value;
      region2 = "";
      courseKey = "";
      render(panel);
    });
    panel.querySelector("#csvRegion2")?.addEventListener("change", (e) => {
      region2 = e.target.value;
      courseKey = "";
      render(panel);
    });
    panel.querySelector("#csvCourse")?.addEventListener("change", (e) => {
      courseKey = e.target.value;
    });
    panel.querySelector("#addCsvFacilityBtn")?.addEventListener("click", handleAddCsv);
    panel.querySelector("#getLocationBtn")?.addEventListener("click", getCurrentLocation);
    panel.querySelector("#showManualInputBtn")?.addEventListener("click", () => {
      showManualInput = true;
      render(panel);
    });
    panel.querySelector("#saveManualFacilityBtn")?.addEventListener("click", handleSaveManual);
    panel.querySelector("#clearAllFacilitiesBtn")?.addEventListener("click", handleClearAll);
    panel.querySelector("#manualFacilityName")?.addEventListener("input", (e) => {
      facilityName = e.target.value;
    });
    panel.querySelector("#manualLatitude")?.addEventListener("input", (e) => {
      latitude = e.target.value;
    });
    panel.querySelector("#manualLongitude")?.addEventListener("input", (e) => {
      longitude = e.target.value;
    });

    panel.querySelectorAll(".settings-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeFacility(btn.dataset.removeId));
    });

    panel.querySelector("#facilityModalCancel")?.addEventListener("click", () => {
      modal = null;
      render(panel);
    });

    panel.querySelectorAll(".settings-replace-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.replaceMode === "manual") {
          confirmReplaceManual(btn.dataset.replaceId);
        } else {
          confirmReplace(btn.dataset.replaceId);
        }
        render(panel);
      });
    });
  }

  function tryAddCsvRow(row) {
    const current = Facilities.loadFacilityItemsFromCookie();
    const csvCount = current.filter((i) => i.source === "csv").length;
    const total = current.length;
    const newItem = {
      source: "csv",
      id: Facilities.makeCsvFacilityId(row.region1, row.region2, row.name),
      region1: row.region1,
      region2: row.region2,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
    };

    if (current.some((i) => i.id === newItem.id)) {
      errorMessage = "この施設はすでに追加されています。";
      return;
    }

    if (csvCount < Facilities.MAX_CSV_FACILITIES && total < Facilities.MAX_TOTAL_FACILITIES) {
      Facilities.saveFacilityItemsToCookie([...current, newItem]);
      errorMessage = "";
      notifyParent();
      return;
    }

    modal = { newItem, current };
    errorMessage = "";
  }

  function confirmReplace(removeId) {
    if (!modal) return;
    const filtered = modal.current.filter((i) => i.id !== removeId);
    Facilities.saveFacilityItemsToCookie([...filtered, modal.newItem]);
    modal = null;
    notifyParent();
  }

  function confirmReplaceManual(removeId) {
    if (!modal) return;
    const filtered = modal.current.filter((i) => i.id !== removeId);
    Facilities.saveFacilityItemsToCookie([...filtered, modal.newItem]);
    modal = null;
    notifyParent();
  }

  function handleAddCsv() {
    errorMessage = "";
    const panel = document.getElementById("facility-settings-panel");
    const courses = tree[region1]?.[region2] || [];
    const row = courses.find((r) => r.rowKey === courseKey);
    if (!row) {
      errorMessage = "地方・地域・ゴルフコースを選択してください。";
      if (panel) render(panel);
      return;
    }
    tryAddCsvRow(row);
    if (panel) render(panel);
  }

  function removeFacility(id) {
    const current = Facilities.loadFacilityItemsFromCookie();
    Facilities.saveFacilityItemsToCookie(current.filter((i) => i.id !== id));
    if (String(id).startsWith("manual:")) {
      facilityName = "";
      latitude = "";
      longitude = "";
    }
    notifyParent();
  }

  function getCurrentLocation() {
    errorMessage = "";
    if (!navigator.geolocation) {
      errorMessage = "お使いのブラウザは位置情報APIをサポートしていません。";
      showManualInput = true;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude.toFixed(6);
        longitude = position.coords.longitude.toFixed(6);
        showManualInput = true;
        if (onUpdated) onUpdated(false);
        const panel = document.getElementById("facility-settings-panel");
        if (panel) render(panel);
      },
      () => {
        showManualInput = true;
        errorMessage = "位置情報が取得できませんでした。手動で入力してください。";
        const panel = document.getElementById("facility-settings-panel");
        if (panel) render(panel);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleSaveManual() {
    errorMessage = "";
    const panel = document.getElementById("facility-settings-panel");
    facilityName = panel?.querySelector("#manualFacilityName")?.value?.trim() ?? facilityName;
    latitude = panel?.querySelector("#manualLatitude")?.value ?? latitude;
    longitude = panel?.querySelector("#manualLongitude")?.value ?? longitude;

    if (!facilityName) {
      errorMessage = "施設名を入力してください。";
      if (panel) render(panel);
      return;
    }
    if (!latitude || !longitude) {
      errorMessage = "緯度・経度を入力するか、位置情報を取得してください。";
      if (panel) render(panel);
      return;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      errorMessage = "緯度・経度は数値で入力してください。";
      if (panel) render(panel);
      return;
    }

    const manualItem = {
      source: "manual",
      id: "manual:1",
      name: facilityName,
      latitude: lat,
      longitude: lng,
    };

    const current = Facilities.loadFacilityItemsFromCookie();
    const withoutManual = current.filter((i) => i.source !== "manual");
    const hasManual = current.some((i) => i.source === "manual");

    if (hasManual) {
      Facilities.saveFacilityItemsToCookie([...withoutManual, manualItem]);
      notifyParent();
      return;
    }

    if (withoutManual.length < Facilities.MAX_TOTAL_FACILITIES) {
      Facilities.saveFacilityItemsToCookie([...withoutManual, manualItem]);
      notifyParent();
      return;
    }

    modal = { newItem: manualItem, current, replaceMode: "manual" };
    if (panel) render(panel);
  }

  function handleClearAll() {
    Facilities.clearAllFacilitiesCookie();
    region1 = "";
    region2 = "";
    courseKey = "";
    facilityName = "";
    latitude = "";
    longitude = "";
    errorMessage = "";
    modal = null;
    notifyParent();
  }

  async function init(options) {
    onUpdated = options.onUpdated;
    facilityItems = Facilities.loadFacilityItemsFromCookie();
    const manual = Facilities.getManualFacilityFromCookie();
    if (manual) {
      facilityName = manual.name;
      latitude = String(manual.latitude);
      longitude = String(manual.longitude);
    } else {
      const portal = Facilities.loadPortalSettingsAsFacilityItem();
      if (portal) {
        facilityName = portal.name;
        latitude = String(portal.latitude);
        longitude = String(portal.longitude);
        showManualInput = true;
      }
    }

    render(options.panel);

    try {
      const res = await fetch("data/golfCourse20260525.csv");
      if (!res.ok) throw new Error(`CSVの取得に失敗しました (${res.status})`);
      const text = await res.text();
      rows = GolfCourseCsv.parseGolfCourseCsv(text);
      tree = GolfCourseCsv.buildRegionTree(rows);
    } catch (e) {
      errorMessage = e.message || "CSVの読み込みに失敗しました";
    }

    render(options.panel);
  }

  function refresh(panel) {
    facilityItems = Facilities.loadFacilityItemsFromCookie();
    render(panel);
  }

  return { init, refresh };
})();
