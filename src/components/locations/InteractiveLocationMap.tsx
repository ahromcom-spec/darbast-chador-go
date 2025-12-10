import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Locate, Layers, Map as MapIcon, Satellite } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import SimpleLeafletMap from './SimpleLeafletMap';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number, distance?: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
  districtId?: string;
}

// مختصات مراکز استان‌های ایران
const provinceCoordinates: { [key: string]: { lat: number; lng: number; zoom: number } } = {
  '10': { lat: 34.6416, lng: 50.8746, zoom: 12 }, // قم
  '08': { lat: 35.6892, lng: 51.3890, zoom: 11 }, // تهران
  '01': { lat: 38.0800, lng: 46.2919, zoom: 10 }, // آذربایجان شرقی
  '03': { lat: 37.4531, lng: 45.0000, zoom: 10 }, // آذربایجان غربی
  '02': { lat: 34.7981, lng: 48.5146, zoom: 10 }, // اردبیل
  '04': { lat: 31.8974, lng: 54.3569, zoom: 10 }, // اصفهان
  '17': { lat: 34.0817, lng: 49.7013, zoom: 10 }, // البرز
  '05': { lat: 31.3183, lng: 48.6706, zoom: 10 }, // ایلام
  '06': { lat: 27.1865, lng: 56.2808, zoom: 10 }, // بوشهر
  '07': { lat: 35.5611, lng: 51.4231, zoom: 11 }, // تهران
  '09': { lat: 32.6546, lng: 51.6679, zoom: 10 }, // چهارمحال و بختیاری
  '11': { lat: 36.2381, lng: 59.6161, zoom: 10 }, // خراسان رضوی
  '29': { lat: 32.8663, lng: 59.2210, zoom: 10 }, // خراسان جنوبی
  '30': { lat: 37.4713, lng: 57.3314, zoom: 10 }, // خراسان شمالی
  '12': { lat: 31.3201, lng: 48.6940, zoom: 10 }, // خوزستان
  '13': { lat: 36.5699, lng: 53.0586, zoom: 10 }, // زنجان
  '14': { lat: 36.6472, lng: 48.5104, zoom: 10 }, // سمنان
  '15': { lat: 27.5342, lng: 60.5820, zoom: 10 }, // سیستان و بلوچستان
  '16': { lat: 29.6103, lng: 52.5311, zoom: 10 }, // فارس
  '18': { lat: 36.6367, lng: 48.6814, zoom: 10 }, // قزوین
  '19': { lat: 34.3143, lng: 47.0658, zoom: 10 }, // کردستان
  '20': { lat: 30.2839, lng: 57.0833, zoom: 10 }, // کرمان
  '21': { lat: 34.3142, lng: 47.0658, zoom: 10 }, // کرمانشاه
  '22': { lat: 30.9800, lng: 50.8200, zoom: 10 }, // کهگیلویه و بویراحمد
  '23': { lat: 36.8500, lng: 54.4167, zoom: 10 }, // گلستان
  '24': { lat: 37.2808, lng: 49.5926, zoom: 10 }, // گیلان
  '25': { lat: 33.5894, lng: 49.7910, zoom: 10 }, // لرستان
  '26': { lat: 36.5654, lng: 52.6778, zoom: 10 }, // مازندران
  '27': { lat: 34.3600, lng: 50.8764, zoom: 10 }, // مرکزی
  '28': { lat: 27.1939, lng: 56.2772, zoom: 10 }, // هرمزگان
  '31': { lat: 34.7992, lng: 48.5146, zoom: 10 }, // همدان
  '32': { lat: 31.8934, lng: 54.3608, zoom: 10 }, // یزد
};

const IRAN_BOUNDS: [[number, number], [number, number]] = [[44.0, 24.0], [64.0, 40.0]];

// مرکز استان قم
const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

// شناسه‌های لایه و منبع مسیر در Mapbox
const ROUTE_SOURCE_ID = 'qom-route-source';
const ROUTE_LAYER_ID = 'qom-route-layer';

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 34.6416, // Qom
  initialLng = 50.8746, // Qom
  provinceCode,
  districtId,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [useFallback, setUseFallback] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [roadDistance, setRoadDistance] = useState<number | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const qomCenterMarker = useRef<mapboxgl.Marker | null>(null);
  const { toast } = useToast();

  // دریافت توکن Mapbox و فعال‌سازی نقشه پیشرفته در صورت موجود بودن
  useEffect(() => {
    const cached = sessionStorage.getItem('mapbox_token');
    if (cached) {
      setMapboxToken(cached);
      setUseFallback(false);
      return;
    }

    const tryEdgeThenEnv = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
          sessionStorage.setItem('mapbox_token', data.token);
          setUseFallback(false);
          return;
        }
      } catch (_) {}

      const envToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (envToken) {
        setMapboxToken(envToken);
        sessionStorage.setItem('mapbox_token', envToken);
        setUseFallback(false);
        return;
      }
      // اگر توکن موجود نبود، در حالت fallback باقی بماند
    };

    tryEdgeThenEnv();
  }, [toast]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // راه‌اندازی نقشه
  useEffect(() => {
    if (useFallback || !isMounted || !mapContainer.current || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;
      // فعال‌سازی پشتیبانی متن RTL
      if (typeof (mapboxgl as any).setRTLTextPlugin === 'function') {
        try {
          (mapboxgl as any).setRTLTextPlugin(
            'https://cdn.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js',
            undefined,
            true
          );
        } catch (_) {}
      }

      // تعیین موقعیت اولیه بر اساس استان
      let startLat = initialLat;
      let startLng = initialLng;
      let startZoom = 12; // Qom city-level zoom

      if (provinceCode && provinceCoordinates[provinceCode]) {
        const coords = provinceCoordinates[provinceCode];
        startLat = coords.lat;
        startLng = coords.lng;
        startZoom = coords.zoom;
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [startLng, startLat],
        zoom: startZoom,
        projection: 'mercator',
        renderWorldCopies: false,
        minZoom: 4,
        maxZoom: 22,
        pitchWithRotate: false,
        attributionControl: false,
        performanceMetricsCollection: false,
        refreshExpiredTiles: false,
      });

      // اضافه کردن لایه‌های ساختمان برای نمایش واضح تمام قواره‌ها در همه سطوح زوم
      map.current.on('load', () => {
        if (map.current) {
          const layers = map.current.getStyle().layers;
          const labelLayerId = layers?.find(
            (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
          )?.id;

          // لایه ساختمان‌های سه‌بعدی؛ همه ساختمان‌ها را بدون فیلتر extrude نشان می‌دهیم
          map.current.addLayer(
            {
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 14,
              paint: {
                'fill-extrusion-color': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  '#8b8b8b',
                  '#aaaaaa',
                ],
                // اگر height وجود نداشته باشد، یک ارتفاع پیش‌فرض برای دیده شدن قواره در نظر می‌گیریم
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  0,
                  14.5,
                  ['coalesce', ['get', 'height'], 10],
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  0,
                  14.5,
                  ['coalesce', ['get', 'min_height'], 0],
                ],
                'fill-extrusion-opacity': 0.75,
              },
            },
            labelLayerId
          );

          // لایه کف ساختمان‌ها (2D) برای نمایش قواره‌ها در زوم‌های پایین‌تر
          map.current.addLayer(
            {
              id: 'building-footprints',
              source: 'composite',
              'source-layer': 'building',
              type: 'fill',
              minzoom: 12,
              maxzoom: 15,
              paint: {
                'fill-color': '#d6d6d6',
                'fill-opacity': 0.6,
                'fill-outline-color': '#999999',
              },
            },
            labelLayerId
          );

          // لایه خطوط مرزی ساختمان‌ها برای تفکیک بهتر قواره‌ها
          map.current.addLayer({
            id: 'building-outlines',
            source: 'composite',
            'source-layer': 'building',
            type: 'line',
            minzoom: 12,
            paint: {
              'line-color': '#777777',
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,
                0.4,
                16,
                1.6,
              ],
              'line-opacity': 0.9,
            },
          });
        }
      });

      // نقشه را بلافاصله قابل نمایش کن
      setIsMapReady(true);

      // لاگ خطای سبک/توکن و سوییچ به نقشه ساده
      map.current.on('error', (e) => {
        console.error('Mapbox error', e);
        setUseFallback(true);
        toast({ title: 'نقشه ساده فعال شد', description: 'نمای نقشه به حالت جایگزین تغییر کرد.', variant: 'default' });
      });

      // محدود کردن نقشه به مرزهای ایران برای سبک‌تر شدن
      map.current.setMaxBounds(IRAN_BOUNDS as any);

      // بدون fitBounds ایران تا سریع‌تر روی قم بماند

      // کنترل‌های ناوبری
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-left');
      map.current.dragRotate.disable();
      (map.current as any).touchZoomRotate?.disableRotation?.();

      // بارگذاری کامل نقشه
      map.current.once('load', () => {
        setIsMapReady(true);
        setTimeout(() => map.current?.resize(), 100);
        
        // اضافه کردن مارکر مرکز قم
        const qomEl = document.createElement('div');
        qomEl.innerHTML = `
          <div style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
            <svg width="30" height="40" viewBox="0 0 30 40">
              <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 22.5 15 22.5s15-11.25 15-22.5c0-8.284-6.716-15-15-15z" 
                fill="hsl(var(--destructive))" stroke="white" stroke-width="2"/>
              <circle cx="15" cy="15" r="5" fill="white"/>
            </svg>
          </div>
        `;
        
        qomCenterMarker.current = new mapboxgl.Marker({ element: qomEl, anchor: 'bottom' })
          .setLngLat([QOM_CENTER.lng, QOM_CENTER.lat])
          .addTo(map.current!);

        // اگر موقعیت اولیه از نقشه کره زمین آمده، مارکر آن را نمایش بده
        if (initialLat !== 34.6416 || initialLng !== 50.8746) {
          const el = document.createElement('div');
          el.className = 'custom-mapbox-marker';
          el.innerHTML = `
            <div class="marker-animation">
              <svg width="40" height="50" viewBox="0 0 40 50">
                <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30c0-11.046-8.954-20-20-20z" 
                  fill="hsl(var(--primary))" stroke="white" stroke-width="3"/>
                <circle cx="20" cy="20" r="8" fill="white"/>
                <circle cx="20" cy="20" r="4" fill="hsl(var(--primary))"/>
              </svg>
            </div>
          `;

          marker.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([initialLng, initialLat])
            .addTo(map.current!);

          setSelectedPosition({ lat: initialLat, lng: initialLng });
          onLocationSelect(initialLat, initialLng);
        }
      });

      // Hide upload popup when clicking elsewhere on map
      map.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        
        // Close any open media upload popups
        const uploadPopups = document.querySelectorAll('[data-upload-popup]');
        uploadPopups.forEach(popup => {
          if (popup instanceof HTMLElement) {
            popup.style.display = 'none';
          }
        });

        if (marker.current) {
          marker.current.remove();
        }

        const el = document.createElement('div');
        el.className = 'custom-mapbox-marker';
        el.innerHTML = `
          <div class="marker-animation">
            <svg width="40" height="50" viewBox="0 0 40 50">
              <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30c0-11.046-8.954-20-20-20z" 
                fill="hsl(var(--primary))" stroke="white" stroke-width="3"/>
              <circle cx="20" cy="20" r="8" fill="white"/>
              <circle cx="20" cy="20" r="4" fill="hsl(var(--primary))"/>
            </svg>
          </div>
        `;

        marker.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        setSelectedPosition({ lat, lng });
        onLocationSelect(lat, lng);

        // محاسبه مسیر و فاصله جاده‌ای
        setLoadingRoute(true);
        setRoadDistance(null);
        
        try {
          let routeData: any | null = null;

          // 1) تلاش با Mapbox Directions اگر توکن موجود است
          if (mapboxToken) {
            try {
              const mUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${QOM_CENTER.lng},${QOM_CENTER.lat};${lng},${lat}?overview=full&geometries=geojson&access_token=${mapboxToken}`;
              const mRes = await fetch(mUrl, { mode: 'cors' });
              const mJson = await mRes.json();
              if (mJson?.routes?.length) routeData = mJson;
            } catch (_) {}
          }

          // 2) در صورت عدم موفقیت، OSRM عمومی (با fallback دوم)
          if (!routeData) {
            const endpoints = [
              'https://router.project-osrm.org/route/v1/driving',
              'https://routing.openstreetmap.de/routed-car/route/v1/driving'
            ];

            for (const endpoint of endpoints) {
              try {
                const url = `${endpoint}/${QOM_CENTER.lng},${QOM_CENTER.lat};${lng},${lat}?overview=full&geometries=geojson`;
                const res = await fetch(url, { mode: 'cors' });
                if (!res.ok) continue;
                const json = await res.json();
                if (json?.routes?.length) {
                  routeData = json;
                  break;
                }
              } catch (_) {}
            }
          }
          
          if (routeData?.routes?.length) {
            const roadDistanceKm = routeData.routes[0].distance / 1000;
            setRoadDistance(roadDistanceKm);
            
            // ارسال فاصله به callback
            onLocationSelect(lat, lng, roadDistanceKm);
            
            // حذف مسیر قبلی اگر وجود دارد (ایمن)
            if (map.current!.getLayer(ROUTE_LAYER_ID)) {
              try { map.current!.removeLayer(ROUTE_LAYER_ID); } catch (_) {}
            }
            if (map.current!.getSource(ROUTE_SOURCE_ID)) {
              try { map.current!.removeSource(ROUTE_SOURCE_ID); } catch (_) {}
            }
            
            // اضافه کردن مسیر به نقشه
            map.current!.addSource(ROUTE_SOURCE_ID, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: routeData.routes[0].geometry
              }
            });
            
            map.current!.addLayer({
              id: ROUTE_LAYER_ID,
              type: 'line',
              source: ROUTE_SOURCE_ID,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#2563eb',
                'line-width': 5,
                'line-opacity': 0.9
              }
            });

            // تنظیم دید نقشه روی مسیر
            const coords: [number, number][] = routeData.routes[0].geometry.coordinates;
            let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
            for (const [lngc, latc] of coords) {
              if (lngc < minLng) minLng = lngc;
              if (lngc > maxLng) maxLng = lngc;
              if (latc < minLat) minLat = latc;
              if (latc > maxLat) maxLat = latc;
            }
            map.current!.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40 });
          } else {
            // اگر هیچ سرویس مسیری پاسخی نداد، مسیر نمایش داده نمی‌شود
            setRoadDistance(null);
          }
        } catch (err) {
          setRoadDistance(null);
        } finally {
          setLoadingRoute(false);
        }

        toast({
          title: '✓ موقعیت انتخاب شد',
          description: 'در حال محاسبه مسیر جاده‌ای...',
        });
      });

      // timeout اطمینان
      const timeout = setTimeout(() => {
        setIsMapReady(true);
        map.current?.resize();
      }, 2000);

      const onResize = () => map.current?.resize();
      window.addEventListener('resize', onResize);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('resize', onResize);
        if (marker.current) marker.current.remove();
        if (qomCenterMarker.current) qomCenterMarker.current.remove();
        if (map.current) {
          if (map.current.getSource(ROUTE_SOURCE_ID)) {
            map.current.removeLayer(ROUTE_LAYER_ID);
            map.current.removeSource(ROUTE_SOURCE_ID);
          }
          map.current.remove();
        }
      };
    } catch (err) {
      console.error('Map error:', err);
      setIsMapReady(true);
      toast({
        title: 'خطا در بارگذاری نقشه',
        description: 'لطفاً دوباره تلاش کنید',
        variant: 'destructive',
      });
    }
  }, [isMounted, mapboxToken, provinceCode, initialLat, initialLng, onLocationSelect, toast]);

  // تغییر استایل نقشه (غیرفعال در حالت fallback)
  useEffect(() => {
    if (useFallback || !map.current) return;

    const styleUrl = mapStyle === 'satellite' 
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/streets-v12';

    map.current.setStyle(styleUrl);
    setIsMapReady(true);

    const onIdle = () => setTimeout(() => map.current?.resize(), 100);
    map.current.once('idle', onIdle);

    return () => { map.current?.off('idle', onIdle); }
  }, [mapStyle, useFallback]);

  // تغییر موقعیت با تغییر استان
  useEffect(() => {
    if (!map.current || !isMapReady || !provinceCode) return;

    const coords = provinceCoordinates[provinceCode];
    if (coords) {
      map.current.flyTo({
        center: [coords.lng, coords.lat],
        zoom: coords.zoom,
        essential: true,
        duration: 2000,
      });
    }
  }, [provinceCode, isMapReady]);

  // دریافت موقعیت فعلی کاربر
  const handleGetUserLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'خطا',
        description: 'مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            essential: true,
          });

          toast({
            title: '✓ موقعیت شما یافت شد',
            description: 'روی نقشه کلیک کنید تا نقطه دلخواه را انتخاب کنید',
          });
        }
      },
      () => {
        toast({
          title: 'خطا',
          description: 'دریافت موقعیت ناموفق بود',
          variant: 'destructive',
        });
      }
    );
  };

  if (!isMounted) {
    return (
      <div className="h-[500px] w-full rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-medium">در حال بارگذاری نقشه...</p>
        </div>
      </div>
    );
  }

  if (!useFallback && !mapboxToken) {
    return (
      <div className="h-[500px] w-full rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">در حال دریافت تنظیمات نقشه...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* تغییر حالت نمایش */}
      {!useFallback && (
        <div className="flex items-center gap-2">
          <Button
            variant={mapStyle === 'streets' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMapStyle('streets')}
            className="flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            نقشه ساده
          </Button>
          <Button
            variant={mapStyle === 'satellite' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMapStyle('satellite')}
            className="flex items-center gap-2"
          >
            <Satellite className="w-4 h-4" />
            نمای ماهواره‌ای
          </Button>
        </div>
      )}

      {/* نقشه */}
      <div className="relative h-[500px] w-full rounded-xl overflow-hidden border-2 shadow-lg">
        {useFallback ? (
          <SimpleLeafletMap
            onLocationSelect={(lat, lng) => {
              setSelectedPosition({ lat, lng });
              onLocationSelect(lat, lng);
            }}
            initialLat={initialLat}
            initialLng={initialLng}
          />
        ) : (
          <>
            <div ref={mapContainer} className="h-full w-full" />
            
            {/* نمایش فاصله جاده‌ای برای Mapbox */}
            {selectedPosition && !useFallback && (
              <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-4 shadow-lg z-[1000] animate-fade-in">
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="font-medium text-foreground text-base">
                    {loadingRoute ? (
                      <span>در حال محاسبه مسیر جاده‌ای...</span>
                    ) : roadDistance ? (
                      <span>فاصله جاده‌ای تا مرکز شهر قم: <span className="font-bold text-primary">{roadDistance.toFixed(1)}</span> کیلومتر</span>
                    ) : null}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {!isMapReady && !useFallback && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-[1000]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted-foreground font-medium">بارگذاری نقشه...</p>
            </div>
          </div>
        )}

        {/* دکمه موقعیت من */}
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-4 right-4 bg-background/95 backdrop-blur shadow-lg hover:scale-105 transition-transform z-[1000]"
          onClick={handleGetUserLocation}
          title="موقعیت من"
        >
          <Locate className="w-4 h-4" />
        </Button>


        <style>{`
          .custom-mapbox-marker {
            cursor: pointer;
            width: 40px;
            height: 50px;
          }
          .marker-animation {
            animation: markerDrop 0.6s ease-out;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
          }
          @keyframes markerDrop {
            0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
            60% { transform: translateY(5px) scale(1.1); }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          .mapboxgl-ctrl-bottom-left,
          .mapboxgl-ctrl-bottom-right {
            display: none;
          }
          .mapboxgl-ctrl-logo {
            display: none !important;
          }
        `}</style>
      </div>
    </div>
  );
}
