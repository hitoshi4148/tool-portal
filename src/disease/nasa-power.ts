export interface DailyWeatherRecord {
  date: string;
  temperature_avg: number | null;
  humidity_avg: number | null;
  temperature_max: number | null;
  temperature_min: number | null;
}

export interface HourlyWeatherRecord {
  datetime: string;
  temperature: number | null;
  humidity: number | null;
}

function formatDateForNasa(date: string): string {
  return date.replace(/-/g, "");
}

function normalizeDaily(rawData: {
  properties?: { parameter?: Record<string, Record<string, number>> };
}): DailyWeatherRecord[] {
  const parameter = rawData.properties?.parameter;
  if (!parameter) {
    throw new Error("Invalid NASA POWER daily response");
  }

  const t2m = parameter.T2M ?? {};
  const rh2m = parameter.RH2M ?? {};
  const t2mMax = parameter.T2M_MAX ?? {};
  const t2mMin = parameter.T2M_MIN ?? {};

  return Object.keys(t2m)
    .sort()
    .map((dateKey) => {
      const year = dateKey.substring(0, 4);
      const month = dateKey.substring(4, 6);
      const day = dateKey.substring(6, 8);
      const toNumber = (value: number | undefined) =>
        value !== null && value !== undefined ? Number(value) : null;

      return {
        date: `${year}-${month}-${day}`,
        temperature_avg: toNumber(t2m[dateKey]),
        humidity_avg: toNumber(rh2m[dateKey]),
        temperature_max: toNumber(t2mMax[dateKey]),
        temperature_min: toNumber(t2mMin[dateKey]),
      };
    });
}

function normalizeHourly(rawData: {
  properties?: { parameter?: Record<string, Record<string, number>> };
}): HourlyWeatherRecord[] {
  const parameter = rawData.properties?.parameter;
  if (!parameter) {
    throw new Error("Invalid NASA POWER hourly response");
  }

  const t2m = parameter.T2M ?? {};
  const rh2m = parameter.RH2M ?? {};

  return Object.keys(t2m)
    .sort()
    .map((timestamp) => {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(8, 10);
      const utcDate = new Date(`${year}-${month}-${day}T${hour}:00:00Z`);
      const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
      const jstYear = jstDate.getUTCFullYear();
      const jstMonth = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
      const jstDay = String(jstDate.getUTCDate()).padStart(2, "0");
      const jstHour = String(jstDate.getUTCHours()).padStart(2, "0");
      const toNumber = (value: number | undefined) =>
        value !== null && value !== undefined ? Number(value) : null;

      return {
        datetime: `${jstYear}-${jstMonth}-${jstDay}T${jstHour}:00:00+09:00`,
        temperature: toNumber(t2m[timestamp]),
        humidity: toNumber(rh2m[timestamp]),
      };
    });
}

export function filterDailyByDateRange(
  daily: DailyWeatherRecord[],
  startDate: string,
  endDate: string
): DailyWeatherRecord[] {
  return daily.filter((row) => row.date >= startDate && row.date <= endDate);
}

async function fetchRaw(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NASA POWER API error: ${response.status}`);
  }

  const data = await response.json();
  const messages = data.messages as Array<{ severity: string; message: string }> | undefined;
  const errors = messages?.filter((msg) => msg.severity === "ERROR") ?? [];
  if (errors.length > 0) {
    throw new Error(`NASA POWER API error: ${errors.map((m) => m.message).join(", ")}`);
  }

  return data;
}

export async function fetchNasaPowerDaily(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<DailyWeatherRecord[]> {
  const params = new URLSearchParams({
    parameters: "T2M,RH2M,T2M_MAX,T2M_MIN",
    community: "AG",
    longitude: String(longitude),
    latitude: String(latitude),
    start: formatDateForNasa(startDate),
    end: formatDateForNasa(endDate),
    format: "JSON",
  });

  const data = await fetchRaw(
    `https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`
  );
  return normalizeDaily(data);
}

export async function fetchNasaPowerHourly(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<HourlyWeatherRecord[]> {
  const params = new URLSearchParams({
    parameters: "T2M,RH2M",
    community: "AG",
    longitude: String(longitude),
    latitude: String(latitude),
    start: formatDateForNasa(startDate),
    end: formatDateForNasa(endDate),
    format: "JSON",
  });

  const data = await fetchRaw(
    `https://power.larc.nasa.gov/api/temporal/hourly/point?${params.toString()}`
  );
  return normalizeHourly(data);
}
