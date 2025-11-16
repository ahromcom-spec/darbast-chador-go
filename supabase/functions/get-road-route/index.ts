import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Point = { lat: number; lng: number };

async function getMapboxRoute(origin: Point, dest: Point) {
  const token = Deno.env.get("MAPBOX_PUBLIC_TOKEN") || Deno.env.get("MAPBOX_TOKEN");
  if (!token) return null;

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.routes?.length) return json.routes[0];
  return null;
}

async function getOsrmRoute(origin: Point, dest: Point) {
  const endpoints = [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  ];
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.routes?.length) return json.routes[0];
    } catch (_) {
      // try next endpoint
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const origin: Point | undefined = body?.origin;
    const dest: Point | undefined = body?.dest;

    if (!origin || !dest || typeof origin.lat !== "number" || typeof origin.lng !== "number" || typeof dest.lat !== "number" || typeof dest.lng !== "number") {
      return new Response(JSON.stringify({ error: "Invalid origin/dest" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Try Mapbox if token exists
    let route: any | null = null;
    try {
      route = await getMapboxRoute(origin, dest);
    } catch (_) {}

    // 2) Fallback to OSRM
    if (!route) {
      route = await getOsrmRoute(origin, dest);
    }

    if (!route) {
      return new Response(JSON.stringify({ error: "No route found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const distanceKm = (route.distance ?? 0) / 1000;
    const geometry = route.geometry; // GeoJSON LineString

    return new Response(
      JSON.stringify({ distanceKm, geometry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[get-road-route] error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
