/**
 * OSM Buildings overlay — fetches building polygons via Overpass API for the
 * current viewport and renders them as filled Leaflet polygons.
 *
 * Goal: make cadastral/building parcels visible everywhere OSM has data, even
 * when the default raster tile rendering omits them at the user's zoom.
 *
 * Behaviour:
 * - Active only at zoom >= MIN_ZOOM (close-up street view).
 * - Debounces moveend/zoomend before querying Overpass.
 * - Caches fetched bbox keys to avoid re-querying the same tile area.
 * - Silent on failure (Overpass is best-effort).
 */

import L from 'leaflet';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const MIN_ZOOM = 17;          // فقط در زوم نزدیک
const FETCH_DEBOUNCE_MS = 400;
const MAX_CACHED_TILES = 200;

/** Round bbox to a coarse grid so neighbouring pans share the same cache key. */
function bboxKey(b: L.LatLngBounds): string {
  const r = (n: number) => Math.round(n * 200) / 200; // ~5m grid
  return `${r(b.getSouth())},${r(b.getWest())},${r(b.getNorth())},${r(b.getEast())}`;
}

async function fetchBuildings(bounds: L.LatLngBounds, signal: AbortSignal): Promise<any[]> {
  const s = bounds.getSouth().toFixed(5);
  const w = bounds.getWest().toFixed(5);
  const n = bounds.getNorth().toFixed(5);
  const e = bounds.getEast().toFixed(5);
  const query = `[out:json][timeout:20];(way["building"](${s},${w},${n},${e});relation["building"](${s},${w},${n},${e}););out geom;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      return (json?.elements as any[]) || [];
    } catch (err) {
      if ((err as any)?.name === 'AbortError') throw err;
      // try next endpoint
    }
  }
  return [];
}

function elementToLatLngs(el: any): L.LatLng[][] | null {
  if (el.type === 'way' && Array.isArray(el.geometry)) {
    return [el.geometry.map((p: any) => L.latLng(p.lat, p.lon))];
  }
  if (el.type === 'relation' && Array.isArray(el.members)) {
    const rings: L.LatLng[][] = [];
    for (const m of el.members) {
      if (m.type === 'way' && Array.isArray(m.geometry) && m.role !== 'inner') {
        rings.push(m.geometry.map((p: any) => L.latLng(p.lat, p.lon)));
      }
    }
    return rings.length ? rings : null;
  }
  return null;
}

export function createOSMBuildingsLayer(): L.LayerGroup {
  const group = L.layerGroup();
  let map: L.Map | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortCtrl: AbortController | null = null;
  const fetchedKeys = new Set<string>();
  const renderedIds = new Set<number | string>();

  const style: L.PathOptions = {
    color: '#8b6f47',       // قهوه‌ای تیره برای خطوط
    weight: 0.8,
    opacity: 0.9,
    fillColor: '#c9a576',   // قهوه‌ای روشن برای پرکردن قواره
    fillOpacity: 0.55,
    interactive: false,
  };

  const refresh = () => {
    if (!map) return;
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) return;

    const bounds = map.getBounds();
    const key = bboxKey(bounds);
    if (fetchedKeys.has(key)) return;
    fetchedKeys.add(key);
    if (fetchedKeys.size > MAX_CACHED_TILES) {
      const first = fetchedKeys.values().next().value;
      if (first) fetchedKeys.delete(first);
    }

    abortCtrl?.abort();
    abortCtrl = new AbortController();

    fetchBuildings(bounds, abortCtrl.signal)
      .then((elements) => {
        if (!map) return;
        for (const el of elements) {
          const id = `${el.type}/${el.id}`;
          if (renderedIds.has(id)) continue;
          const rings = elementToLatLngs(el);
          if (!rings || !rings.length) continue;
          renderedIds.add(id);
          L.polygon(rings, style).addTo(group);
        }
      })
      .catch(() => { /* silent — Overpass best-effort */ });
  };

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, FETCH_DEBOUNCE_MS);
  };

  group.on('add', (e: any) => {
    map = e.target?._map || null;
    if (!map) return;
    map.on('moveend zoomend', scheduleRefresh);
    scheduleRefresh();
  });

  group.on('remove', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    abortCtrl?.abort();
    map?.off('moveend zoomend', scheduleRefresh);
    map = null;
  });

  return group;
}
