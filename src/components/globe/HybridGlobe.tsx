import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  const { projects, loading } = useProjectsHierarchy();

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // ایجاد نقشه با مرکز ایران
    const map = L.map(mapContainer.current, {
      center: [32.4279, 53.6880], // مرکز ایران
      zoom: 6,
      minZoom: 5,
      maxZoom: 18,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    mapRef.current = map;

    // اضافه کردن لایه تایل OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, []);

  // اضافه کردن مارکرهای پروژه‌ها
  useEffect(() => {
    if (!mapRef.current || loading) return;

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // فیلتر پروژه‌هایی که موقعیت جغرافیایی دارند
    const projectsWithLocation = projects.filter(
      p => p.locations?.lat && p.locations?.lng && 
           p.locations.lat >= 24 && p.locations.lat <= 40 && 
           p.locations.lng >= 44 && p.locations.lng <= 64
    );

    if (projectsWithLocation.length === 0) return;

    // ایجاد آیکون سفارشی برای پروژه‌ها
    const projectIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    // اضافه کردن مارکر برای هر پروژه
    projectsWithLocation.forEach(project => {
      if (!project.locations?.lat || !project.locations?.lng) return;
      
      const marker = L.marker([project.locations.lat, project.locations.lng], { icon: projectIcon })
        .addTo(mapRef.current!);
      
      // اضافه کردن popup
      const popupContent = `
        <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right;">
          <strong style="font-size: 14px;">${project.title || 'پروژه'}</strong><br/>
          <span style="font-size: 12px; color: #666;">${project.locations?.address_line || ''}</span>
        </div>
      `;
      marker.bindPopup(popupContent);

      // کلیک روی مارکر
      marker.on('click', () => {
        setSelectedProject(project);
      });

      markersRef.current.push(marker);
    });

    // تنظیم bounds نقشه برای نمایش همه پروژه‌ها
    if (projectsWithLocation.length > 0) {
      const bounds = L.latLngBounds(
        projectsWithLocation
          .filter(p => p.locations?.lat && p.locations?.lng)
          .map(p => [p.locations!.lat, p.locations!.lng] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [projects, loading]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* دکمه بستن */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* نقشه */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* کارت اطلاعات در پایین */}
      <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md bg-background/90 backdrop-blur-sm p-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">پروژه‌های شما</h3>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری پروژه‌ها...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">هیچ پروژه‌ای یافت نشد</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {projects.length} پروژه فعال روی نقشه نمایش داده شده است
              </p>
              {selectedProject && (
                <div className="mt-2 p-2 bg-primary/10 rounded-md">
                  <p className="text-sm font-medium">{selectedProject.title || 'پروژه'}</p>
                  <p className="text-xs text-muted-foreground">{selectedProject.locations?.address_line}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
