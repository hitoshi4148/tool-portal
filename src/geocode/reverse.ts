interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  borough?: string;
  suburb?: string;
  county?: string;
  state?: string;
  province?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

const MUNICIPALITY_KEYS: (keyof NominatimAddress)[] = [
  "city",
  "town",
  "village",
  "municipality",
  "city_district",
  "borough",
  "suburb",
  "county",
];

function isPrefectureName(name: string): boolean {
  return /(都|道|府|県)$/.test(name);
}

export function extractMunicipality(address: NominatimAddress): string {
  for (const key of MUNICIPALITY_KEYS) {
    const value = address[key];
    if (value && !isPrefectureName(value)) {
      return value;
    }
  }
  return "";
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("accept-language", "ja");
  url.searchParams.set("zoom", "12");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "tool-portal/0.1 (contact: hitoshi.yoshinobu@gmail.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`);
  }

  const data = (await response.json()) as NominatimResponse;
  if (!data.address) {
    return "";
  }

  return extractMunicipality(data.address);
}
