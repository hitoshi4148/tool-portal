/** Shared probability adjustment logic (mirrors public/portal/diagnosis/inference.js). */

export type TurfType = "暖地型芝" | "寒地型芝";

export const TURF_CLASS_PRIORS: Record<TurfType, Record<string, number>> = {
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

export interface SymptomFlags {
  patch: boolean;
  thread: boolean;
  water: boolean;
  ring: boolean;
}

export function adjustProbabilities(
  probs: ArrayLike<number>,
  classNames: string[],
  turfType: TurfType,
  symptoms: SymptomFlags,
): Float64Array {
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
