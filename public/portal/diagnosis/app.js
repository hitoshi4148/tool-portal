import {
  MAX_LONG_EDGE,
  MAX_UPLOAD_MB,
  MODEL_CACHE_NAME,
  PORTAL_SETTINGS_COOKIE,
  TURF_TYPE_STORAGE_KEY,
} from "./constants.js";
import {
  adjustProbabilities,
  getRacSearchUrl,
  getReferenceImagePath,
  getTopK,
  prepareImage,
  softmax,
} from "./inference.js";

const MODEL_URL = "model.onnx";
const ORT_VERSION = "1.21.0";
const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist`;

/** @type {import('onnxruntime-web').InferenceSession | null} */
let session = null;
/** @type {string[]} */
let classNames = [];
/** @type {Record<string, { name?: string, symptom?: string, management?: string, fungicide?: string }>} */
let diseaseInfo = {};

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/** @returns {'暖地型芝' | '寒地型芝'} */
function getInitialTurfType() {
  const saved = localStorage.getItem(TURF_TYPE_STORAGE_KEY);
  if (saved === "暖地型芝" || saved === "寒地型芝") return saved;

  const raw = getCookie(PORTAL_SETTINGS_COOKIE);
  if (raw) {
    try {
      const settings = JSON.parse(raw);
      if (settings.greenType === "暖地型") return "暖地型芝";
      if (settings.greenType === "寒地型") return "寒地型芝";
    } catch {
      // ignore
    }
  }
  return "暖地型芝";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(1);
}

class LoadingTracker {
  constructor(statusEl) {
    this.statusEl = statusEl;
    this.startMs = performance.now();
    this.timerId = null;
  }

  setMessage(message) {
    this.statusEl.textContent = message;
  }

  startElapsed(prefix) {
    this.stopElapsed();
    const tick = () => {
      const elapsed = formatSeconds(performance.now() - this.startMs);
      this.statusEl.textContent = `${prefix}（経過 ${elapsed} 秒）`;
    };
    tick();
    this.timerId = window.setInterval(tick, 100);
  }

  stopElapsed() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  done(message) {
    this.stopElapsed();
    this.statusEl.textContent = message;
  }
}

async function loadOrt() {
  if (window.ort) return window.ort;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${ORT_CDN}/ort.min.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("ONNX Runtime の読み込みに失敗しました。"));
    document.head.appendChild(script);
  });
  window.ort.env.wasm.wasmPaths = `${ORT_CDN}/`;
  return window.ort;
}

async function loadJsonConfig() {
  const [classRes, infoRes] = await Promise.all([
    fetch("class_names.json"),
    fetch("disease_info.json"),
  ]);
  if (!classRes.ok || !infoRes.ok) {
    throw new Error("設定ファイルの読み込みに失敗しました。");
  }
  const classData = await classRes.json();
  classNames = classData.class_names ?? [];
  diseaseInfo = await infoRes.json();
  if (classNames.length === 0) {
    throw new Error("クラス定義が空です。");
  }
}

async function loadModel(tracker) {
  if (session) return { fromCache: true };

  await loadOrt();
  const modelFetchUrl = new URL(MODEL_URL, window.location.href).href;
  const cache = await caches.open(MODEL_CACHE_NAME);
  let response = await cache.match(modelFetchUrl);
  const fromCache = !!response;

  if (!fromCache) {
    tracker.setMessage("AIモデルを読み込んでいます…（初回のみ・約 6 MB）");
    response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error("AIモデルの取得に失敗しました。");
    }
    await cache.put(modelFetchUrl, response.clone());
  } else {
    tracker.setMessage("AIモデルを読み込んでいます…");
  }

  const buffer = await response.arrayBuffer();
  session = await ort.InferenceSession.create(buffer, {
    executionProviders: ["wasm"],
  });
  return { fromCache };
}

function getSelectedTurfType() {
  const selected = document.querySelector('input[name="turf-type"]:checked');
  return /** @type {'暖地型芝' | '寒地型芝'} */ (selected?.value ?? "暖地型芝");
}

function getSymptoms() {
  return {
    patch: /** @type {HTMLInputElement} */ (document.getElementById("symptom-patch")).checked,
    thread: /** @type {HTMLInputElement} */ (document.getElementById("symptom-thread")).checked,
    water: /** @type {HTMLInputElement} */ (document.getElementById("symptom-water")).checked,
    ring: /** @type {HTMLInputElement} */ (document.getElementById("symptom-ring")).checked,
  };
}

function validateFile(file) {
  const name = (file.name || "").toLowerCase();
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  if (!allowed.some((ext) => name.endsWith(ext))) {
    return "対応形式は JPG / JPEG / PNG / WEBP です。";
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_UPLOAD_MB) {
    return `画像サイズが大きすぎます（${sizeMb.toFixed(1)} MB）。${MAX_UPLOAD_MB} MB 以下の画像を選んでください。`;
  }
  return null;
}

function renderResults(predictedClass, confidence, topK, previewCanvas) {
  const resultsEl = document.getElementById("diagnosis-results");
  const info = diseaseInfo[predictedClass] ?? {};
  const displayName = info.name ?? predictedClass;
  const confidenceText = `${Math.round(confidence * 100)}%`;
  const racUrl = getRacSearchUrl(predictedClass);
  const refPath = getReferenceImagePath(predictedClass);

  const topHtml = topK
    .map((item, rank) => {
      const topName = diseaseInfo[item.className]?.name ?? item.className;
      const pct = Math.round(item.probability * 100);
      return `
        <div class="diag-top-item">
          <div class="diag-top-label">${rank + 1}位 ${escapeHtml(topName)} <strong>${pct}%</strong></div>
          <div class="diag-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="diag-progress-bar" style="width:${pct}%"></div>
          </div>
        </div>`;
    })
    .join("");

  resultsEl.innerHTML = `
    <section class="diag-result-card">
      <h2 class="diag-result-title">診断結果</h2>
      <p class="diag-result-summary">病名: ${escapeHtml(displayName)} / 信頼度: ${confidenceText}</p>
      <div class="diag-result-grid">
        <div class="diag-result-main">
          <h3 class="diag-disease-name">${escapeHtml(displayName)}</h3>
          <p class="diag-confidence">信頼度 <strong>${confidenceText}</strong></p>
          <h4>症状</h4>
          <p>${escapeHtml(info.symptom ?? "")}</p>
          <h4>管理方法</h4>
          <p>${escapeHtml(info.management ?? "")}</p>
          <h4>推奨薬剤系統</h4>
          <p>${escapeHtml(info.fungicide ?? "")}</p>
          <p class="diag-rac-link-wrap">
            <a class="diag-rac-link" href="${escapeHtml(racUrl)}">この病害の防除農薬をみる</a>
          </p>
          <h4>Top10 予測</h4>
          <div class="diag-top-list">${topHtml}</div>
        </div>
        <div class="diag-result-side">
          <img src="${escapeHtml(refPath)}" alt="参考画像" class="diag-ref-image" width="320" height="240"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <p class="diag-ref-missing" hidden>参考画像は現在準備中です</p>
          <div class="diag-upload-preview-wrap"></div>
        </div>
      </div>
    </section>`;

  const previewWrap = resultsEl.querySelector(".diag-upload-preview-wrap");
  if (previewWrap) {
    previewCanvas.className = "diag-upload-preview";
    previewWrap.appendChild(previewCanvas);
  }
  resultsEl.classList.remove("hidden");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runDiagnosis(file) {
  const statusEl = document.getElementById("diagnosis-status");
  const submitBtn = document.getElementById("diagnose-btn");
  const resultsEl = document.getElementById("diagnosis-results");
  const tracker = new LoadingTracker(statusEl);

  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  submitBtn.disabled = true;
  tracker.startMs = performance.now();

  try {
    const fileError = validateFile(file);
    if (fileError) throw new Error(fileError);

    tracker.setMessage("画像を処理しています…");
    const { previewCanvas, tensor } = await prepareImage(file, MAX_LONG_EDGE);

    const { fromCache } = await loadModel(tracker);
    if (fromCache) {
      tracker.setMessage("AIモデルを読み込んでいます…");
    }

    if (!session) throw new Error("AIモデルの初期化に失敗しました。");

    tracker.startElapsed("AI推論中…");
    const ort = await loadOrt();
    const input = new ort.Tensor("float32", tensor, [1, 3, 224, 224]);
    const outputs = await session.run({ input });
    const logits = Array.from(outputs.output.data);
    const baseProbs = softmax(logits);

    const turfType = getSelectedTurfType();
    localStorage.setItem(TURF_TYPE_STORAGE_KEY, turfType);
    const adjusted = adjustProbabilities(baseProbs, classNames, turfType, getSymptoms());

    let predIdx = 0;
    let maxProb = adjusted[0];
    for (let i = 1; i < adjusted.length; i++) {
      if (adjusted[i] > maxProb) {
        maxProb = adjusted[i];
        predIdx = i;
      }
    }

    const predictedClass = classNames[predIdx];
    const topK = getTopK(adjusted, classNames, Math.min(10, classNames.length));
    const totalSec = formatSeconds(performance.now() - tracker.startMs);
    tracker.done(`診断完了（合計 ${totalSec} 秒）`);
    renderResults(predictedClass, maxProb, topK, previewCanvas);
  } catch (err) {
    tracker.stopElapsed();
    const message = err instanceof Error ? err.message : "診断中にエラーが発生しました。";
    statusEl.textContent = message;
    statusEl.classList.add("diag-status--error");
  } finally {
    submitBtn.disabled = false;
  }
}

function initTurfTypeRadios() {
  const initial = getInitialTurfType();
  const warm = document.getElementById("turf-warm");
  const cool = document.getElementById("turf-cool");
  if (initial === "寒地型芝" && cool) cool.checked = true;
  else if (warm) warm.checked = true;

  const labelEl = document.getElementById("turf-type-label");
  const updateLabel = () => {
    if (labelEl) labelEl.textContent = `現在の芝種: ${getSelectedTurfType()}`;
  };
  document.querySelectorAll('input[name="turf-type"]').forEach((el) => {
    el.addEventListener("change", updateLabel);
  });
  updateLabel();
}

function initFileInput() {
  const input = /** @type {HTMLInputElement} */ (document.getElementById("photo-input"));
  const nameEl = document.getElementById("file-name");
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    nameEl.textContent = file ? file.name : "未選択";
  });
}

function initForm() {
  const form = document.getElementById("diagnosis-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const statusEl = document.getElementById("diagnosis-status");
    statusEl.classList.remove("diag-status--error");

    const file = /** @type {HTMLInputElement} */ (document.getElementById("photo-input")).files?.[0];
    if (!file) {
      statusEl.textContent = "病斑パッチの写真をアップロードしてください。";
      statusEl.classList.add("diag-status--error");
      return;
    }
    await runDiagnosis(file);
  });
}

async function init() {
  initTurfTypeRadios();
  initFileInput();
  initForm();
  try {
    await loadJsonConfig();
  } catch (err) {
    const statusEl = document.getElementById("diagnosis-status");
    statusEl.textContent = err instanceof Error ? err.message : "初期化に失敗しました。";
    statusEl.classList.add("diag-status--error");
  }
}

init();
