// Nominatim geocoder (free, no API key, 1 req/sec rate limit)
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface GeoResult {
  lat: number;
  lng: number;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address.trim()) return null;
  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "gb",
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": "PaneProApp/1.0" },
    });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

export async function geocodeCustomers(
  customers: { id: string; address: string; lat?: number; lng?: number }[],
  onUpdate: (id: string, coords: { lat: number; lng: number }) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const needsGeo = customers.filter((c) => !c.lat && !c.lng && c.address.trim());
  let geocoded = 0;
  for (let i = 0; i < needsGeo.length; i++) {
    const c = needsGeo[i];
    const result = await geocodeAddress(c.address);
    if (result) {
      onUpdate(c.id, result);
      geocoded++;
    }
    onProgress?.(i + 1, needsGeo.length);
    // Respect Nominatim rate limit
    if (i < needsGeo.length - 1) await delay(1100);
  }
  return geocoded;
}
