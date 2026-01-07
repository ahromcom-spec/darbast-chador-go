import { supabase } from "@/integrations/supabase/client";

export type GeocodeResult = {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
};

export async function geocodeIranNominatim(query: string): Promise<GeocodeResult[]> {
  const { data, error } = await supabase.functions.invoke("geocode-nominatim", {
    body: { q: query },
  });

  if (error) throw error;

  const results = (data as any)?.results;
  if (!Array.isArray(results)) return [];

  return results as GeocodeResult[];
}
