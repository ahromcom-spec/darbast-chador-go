import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const q = (body?.q ?? body?.query ?? "").toString();

    console.log("[geocode-nominatim] request", {
      q: q?.slice(0, 80),
      len: q?.length,
    });

    if (!q.trim() || q.trim().length < 2) {
      return json({ results: [] });
    }

    if (q.length > 120) {
      return json({ error: "Query is too long" }, 400);
    }

    const params = new URLSearchParams({
      q: q.trim(),
      format: "json",
      addressdetails: "1",
      limit: "7",
      countrycodes: "ir",
      "accept-language": "fa",
      viewbox: "44.0,39.8,63.3,25.0",
      bounded: "0",
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim usage policy: identify your application
        "User-Agent": "AhromApp/1.0 (Lovable Cloud)",
        Accept: "application/json",
      },
    }).finally(() => clearTimeout(timeout));

    const status = res.status;

    if (!res.ok) {
      console.error("[geocode-nominatim] upstream not ok", { status });
      return json({ results: [], error: "Geocoding failed" }, 502);
    }

    const data = (await res.json().catch(() => [])) as any[];

    const results = Array.isArray(data)
      ? data
          .map((item: any) => ({
            id: (item?.place_id ?? item?.osm_id ?? Math.random()).toString(),
            place_name: (item?.display_name ?? "").toString(),
            lat: Number.parseFloat(item?.lat),
            lng: Number.parseFloat(item?.lon),
          }))
          .filter((r) => r.place_name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
      : [];

    console.log("[geocode-nominatim] response", {
      status,
      results: results.length,
      ms: Date.now() - startedAt,
    });

    return json({ results });
  } catch (err) {
    console.error("[geocode-nominatim] error", {
      ms: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    });

    // AbortError or any other failure
    return json({ results: [], error: "Internal error" }, 500);
  }
});
