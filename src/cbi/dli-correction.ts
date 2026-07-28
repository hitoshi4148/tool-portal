import { CBI_DLI } from "./cbi-config";

/**
 * Light correction factor L from daily shortwave integral (MJ/m²).
 * DLI sufficient → ~1.0, overcast → ~0.5–0.9.
 */
export function lightCorrectionFromDliMj(dliMj: number): number {
  const ratio = dliMj / CBI_DLI.referenceMjPerDay;
  const factor = 0.5 + 0.5 * ratio;
  return clamp(
    factor,
    CBI_DLI.minLightFactor,
    CBI_DLI.maxLightFactor
  );
}

/**
 * Estimate L from mean daytime cloud fraction (0–1, MET).
 */
export function lightCorrectionFromCloudFraction(
  cloudFraction: number
): number {
  const clamped = clamp(cloudFraction, 0, 1);
  const factor = 1 - 0.5 * clamped;
  return clamp(
    factor,
    CBI_DLI.minLightFactor,
    CBI_DLI.maxLightFactor
  );
}

/** Sum hourly Wh/m² shortwave over daylight hours → MJ/m² */
export function sumHourlyShortwaveToMj(
  hourlyWhPerM2: number[]
): number {
  const totalWh = hourlyWhPerM2.reduce(
    (sum, value) => sum + (value > 0 ? value : 0),
    0
  );
  return totalWh / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
