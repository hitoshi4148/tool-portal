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

export async function fetchMet(lat: number, lon: number): Promise<MetResponse> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "tool-portal/0.1 (contact: hitoshi.yoshinobu@gmail.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`MET API error: ${response.status}`);
  }

  return response.json() as Promise<MetResponse>;
}
