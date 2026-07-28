/** Version 1 — coefficients are provisional and intended for later calibration. */

export const CBI_VERSION = 1;

export const CBI_DAY_START_HOUR = 6;
export const CBI_DAY_END_HOUR = 18;

export const CBI_GP_GRASS = {
  grassName: "ベントグラス",
  optimum: 20,
  variance: 10,
} as const;

export const CBI_RESPIRATION = {
  q10: 2,
  nightOptimumTemp: 15,
} as const;

export const CBI_DLI = {
  /** Reference daily shortwave integral (MJ/m²) for full sun — maps to L ≈ 1.0 */
  referenceMjPerDay: 20,
  minLightFactor: 0.5,
  maxLightFactor: 1,
  /** Used when neither radiation nor cloud data is available */
  defaultLightFactor: 0.85,
} as const;

export const CBI_MIN_RESPIRATION_LOAD_INDEX = 0.5;

/** Most recent day first; weights sum to 1.0 */
export const CBI_HISTORY_WEIGHTS = [0.3, 0.25, 0.2, 0.1, 0.07, 0.05, 0.03] as const;

/** CBI thresholds for 5→1 stars (inclusive lower bound per level) */
export const CBI_STAR_THRESHOLDS = [2.0, 1.5, 1.0, 0.7, 0.4] as const;

export const CBI_STAR_LABELS = [
  "非常に良好",
  "良好",
  "注意",
  "かなり危険",
  "危険",
] as const;

export const CBI_ENERGY_PERCENT_LEVELS = [
  { minPercent: 80, label: "非常に元気" },
  { minPercent: 60, label: "良好" },
  { minPercent: 40, label: "注意" },
  { minPercent: 20, label: "かなり弱っている" },
  { minPercent: 0, label: "危険" },
] as const;

/** Map weighted CBI to 0–100% energy reserve display */
export const CBI_ENERGY_CBI_RANGE = {
  highCbi: 2.0,
  lowCbi: 0.4,
  highPercent: 100,
  lowPercent: 20,
} as const;
