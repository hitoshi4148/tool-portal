const WorkMemoUI = (() => {
  const AUTH_STORAGE_KEY = "portalWorkMemoAuth";
  const SHEET_STORAGE_PREFIX = "portalWorkMemoSheetId:";
  const SHEET_RANGE = "作業履歴!A:C";
  const SHEET_DATA_RANGE = "作業履歴!A2:C";
  const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const GOOGLE_CONFIG_API = "/portal/api/google-config";

  let container = null;
  let clientId = null;
  let tokenClient = null;
  let facilityName = "";
  let authState = null;
  let rows = [];
  let statusMessage = "";
  let statusIsError = false;
  let isConnecting = false;
  let isSaving = false;
  let selectedSheetRow = null;

  function getJstTodayString() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function sanitizeSheetTitle(name) {
    const base = (name || "施設").trim() || "施設";
    return `${base.replace(/[\\/?:*[\]]/g, "_")}作業履歴`;
  }

  function getSheetStorageKey() {
    return `${SHEET_STORAGE_PREFIX}${sanitizeSheetTitle(facilityName)}`;
  }

  function loadAuthState() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.accessToken || !parsed?.expiresAt) return null;
      if (Date.now() >= parsed.expiresAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveAuthState(state) {
    authState = state;
    if (!state) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  }

  function loadSheetId() {
    return localStorage.getItem(getSheetStorageKey());
  }

  function saveSheetId(sheetId) {
    localStorage.setItem(getSheetStorageKey(), sheetId);
  }

  function setStatus(message, isError = false) {
    statusMessage = message;
    statusIsError = isError;
  }

  function clearStatus() {
    statusMessage = "";
    statusIsError = false;
  }

  function normalizeDateForInput(value) {
    const text = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsed);
    }

    return getJstTodayString();
  }

  function clearSelection() {
    selectedSheetRow = null;
  }

  function getSelectedRow() {
    if (!selectedSheetRow) return null;
    return rows.find((row) => row.sheetRow === selectedSheetRow) ?? null;
  }

  function selectRow(sheetRow) {
    const row = rows.find((entry) => entry.sheetRow === sheetRow);
    if (!row || selectedSheetRow === sheetRow) return;
    selectedSheetRow = sheetRow;
    clearStatus();
    render();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function ensureGoogleClientId() {
    if (clientId) return clientId;
    const response = await fetch(GOOGLE_CONFIG_API);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Google 連携 API の応答が不正です（/portal/api/google-config）");
    }
    if (!response.ok || !data.success || !data.clientId) {
      throw new Error(
        data.error ||
          "Google 連携の設定がありません（管理者に GOOGLE_OAUTH_CLIENT_ID を設定してください）"
      );
    }
    clientId = data.clientId;
    return clientId;
  }

  function waitForGoogleIdentity(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
      const check = (attempt) => {
        if (window.google?.accounts?.oauth2) {
          resolve();
          return;
        }
        if (attempt >= maxAttempts) {
          reject(new Error("Google ログイン script の初期化に失敗しました"));
          return;
        }
        setTimeout(() => check(attempt + 1), 100);
      };
      check(0);
    });
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let script = document.getElementById("google-gsi-script");
      if (!script) {
        script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          waitForGoogleIdentity().then(resolve).catch(reject);
        };
        script.onerror = () => reject(new Error("Google ログイン script の読み込みに失敗しました"));
        document.head.appendChild(script);
        return;
      }

      script.addEventListener(
        "load",
        () => {
          waitForGoogleIdentity().then(resolve).catch(reject);
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => reject(new Error("Google ログイン script の読み込みに失敗しました")),
        { once: true }
      );

      if (script.readyState === "complete" || script.dataset.loaded === "true") {
        waitForGoogleIdentity().then(resolve).catch(reject);
      }
    });
  }

  function requestAccessToken() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            "Google 連携がタイムアウトしました。ポップアップのブロック解除後、再度お試しください。"
          )
        );
      }, 120_000);

      tokenClient.callback = (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);

        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        const expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000 - 60_000;
        const nextState = {
          accessToken: response.access_token,
          expiresAt,
        };
        saveAuthState(nextState);
        resolve(nextState);
      };

      try {
        tokenClient.requestAccessToken({ prompt: authState ? "" : "consent" });
      } catch (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async function ensureAccessToken(forcePrompt = false) {
    if (!forcePrompt) {
      const cached = loadAuthState();
      if (cached) {
        authState = cached;
        return cached.accessToken;
      }
    }

    await ensureGoogleClientId();
    await loadGoogleScript();

    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        callback: () => {},
      });
    }

    const state = await requestAccessToken();
    return state.accessToken;
  }

  async function googleFetch(url, options = {}, allowRetry = true) {
    const token = await ensureAccessToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && allowRetry) {
      saveAuthState(null);
      await ensureAccessToken(true);
      return googleFetch(url, options, false);
    }
    if (!response.ok) {
      throw new Error(data.error?.message || "Google API エラー");
    }
    return data;
  }

  async function sheetsFetch(path, options = {}) {
    return googleFetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, options);
  }

  async function driveFetch(path, options = {}) {
    return googleFetch(`https://www.googleapis.com/drive/v3${path}`, options);
  }

  async function findExistingSpreadsheet(title) {
    const query = encodeURIComponent(
      `mimeType='application/vnd.google-apps.spreadsheet' and name='${title.replace(/'/g, "\\'")}' and trashed=false`
    );
    const data = await driveFetch(`/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`);
    return data.files?.[0]?.id ?? null;
  }

  async function createSpreadsheet(title) {
    const created = await sheetsFetch("", {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: "作業履歴" } }],
      }),
    });

    await sheetsFetch(`/${created.spreadsheetId}/values/${encodeURIComponent(SHEET_RANGE)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({
        range: SHEET_RANGE,
        majorDimension: "ROWS",
        values: [["日付", "エリア", "メモ"]],
      }),
    });

    return created.spreadsheetId;
  }

  async function ensureSpreadsheetId() {
    const cached = loadSheetId();
    if (cached) {
      return cached;
    }

    const title = sanitizeSheetTitle(facilityName);
    let sheetId = await findExistingSpreadsheet(title);
    if (!sheetId) {
      sheetId = await createSpreadsheet(title);
    }

    saveSheetId(sheetId);
    return sheetId;
  }

  async function loadRows() {
    const sheetId = await ensureSpreadsheetId();
    const data = await sheetsFetch(
      `/${sheetId}/values/${encodeURIComponent(SHEET_DATA_RANGE)}?majorDimension=ROWS`
    );
    rows = (data.values || [])
      .map((row, index) => ({
        sheetRow: index + 2,
        date: String(row[0] ?? "").trim(),
        area: String(row[1] ?? "").trim(),
        memo: String(row[2] ?? "").trim(),
      }))
      .filter((row) => row.date || row.area || row.memo);

    if (selectedSheetRow && !rows.some((row) => row.sheetRow === selectedSheetRow)) {
      clearSelection();
    }
  }

  async function getWorkHistorySheetTabId(spreadsheetId) {
    const data = await sheetsFetch(`/${spreadsheetId}?fields=sheets(properties(sheetId,title))`);
    const sheet = data.sheets?.find((entry) => entry.properties?.title === "作業履歴");
    if (!sheet?.properties || sheet.properties.sheetId == null) {
      throw new Error("作業履歴シートが見つかりません");
    }
    return sheet.properties.sheetId;
  }

  async function updateRow(sheetRow, date, area, memo) {
    const sheetId = await ensureSpreadsheetId();
    const range = `作業履歴!A${sheetRow}:C${sheetRow}`;
    await sheetsFetch(
      `/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: [[date, area, memo]],
        }),
      }
    );
  }

  async function deleteRow(sheetRow) {
    const spreadsheetId = await ensureSpreadsheetId();
    const sheetTabId = await getWorkHistorySheetTabId(spreadsheetId);
    await sheetsFetch(`/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetTabId,
                dimension: "ROWS",
                startIndex: sheetRow - 1,
                endIndex: sheetRow,
              },
            },
          },
        ],
      }),
    });
  }

  async function appendRow(date, area, memo) {
    const sheetId = await ensureSpreadsheetId();
    await sheetsFetch(
      `/${sheetId}/values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({
          range: SHEET_RANGE,
          majorDimension: "ROWS",
          values: [[date, area, memo]],
        }),
      }
    );
  }

  function buildWorkMemoInfoHtml(sheetTitle) {
    const fileName = escapeHtml(sheetTitle);
    return `<span class="series-info-anchor work-memo-info-anchor">
      <button type="button" class="series-info-btn" aria-label="芝しごとノートの保存先について">i</button>
      <span class="series-info-popover work-memo-info-popover" role="tooltip">
        ここで入力した内容は、各利用者の Google ドライブ（マイドライブ）に「${fileName}」というスプレッドシート（日付・エリア・メモ）として保存されます。
        芝しごとポータルのサーバー側ではデータを保持・管理しません。保存先は連携した Google アカウント内のみです。
        <br><br>
        <strong>本機能は現在、試験運用中です。</strong>
        試験参加をご希望の方は、Gmail から hitoshi.yoshinobu@gmail.com 宛に「試験参加希望」とお送りください。名前・住所等の個人情報は一切不要です。
      </span>
    </span>`;
  }

  function buildWorkMemoTitleHtml(sheetTitle) {
    return `<div class="work-memo-title-main">
      <h3 class="disease-risk-title">芝しごとノート</h3>
      ${buildWorkMemoInfoHtml(sheetTitle)}
    </div>`;
  }

  function buildRowsHtml() {
    if (rows.length === 0) {
      return `<tr><td colspan="3" class="work-memo-empty">まだ記録がありません</td></tr>`;
    }

    return rows
      .map(
        (row) => `<tr class="work-memo-row${row.sheetRow === selectedSheetRow ? " work-memo-row--selected" : ""}" data-sheet-row="${row.sheetRow}" tabindex="0" role="button" aria-label="記録を編集">
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.area)}</td>
        <td>${escapeHtml(row.memo)}</td>
      </tr>`
      )
      .join("");
  }

  const MIC_ICON_SVG = `<svg class="ai-advisor-mic-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`;

  function buildVoiceFieldHtml(inputHtml, micId, statusId, label) {
    const micLabel = `${label}を音声入力`;
    return `<div class="voice-field">
      <div class="voice-field-row">
        ${inputHtml}
        <button type="button" id="${micId}" class="ai-advisor-mic-btn work-memo-mic-btn" aria-label="${micLabel}" data-mic-label="${micLabel}" aria-pressed="false">${MIC_ICON_SVG}</button>
      </div>
      <p id="${statusId}" class="ai-advisor-mic-status work-memo-mic-status" hidden></p>
    </div>`;
  }

  function buildFormHtml(today) {
    const editing = selectedSheetRow != null;
    const selectedRow = getSelectedRow();
    const formDate = editing && selectedRow ? normalizeDateForInput(selectedRow.date) : today;
    const formArea = editing && selectedRow ? selectedRow.area : "";
    const formMemo = editing && selectedRow ? selectedRow.memo : "";
    const savingLabel = editing ? "更新中..." : "保存中...";
    const submitLabel = editing ? "更新" : "追加";

    if (editing) {
      return `<form class="work-memo-form work-memo-form--edit" id="work-memo-form">
        <input type="date" id="work-memo-date" value="${escapeHtml(formDate)}" aria-label="日付">
        ${buildVoiceFieldHtml(`<input type="text" id="work-memo-area-input" placeholder="エリア" maxlength="120" aria-label="エリア" value="${escapeHtml(formArea)}">`, "work-memo-area-mic", "work-memo-area-mic-status", "エリア")}
        ${buildVoiceFieldHtml(`<input type="text" id="work-memo-text" placeholder="メモ" maxlength="500" aria-label="メモ" value="${escapeHtml(formMemo)}">`, "work-memo-text-mic", "work-memo-text-mic-status", "メモ")}
        <div class="work-memo-form-actions">
          <button type="submit" class="btn-primary work-memo-save-btn" ${isSaving ? "disabled" : ""}>${isSaving ? savingLabel : submitLabel}</button>
          <button type="button" class="work-memo-cancel-btn" id="work-memo-cancel-btn" ${isSaving ? "disabled" : ""}>キャンセル</button>
          <button type="button" class="work-memo-delete-btn" id="work-memo-delete-btn" ${isSaving ? "disabled" : ""}>削除</button>
        </div>
      </form>`;
    }

    return `<form class="work-memo-form" id="work-memo-form">
      <input type="date" id="work-memo-date" value="${escapeHtml(formDate)}" aria-label="日付">
      ${buildVoiceFieldHtml(`<input type="text" id="work-memo-area-input" placeholder="エリア" maxlength="120" aria-label="エリア">`, "work-memo-area-mic", "work-memo-area-mic-status", "エリア")}
      ${buildVoiceFieldHtml(`<input type="text" id="work-memo-text" placeholder="メモ" maxlength="500" aria-label="メモ">`, "work-memo-text-mic", "work-memo-text-mic-status", "メモ")}
      <button type="submit" class="btn-primary work-memo-add-btn" ${isSaving ? "disabled" : ""}>${isSaving ? savingLabel : submitLabel}</button>
    </form>`;
  }

  function render() {
    if (!container) return;

    const connected = Boolean(loadAuthState());
    const sheetTitle = sanitizeSheetTitle(facilityName);
    const today = getJstTodayString();

    if (!connected) {
      container.innerHTML = `<div class="work-memo-panel disease-risk-panel">
        ${buildWorkMemoTitleHtml(sheetTitle)}
        <p class="work-memo-intro">Google ドライブ上に「${escapeHtml(sheetTitle)}」スプレッドシートを作成し、作業履歴を保存する機能を試験的に公開しています。モニター参加をご希望の方は、Gmail から hitoshi.yoshinobu@gmail.com 宛に「試験参加希望」とお送りください。名前・住所等の個人情報は一切不要です。</p>
        <button type="button" class="btn-primary work-memo-connect-btn" id="work-memo-connect-btn" ${isConnecting ? "disabled" : ""}>${isConnecting ? "連携中..." : "Googleで連携"}</button>
        ${statusMessage ? `<p class="work-memo-status ${statusIsError ? "work-memo-status--error" : ""}">${escapeHtml(statusMessage)}</p>` : ""}
      </div>`;
      bindPanelEvents();
      return;
    }

    container.innerHTML = `<div class="work-memo-panel disease-risk-panel">
      <div class="work-memo-title-row">
        ${buildWorkMemoTitleHtml(sheetTitle)}
        <button type="button" class="work-memo-disconnect-btn" id="work-memo-disconnect-btn">連携解除</button>
      </div>
      <p class="work-memo-sheet-name">${escapeHtml(sheetTitle)}</p>
      <div class="work-memo-table-wrap" id="work-memo-scroll">
        <table class="work-memo-table">
          <thead>
            <tr><th>日付</th><th>エリア</th><th>メモ</th></tr>
          </thead>
          <tbody>${buildRowsHtml()}</tbody>
        </table>
      </div>
      ${buildFormHtml(today)}
      <p class="voice-unsupported-hint" hidden>音声入力は PC または Android の Chrome / Edge で使えます</p>
      ${statusMessage ? `<p class="work-memo-status ${statusIsError ? "work-memo-status--error" : ""}">${escapeHtml(statusMessage)}</p>` : ""}
    </div>`;

    bindPanelEvents();

    const scrollEl = document.getElementById("work-memo-scroll");
    if (scrollEl) {
      requestAnimationFrame(() => {
        if (selectedSheetRow) {
          const rowEl = scrollEl.querySelector(`tr[data-sheet-row="${selectedSheetRow}"]`);
          rowEl?.scrollIntoView({ block: "nearest" });
          return;
        }
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }
  }

  async function connect() {
    if (isConnecting) return;
    isConnecting = true;
    setStatus("Google アカウント選択画面を開いています...");
    render();

    try {
      await ensureAccessToken(true);
      setStatus("スプレッドシートを準備しています...");
      render();
      await loadRows();
      clearStatus();
    } catch (error) {
      setStatus(error.message || "Google 連携に失敗しました", true);
    } finally {
      isConnecting = false;
      render();
    }
  }

  function disconnect() {
    saveAuthState(null);
    rows = [];
    clearSelection();
    clearStatus();
    render();
  }

  function readFormValues() {
    const dateInput = document.getElementById("work-memo-date");
    const areaInput = document.getElementById("work-memo-area-input");
    const memoInput = document.getElementById("work-memo-text");
    return {
      date: dateInput?.value?.trim() ?? "",
      area: areaInput?.value?.trim() ?? "",
      memo: memoInput?.value?.trim() ?? "",
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;
    if (window.VoiceInput) window.VoiceInput.stopAll();

    const { date, area, memo } = readFormValues();

    if (!date) {
      setStatus("日付を入力してください", true);
      render();
      return;
    }

    const editing = selectedSheetRow != null;
    isSaving = true;
    setStatus(editing ? "更新中..." : "保存中...");
    render();

    try {
      if (editing) {
        await updateRow(selectedSheetRow, date, area || "", memo || "");
        clearSelection();
        await loadRows();
        setStatus("更新しました");
      } else {
        await appendRow(date, area || "", memo || "");
        const areaInput = document.getElementById("work-memo-area-input");
        const memoInput = document.getElementById("work-memo-text");
        if (areaInput) areaInput.value = "";
        if (memoInput) memoInput.value = "";
        await loadRows();
        setStatus("保存しました");
      }
    } catch (error) {
      setStatus(error.message || (editing ? "更新に失敗しました" : "保存に失敗しました"), true);
    } finally {
      isSaving = false;
      render();
    }
  }

  function handleCancel() {
    if (isSaving) return;
    clearSelection();
    clearStatus();
    render();
  }

  async function handleDelete() {
    if (isSaving || !selectedSheetRow) return;
    if (!window.confirm("この記録を削除しますか？")) {
      return;
    }

    isSaving = true;
    setStatus("削除中...");
    render();

    try {
      await deleteRow(selectedSheetRow);
      clearSelection();
      await loadRows();
      setStatus("削除しました");
    } catch (error) {
      setStatus(error.message || "削除に失敗しました", true);
    } finally {
      isSaving = false;
      render();
    }
  }

  function bindPanelEvents() {
    const connectBtn = container.querySelector("#work-memo-connect-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", connect);
    }

    const disconnectBtn = container.querySelector("#work-memo-disconnect-btn");
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", disconnect);
    }

    const form = container.querySelector("#work-memo-form");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }

    const cancelBtn = container.querySelector("#work-memo-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", handleCancel);
    }

    const deleteBtn = container.querySelector("#work-memo-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", handleDelete);
    }

    container.querySelectorAll(".work-memo-row[data-sheet-row]").forEach((rowEl) => {
      rowEl.addEventListener("click", () => {
        const sheetRow = Number(rowEl.dataset.sheetRow);
        if (!Number.isFinite(sheetRow)) return;
        selectRow(sheetRow);
      });
      rowEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const sheetRow = Number(rowEl.dataset.sheetRow);
        if (!Number.isFinite(sheetRow)) return;
        selectRow(sheetRow);
      });
    });

    bindVoiceFields();
  }

  function bindVoiceFields() {
    if (!window.VoiceInput) return;
    window.VoiceInput.bindVoiceField({
      input: container.querySelector("#work-memo-area-input"),
      micBtn: container.querySelector("#work-memo-area-mic"),
      micStatus: container.querySelector("#work-memo-area-mic-status"),
      maxLength: 120,
    });
    window.VoiceInput.bindVoiceField({
      input: container.querySelector("#work-memo-text"),
      micBtn: container.querySelector("#work-memo-text-mic"),
      micStatus: container.querySelector("#work-memo-text-mic-status"),
      maxLength: 500,
    });
    window.VoiceInput.revealUnsupportedHints(container);
  }

  function bindEvents() {
    if (!container || container.dataset.memoBound === "true") return;
    container.dataset.memoBound = "true";
  }

  function updateFacilityName(name) {
    facilityName = (name || "").trim();
    authState = loadAuthState();
    clearStatus();
    render();

    if (authState) {
      loadRows()
        .then(() => {
          clearStatus();
          render();
        })
        .catch((error) => {
          setStatus(error.message || "履歴の読み込みに失敗しました", true);
          render();
        });
    }
  }

  function init(target, settings = {}) {
    container = target;
    facilityName = (settings.facilityName || "").trim();
    authState = loadAuthState();
    render();
    bindEvents();

    if (authState) {
      loadRows()
        .then(() => {
          clearStatus();
          render();
        })
        .catch(() => {
          saveAuthState(null);
          setStatus("Google 連携の有効期限が切れました。再度連携してください。", true);
          render();
        });
    }
  }

  return {
    init,
    updateFacilityName,
  };
})();
