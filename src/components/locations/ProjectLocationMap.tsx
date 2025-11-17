import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Navigation, Map, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ProjectLocationMapProps {
  projectLat: number;
  projectLng: number;
  projectAddress: string;
}

const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

export function ProjectLocationMap({ projectLat, projectLng, projectAddress }: ProjectLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [roadDistance, setRoadDistance] = useState<number | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [showNavigationSheet, setShowNavigationSheet] = useState(false);

  const navigationApps = [
    {
      name: 'Google Maps',
      icon: Map,
      url: `https://www.google.com/maps/dir/?api=1&destination=${projectLat},${projectLng}`,
    },
    {
      name: 'Waze',
      icon: Navigation,
      url: `waze://?ll=${projectLat},${projectLng}&navigate=yes`,
    },
    {
      name: 'Balad',
      icon: MapPin,
      url: `balad://showMap?latitude=${projectLat}&longitude=${projectLng}`,
    },
    {
      name: 'Neshan',
      icon: Car,
      url: `neshan://location?latitude=${projectLat}&longitude=${projectLng}`,
    },
  ];

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const openInMaps = (url: string) => {
    window.open(url, '_blank');
    setShowNavigationSheet(false);
  };

  const handleNavigationClick = () => {
    if (isMobile()) {
      // در موبایل لیست برنامه‌ها را نمایش بده
      setShowNavigationSheet(true);
    } else {
      // در دسکتاپ مستقیماً Google Maps باز شود
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${projectLat},${projectLng}`, '_blank');
    }
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // Recreate map on prop changes to ensure correct rendering inside cards/dialogs
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    setLoadingRoute(true);

    // ایجاد نقشه
    const map = L.map(mapContainer.current, {
      center: [projectLat, projectLng],
      zoom: 12,
      minZoom: 5,
      maxZoom: 18,
      scrollWheelZoom: false,
      zoomControl: true,
      dragging: true,
    });

    mapRef.current = map;

    // اضافه کردن لایه تایل
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // اطمینان از محاسبه ابعاد پس از نمایش در دیالوگ/کارت
    tileLayer.on('load', () => {
      setTimeout(() => map.invalidateSize(), 50);
    });
    setTimeout(() => map.invalidateSize(), 200);
    window.setTimeout(() => map.invalidateSize(), 600);

    // آیکون‌های سفارشی
    const qomCenterIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const projectIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [30, 49],
      iconAnchor: [15, 49],
      popupAnchor: [1, -34],
      shadowSize: [49, 49],
    });

    // مارکر مرکز قم
    L.marker([QOM_CENTER.lat, QOM_CENTER.lng], { icon: qomCenterIcon })
      .addTo(map)
      .bindPopup('<div style="text-align: center; font-family: Vazir, sans-serif;"><strong>مرکز شهر قم</strong></div>');

    // مارکر لوکیشن پروژه
    L.marker([projectLat, projectLng], { icon: projectIcon })
      .addTo(map)
      .bindPopup(`<div style="text-align: center; font-family: Vazir, sans-serif;"><strong>موقعیت پروژه</strong><br/>${projectAddress}</div>`);

    // محاسبه و رسم مسیر جاده‌ای
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-road-route', {
          body: {
            origin: { lat: QOM_CENTER.lat, lng: QOM_CENTER.lng },
            dest: { lat: projectLat, lng: projectLng },
          },
        });

        if (!error && data?.geometry?.coordinates?.length) {
          // تبدیل coordinates از [lng, lat] به [lat, lng]
          const routeCoordinates: [number, number][] = data.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );

          // رسم مسیر روی نقشه
          const routeLine = L.polyline(routeCoordinates, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1,
          }).addTo(map);

          // تنظیم view برای نمایش کل مسیر
          map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

          // تنظیم فاصله
          if (data.distanceKm) {
            setRoadDistance(data.distanceKm);
          }
        }
      } catch (err) {
        console.error('خطا در دریافت مسیر:', err);
      } finally {
        setLoadingRoute(false);
      }
    })();

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [projectLat, projectLng, projectAddress]);

  return (
    <>
      <div className="w-full space-y-3">
        {/* نقشه */}
        <div 
          ref={mapContainer} 
          className="w-full h-[400px] rounded-lg border shadow-sm overflow-hidden"
          style={{ direction: 'ltr' }}
        />

        {/* اطلاعات مسیر */}
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-medium">{projectAddress}</span>
            </div>
            <div className="flex items-center gap-3">
              {loadingRoute ? (
                <span className="text-xs text-muted-foreground">در حال محاسبه...</span>
              ) : roadDistance ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">فاصله از مرکز قم:</span>
                  <span className="font-bold text-sm text-primary">{roadDistance.toFixed(1)} کیلومتر</span>
                </div>
              ) : null}
              <Button 
                onClick={handleNavigationClick}
                variant="outline" 
                size="sm" 
                className="gap-2"
              >
                <Navigation className="w-4 h-4" />
                مسیریابی
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet انتخاب برنامه مسیریابی */}
      <Sheet open={showNavigationSheet} onOpenChange={setShowNavigationSheet}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader className="text-right">
            <SheetTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              انتخاب برنامه مسیریابی
            </SheetTitle>
            <SheetDescription>
              یکی از برنامه‌های مسیریابی زیر را برای نمایش مسیر انتخاب کنید
            </SheetDescription>
          </SheetHeader>
          
          <div className="grid gap-3 mt-6">
            {navigationApps.map((app) => {
              const Icon = app.icon;
              return (
                <Button
                  key={app.name}
                  onClick={() => openInMaps(app.url)}
                  variant="outline"
                  className="h-auto py-4 justify-start gap-4 text-right"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-muted-foreground">باز کردن در {app.name}</div>
                  </div>
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
