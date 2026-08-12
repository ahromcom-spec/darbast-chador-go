/**
 * Map provider adapter — Mapbox.
 *
 * NOTE: This module is named `neshan.ts` for backward compatibility with all
 * existing imports across the project. It used to wrap Neshan APIs, but the
 * underlying provider has been switched back to **Mapbox** per user request
 * ("بر روی نقشه کره زمین و سایت همان نقشه قبلی یعنی MAPBOX را قرار بده").
 *
 * All exported names (createNeshanTileLayer, getNeshanTileUrl, NESHAN_API_KEY,
 * NESHAN_ATTRIBUTION, neshanSearch, neshanReverse, neshanDirection, …) are
 * preserved so callers don't need to be touched.
 */

import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

// =====================
// Mapbox token bootstrap (used only for satellite / geocoding / directions)
// =====================
let MAPBOX_TOKEN: string | null = null;
let mapboxTokenPromise: Promise<string | null> | null = null;

/** Returns the Mapbox public token, fetching it once and caching it. */
export async function getMapboxToken(): Promise<string | null> {
  if (MAPBOX_TOKEN) return MAPBOX_TOKEN;
  if (mapboxTokenPromise) return mapboxTokenPromise;

  mapboxTokenPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error || !data?.token) {
        console.warn('[mapbox] failed to fetch token', error);
        return null;
      }
      MAPBOX_TOKEN = data.token as string;
      return MAPBOX_TOKEN;
    } catch (e) {
      console.warn('[mapbox] token fetch error', e);
      return null;
    }
  })();

  return mapboxTokenPromise;
}

// Neshan web API key — used for raster tiles with full Persian labels.
export const NESHAN_API_KEY: string =
  (import.meta as any).env?.VITE_NESHAN_API_KEY ||
  'web.8216e942ff494cd1b5dff1f8c86675d7';

// =====================
// Tile Layer (Mapbox raster)
// =====================
export type NeshanMapType =
  | 'standard-day'
  | 'standard-night'
  | 'neshan'
  | 'dreamy'
  | 'dreamy-gold'
  | 'satellite';

export const NESHAN_ATTRIBUTION =
  '&copy; <a href="https://neshan.org" target="_blank" rel="noopener">نشان</a>';

const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/about/" target="_blank" rel="noopener">OpenStreetMap</a>';

/** Map our legacy "neshan" style names onto Mapbox styles (used only for satellite). */
function mapStyleId(mapType: NeshanMapType): string {
  switch (mapType) {
    case 'satellite':
      return 'mapbox/satellite-streets-v12';
    case 'standard-night':
      return 'mapbox/dark-v11';
    case 'dreamy':
    case 'dreamy-gold':
      return 'mapbox/light-v11';
    case 'standard-day':
    case 'neshan':
    default:
      return 'mapbox/streets-v12';
  }
}

/**
 * Returns a Leaflet TileLayer URL template.
 * - Satellite → Mapbox satellite-streets.
 * - Standard / other styles → OpenStreetMap raster tiles, which render labels
 *   in the local script (Persian inside Iran, Arabic in Iraq, etc.).
 *   Mapbox raster Static Tiles do not honour the `language=fa` parameter,
 *   so OSM gives us reliable Persian labels without needing a vector renderer.
 */
export function getNeshanTileUrl(mapType: NeshanMapType = 'standard-day'): string {
  if (mapType === 'satellite') {
    // Esri World Imagery — same provider already visible in the attribution.
    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  }
  return `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

const ESRI_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics';

type PersianMapLabel = {
  name: string;
  lat: number;
  lng: number;
  minZoom: number;
  maxZoom?: number;
  kind: 'country' | 'province' | 'city' | 'street';
};

const PERSIAN_MAP_LABELS: PersianMapLabel[] = [
  { name: 'ایران', lat: 32.4279, lng: 53.688, minZoom: 4, maxZoom: 7, kind: 'country' },
  { name: 'استان تهران', lat: 35.6892, lng: 51.389, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان قم', lat: 34.6416, lng: 50.8746, minZoom: 5, maxZoom: 10, kind: 'province' },
  { name: 'استان اصفهان', lat: 32.6546, lng: 51.668, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان فارس', lat: 29.5918, lng: 52.5837, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان خراسان رضوی', lat: 36.2605, lng: 59.6168, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان یزد', lat: 31.8974, lng: 54.3569, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان کرمان', lat: 30.2839, lng: 57.0834, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'استان سیستان و بلوچستان', lat: 29.4963, lng: 60.8629, minZoom: 5, maxZoom: 8, kind: 'province' },
  { name: 'تهران', lat: 35.6892, lng: 51.389, minZoom: 5, kind: 'city' },
  { name: 'قم', lat: 34.6416, lng: 50.8746, minZoom: 5, kind: 'city' },
  { name: 'اصفهان', lat: 32.6546, lng: 51.668, minZoom: 5, kind: 'city' },
  { name: 'مشهد', lat: 36.2605, lng: 59.6168, minZoom: 5, kind: 'city' },
  { name: 'شیراز', lat: 29.5918, lng: 52.5837, minZoom: 5, kind: 'city' },
  { name: 'تبریز', lat: 38.0962, lng: 46.2738, minZoom: 5, kind: 'city' },
  { name: 'رشت', lat: 37.2808, lng: 49.5832, minZoom: 5, kind: 'city' },
  { name: 'یزد', lat: 31.8974, lng: 54.3569, minZoom: 5, kind: 'city' },
  { name: 'کرمان', lat: 30.2839, lng: 57.0834, minZoom: 6, kind: 'city' },
  { name: 'اهواز', lat: 31.3183, lng: 48.6706, minZoom: 6, kind: 'city' },
  { name: 'کرمانشاه', lat: 34.3142, lng: 47.065, minZoom: 6, kind: 'city' },
  { name: 'همدان', lat: 34.7983, lng: 48.5146, minZoom: 6, kind: 'city' },
  { name: 'اراک', lat: 34.0954, lng: 49.7013, minZoom: 6, kind: 'city' },
  { name: 'قزوین', lat: 36.2688, lng: 50.0041, minZoom: 6, kind: 'city' },
  { name: 'سمنان', lat: 35.5729, lng: 53.3971, minZoom: 6, kind: 'city' },
  { name: 'کاشان', lat: 33.985, lng: 51.409, minZoom: 7, kind: 'city' },
  { name: 'ساوه', lat: 35.0213, lng: 50.3566, minZoom: 8, kind: 'city' },
  { name: 'بلوار امین', lat: 34.6268, lng: 50.8505, minZoom: 13, kind: 'street' },
  { name: 'بلوار جمهوری اسلامی', lat: 34.6222, lng: 50.8795, minZoom: 13, kind: 'street' },
  { name: 'خیابان ارم', lat: 34.641, lng: 50.879, minZoom: 14, kind: 'street' },
  { name: 'خیابان صفائیه', lat: 34.6418, lng: 50.887, minZoom: 14, kind: 'street' },
  { name: 'بلوار الغدیر', lat: 34.6137, lng: 50.9004, minZoom: 13, kind: 'street' },
  { name: 'بلوار پیامبر اعظم', lat: 34.592, lng: 50.866, minZoom: 13, kind: 'street' },
  { name: 'بلوار عمار یاسر', lat: 34.655, lng: 50.87, minZoom: 14, kind: 'street' },
  { name: 'خیابان دورشهر', lat: 34.646, lng: 50.884, minZoom: 14, kind: 'street' },
];

function createPersianLabelsOverlay(): L.LayerGroup {
  const group = L.layerGroup();
  let map: L.Map | null = null;

  const render = () => {
    if (!map) return;
    const zoom = map.getZoom();
    const bounds = map.getBounds().pad(0.15);
    group.clearLayers();

    PERSIAN_MAP_LABELS.forEach((label) => {
      if (zoom < label.minZoom || (label.maxZoom && zoom > label.maxZoom)) return;
      const latLng: L.LatLngExpression = [label.lat, label.lng];
      if (!bounds.contains(latLng as L.LatLngTuple)) return;

      const size = label.kind === 'country' ? 30 : label.kind === 'province' ? 18 : label.kind === 'street' ? 13 : 15;
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-family:Vazirmatn,Vazir,Tahoma,sans-serif;direction:rtl;white-space:nowrap;color:#fff;font-weight:800;font-size:${size}px;line-height:1;text-shadow:0 1px 2px #0f2f5f,0 0 3px #0f2f5f,0 0 5px #0f2f5f;pointer-events:none;transform:translate(-50%,-50%);">${label.name}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(latLng, { icon, interactive: false, keyboard: false, pane: 'overlayPane' }).addTo(group);
    });
  };

  group.on('add', (event: any) => {
    map = event.target?._map || null;
    render();
    map?.on('moveend zoomend', render);
  });
  group.on('remove', () => {
    map?.off('moveend zoomend', render);
    map = null;
  });
  return group;
}

/**
 * Creates a Leaflet TileLayer.
 * - Satellite → Esri World Imagery + transparent labels overlay (Persian
 *   inside Iran via OSM/Carto labels-only tiles).
 * - Standard  → OSM raster (native-script labels).
 *
 * Both layers oversample beyond their native max zoom (`maxNativeZoom`) so
 * deep zoom never produces "Map data not yet available" blank tiles — Leaflet
 * upscales the deepest available tile instead.
 */
export function createNeshanTileLayer(
  mapType: NeshanMapType = 'standard-day',
  options?: L.TileLayerOptions,
): L.TileLayer {
  if (mapType === 'satellite') {
    const ESRI_SAT_URL =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    // منبع جایگزین در صورت خطای تایل (فایرفاکس/موبایل و فیلترینگ)
    const WIKIMEDIA_SAT_FALLBACK =
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const sat = L.tileLayer(ESRI_SAT_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 22,
      // Esri returns a grey "Map data not yet available" placeholder for
      // parts of Qom at z19+. Oversample z18 instead so deep zoom stays usable.
      maxNativeZoom: 18,
      // crossOrigin عمداً تنظیم نشده است: در فایرفاکس موبایل اگر پاسخ سرور
      // هدر CORS نداشته باشد، تصویر تایل رد می‌شود و نقشه خاکستری می‌ماند.
      updateWhenIdle: false,
      keepBuffer: 3,
      ...options,
    });

    // اگر تایل‌های منبع اول لود نشوند، یک‌بار به منبع جایگزین سوییچ می‌کنیم
    let satErrors = 0;
    let switched = false;
    sat.on('tileerror', () => {
      satErrors += 1;
      if (!switched && satErrors >= 3) {
        switched = true;
        sat.setUrl(WIKIMEDIA_SAT_FALLBACK);
      }
    });

    // پوشش برچسب‌ها (نام خیابان‌ها، محله‌ها، شهرها) به‌صورت تایل‌های شفاف
    // روی تصاویر ماهواره‌ای — از CartoDB labels-only که در داخل ایران
    // اسامی را به فارسی نمایش می‌دهد و تمام جزئیات خیابانی را پوشش می‌دهد.
    const cartoLabels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 22,
        maxNativeZoom: 20,
        pane: 'overlayPane',
      },
    );

    const persianLabels = createPersianLabelsOverlay();

    sat.on('add', (e: any) => {
      const map = e.target?._map;
      if (!map) return;
      if (!map.hasLayer(cartoLabels)) cartoLabels.addTo(map);
      if (!map.hasLayer(persianLabels)) persianLabels.addTo(map);
    });
    sat.on('remove', (e: any) => {
      const map = e.target?._map;
      if (!map) return;
      if (map.hasLayer(cartoLabels)) map.removeLayer(cartoLabels);
      if (map.hasLayer(persianLabels)) map.removeLayer(persianLabels);
    });

    return sat;
  }

  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 22,
    maxNativeZoom: 19,
    crossOrigin: true,
    ...options,
  });
}



// =====================
// Forward Geocoding (Mapbox Geocoding v5)
// =====================
export interface NeshanSearchResultItem {
  title: string;
  address: string;
  category?: string;
  type?: string;
  region?: string;
  neighbourhood?: string;
  location: { x: number; y: number }; // x=lng, y=lat
}

export interface NeshanSearchResult {
  count: number;
  items: NeshanSearchResultItem[];
}

const QOM_DEFAULT = { lat: 34.6416, lng: 50.8746 };

async function cloudIranSearch(term: string, lat: number, lng: number): Promise<NeshanSearchResultItem[]> {
  const { data, error } = await supabase.functions.invoke('geocode-nominatim', {
    body: { q: term, lat, lng },
  });
  if (error) {
    console.warn('[geocode-cloud] search failed', error);
    return [];
  }
  const results = (data?.results || []) as Array<{ place_name: string; lat: number; lng: number }>;
  return results
    .filter((item) => item.place_name && Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item) => {
      const [title, ...rest] = item.place_name.split(/ - |،/).map((part) => part.trim()).filter(Boolean);
      return {
        title: title || item.place_name,
        address: rest.join('، ') || item.place_name,
        location: { x: item.lng, y: item.lat },
      };
    });
}

export async function neshanSearch(
  term: string,
  lat: number = QOM_DEFAULT.lat,
  lng: number = QOM_DEFAULT.lng,
): Promise<NeshanSearchResultItem[]> {
  // Primary: Lovable Cloud geocoder combines multiple Iran-friendly sources
  // and ranks streets/neighborhoods intelligently.
  const cloudItems = await cloudIranSearch(term, lat, lng);
  if (cloudItems.length > 0) return cloudItems;

  // Optional Neshan fallback only when a non-web Search API key is configured.
  if (NESHAN_API_KEY && !NESHAN_API_KEY.startsWith('web.')) {
    try {
      const url =
        `https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}` +
        `&lat=${lat}&lng=${lng}`;
      const res = await fetch(url, {
        headers: { 'Api-Key': NESHAN_API_KEY },
      });
      if (res.ok) {
        const json = await res.json();
        const items = (json?.items || []) as any[];
        if (items.length > 0) {
          return items.map((it) => ({
            title: it.title || '',
            address: it.address || '',
            category: it.category,
            type: it.type,
            region: it.region,
            neighbourhood: it.neighbourhood,
            location: { x: it.location?.x, y: it.location?.y },
          }));
        }
      }
    } catch (e) {
      console.warn('[neshan] search failed', e);
    }
  }

  // Fallback → Mapbox geocoding.
  const token = await getMapboxToken();
  if (!token) return [];
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json` +
      `?access_token=${token}` +
      `&proximity=${lng},${lat}` +
      `&country=ir&language=fa&limit=8`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const features = (json?.features || []) as any[];
    return features.map((f) => ({
      title: f.text || f.place_name || '',
      address: f.place_name || '',
      category: f.properties?.category,
      type: (f.place_type && f.place_type[0]) || undefined,
      region: f.context?.find?.((c: any) => String(c.id).startsWith('region'))?.text,
      neighbourhood: f.context?.find?.((c: any) => String(c.id).startsWith('neighborhood'))?.text,
      location: { x: f.center?.[0], y: f.center?.[1] },
    }));
  } catch (e) {
    console.warn('[mapbox] search failed', e);
    return [];
  }
}

// =====================
// Reverse Geocoding (Mapbox)
// =====================
export interface NeshanReverseResult {
  status: string;
  formatted_address?: string;
  route_name?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  place?: string;
  district?: string;
}

export async function neshanReverse(lat: number, lng: number): Promise<NeshanReverseResult | null> {
  const token = await getMapboxToken();
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${token}&language=fa&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const f = json?.features?.[0];
    if (!f) return { status: 'NOT_FOUND' };
    const ctx = (f.context || []) as any[];
    const find = (prefix: string) => ctx.find((c) => String(c.id).startsWith(prefix))?.text;
    return {
      status: 'OK',
      formatted_address: f.place_name,
      route_name: f.text,
      neighbourhood: find('neighborhood'),
      city: find('place'),
      state: find('region'),
      place: find('place'),
      district: find('district'),
    };
  } catch {
    return null;
  }
}

// =====================
// Driving Direction (Mapbox Directions)
// =====================
export interface NeshanRouteLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
}
export interface NeshanRoute {
  overview_polyline?: { points: string };
  legs: NeshanRouteLeg[];
}
export interface NeshanDirectionResponse {
  routes: NeshanRoute[];
}

/**
 * Decode a Google-style polyline (kept exported for callers that still use it).
 */
export function decodePolyline(encoded: string): [number, number][] {
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

export async function neshanDirection(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<{ distanceKm: number; durationMinutes: number; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null> {
  const token = await getMapboxToken();
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
      `?geometries=geojson&overview=full&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    return {
      distanceKm: (route.distance || 0) / 1000,
      durationMinutes: Math.round((route.duration || 0) / 60),
      geometry: {
        type: 'LineString',
        coordinates: route.geometry.coordinates as [number, number][],
      },
    };
  } catch {
    return null;
  }
}

// =====================
// Neshan Reverse Geocoding (with HouseNumber / plaque)
// Calls the `neshan-reverse` Edge Function which proxies the Neshan service key.
// =====================
export interface NeshanPlaqueResult {
  formatted_address: string;
  neighbourhood: string;
  route_name: string;
  route_type: string;
  district: string;
  city: string;
  place: string;
  house_number: string;
  house_number_source?: 'exact' | 'nearby' | 'unavailable';
  plaque_distance_m?: number;
}

const reverseCache = new Map<string, NeshanPlaqueResult | null>();
const reverseInflight = new Map<string, Promise<NeshanPlaqueResult | null>>();

export async function neshanReverseGeocode(lat: number, lng: number): Promise<NeshanPlaqueResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  if (reverseInflight.has(key)) return reverseInflight.get(key)!;

  const p = (async () => {
    try {
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/neshan-reverse?lat=${lat}&lng=${lng}`;
      const session = (await supabase.auth.getSession()).data.session;
      const r = await fetch(url, {
        headers: {
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token || (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const result: NeshanPlaqueResult | null = r.ok ? ((await r.json()) as NeshanPlaqueResult) : null;
      reverseCache.set(key, result);
      return result;
    } catch (e) {
      console.warn('[neshanReverseGeocode] error', e);
      reverseCache.set(key, null);
      return null;
    } finally {
      reverseInflight.delete(key);
    }
  })();

  reverseInflight.set(key, p);
  return p;
}


