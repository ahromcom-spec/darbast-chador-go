import { supabase } from "@/integrations/supabase/client";

export type GeocodeResult = {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(label)), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

export async function geocodeIranNominatim(query: string): Promise<GeocodeResult[]> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log("[geocodeIranNominatim] start", { query });

  const invokePromise = supabase.functions.invoke("geocode-nominatim", {
    body: { q: query },
  });

  const { data, error } = await withTimeout(
    invokePromise,
    9000,
    "Geocoding request timed out"
  );

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log("[geocodeIranNominatim] done", { ms: Math.round(t1 - t0) });

  if (error) {
    console.error("[geocodeIranNominatim] invoke error", error);
    throw error;
  }

  const results = (data as any)?.results;
  if (!Array.isArray(results)) return [];
  return results as GeocodeResult[];
}
