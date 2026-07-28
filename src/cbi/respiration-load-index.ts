import { CBI_RESPIRATION } from "./cbi-config";

/**
 * Hourly respiration load contribution using simplified Q10 response.
 * RLI_hour = Q10^((T - Topt) / 10)
 */
export function hourlyRespirationLoad(
  temperature: number,
  nightOptimumTemp: number = CBI_RESPIRATION.nightOptimumTemp,
  q10: number = CBI_RESPIRATION.q10
): number {
  return Math.pow(q10, (temperature - nightOptimumTemp) / 10);
}

/** Sum hourly respiration load over night hours. */
export function computeRespirationLoadIndex(
  nightTemperatures: number[],
  nightOptimumTemp: number = CBI_RESPIRATION.nightOptimumTemp,
  q10: number = CBI_RESPIRATION.q10
): number {
  if (nightTemperatures.length === 0) {
    return 0;
  }

  return nightTemperatures.reduce(
    (sum, temp) => sum + hourlyRespirationLoad(temp, nightOptimumTemp, q10),
    0
  );
}
