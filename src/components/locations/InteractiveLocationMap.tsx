import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, Locate, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import 'leaflet/dist/leaflet.css';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
}

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 32.4279, // مرکز ایران
  initialLng = 53.6880,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !mapContainerRef.current) return;

    let leaflet: any;
    let clickHandler: any;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        leaflet = await import('leaflet');

        // آیکون مارکر انتخابی
        const SelectedIcon = leaflet.divIcon({
          className: 'custom-selected-marker',
          html: `
            <div class="marker-container">
              <div class="marker-pulse"></div>
              <div class="marker-pin">
                <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
                  <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30c0-11.046-8.954-20-20-20z" 
                    fill="hsl(var(--primary))" stroke="white" stroke-width="3"/>
                  <circle cx="20" cy="20" r="8" fill="white"/>
                  <circle cx="20" cy="20" r="4" fill="hsl(var(--primary))"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
        });

        // آیکون موقعیت کاربر
        const UserLocationIcon = leaflet.divIcon({
          className: 'custom-user-marker',
          html: `
            <div class="user-location-marker">
              <div class="user-location-pulse"></div>
              <div class="user-location-dot"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        // راه‌اندازی نقشه با نمای کلی ایران
        const startPos: [number, number] = [initialLat, initialLng];
        mapRef.current = leaflet.map(mapContainerRef.current, {
          center: startPos,
          zoom: 6, // زوم کمتر برای دیدن کل ایران
          minZoom: 5,
          maxZoom: 18,
          zoomControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
          attributionControl: false,
        });

        // لایه نقشه با تنظیمات بهینه برای ایران
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 5,
            crossOrigin: true,
            // تنظیمات برای نمایش بهتر نام شهرها به فارسی
            detectRetina: true,
          })
          .addTo(mapRef.current);

        // اتریبیوشن سفارشی
        leaflet.control.attribution({
          position: 'bottomleft',
          prefix: '<a href="https://leafletjs.com" target="_blank">Leaflet</a>'
        }).addTo(mapRef.current);

        // آماده شدن نقشه
        mapRef.current.whenReady(() => {
          setTimeout(() => {
            setIsMapReady(true);
            mapRef.current?.invalidateSize();
          }, 100);
        });

        // مشاهده‌گر تغییر سایز
        if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            setTimeout(() => {
              try {
                mapRef.current?.invalidateSize();
              } catch {}
            }, 100);
          });
          resizeObserver.observe(mapContainerRef.current);
        }

        // مارکر اولیه - فقط اگر کاربر موقعیت را انتخاب کرده باشد
        if (initialLat !== 32.4279 || initialLng !== 53.6880) {
          markerRef.current = leaflet
            .marker(startPos, { icon: SelectedIcon })
            .addTo(mapRef.current);
          setSelectedPosition({ lat: initialLat, lng: initialLng });
        } else {
          // برای نمای اولیه، مارکر نمی‌گذاریم تا کل نقشه ایران دیده شود
          setSelectedPosition(null);
        }

        // کلیک روی نقشه
        clickHandler = (e: any) => {
          const { lat, lng } = e.latlng;

          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = leaflet
              .marker([lat, lng], { icon: SelectedIcon })
              .addTo(mapRef.current);
          }

          // افکت دایره موقت
          const ripple = leaflet.circle([lat, lng], {
            color: 'hsl(var(--primary))',
            fillColor: 'hsl(var(--primary))',
            fillOpacity: 0.15,
            radius: 80,
            weight: 2,
          }).addTo(mapRef.current);

          setTimeout(() => {
            mapRef.current?.removeLayer(ripple);
          }, 800);

          setSelectedPosition({ lat, lng });
          onLocationSelect(lat, lng);

          toast({
            title: '✓ موقعیت انتخاب شد',
            description: `عرض: ${lat.toFixed(6)} - طول: ${lng.toFixed(6)}`,
          });
        };

        mapRef.current.on('click', clickHandler);

        // ذخیره leaflet برای استفاده در توابع دیگر
        (mapRef.current as any)._leaflet = leaflet;
      } catch (err) {
        console.error('خطا در راه‌اندازی نقشه:', err);
        toast({
          title: 'خطا',
          description: 'نقشه بارگذاری نشد. لطفاً صفحه را رفرش کنید.',
          variant: 'destructive',
        });
      }
    })();

    return () => {
      try {
        if (resizeObserver) resizeObserver.disconnect();
        if (mapRef.current) {
          if (clickHandler) mapRef.current.off('click', clickHandler);
          mapRef.current.remove();
        }
      } catch {}
      mapRef.current = null;
      markerRef.current = null;
      userMarkerRef.current = null;
    };
  }, [isMounted, initialLat, initialLng, onLocationSelect, toast]);

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

    toast({
      title: 'در حال دریافت موقعیت...',
      description: 'لطفاً اجازه دسترسی به موقعیت را بدهید',
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const leaflet = (mapRef.current as any)?._leaflet;

        if (mapRef.current && leaflet) {
          mapRef.current.setView([latitude, longitude], 15, { animate: true });

          // حذف مارکر قبلی کاربر
          if (userMarkerRef.current) {
            mapRef.current.removeLayer(userMarkerRef.current);
          }

          // آیکون موقعیت کاربر
          const UserLocationIcon = leaflet.divIcon({
            className: 'custom-user-marker',
            html: `
              <div class="user-location-marker">
                <div class="user-location-pulse"></div>
                <div class="user-location-dot"></div>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          userMarkerRef.current = leaflet
            .marker([latitude, longitude], { icon: UserLocationIcon })
            .addTo(mapRef.current);

          setUserLocation({ lat: latitude, lng: longitude });

          toast({
            title: '✓ موقعیت شما یافت شد',
            description: 'روی نقشه کلیک کنید تا نقطه دلخواه را انتخاب کنید',
          });
        }
      },
      (error) => {
        toast({
          title: 'خطا',
          description: 'دریافت موقعیت ناموفق بود. دسترسی به موقعیت را بررسی کنید.',
          variant: 'destructive',
        });
      }
    );
  };

  // زوم کردن
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  if (!isMounted) {
    return (
      <div className="h-[500px] w-full rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-medium">در حال بارگذاری نقشه تعاملی...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* راهنما */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-foreground">نقشه کامل ایران را می‌بینید - روی نقشه کلیک کنید یا زوم کنید تا موقعیت دقیق را انتخاب کنید</p>
          <p className="text-muted-foreground text-xs">با استفاده از دکمه‌های زوم یا اسکرول موس می‌توانید نقشه را بزرگ‌نمایی کنید و جزئیات شهرها را ببینید</p>
        </div>
      </div>

      {/* نقشه اصلی */}
      <div className="relative h-[500px] w-full rounded-xl overflow-hidden border-2 shadow-lg animate-scale-in">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* لودینگ */}
        {!isMapReady && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted-foreground font-medium">بارگذاری نقشه...</p>
            </div>
          </div>
        )}

        {/* کنترل‌ها */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
          <Button
            size="icon"
            variant="secondary"
            className="bg-background/95 backdrop-blur shadow-lg hover:scale-105 transition-transform"
            onClick={handleGetUserLocation}
            title="موقعیت من"
          >
            <Locate className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-background/95 backdrop-blur shadow-lg hover:scale-105 transition-transform"
            onClick={handleZoomIn}
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="bg-background/95 backdrop-blur shadow-lg hover:scale-105 transition-transform"
            onClick={handleZoomOut}
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>

        {/* نمایش مختصات */}
        {selectedPosition && (
          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg z-[1000] animate-fade-in">
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

        {/* استایل‌های CSS */}
        <style>{`
          /* مارکر انتخابی */
          .marker-container {
            position: relative;
            width: 40px;
            height: 50px;
          }
          .marker-pulse {
            position: absolute;
            top: 10px;
            left: 10px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: hsl(var(--primary) / 0.4);
            animation: markerPulse 2s infinite;
          }
          .marker-pin {
            position: relative;
            z-index: 2;
            animation: markerDrop 0.6s ease-out;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
          }
          @keyframes markerDrop {
            0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
            60% { transform: translateY(5px) scale(1.1); }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes markerPulse {
            0%, 100% { transform: scale(0.8); opacity: 0.7; }
            50% { transform: scale(2); opacity: 0; }
          }

          /* موقعیت کاربر */
          .user-location-marker {
            position: relative;
            width: 20px;
            height: 20px;
          }
          .user-location-pulse {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: hsl(var(--chart-2) / 0.3);
            animation: userPulse 2s infinite;
          }
          .user-location-dot {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: hsl(var(--chart-2));
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          @keyframes userPulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(2.5); opacity: 0; }
          }

          /* بهبود استایل نقشه */
          .leaflet-container {
            font-family: inherit;
            background: hsl(var(--muted));
          }
          .leaflet-tile {
            filter: brightness(0.95) contrast(1.05);
          }
          .leaflet-control-attribution {
            background: hsl(var(--background) / 0.8) !important;
            backdrop-filter: blur(8px);
            border-radius: 0.375rem;
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
          }
          .leaflet-control-attribution a {
            color: hsl(var(--primary)) !important;
          }
        `}</style>
      </div>
    </div>
  );
}
