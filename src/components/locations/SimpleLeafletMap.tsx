import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { MapSearchBox } from './MapSearchBox';
import { Button } from '@/components/ui/button';
import { Satellite, Map as MapIcon } from 'lucide-react';

export interface SimpleLeafletMapRef {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  setMarker: (lat: number, lng: number) => void;
}

interface SimpleLeafletMapProps {
  onLocationSelect: (lat: number, lng: number, distance?: number) => void;
  initialLat?: number;
  initialLng?: number;
  showSearch?: boolean;
}

// مختصات مرکز شهر قم
const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

// محاسبه فاصله بین دو نقطه جغرافیایی (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // شعاع زمین به کیلومتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function SimpleLeafletMapInner({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
  showSearch = true,
}: SimpleLeafletMapProps, ref: React.Ref<SimpleLeafletMapRef>) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const qomCenterMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number; distance: number; roadDistance?: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapboxTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let map: L.Map;

    try {
      console.log('[SimpleLeafletMap] Initializing map...');
      
      // بررسی پشتیبانی از Leaflet
      if (typeof L === 'undefined') {
        console.error('[SimpleLeafletMap] Leaflet library not loaded');
        return;
      }

      // محاسبه نقطه شروع: اگر مختصات نامعتبر یا 0 باشند، روی قم قرار بده
      const startLat = (initialLat >= 24 && initialLat <= 40) ? initialLat : 34.6416;
      const startLng = (initialLng >= 44 && initialLng <= 64) ? initialLng : 50.8746;

      // ایجاد نقشه با تنظیمات بهینه برای سازگاری
      map = L.map(mapContainer.current, {
        center: [startLat, startLng],
        zoom: 12,
        minZoom: 5,
        maxZoom: 22,
        scrollWheelZoom: true,
        zoomControl: true,
        preferCanvas: true,
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
      });

      mapRef.current = map;
      console.log('[SimpleLeafletMap] Map initialized successfully');
    } catch (error) {
      console.error('[SimpleLeafletMap] Error initializing map:', error);
      return;
    }

    if (!map) return;

    // دریافت توکن Mapbox برای fallback مسیریابی
    (async () => {
      try {
        const cached = sessionStorage.getItem('mapbox_token');
        if (cached) {
          mapboxTokenRef.current = cached;
        } else {
          const { data, error } = await supabase.functions.invoke('get-mapbox-token');
          if (!error && data?.token) {
            mapboxTokenRef.current = data.token as string;
            sessionStorage.setItem('mapbox_token', data.token);
          } else {
            const envToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;
            if (envToken) {
              mapboxTokenRef.current = envToken;
              sessionStorage.setItem('mapbox_token', envToken);
            }
          }
        }
      } catch { /* ignore */ }
    })();

    // اضافه کردن لایه تایل فقط با استفاده از OpenStreetMap / Carto برای سازگاری حداکثری
    const tileConfigs: { url: string; options?: L.TileLayerOptions }[] = [
      {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 22,
          maxNativeZoom: 19,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 4,
          errorTileUrl: '',
        },
      },
      {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 22,
          maxNativeZoom: 19,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 4,
          errorTileUrl: '',
        },
      },
      {
        url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 22,
          maxNativeZoom: 19,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 4,
          errorTileUrl: '',
        },
      },
    ];
    
    let tileLayerAdded = false;
    for (const { url, options } of tileConfigs) {
      try {
        const layer = L.tileLayer(url, options).addTo(map);
        tileLayerRef.current = layer; // ذخیره لایه برای تعویض
        tileLayerAdded = true;

        layer.on('tileerror', (e) => {
          console.error('[SimpleLeafletMap] Tile load error:', e);
        });

        console.log('[SimpleLeafletMap] Tile layer added:', url);
        break;
      } catch (err) {
        console.warn('[SimpleLeafletMap] Tile layer failed:', url, err);
      }
    }
    
    if (!tileLayerAdded) {
      console.error('[SimpleLeafletMap] All tile layers failed');
    }

    // تنظیم marker icon
    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    // اضافه کردن مارکر دائمی برای مرکز شهر قم
    const qomCenterIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [30, 49],
      iconAnchor: [15, 49],
      popupAnchor: [1, -34],
      shadowSize: [49, 49],
    });

    const qomCenterMarker = L.marker([QOM_CENTER.lat, QOM_CENTER.lng], { icon: qomCenterIcon }).addTo(map);
    qomCenterMarker.bindPopup('<div style="text-align: center; font-family: Vazir, sans-serif;"><strong>مرکز شهر قم</strong></div>');
    qomCenterMarkerRef.current = qomCenterMarker;

    // کمک‌تابع: محاسبه و رسم مسیر جاده‌ای
    const computeRoute = async (lat: number, lng: number) => {
      const distance = calculateDistance(QOM_CENTER.lat, QOM_CENTER.lng, lat, lng);
      // ذخیره موقعیت و فاصله هوایی
      setSelectedPos({ lat, lng, distance });
      // ابتدا بدون فاصله جاده‌ای فراخوانی می‌کنیم (فاصله هوایی)
      onLocationSelect(lat, lng, distance);

      setLoadingRoute(true);
      try {
        // فراخوانی فانکشن بک‌اند جهت محاسبه مسیر (حل مشکلات CORS/Rate-limit)
        const { data, error } = await supabase.functions.invoke('get-road-route', {
          body: {
            origin: { lat: QOM_CENTER.lat, lng: QOM_CENTER.lng },
            dest: { lat, lng },
          },
        });

        if (!error && data?.geometry?.coordinates?.length) {
          const roadDistanceKm = data.distanceKm as number;
          setSelectedPos({ lat, lng, distance, roadDistance: roadDistanceKm });
          // فاصله جاده‌ای را به callback ارسال کن
          onLocationSelect(lat, lng, roadDistanceKm);

          // حذف مسیر قبلی
          if (routeLineRef.current) {
            routeLineRef.current.remove();
          }

          // رسم مسیر جاده‌ای روی نقشه (GeoJSON -> [lat, lng])
          const coordinates = (data.geometry.coordinates as [number, number][]) .map((coord) => [coord[1], coord[0]] as [number, number]);
          const routeLine = L.polyline(coordinates, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // نمایش مسیر کامل در قاب
          const bounds = L.latLngBounds(coordinates as [number, number][]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

          routeLineRef.current = routeLine;
        } else {
          // اگر هیچ مسیری برنگشت
          if (routeLineRef.current) {
            routeLineRef.current.remove();
            routeLineRef.current = null;
          }
          setSelectedPos({ lat, lng, distance, roadDistance: undefined });
        }
      } catch (error) {
        console.error('خطا در محاسبه مسیر جاده‌ای:', error);
        if (routeLineRef.current) {
          routeLineRef.current.remove();
          routeLineRef.current = null;
        }
      } finally {
        setLoadingRoute(false);
      }
    };

    // اگر موقعیت اولیه از نقشه کره زمین آمده، مارکر آن را نمایش بده
    if (initialLat !== 34.6416 || initialLng !== 50.8746) {
      const marker = L.marker([initialLat, initialLng], { icon: customIcon, draggable: true }).addTo(map);
      markerRef.current = marker;
      
      // محاسبه مسیر برای موقعیت اولیه
      computeRoute(initialLat, initialLng);
      
      // در صورت drag شدن مارکر، مسیر مجدد محاسبه شود
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await computeRoute(pos.lat, pos.lng);
      });
    }

    // رویداد کلیک روی نقشه
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // حذف marker قبلی
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // اضافه کردن marker جدید (قابل‌جابجایی)
      const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
      markerRef.current = marker;

      // محاسبه و رسم مسیر برای این نقطه
      await computeRoute(lat, lng);

      // در صورت drag شدن مارکر، مسیر مجدد محاسبه شود
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await computeRoute(pos.lat, pos.lng);
      });
    });

    // Resize handler برای modal - فقط یک بار اجرا می‌شود
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // فقط یک بار resize می‌کنیم بعد از 200ms
    const resizeTimeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    }, 200);

    // Cleanup
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (qomCenterMarkerRef.current) {
        qomCenterMarkerRef.current.remove();
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // تغییر نمای نقشه بین استاندارد و ماهواره‌ای
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // حذف لایه قبلی
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    
    let newLayer: L.TileLayer;
    
    if (mapStyle === 'satellite') {
      // لایه ماهواره‌ای از ESRI World Imagery (رایگان)
      newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 22,
        maxNativeZoom: 19,
      });
    } else {
      // لایه استاندارد OpenStreetMap
      newLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22,
        maxNativeZoom: 19,
      });
    }
    
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Handler for search box location selection
  const handleSearchLocationSelect = (lat: number, lng: number, placeName: string) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 17, {
        duration: 1.5,
        easeLinearity: 0.25
      });
      
      // ایجاد/جابجایی مارکر
      const distance = calculateDistance(lat, lng, QOM_CENTER.lat, QOM_CENTER.lng);
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const markerIcon = L.divIcon({
          className: 'custom-marker',
          html: `<svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 0C8.954 0 0 8.954 0 20c0 15.23 18.116 28.547 18.894 29.105a2 2 0 002.212 0C21.884 48.547 40 35.23 40 20c0-11.046-8.954-20-20-20z" fill="#3b82f6"/>
            <circle cx="20" cy="18" r="8" fill="white"/>
          </svg>`,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
        });
        markerRef.current = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(mapRef.current);
        
        markerRef.current.on('dragend', function() {
          const pos = markerRef.current!.getLatLng();
          const dist = calculateDistance(pos.lat, pos.lng, QOM_CENTER.lat, QOM_CENTER.lng);
          setSelectedPos({ lat: pos.lat, lng: pos.lng, distance: dist });
          onLocationSelect(pos.lat, pos.lng);
        });
      }
      
      setSelectedPos({ lat, lng, distance });
      onLocationSelect(lat, lng, distance);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom = 17) => {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], zoom, { duration: 1.5 });
      }
    },
    setMarker: (lat: number, lng: number) => {
      handleSearchLocationSelect(lat, lng, '');
    }
  }));

  return (
    <div className="relative w-full">
      <div
        ref={mapContainer}
        className="w-full rounded-lg border border-border"
        style={{ 
          minHeight: '420px',
          // جلوگیری از تداخل CSS zoom با نقشه
          zoom: 1,
          transform: 'translateZ(0)'
        }}
      />

      {/* دکمه تغییر نمای نقشه */}
      <Button
        variant="default"
        size="sm"
        onClick={() => setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard')}
        className="absolute top-4 right-4 z-[1002] shadow-lg border-2 border-primary/20 text-xs px-3 py-1.5 h-8"
        title={mapStyle === 'standard' ? 'نمای ماهواره‌ای' : 'نمای استاندارد'}
      >
        {mapStyle === 'standard' ? (
          <>
            <Satellite className="h-3.5 w-3.5 ml-1.5" />
            <span className="font-semibold text-xs">ماهواره‌ای</span>
          </>
        ) : (
          <>
            <MapIcon className="h-3.5 w-3.5 ml-1.5" />
            <span className="font-semibold text-xs">نقشه</span>
          </>
        )}
      </Button>

      {/* کادر جستجوی آدرس */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-[1001]">
          <MapSearchBox
            onLocationSelect={handleSearchLocationSelect}
            placeholder="جستجوی آدرس..."
            className="w-full"
          />
        </div>
      )}

      {selectedPos && (
        <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg z-[1000]">
          <div className="flex items-center justify-center gap-2">
            {loadingRoute ? (
              <span className="text-sm text-muted-foreground">در حال محاسبه مسیر جاده‌ای...</span>
            ) : selectedPos.roadDistance ? (
              <span className="text-sm font-medium text-foreground">
                فاصله جاده‌ای تا مرکز شهر قم: <span className="font-bold text-primary">{selectedPos.roadDistance.toFixed(1)}</span> کیلومتر
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">مسیر جاده‌ای در دسترس نبود</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SimpleLeafletMap = forwardRef(SimpleLeafletMapInner);
export default SimpleLeafletMap;
