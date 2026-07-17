import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Point = { lat: number; lng: number };

// Decode Google-style polyline (Neshan uses the same encoding)
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

async function getNeshanRoute(origin: Point, dest: Point): Promise<any | null> {
  const key = Deno.env.get("NESHAN_API_KEY");
  if (!key) {
    console.log("[get-road-route] NESHAN_API_KEY not set, skipping Neshan");
    return null;
  }

  try {
    const url = `https://api.neshan.org/v4/direction?type=car&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Api-Key": key },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log("[get-road-route] Neshan response not OK:", res.status);
      return null;
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.overview_polyline?.points) return null;

    const decoded = decodePolyline(route.overview_polyline.points);
    const coordinates: [number, number][] = decoded.map(([la, ln]) => [ln, la]);

    const totalMeters = (route.legs || []).reduce(
      (sum: number, leg: any) => sum + (leg?.distance?.value || 0),
      0,
    );

    return {
      distance: totalMeters,
      geometry: { type: "LineString", coordinates },
    };
  } catch (e) {
    console.log("[get-road-route] Neshan failed:", e);
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
        headers: { "User-Agent": "AhromApp/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const json = await res.json();
      if (json?.routes?.length) {
        return json.routes[0];
      }
    } catch (e) {
      console.log("[get-road-route] OSRM endpoint failed:", endpoint, e);
    }
  }
  return null;
}

function calculateStraightLineDistance(origin: Point, dest: Point): number {
  const R = 6371;
  const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((dest.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function createStraightLineGeometry(origin: Point, dest: Point) {
  return {
    type: "LineString",
    coordinates: [
      [origin.lng, origin.lat],
      [dest.lng, dest.lat],
    ],
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

    if (
      !origin || !dest ||
      typeof origin.lat !== "number" || typeof origin.lng !== "number" ||
      typeof dest.lat !== "number" || typeof dest.lng !== "number"
    ) {
      return new Response(JSON.stringify({ error: "Invalid origin/dest" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-road-route] Processing route from", origin, "to", dest);

    // 1) Neshan first (Iranian map provider)
    let route: any | null = await getNeshanRoute(origin, dest);

    // 2) OSRM fallback
    if (!route) {
      route = await getOsrmRoute(origin, dest);
    }

    // 3) Straight line as last resort
    if (!route) {
      const straightDistance = calculateStraightLineDistance(origin, dest);
      const straightGeometry = createStraightLineGeometry(origin, dest);

      return new Response(
        JSON.stringify({
          distanceKm: straightDistance * 1.3,
          geometry: straightGeometry,
          isStraightLine: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distanceKm = (route.distance ?? 0) / 1000;
    const geometry = route.geometry;

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
