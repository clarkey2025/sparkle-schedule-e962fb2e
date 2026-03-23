// Primary geocoder: Nominatim (OpenStreetMap)
// Fallback geocoder: Photon (OpenStreetMap-powered)
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api";
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [0, 2_000, 4_000] as const;
const CUSTOMER_DELAY_MS = 1_600;

interface GeoResult {
  lat: number;
  lng: number;
}

interface GeocodeAttempt {
  coords: GeoResult | null;
  retryable: boolean;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanQuery(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim();
}

function buildAddressVariants(address: string): string[] {
  const normalized = cleanQuery(address);
  if (!normalized) return [];

  const withoutCountry = cleanQuery(normalized.replace(/\b(United Kingdom|UK)\b/gi, ""));
  const withoutPostcode = cleanQuery(normalized.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, ""));

  return [...new Set([normalized, withoutCountry, withoutPostcode].filter(Boolean))];
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeWithNominatim(query: string): Promise<GeocodeAttempt> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "gb",
  });

  const res = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`);
  if (!res) return { coords: null, retryable: true };
  if (!res.ok) return { coords: null, retryable: res.status === 429 || res.status >= 500 };

  try {
    const data: Array<{ lat: string; lon: string }> = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { coords: null, retryable: false };

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { coords: null, retryable: false };

    return { coords: { lat, lng }, retryable: false };
  } catch {
    return { coords: null, retryable: true };
  }
}

async function geocodeWithPhoton(query: string): Promise<GeocodeAttempt> {
  const params = new URLSearchParams({ q: query, limit: "1", lang: "en" });

  const res = await fetchWithTimeout(`${PHOTON_URL}?${params}`);
  if (!res) return { coords: null, retryable: true };
  if (!res.ok) return { coords: null, retryable: res.status === 429 || res.status >= 500 };

  try {
    const data: { features?: Array<{ geometry?: { coordinates?: [number, number] } }> } = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return { coords: null, retryable: false };

    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { coords: null, retryable: false };

    return { coords: { lat, lng }, retryable: false };
  } catch {
    return { coords: null, retryable: true };
  }
}

async function runWithRetry(fn: () => Promise<GeocodeAttempt>): Promise<GeoResult | null> {
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (RETRY_DELAYS_MS[i] > 0) await delay(RETRY_DELAYS_MS[i]);
    const attempt = await fn();
    if (attempt.coords) return attempt.coords;
    if (!attempt.retryable) break;
  }
  return null;
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const queries = buildAddressVariants(address);
  if (queries.length === 0) return null;

  for (const query of queries) {
    const fromNominatim = await runWithRetry(() => geocodeWithNominatim(query));
    if (fromNominatim) return fromNominatim;

    const fromPhoton = await runWithRetry(() => geocodeWithPhoton(query));
    if (fromPhoton) return fromPhoton;
  }

  return null;
}

export async function geocodeCustomers(
  customers: { id: string; address: string; lat?: number; lng?: number }[],
  onUpdate: (id: string, coords: { lat: number; lng: number }) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const needsGeo = customers.filter((c) => (!c.lat || !c.lng) && c.address.trim());
  let geocoded = 0;

  for (let i = 0; i < needsGeo.length; i++) {
    const c = needsGeo[i];
    const result = await geocodeAddress(c.address);
    if (result) {
      onUpdate(c.id, result);
      geocoded++;
    }

    onProgress?.(i + 1, needsGeo.length);
    if (i < needsGeo.length - 1) await delay(CUSTOMER_DELAY_MS);
  }

  return geocoded;
}
