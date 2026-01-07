import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const q = (body?.q ?? body?.query ?? "").toString();

    if (!q.trim() || q.trim().length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (q.length > 120) {
      return badRequest("Query is too long");
    }

    const params = new URLSearchParams({
      q: q.trim(),
      format: "json",
      addressdetails: "1",
      limit: "7",
      countrycodes: "ir",
      "accept-language": "fa",
      // viewbox برای اولویت‌دهی به منطقه ایران
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
        "Accept": "application/json",
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return new Response(JSON.stringify({ results: [], error: "Geocoding failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[geocode-nominatim] error", err);
    return new Response(JSON.stringify({ results: [], error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
