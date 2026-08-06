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
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => ({
        date: row[0] ?? "",
        area: row[1] ?? "",
        memo: row[2] ?? "",
      }));
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
        (row) => `<tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.area)}</td>
        <td>${escapeHtml(row.memo)}</td>
      </tr>`
      )
      .join("");
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
      <form class="work-memo-form" id="work-memo-form">
        <input type="date" id="work-memo-date" value="${today}" aria-label="日付">
        <input type="text" id="work-memo-area-input" placeholder="エリア" maxlength="120" aria-label="エリア">
        <input type="text" id="work-memo-text" placeholder="メモ" maxlength="500" aria-label="メモ">
        <button type="submit" class="btn-primary work-memo-add-btn" ${isSaving ? "disabled" : ""}>${isSaving ? "保存中..." : "追加"}</button>
      </form>
      ${statusMessage ? `<p class="work-memo-status ${statusIsError ? "work-memo-status--error" : ""}">${escapeHtml(statusMessage)}</p>` : ""}
    </div>`;

    bindPanelEvents();

    const scrollEl = document.getElementById("work-memo-scroll");
    if (scrollEl) {
      requestAnimationFrame(() => {
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
    clearStatus();
    render();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const dateInput = document.getElementById("work-memo-date");
    const areaInput = document.getElementById("work-memo-area-input");
    const memoInput = document.getElementById("work-memo-text");
    const date = dateInput?.value?.trim();
    const area = areaInput?.value?.trim();
    const memo = memoInput?.value?.trim();

    if (!date) {
      setStatus("日付を入力してください", true);
      render();
      return;
    }

    isSaving = true;
    setStatus("保存中...");
    render();

    try {
      await appendRow(date, area || "", memo || "");
      if (areaInput) areaInput.value = "";
      if (memoInput) memoInput.value = "";
      await loadRows();
      setStatus("保存しました");
    } catch (error) {
      setStatus(error.message || "保存に失敗しました", true);
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
