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

type Result = { id: string; place_name: string; lat: number; lng: number; score?: number };

const IRAN = { west: 44, south: 25, east: 63.5, north: 40 };
const STREET_WORDS = ["خیابان", "بلوار", "کوچه", "میدان", "محله", "بزرگراه", "اتوبان", "چهارراه"];

function normalizeText(value: string) {
  return value
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,،]+/g, "،")
    .replace(/\s+/g, " ")
    .trim();
}

function inIran(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= IRAN.south && lat <= IRAN.north && lng >= IRAN.west && lng <= IRAN.east;
}

function distanceKm(aLat?: number, aLng?: number, bLat?: number, bLng?: number) {
  if (![aLat, aLng, bLat, bLng].every((n) => Number.isFinite(n))) return 9999;
  const R = 6371;
  const dLat = ((bLat! - aLat!) * Math.PI) / 180;
  const dLng = ((bLng! - aLng!) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat! * Math.PI) / 180) * Math.cos((bLat! * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function queryVariants(raw: string) {
  const q = normalizeText(raw);
  const set = new Set<string>([q]);
  const parts = q.split("،").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    set.add(`${parts.slice(1).join(" ")} ${parts[0]}`);
    set.add(`${parts[0]} ${parts.slice(1).join(" ")}`);
  }
  for (const item of [...set]) {
    set.add(item.replace(/^خیابان\s+/, "بلوار "));
    set.add(item.replace(/^بلوار\s+/, "خیابان "));
    const withoutType = normalizeText(item.replace(new RegExp(`\\b(${STREET_WORDS.join("|")})\\b`, "g"), " "));
    if (withoutType && withoutType !== item) set.add(withoutType);
  }
  return [...set].filter((v) => v.length >= 2).slice(0, 6);
}

function scoreResult(result: Result, query: string, lat?: number, lng?: number) {
  const haystack = normalizeText(result.place_name).toLowerCase();
  const tokens = normalizeText(query).toLowerCase().split(/[\s،-]+/).filter((t) => t.length > 1);
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  let score = matched * 18;
  if (tokens.length && matched === tokens.length) score += 35;
  if (STREET_WORDS.some((word) => haystack.includes(word))) score += 18;
  if (haystack.includes("استان قم") || haystack.includes("شهر قم")) score += query.includes("قم") ? 28 : 0;
  const dist = distanceKm(lat, lng, result.lat, result.lng);
  if (dist < 8) score += 35;
  else if (dist < 30) score += 20;
  else if (dist < 120) score += 8;
  result.score = score;
  return result;
}

async function fetchNominatim(params: Record<string, string>, timeoutMs = 6500): Promise<Result[]> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "ir",
    "accept-language": "fa",
    viewbox: `${IRAN.west},${IRAN.north},${IRAN.east},${IRAN.south}`,
    bounded: "0",
    ...params,
  }).toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": "AhromApp/1.0 (Lovable Cloud)", Accept: "application/json" },
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as any[];
  return Array.isArray(data)
    ? data.map((item) => ({
        id: `osm-${item?.place_id ?? item?.osm_id ?? crypto.randomUUID()}`,
        place_name: String(item?.display_name ?? ""),
        lat: Number.parseFloat(item?.lat),
        lng: Number.parseFloat(item?.lon),
      })).filter((r) => r.place_name && inIran(r.lat, r.lng))
    : [];
}

async function fetchPhoton(q: string, lat?: number, lng?: number): Promise<Result[]> {
  const params = new URLSearchParams({ q, limit: "10" });
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return ((data?.features || []) as any[])
    .map((f) => {
      const p = f?.properties || {};
      const [lng, lat] = f?.geometry?.coordinates || [];
      const name = [p.name, p.street, p.district, p.city, p.state, "ایران"].filter(Boolean).join("، ");
      return { id: `photon-${p.osm_id ?? crypto.randomUUID()}`, place_name: name, lat: Number(lat), lng: Number(lng) };
    })
    .filter((r) => r.place_name && inIran(r.lat, r.lng));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const q = normalizeText((body?.q ?? body?.query ?? "").toString());
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);

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

    const variants = queryVariants(q);
    const structured: Promise<Result[]>[] = [];
    const commaParts = q.split("،").map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      structured.push(fetchNominatim({ city: commaParts[0], street: commaParts.slice(1).join(" ") }).catch(() => []));
    }

    const batches = await Promise.all([
      ...structured,
      ...variants.slice(0, 4).map((variant) => fetchNominatim({ q: variant }).catch(() => [])),
      fetchPhoton(variants[0], lat, lng).catch(() => []),
    ]);

    const seen = new Set<string>();
    const results = batches.flat()
      .map((r) => scoreResult(r, q, Number.isFinite(lat) ? lat : undefined, Number.isFinite(lng) ? lng : undefined))
      .filter((r) => {
        const key = `${Math.round(r.lat * 100000)}:${Math.round(r.lng * 100000)}:${normalizeText(r.place_name).slice(0, 30)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10)
      .map(({ score: _score, ...r }) => r);

    console.log("[geocode-nominatim] response", {
      variants: variants.length,
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
