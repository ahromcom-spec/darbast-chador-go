import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const { projects, loading } = useProjectsHierarchy();
  const { toast } = useToast();

  // رویداد انتخاب فایل
  const handleAddImage = () => {
    if (!selectedProject) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedProject) return;
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'خطا', description: 'برای آپلود باید وارد شوید', variant: 'destructive' });
        return;
      }

      const { data: pv3 } = await supabase
        .from('projects_v3')
        .select('id, created_at')
        .eq('hierarchy_project_id', selectedProject.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (!pv3) {
        toast({ title: 'سفارش پیدا نشد', description: 'برای این پروژه سفارشی ثبت نشده است.', variant: 'destructive' });
        return;
      }

      const projectV3Id = pv3.id as string;
      const newMedia: { file_path: string; file_type: string }[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const filePath = `${user.id}/${projectV3Id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;

        const { error: uploadErr } = await supabase.storage
          .from('order-media')
          .upload(filePath, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
        if (uploadErr) {
          console.error('upload error', uploadErr);
          continue;
        }

        const { error: insertErr } = await supabase.from('project_media').insert({
          project_id: projectV3Id,
          file_path: filePath,
          file_type: 'image',
          mime_type: file.type,
          file_size: file.size,
          user_id: user.id,
        });
        if (insertErr) {
          console.error('insert error', insertErr);
          continue;
        }

        newMedia.push({ file_path: filePath, file_type: 'image' });
      }

      if (newMedia.length > 0) {
        setProjectsWithMedia(prev => prev.map(p => p.id === selectedProject.id
          ? { ...p, media: [...newMedia, ...(p.media || [])].slice(0, 3) }
          : p
        ));
        setSelectedProject(prev => prev ? { ...prev, media: [...newMedia, ...(prev.media || [])].slice(0, 3) } : prev);
        toast({ title: 'موفق', description: `${newMedia.length} تصویر اضافه شد.` });
      } else {
        toast({ title: 'هیچ تصویری اضافه نشد', description: 'فرمت فایل نامعتبر بود یا خطای موقت رخ داد.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('upload fatal', err);
      toast({ title: 'خطا در آپلود', description: err?.message || 'مشکل در بارگذاری تصویر', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

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
      
      let iconToUse: any = projectIcon;
      const firstImg = project.media?.find(m => m.file_type === 'image');
      if (firstImg) {
        const { data: { publicUrl } } = supabase.storage
          .from('order-media')
          .getPublicUrl(firstImg.file_path);
        const html = `
          <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid rgba(255,255,255,.85);background:#eee">
            <img src="${publicUrl}" alt="تصویر پروژه" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>
          </div>`;
        iconToUse = L.divIcon({
          html,
          className: 'project-thumb-icon',
          iconSize: [44, 44],
          iconAnchor: [22, 44],
          popupAnchor: [0, -44],
        });
      }

      const marker = L.marker([project.locations.lat, project.locations.lng], { icon: iconToUse })
        .addTo(mapRef.current!);
      
      // تولید HTML برای عکس‌ها
      const mediaHTML = project.media && project.media.length > 0 
        ? `
          <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
            ${project.media
              ?.filter(m => m.file_type === 'image')
              .map(m => {
                const { data: { publicUrl } } = supabase.storage
                  .from('order-media')
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
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button size="sm" onClick={handleAddImage} disabled={uploading}>
                      {uploading ? 'در حال آپلود…' : 'افزودن تصویر'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
