/** @typedef {'暖地型芝' | '寒地型芝'} TurfType */

/** @type {Record<TurfType, Record<string, number>>} */
export const TURF_CLASS_PRIORS = {
  暖地型芝: {
    large_patch: 2.2,
    take_all_patch: 1.4,
    snow_mold: 0.1,
    dollar_spot: 0.2,
    anthracnose_decline: 0.3,
    leaf_spot: 0.6,
    red_thread: 0.5,
  },
  寒地型芝: {
    large_patch: 0.05,
    take_all_patch: 0.4,
    snow_mold: 1.4,
    dollar_spot: 1.25,
    anthracnose_decline: 1.25,
    leaf_spot: 1.15,
    red_thread: 1.1,
  },
};

/** @type {Record<string, string>} */
export const DISEASE_QUERY_NAME_MAP = {
  anthracnose_decline: "炭疽病",
  brown_patch: "ブラウンパッチ",
  dollar_spot: "ダラースポット",
  fairy_ring: "フェアリーリング",
  large_patch: "ラージパッチ",
  leaf_spot: "葉枯病",
  pythium: "ピシウム",
  red_thread: "赤葉腐病",
  snow_mold: "雪腐病",
  take_all_patch: "立枯病",
};

export const IMAGENET_MEAN = [0.485, 0.456, 0.406];
export const IMAGENET_STD = [0.229, 0.224, 0.225];
export const MAX_UPLOAD_MB = 12;
export const MAX_LONG_EDGE = 1024;
export const MODEL_CACHE_NAME = "diagnosis-model-v110";
export const TURF_TYPE_STORAGE_KEY = "diagnosisTurfType";
export const PORTAL_SETTINGS_COOKIE = "portalSettings";
