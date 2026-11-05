export interface MetTimeseriesEntry {
  time: string;
  data: {
    instant: {
      details: {
        wind_speed?: number;
        air_temperature?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
      };
    };
    next_1_hours?: {
      details: {
        precipitation_amount?: number;
      };
    };
    next_6_hours?: {
      details: {
        precipitation_amount?: number;
      };
    };
  };
}

export interface MetResponse {
  properties: {
    timeseries: MetTimeseriesEntry[];
  };
}

import { fetchJsonWithRetry } from "../shared/fetch-json-with-retry";

/** Tiny offsets so retries miss a poisoned CDN/cache entry for a popular lat/lon. */
const MET_RETRY_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.0001, 0.0001],
  [-0.0001, -0.0001],
];

function metForecastUrl(lat: number, lon: number): string {
  return `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
}

export async function fetchMet(lat: number, lon: number): Promise<MetResponse> {
  return fetchJsonWithRetry<MetResponse>(
    (attempt) => {
      const [dLat, dLon] =
        MET_RETRY_OFFSETS[Math.min(attempt, MET_RETRY_OFFSETS.length - 1)];
      return metForecastUrl(lat + dLat, lon + dLon);
    },
    {
      headers: {
        "User-Agent": "tool-portal/0.1 (contact: hitoshi.yoshinobu@gmail.com)",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      // Avoid Cloudflare caching a truncated MET body for the subrequest.
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    } as RequestInit,
    { label: "MET", attempts: MET_RETRY_OFFSETS.length }
  );
}
