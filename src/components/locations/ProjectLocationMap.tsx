import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const openInMaps = () => {
    // Universal geo URL که در اکثر موبایل‌ها کار می‌کند
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${projectLat},${projectLng}`;
    
    // باز کردن در تب جدید
    window.open(googleMapsUrl, '_blank');
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

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
          const roadDistanceKm = data.distanceKm as number;
          setRoadDistance(roadDistanceKm);

          // رسم مسیر جاده‌ای
          const coordinates = (data.geometry.coordinates as [number, number][]).map(
            (coord) => [coord[1], coord[0]] as [number, number]
          );
          L.polyline(coordinates, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // نمایش مسیر کامل در قاب
          const bounds = L.latLngBounds([
            ...coordinates,
            [QOM_CENTER.lat, QOM_CENTER.lng],
            [projectLat, projectLng],
          ] as [number, number][]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else {
          // اگر مسیر برنگشت، فقط دو نقطه را نشان بده
          const bounds = L.latLngBounds([
            [QOM_CENTER.lat, QOM_CENTER.lng],
            [projectLat, projectLng],
          ] as [number, number][]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      } catch (error) {
        console.error('خطا در بارگذاری مسیر:', error);
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
    <div className="relative w-full">
      <div
        ref={mapContainer}
        className="w-full rounded-lg border border-border"
        style={{ minHeight: '360px' }}
      />

      {/* اطلاعات مسیر */}
      <div className="mt-3 bg-muted/50 rounded-lg p-3 border border-border">
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
            <Button onClick={openInMaps} variant="outline" size="sm" className="gap-2">
              <Navigation className="w-4 h-4" />
              مسیریابی
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
