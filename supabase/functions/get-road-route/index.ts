import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Point = { lat: number; lng: number };

async function getMapboxRoute(origin: Point, dest: Point): Promise<any | null> {
  const token = Deno.env.get("MAPBOX_PUBLIC_TOKEN") || Deno.env.get("MAPBOX_TOKEN");
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&access_token=${token}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.routes?.length) return json.routes[0];
    return null;
  } catch (e) {
    console.log("[get-road-route] Mapbox failed:", e);
    return null;
  }
}

async function getOsrmRoute(origin: Point, dest: Point): Promise<any | null> {
  const endpoints = [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      console.log("[get-road-route] Trying OSRM:", endpoint);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, { 
        signal: controller.signal,
        headers: {
          "User-Agent": "AhromApp/1.0",
        }
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        console.log("[get-road-route] OSRM response not OK:", res.status);
        continue;
      }
      
      const json = await res.json();
      if (json?.routes?.length) {
        console.log("[get-road-route] OSRM success from:", endpoint);
        return json.routes[0];
      }
    } catch (e) {
      console.log("[get-road-route] OSRM endpoint failed:", endpoint, e);
    }
  }
  return null;
}

// فاصله خط مستقیم به عنوان fallback
function calculateStraightLineDistance(origin: Point, dest: Point): number {
  const R = 6371;
  const dLat = (dest.lat - origin.lat) * Math.PI / 180;
  const dLng = (dest.lng - origin.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ایجاد geometry ساده (خط مستقیم) به عنوان fallback
function createStraightLineGeometry(origin: Point, dest: Point) {
  return {
    type: "LineString",
    coordinates: [
      [origin.lng, origin.lat],
      [dest.lng, dest.lat]
    ]
  };
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

    console.log("[get-road-route] Processing route from", origin, "to", dest);

    // 1) Try Mapbox if token exists
    let route: any | null = null;
    route = await getMapboxRoute(origin, dest);

    // 2) Fallback to OSRM
    if (!route) {
      route = await getOsrmRoute(origin, dest);
    }

    // 3) اگر هیچ‌کدام جواب نداد، خط مستقیم برگردان
    if (!route) {
      console.log("[get-road-route] All routing services failed, using straight line");
      const straightDistance = calculateStraightLineDistance(origin, dest);
      const straightGeometry = createStraightLineGeometry(origin, dest);
      
      return new Response(
        JSON.stringify({ 
          distanceKm: straightDistance * 1.3, // ضریب تقریبی برای مسیر جاده‌ای
          geometry: straightGeometry,
          isStraightLine: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distanceKm = (route.distance ?? 0) / 1000;
    const geometry = route.geometry;

    console.log("[get-road-route] Success, distance:", distanceKm, "km");

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
