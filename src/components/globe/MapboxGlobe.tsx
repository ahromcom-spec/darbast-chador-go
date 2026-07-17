import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { createNeshanTileLayer } from '@/lib/neshan';

interface MapboxGlobeProps {
  onClose: () => void;
}

/**
 * نمای کره زمین (نسخه نشان):
 * این کامپوننت قبلاً با Mapbox GL پیاده‌سازی شده بود. اکنون با
 * Leaflet + تایل‌های نشان (پلتفرم نقشه ایرانی) بازنویسی شده تا کاملاً
 * مستقل از Mapbox باشد و در ایران بدون مشکل کار کند.
 */
export default function MapboxGlobe({ onClose }: MapboxGlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const { projects } = useProjectsHierarchy();
  const [animationStatus, setAnimationStatus] = useState('در حال آماده‌سازی...');

  // راه‌اندازی نقشه نشان
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [32.4279, 53.688], // مرکز ایران
      zoom: 5,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });

    const tile = createNeshanTileLayer('standard-day');
    tile.addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tile;
    setLoading(false);

    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // انیمیشن نمایش (پرواز به ایران → قم → اولین پروژه)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const t1 = window.setTimeout(() => {
      setAnimationStatus('در حال پرواز به ایران...');
      map.flyTo([32.4279, 53.688], 6, { duration: 2.5 });
    }, 600);

    const t2 = window.setTimeout(() => {
      if (projects.length === 0) return;
      setAnimationStatus('در حال نزدیک شدن به قم...');
      map.flyTo([34.6401, 50.8764], 11, { duration: 2.5 });
    }, 4000);

    const t3 = window.setTimeout(() => {
      const firstProject = projects[0];
      if (firstProject?.locations?.lat && firstProject?.locations?.lng) {
        setAnimationStatus('موقعیت دقیق پروژه شما');
        map.flyTo(
          [firstProject.locations.lat, firstProject.locations.lng],
          17,
          { duration: 2.5 },
        );
      }
    }, 7500);

    // اضافه کردن مارکرها بعد از انیمیشن
    const t4 = window.setTimeout(() => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      projects.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        const isFirst = index === 0;

        const html = `
          <div style="
            width:${isFirst ? 50 : 36}px;height:${isFirst ? 50 : 36}px;
            border-radius:50%;
            background-color:${isFirst ? '#ef4444' : '#f59e0b'};
            border:4px solid white;
            box-shadow:0 8px 16px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:${isFirst ? 24 : 18}px;cursor:pointer;
          ">${isFirst ? '📍' : '📌'}</div>`;

        const icon = L.divIcon({
          html,
          className: 'globe-project-marker',
          iconSize: [isFirst ? 50 : 36, isFirst ? 50 : 36],
          iconAnchor: [isFirst ? 25 : 18, isFirst ? 25 : 18],
        });

        const marker = L.marker(
          [project.locations.lat, project.locations.lng],
          { icon },
        ).addTo(map);

        marker.bindPopup(
          `<div style="padding:8px;font-family:Vazir,sans-serif;direction:rtl;min-width:200px;">
             <h3 style="font-weight:bold;margin:0 0 6px 0;font-size:15px;">${project.title || 'پروژه'}</h3>
             <p style="font-size:12px;color:#666;line-height:1.5;margin:0;">${project.locations?.address_line || ''}</p>
           </div>`,
        );

        markersRef.current.push(marker);
      });
    }, 10500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [projects]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute top-4 right-4 z-[1001]">
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-background/90 backdrop-blur-sm shadow-lg"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-[1000]">
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-lg font-semibold">در حال بارگذاری نقشه نشان...</p>
            </div>
          </Card>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
        <Card className="p-6 bg-gradient-to-br from-background/98 to-background/95 backdrop-blur-lg border-2 border-primary/40 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
              <p className="text-center text-xl font-bold text-foreground">
                {animationStatus}
              </p>
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                <MapPin className="w-4 h-4 text-primary" />
                <span>استان قم</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>{projects.length} پروژه</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              نقشه نشان (پلتفرم ایرانی)
            </p>
          </div>
        </Card>
      </div>

      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
