// Neshan Reverse Geocoding proxy — uses service key to convert lat/lng to address (incl. plaque/HouseNumber)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const NESHAN_KEY = Deno.env.get('NESHAN_SERVICE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!NESHAN_KEY) {
      return new Response(JSON.stringify({ error: 'NESHAN_SERVICE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ error: 'Invalid lat/lng' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fetchReverse = async (targetLat: number, targetLng: number) => {
      const neshanUrl = `https://api.neshan.org/v5/reverse?lat=${targetLat}&lng=${targetLng}`;
      const r = await fetch(neshanUrl, { headers: { 'Api-Key': NESHAN_KEY } });
      const data = await r.json();
      return { r, data };
    };

    const { r, data } = await fetchReverse(lat, lng);

    if (!r.ok) {
      console.error('[neshan-reverse] upstream error', r.status, data);
      return new Response(JSON.stringify({ error: 'Neshan API error', detail: data }), {
        status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exactHouseNumber = data.HouseNumber || data.house_number || '';
    let houseNumber = exactHouseNumber;
    let houseNumberSource: 'exact' | 'nearby' | 'unavailable' = exactHouseNumber ? 'exact' : 'unavailable';
    let plaqueDistanceM = 0;

    // Neshan only returns a plaque when the point is exactly on a registered
    // entrance/building. If the saved marker is on the street, probe a small
    // radius around it and show the nearest available plaque as an approximation.
    if (!houseNumber) {
      const metersToLat = 1 / 111_320;
      const metersToLng = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
      const probes = [6, 12, 20, 30].flatMap((meters) => [
        { lat: lat + meters * metersToLat, lng, meters },
        { lat: lat - meters * metersToLat, lng, meters },
        { lat, lng: lng + meters * metersToLng, meters },
        { lat, lng: lng - meters * metersToLng, meters },
        { lat: lat + meters * metersToLat * 0.7, lng: lng + meters * metersToLng * 0.7, meters },
        { lat: lat + meters * metersToLat * 0.7, lng: lng - meters * metersToLng * 0.7, meters },
        { lat: lat - meters * metersToLat * 0.7, lng: lng + meters * metersToLng * 0.7, meters },
        { lat: lat - meters * metersToLat * 0.7, lng: lng - meters * metersToLng * 0.7, meters },
      ]);

      for (const probe of probes) {
        const nearby = await fetchReverse(probe.lat, probe.lng);
        if (!nearby.r.ok) continue;
        const candidate = nearby.data.HouseNumber || nearby.data.house_number || '';
        if (candidate) {
          houseNumber = candidate;
          houseNumberSource = 'nearby';
          plaqueDistanceM = probe.meters;
          break;
        }
      }
    }

    // Normalize: { formatted_address, neighbourhood, route_name, house_number, district, city, ... }
    const result = {
      formatted_address: data.formatted_address || '',
      neighbourhood: data.neighbourhood || '',
      route_name: data.route_name || '',
      route_type: data.route_type || '',
      district: data.district || '',
      city: data.city || '',
      place: data.place || '',
      house_number: houseNumber,
      house_number_source: houseNumberSource,
      plaque_distance_m: plaqueDistanceM,
      raw: data,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[neshan-reverse] error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
