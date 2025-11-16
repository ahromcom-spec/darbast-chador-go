import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Locate, Layers, Map as MapIcon, Satellite } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import LeafletFallbackMap from './LeafletFallbackMap';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
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

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 34.6416, // Qom
  initialLng = 50.8746, // Qom
  provinceCode,
  districtId,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const { toast } = useToast();

  // دریافت توکن Mapbox
  useEffect(() => {
    const cached = sessionStorage.getItem('mapbox_token');
    if (cached) {
      setMapboxToken(cached);
      return;
    }

    const tryEdgeThenEnv = async () => {
      // 1) سعی کن از بک‌اند بگیریم
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error as any;
        if (data?.token) {
          setMapboxToken(data.token);
          sessionStorage.setItem('mapbox_token', data.token);
          return;
        }
      } catch (_) {}
      // 2)fallback به env
      const envToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (envToken) {
        setMapboxToken(envToken);
        sessionStorage.setItem('mapbox_token', envToken);
        return;
      }
      toast({ title: 'خطا', description: 'کلید عمومی نقشه یافت نشد', variant: 'destructive' });
    };

    tryEdgeThenEnv();
  }, [toast]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // راه‌اندازی نقشه
  useEffect(() => {
    if (!isMounted || !mapContainer.current || !mapboxToken) return;

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
        maxZoom: 20,
        pitchWithRotate: false,
        attributionControl: false,
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
      });

      // کلیک روی نقشه
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;

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

        marker.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        setSelectedPosition({ lat, lng });
        onLocationSelect(lat, lng);

        toast({
          title: '✓ موقعیت انتخاب شد',
          description: `عرض: ${lat.toFixed(6)} - طول: ${lng.toFixed(6)}`,
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
        if (map.current) map.current.remove();
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

  // تغییر استایل نقشه
  useEffect(() => {
    if (!map.current) return;

    const styleUrl = mapStyle === 'satellite' 
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/streets-v12';

    map.current.setStyle(styleUrl);
    setIsMapReady(true);

    const onIdle = () => setTimeout(() => map.current?.resize(), 100);
    map.current.once('idle', onIdle);

    return () => { map.current?.off('idle', onIdle); }
  }, [mapStyle]);

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

  if (!mapboxToken) {
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
          <LeafletFallbackMap
            onLocationSelect={(lat, lng) => {
              setSelectedPosition({ lat, lng });
              onLocationSelect(lat, lng);
            }}
            initialLat={initialLat}
            initialLng={initialLng}
          />
        ) : (
          <div ref={mapContainer} className="h-full w-full" />
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

        {/* نمایش مختصات */}
        {selectedPosition && (
          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg z-[1000]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm">موقعیت انتخاب شده:</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-mono">
                <span className="text-muted-foreground">
                  عرض: <span className="text-foreground font-semibold">{selectedPosition.lat.toFixed(6)}</span>
                </span>
                <span className="text-muted-foreground">
                  طول: <span className="text-foreground font-semibold">{selectedPosition.lng.toFixed(6)}</span>
                </span>
              </div>
            </div>
          </div>
        )}

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
