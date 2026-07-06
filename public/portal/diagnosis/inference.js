import {
  DISEASE_QUERY_NAME_MAP,
  IMAGENET_MEAN,
  IMAGENET_STD,
  TURF_CLASS_PRIORS,
} from "./constants.js";

/**
 * @param {Float32Array | number[]} probs
 * @param {string[]} classNames
 * @param {import('./constants.js').TurfType} turfType
 * @param {{ patch: boolean, thread: boolean, water: boolean, ring: boolean }} symptoms
 */
export function adjustProbabilities(probs, classNames, turfType, symptoms) {
  const adjusted = Float64Array.from(probs);
  const priors = TURF_CLASS_PRIORS[turfType] ?? {};

  for (let i = 0; i < classNames.length; i++) {
    const name = classNames[i];
    const n = name.toLowerCase().replace(/_/g, "");
    adjusted[i] *= priors[name] ?? 1.0;

    if (symptoms.thread && n.includes("redthread")) adjusted[i] *= 1.6;
    if (symptoms.ring && n.includes("fairy")) adjusted[i] *= 1.25;
    if (symptoms.water && n.includes("pythium")) adjusted[i] *= 1.2;
    if (symptoms.patch && n.includes("dollar")) adjusted[i] *= 1.15;
  }

  let total = 0;
  for (let i = 0; i < adjusted.length; i++) total += adjusted[i];
  if (total <= 0) return adjusted;
  for (let i = 0; i < adjusted.length; i++) adjusted[i] /= total;
  return adjusted;
}

/** @param {number[]} logits */
export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/**
 * @param {ImageData} imageData
 * @returns {Float32Array}
 */
export function imageDataToTensor(imageData) {
  const { data, width, height } = imageData;
  const size = width * height;
  const tensor = new Float32Array(3 * size);

  for (let i = 0; i < size; i++) {
    const px = i * 4;
    const r = data[px] / 255;
    const g = data[px + 1] / 255;
    const b = data[px + 2] / 255;
    tensor[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensor[size + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensor[2 * size + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  return tensor;
}

/**
 * @param {File} file
 * @param {number} maxLongEdge
 */
export async function prepareImage(file, maxLongEdge = 1024) {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const longEdge = Math.max(width, height);

  if (longEdge > maxLongEdge) {
    const scale = maxLongEdge / longEdge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = width;
  previewCanvas.height = height;
  const previewCtx = previewCanvas.getContext("2d");
  if (!previewCtx) throw new Error("Canvas が利用できません。");
  previewCtx.drawImage(bitmap, 0, 0, width, height);

  const modelCanvas = document.createElement("canvas");
  modelCanvas.width = 224;
  modelCanvas.height = 224;
  const modelCtx = modelCanvas.getContext("2d");
  if (!modelCtx) throw new Error("Canvas が利用できません。");
  modelCtx.drawImage(previewCanvas, 0, 0, 224, 224);
  bitmap.close();

  const imageData = modelCtx.getImageData(0, 0, 224, 224);
  return { previewCanvas, tensor: imageDataToTensor(imageData) };
}

/**
 * @param {Float64Array | Float32Array | number[]} probs
 * @param {string[]} classNames
 * @param {number} k
 */
export function getTopK(probs, classNames, k = 10) {
  const indices = Array.from({ length: classNames.length }, (_, i) => i);
  indices.sort((a, b) => probs[b] - probs[a]);
  return indices.slice(0, k).map((idx) => ({
    className: classNames[idx],
    probability: probs[idx],
  }));
}

/** @param {string} className */
export function getRacSearchUrl(className) {
  const target = DISEASE_QUERY_NAME_MAP[className] ?? className;
  return `/portal/rac/?target=${encodeURIComponent(target)}`;
}

/** @param {string} className */
export function getReferenceImagePath(className) {
  return `images/${className.toLowerCase().replace(/ /g, "_")}.jpg`;
}
