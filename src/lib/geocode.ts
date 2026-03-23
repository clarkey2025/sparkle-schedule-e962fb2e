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

// UK postcode regex
const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

// Known UK counties to skip when looking for the city/town
const UK_COUNTIES = new Set([
  "lancashire", "yorkshire", "cheshire", "cumbria", "derbyshire", "devon",
  "dorset", "durham", "essex", "gloucestershire", "hampshire", "herefordshire",
  "hertfordshire", "kent", "leicestershire", "lincolnshire", "norfolk",
  "northamptonshire", "northumberland", "nottinghamshire", "oxfordshire",
  "rutland", "shropshire", "somerset", "staffordshire", "suffolk", "surrey",
  "sussex", "warwickshire", "wiltshire", "worcestershire", "bedfordshire",
  "berkshire", "buckinghamshire", "cambridgeshire", "cornwall", "middlesex",
  "east sussex", "west sussex", "north yorkshire", "south yorkshire",
  "west yorkshire", "east yorkshire", "greater manchester", "merseyside",
  "tyne and wear", "west midlands", "england", "scotland", "wales",
]);

interface ParsedAddress {
  houseNumber: string;
  street: string;
  city: string;
  county: string;
  postcode: string;
  full: string;
}

function parseUKAddress(raw: string): ParsedAddress {
  const full = cleanQuery(raw);
  let postcode = "";
  const pcMatch = full.match(UK_POSTCODE_RE);
  if (pcMatch) postcode = pcMatch[1].trim();

  // Remove postcode and "UK"/"United Kingdom" for part splitting
  let remainder = full
    .replace(UK_POSTCODE_RE, "")
    .replace(/\b(United Kingdom|UK)\b/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .replace(/^\s*,/, "")
    .trim();

  const parts = remainder.split(",").map((p) => p.trim()).filter(Boolean);

  let houseNumber = "";
  let street = parts[0] || "";

  // Extract house number from start of street
  const numMatch = street.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  if (numMatch) {
    houseNumber = numMatch[1];
    street = numMatch[2];
  }

  // Find city (first non-street, non-county part) and county
  let city = "";
  let county = "";
  for (let i = 1; i < parts.length; i++) {
    const lower = parts[i].toLowerCase().trim();
    if (UK_COUNTIES.has(lower)) {
      county = parts[i];
    } else if (!city) {
      city = parts[i];
    }
  }

  return { houseNumber, street, city, county, postcode, full };
}

function buildAddressVariants(address: string): string[] {
  const normalized = cleanQuery(address);
  if (!normalized) return [];

  const withoutCountry = cleanQuery(normalized.replace(/\b(United Kingdom|UK)\b/gi, ""));
  const withoutPostcode = cleanQuery(normalized.replace(UK_POSTCODE_RE, ""));

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

// Try structured Nominatim query first (more precise for house numbers)
async function geocodeStructuredNominatim(parsed: ParsedAddress): Promise<GeocodeAttempt> {
  if (!parsed.street) return { coords: null, retryable: false };

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "gb",
  });

  // Build structured query
  const streetQuery = parsed.houseNumber ? `${parsed.houseNumber} ${parsed.street}` : parsed.street;
  params.set("street", streetQuery);
  if (parsed.city) params.set("city", parsed.city);
  if (parsed.postcode) params.set("postalcode", parsed.postcode);

  const res = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`);
  if (!res) return { coords: null, retryable: true };
  if (!res.ok) return { coords: null, retryable: res.status === 429 || res.status >= 500 };

  try {
    const data: Array<{ lat: string; lon: string; place_rank?: number }> = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { coords: null, retryable: false };

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { coords: null, retryable: false };

    return { coords: { lat, lng }, retryable: false };
  } catch {
    return { coords: null, retryable: true };
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
  if (!address.trim()) return null;

  // 1. Try structured Nominatim query (most precise — resolves house numbers)
  const parsed = parseUKAddress(address);
  const fromStructured = await runWithRetry(() => geocodeStructuredNominatim(parsed));
  if (fromStructured) return fromStructured;

  // 2. Fall back to free-text queries with address variants
  const queries = buildAddressVariants(address);
  for (const query of queries) {
    const fromNominatim = await runWithRetry(() => geocodeWithNominatim(query));
    if (fromNominatim) return fromNominatim;

    const fromPhoton = await runWithRetry(() => geocodeWithPhoton(query));
    if (fromPhoton) return fromPhoton;
  }

  return null;
}

export interface GeocodeResult {
  successCount: number;
  failed: { id: string; name: string; address: string }[];
}

export async function geocodeCustomers(
  customers: { id: string; name?: string; address: string; lat?: number; lng?: number }[],
  onUpdate: (id: string, coords: { lat: number; lng: number }) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<GeocodeResult> {
  const needsGeo = customers.filter((c) => (!c.lat || !c.lng) && c.address.trim());
  let successCount = 0;
  const failed: GeocodeResult["failed"] = [];

  for (let i = 0; i < needsGeo.length; i++) {
    const c = needsGeo[i];
    const result = await geocodeAddress(c.address);
    if (result) {
      onUpdate(c.id, result);
      successCount++;
    } else {
      failed.push({ id: c.id, name: c.name ?? "Unknown", address: c.address });
    }

    onProgress?.(i + 1, needsGeo.length);
    if (i < needsGeo.length - 1) await delay(CUSTOMER_DELAY_MS);
  }

  return { successCount, failed };
}
