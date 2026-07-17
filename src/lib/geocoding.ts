import { neshanSearch } from "@/lib/neshan";

export type GeocodeResult = {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
};

export async function geocodeIranNominatim(query: string): Promise<GeocodeResult[]> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log("[geocodeIran] start", { query });

  try {
    const items = await neshanSearch(query);
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    console.log("[geocodeIran] done", { ms: Math.round(t1 - t0), count: items.length });

    return items.map((item, idx) => ({
      id: `${item.title || item.address}-${idx}-${item.location.x}-${item.location.y}`,
      place_name: [item.title, item.address].filter(Boolean).join(' - '),
      lat: item.location.y,
      lng: item.location.x,
    })).filter((item) => item.place_name && Number.isFinite(item.lat) && Number.isFinite(item.lng));
  } catch (error) {
    console.error("[geocodeIran] error", error);
    return [];
  }
}
