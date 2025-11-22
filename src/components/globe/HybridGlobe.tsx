import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';

type ProjectHierarchy = ReturnType<typeof useProjectsHierarchy>['projects'][0];

interface ProjectWithMedia extends ProjectHierarchy {
  media?: Array<{
    file_path: string;
    file_type: string;
  }>;
}

interface HybridGlobeProps {
  onClose: () => void;
}

export default function HybridGlobe({ onClose }: HybridGlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  
  const { projects, loading } = useProjectsHierarchy();

  // دریافت عکس‌های پروژه‌ها
  useEffect(() => {
    const fetchProjectMedia = async () => {
      if (projects.length === 0) return;

      try {
        const projectIds = projects.map(p => p.id);
        
        // دریافت پروژه‌های v3 مرتبط با projects_hierarchy
        const { data: projectsV3Data } = await supabase
          .from('projects_v3')
          .select('id, hierarchy_project_id')
          .in('hierarchy_project_id', projectIds);

        if (!projectsV3Data || projectsV3Data.length === 0) {
          setProjectsWithMedia(projects.map(p => ({ ...p, media: [] })));
          return;
        }

        const projectV3Ids = projectsV3Data.map(p => p.id);

        // دریافت عکس‌های پروژه
        const { data: mediaData } = await supabase
          .from('project_media')
          .select('file_path, file_type, project_id')
          .in('project_id', projectV3Ids)
          .order('created_at', { ascending: false });

        // ایجاد نقشه از hierarchy_project_id به project_v3 ids
        const hierarchyToV3Map = new Map<string, string[]>();
        projectsV3Data.forEach(pv3 => {
          if (pv3.hierarchy_project_id) {
            if (!hierarchyToV3Map.has(pv3.hierarchy_project_id)) {
              hierarchyToV3Map.set(pv3.hierarchy_project_id, []);
            }
            hierarchyToV3Map.get(pv3.hierarchy_project_id)?.push(pv3.id);
          }
        });

        // گروه‌بندی عکس‌ها بر اساس hierarchy_project_id
        const mediaByHierarchyProject = new Map<string, typeof mediaData>();
        mediaData?.forEach(media => {
          // پیدا کردن hierarchy_project_id برای این media
          for (const [hierarchyId, v3Ids] of hierarchyToV3Map.entries()) {
            if (v3Ids.includes(media.project_id)) {
              if (!mediaByHierarchyProject.has(hierarchyId)) {
                mediaByHierarchyProject.set(hierarchyId, []);
              }
              mediaByHierarchyProject.get(hierarchyId)?.push(media);
              break;
            }
          }
        });

        // ترکیب عکس‌ها با پروژه‌ها (حداکثر 3 عکس برای هر پروژه)
        const projectsWithMediaData: ProjectWithMedia[] = projects.map(project => ({
          ...project,
          media: (mediaByHierarchyProject.get(project.id) || []).slice(0, 3)
        }));

        setProjectsWithMedia(projectsWithMediaData);
      } catch (error) {
        console.error('خطا در دریافت عکس‌های پروژه:', error);
        setProjectsWithMedia(projects.map(p => ({ ...p, media: [] })));
      }
    };

    fetchProjectMedia();
  }, [projects]);

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

    // منتظر بمانیم تا نقشه کاملاً آماده شود
    map.whenReady(() => {
      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // اضافه کردن مارکرهای پروژه‌ها
  useEffect(() => {
    if (!mapRef.current || !mapReady || loading || projectsWithMedia.length === 0) return;

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // فیلتر پروژه‌هایی که موقعیت جغرافیایی دارند
    const projectsWithLocation = projectsWithMedia.filter(
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
      
      // تولید HTML برای عکس‌ها
      const mediaHTML = project.media && project.media.length > 0 
        ? `
          <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
            ${project.media.map(m => {
              const { data: { publicUrl } } = supabase.storage
                .from('project-media')
                .getPublicUrl(m.file_path);
              
              return `<img 
                src="${publicUrl}" 
                alt="تصویر پروژه" 
                style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                onerror="this.style.display='none'"
              />`;
            }).join('')}
          </div>
        `
        : '';

      // اضافه کردن popup
      const popupContent = `
        <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 200px;">
          <strong style="font-size: 14px;">${project.title || 'پروژه'}</strong><br/>
          <span style="font-size: 12px; color: #666;">${project.locations?.address_line || ''}</span>
          ${mediaHTML}
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
  }, [projectsWithMedia, loading, mapReady]);

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
          ) : projectsWithMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground">هیچ پروژه‌ای یافت نشد</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {projectsWithMedia.length} پروژه فعال روی نقشه نمایش داده شده است
              </p>
              {selectedProject && (
                <div className="mt-2 p-2 bg-primary/10 rounded-md">
                  <p className="text-sm font-medium">{selectedProject.title || 'پروژه'}</p>
                  <p className="text-xs text-muted-foreground">{selectedProject.locations?.address_line}</p>
                  {selectedProject.media && selectedProject.media.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedProject.media.length} تصویر</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
