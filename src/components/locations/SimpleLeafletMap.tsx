import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { MapSearchBox } from './MapSearchBox';
import { Button } from '@/components/ui/button';
import { Satellite, Map as MapIcon, Maximize2, Minimize2, Check } from 'lucide-react';
import { createNeshanTileLayer, neshanDirection } from '@/lib/neshan';

export interface SimpleLeafletMapRef {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  setMarker: (lat: number, lng: number) => void;
}

interface SimpleLeafletMapProps {
  onLocationSelect: (lat: number, lng: number, distance?: number) => void;
  initialLat?: number;
  initialLng?: number;
  showSearch?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
  onFullscreenChange,
}: SimpleLeafletMapProps, ref: React.Ref<SimpleLeafletMapRef>) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const qomCenterMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number; distance: number; roadDistance?: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapboxTokenRef = useRef<string | null>(null);
  const placeMarkerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [centerPin, setCenterPin] = useState<{ lat: number; lng: number } | null>(null);
  const [existingLocations, setExistingLocations] = useState<Array<{ id: string; lat: number; lng: number; title: string | null }>>([]);
  const [snapTarget, setSnapTarget] = useState<{ id: string; lat: number; lng: number; title: string | null } | null>(null);


  const toggleFullscreen = async () => {
    const wrapper = mapWrapperRef.current;
    if (!wrapper) return;

    try {
      if (document.fullscreenElement === wrapper) {
        await document.exitFullscreen();
      } else if (wrapper.requestFullscreen) {
        await wrapper.requestFullscreen();
      } else {
        // Fallback for older mobile browsers without the Fullscreen API.
        setIsFullscreen((prev) => {
          const next = !prev;
          onFullscreenChange?.(next);
          return next;
        });
      }
    } catch (error) {
      console.error('[SimpleLeafletMap] Fullscreen failed:', error);
    }
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      const next = document.fullscreenElement === mapWrapperRef.current;
      setIsFullscreen(next);
      onFullscreenChange?.(next);
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [onFullscreenChange]);

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
        zoomControl: false,
        preferCanvas: true,
        attributionControl: false,
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

    // اضافه کردن لایه تایل نشان (نقشه ایرانی با کیفیت بالا)
    try {
      const layer = createNeshanTileLayer('standard-day', {
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4,
      });
      layer.addTo(map);
      tileLayerRef.current = layer;

      layer.on('tileerror', (e) => {
        console.error('[SimpleLeafletMap] Neshan tile load error:', e);
      });

      console.log('[SimpleLeafletMap] Neshan tile layer added');
    } catch (err) {
      console.error('[SimpleLeafletMap] Neshan tile layer failed:', err);
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

    // مارکر مرکز شهر قم حذف شد (طبق درخواست کاربر)

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

    // انتخاب موقعیت با نگه‌داشتن یک‌ثانیه‌ای روی نقشه (به‌جای کلیک ساده)
    const placeMarker = async (lat: number, lng: number) => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await computeRoute(pos.lat, pos.lng);
      });
      await computeRoute(lat, lng);
    };

    const containerEl = map.getContainer();
    let pressTimer: number | undefined;
    let startPoint: { x: number; y: number } | null = null;

    const clearPress = () => {
      if (pressTimer) {
        window.clearTimeout(pressTimer);
        pressTimer = undefined;
      }
      startPoint = null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      // اگر روی مارکر یا دکمه‌ها فشار داده شد، نادیده بگیر
      const target = ev.target as HTMLElement;
      if (target.closest('.leaflet-marker-icon') || target.closest('button')) return;

      startPoint = { x: ev.clientX, y: ev.clientY };
      pressTimer = window.setTimeout(() => {
        if (!startPoint) return;
        const rect = containerEl.getBoundingClientRect();
        const latlng = map.containerPointToLatLng(
          L.point(startPoint.x - rect.left, startPoint.y - rect.top),
        );
        clearPress();
        void placeMarker(latlng.lat, latlng.lng);
      }, 1000);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!startPoint) return;
      const dist = Math.hypot(ev.clientX - startPoint.x, ev.clientY - startPoint.y);
      if (dist > 12) clearPress();
    };

    containerEl.addEventListener('pointerdown', onPointerDown);
    containerEl.addEventListener('pointermove', onPointerMove);
    containerEl.addEventListener('pointerup', clearPress);
    containerEl.addEventListener('pointercancel', clearPress);
    containerEl.addEventListener('pointerleave', clearPress);
    map.on('movestart zoomstart', clearPress);


    // Resize handler برای modal
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // چند بار resize را در بازه‌های مختلف انجام می‌دهیم تا در بارگذاری اول (اینترنت کند/کش خالی)
    // که ممکن است container دیرتر از حد معمول اندازه بگیرد، نقشه مطمئناً نمایش داده شود
    const resizeTimeouts = [100, 300, 600, 1200, 2000].map((delay) =>
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      }, delay)
    );

    // Cleanup
    return () => {
      resizeTimeouts.forEach(clearTimeout);
      resizeObserver.disconnect();
      clearPress();
      containerEl.removeEventListener('pointerdown', onPointerDown);
      containerEl.removeEventListener('pointermove', onPointerMove);
      containerEl.removeEventListener('pointerup', clearPress);
      containerEl.removeEventListener('pointercancel', clearPress);
      containerEl.removeEventListener('pointerleave', clearPress);



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

  // تغییر نمای نقشه بین استاندارد و ماهواره‌ای (با تایل‌های نشان)
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // حذف لایه قبلی
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newLayer = createNeshanTileLayer(
      mapStyle === 'satellite' ? 'satellite' : 'standard-day',
    );

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // در تغییر حالت تمام‌صفحه، اندازه نقشه و تایل‌ها را مجدد محاسبه/بارگذاری کن
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isFullscreen) document.body.style.overflow = 'hidden';

    const refresh = () => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize({ animate: false });
      // اجبار به بارگذاری مجدد تایل‌ها (رفع مشکل نقشه خاکستری در تمام‌صفحه)
      tileLayerRef.current?.redraw();
    };

    const raf = requestAnimationFrame(refresh);
    const timers = [50, 150, 350, 700, 1200].map((d) => setTimeout(refresh, d));

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

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
          const currentMarker = markerRef.current;
          if (!currentMarker) return;
          const pos = currentMarker.getLatLng();
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
    <div
      ref={mapWrapperRef}
      className={
        isFullscreen
          ? 'fixed top-0 left-0 z-[99999] bg-background overflow-hidden'
          : 'relative w-full min-h-[420px] overflow-hidden rounded-lg'
      }
      style={
        isFullscreen
          ? { width: '100vw', height: '100dvh' }
          : undefined
      }
    >
      <div
        ref={mapContainer}
        className="absolute inset-0 h-full w-full rounded-lg border border-border"
        style={{
          // جلوگیری از تداخل CSS zoom با نقشه
          zoom: 1,
          transform: 'translateZ(0)'
        }}
      />

      {/* دکمه تغییر نمای نقشه */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard')}
        className="absolute top-3 right-3 z-[10002] h-9 px-3 text-xs rounded-md bg-background/80 backdrop-blur-md border border-border text-foreground hover:bg-background shadow-md"
        title={mapStyle === 'standard' ? 'نمای ماهواره‌ای' : 'نمای استاندارد'}
      >
        {mapStyle === 'standard' ? (
          <>
            <Satellite className="h-4 w-4 ml-1" />
            <span className="font-medium">ماهواره‌ای</span>
          </>
        ) : (
          <>
            <MapIcon className="h-4 w-4 ml-1" />
            <span className="font-medium">نقشه</span>
          </>
        )}
      </Button>

      {/* دکمه تمام‌صفحه / خروج از تمام‌صفحه */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleFullscreen}
        className="absolute top-14 right-3 z-[10002] h-9 px-3 text-xs rounded-md bg-background/80 backdrop-blur-md border border-border text-foreground hover:bg-background shadow-md"
        title={isFullscreen ? 'کوچک کردن نقشه' : 'نمایش تمام‌صفحه نقشه'}
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="h-4 w-4 ml-1" />
            <span className="font-medium">کوچک کردن</span>
          </>
        ) : (
          <>
            <Maximize2 className="h-4 w-4 ml-1" />
            <span className="font-medium">تمام‌صفحه</span>
          </>
        )}
      </Button>

      {/* کادر جستجوی آدرس - با فاصله از دکمه ماهواره */}
      {showSearch && (
        <div
          className="absolute top-3 left-3 right-[8.5rem] z-[10001] transition-[right] duration-200 focus-within:right-3 focus-within:z-[10003]"
        >
          <MapSearchBox
            onLocationSelect={handleSearchLocationSelect}
            placeholder="جستجوی آدرس..."
            className="w-full"
          />
        </div>
      )}

      {/* بازگشت به فرم ثبت آدرس در حالت تمام‌صفحه */}
      {isFullscreen && (
        <div className="absolute bottom-0 left-0 right-0 p-3 pb-5 bg-background/95 backdrop-blur-md border-t border-border z-[10002]">
          <Button
            type="button"
            className="w-full h-12 text-base font-bold shadow-lg"
            onClick={toggleFullscreen}
          >
            <Check className="h-5 w-5 ml-2" />
            بازگشت به ثبت آدرس
          </Button>
        </div>
      )}


      {selectedPos && (
        <div className={`absolute ${isFullscreen ? 'bottom-24' : 'bottom-2'} right-2 bg-background/70 backdrop-blur-md border border-white/20 rounded-md px-1.5 py-0.5 shadow-sm z-[10000]`}>
          {loadingRoute ? (
            <span className="text-[8px] text-muted-foreground">محاسبه مسیر...</span>
          ) : selectedPos.roadDistance ? (
            <span className="text-[9px] font-medium text-foreground">
              تا مرکز قم: <span className="font-bold text-primary">{selectedPos.roadDistance.toFixed(1)}</span> km
            </span>
          ) : (
            <span className="text-[8px] text-muted-foreground">مسیر در دسترس نبود</span>
          )}
        </div>
      )}
    </div>
  );
}

const SimpleLeafletMap = forwardRef(SimpleLeafletMapInner);
export default SimpleLeafletMap;
