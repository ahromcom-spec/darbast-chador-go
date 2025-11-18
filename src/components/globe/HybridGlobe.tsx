import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
type ProjectHierarchy = ReturnType<typeof useProjectsHierarchy>['projects'][0];

interface HierarchyMedia {
  id: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

interface ProjectWithMedia extends ProjectHierarchy {
  media?: HierarchyMedia[];
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
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
      setUploadProgress(0);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'خطا', description: 'برای آپلود باید وارد شوید', variant: 'destructive' });
        return;
      }

      const newMedia: HierarchyMedia[] = [];
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // قبول تصویر و ویدیو
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) continue;
        
        // بررسی حجم فایل (حداکثر 50MB برای ویدیو، 10MB برای تصویر)
        const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast({ 
            title: 'خطا', 
            description: isVideo ? 'حجم ویدیو نباید بیشتر از 50 مگابایت باشد' : 'حجم تصویر نباید بیشتر از 10 مگابایت باشد', 
            variant: 'destructive' 
          });
          continue;
        }
        const filePath = `${user.id}/hierarchy/${selectedProject.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;

        // آپلود با نمایش درصد پیشرفت
        const { error: uploadErr } = await supabase.storage
          .from('order-media')
          .upload(filePath, file, { 
            contentType: file.type, 
            upsert: false, 
            cacheControl: '3600'
          });
        
        // محاسبه درصد کلی بر اساس تعداد فایل‌ها
        const baseProgress = (i / fileArray.length) * 100;
        const fileProgress = ((i + 1) / fileArray.length) * 100;
        setUploadProgress(Math.round(fileProgress));
        
        if (uploadErr) {
          console.error('upload error', uploadErr);
          continue;
        }

        const { data: insertData, error: insertErr } = await supabase
          .from('project_hierarchy_media')
          .insert({
            hierarchy_project_id: selectedProject.id,
            file_path: filePath,
            file_type: isVideo ? 'video' : 'image',
            mime_type: file.type,
            file_size: file.size,
            user_id: user.id,
          })
          .select('id, file_path, file_type, created_at')
          .single();

        if (insertErr) {
          console.error('insert error', insertErr);
          continue;
        }

        if (insertData) {
          newMedia.push(insertData);
        }
      }

      if (newMedia.length > 0) {
        setProjectsWithMedia(prev => prev.map(p => p.id === selectedProject.id
          ? { ...p, media: [...newMedia, ...(p.media || [])].slice(0, 3) }
          : p
        ));
        setSelectedProject(prev => prev ? { ...prev, media: [...newMedia, ...(prev.media || [])].slice(0, 3) } : prev);
        toast({ title: 'موفق', description: `${newMedia.length} فایل اضافه شد.` });
      } else {
        toast({ title: 'هیچ فایلی اضافه نشد', description: 'فرمت فایل نامعتبر بود یا خطای موقت رخ داد.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('upload fatal', err);
      toast({ title: 'خطا در آپلود', description: err?.message || 'مشکل در بارگذاری تصویر', variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  // دریافت عکس‌های پروژه‌ها
  useEffect(() => {
    const fetchProjectMedia = async () => {
      if (projects.length === 0) {
        console.debug('[HybridGlobe] No projects to fetch media for');
        return;
      }

      console.debug('[HybridGlobe] Fetching media for', projects.length, 'projects');
      
      try {
        const projectIds = projects.map(p => p.id);
        
        // تصاویر و ویدیوهای متصل مستقیم به پروژه‌های hierarchy
        const { data: phMedia } = await supabase
          .from('project_hierarchy_media')
          .select('id, hierarchy_project_id, file_path, file_type, created_at')
          .in('hierarchy_project_id', projectIds)
          .in('file_type', ['image', 'video'])
          .order('created_at', { ascending: false });

        console.debug('[HybridGlobe] Hierarchy media fetched:', phMedia?.length || 0);

        // پشتیبانی سازگاری قدیمی: تصاویر موجود در project_media از طریق projects_v3
        const { data: v3 } = await supabase
          .from('projects_v3')
          .select('id, hierarchy_project_id')
          .in('hierarchy_project_id', projectIds);

        let pmMedia: { project_id: string; file_path: string; file_type: string; created_at: string }[] = [];
        if (v3 && v3.length > 0) {
          const v3Ids = v3.map(x => x.id);
          const { data } = await supabase
            .from('project_media')
            .select('project_id, file_path, file_type, created_at')
            .in('project_id', v3Ids)
            .eq('file_type', 'image')
            .order('created_at', { ascending: false });
          pmMedia = data || [];
        }

        console.debug('[HybridGlobe] Project media fetched:', pmMedia.length);

        // نگاشت id پروژه سلسله‌مراتبی به لیست تصاویر (ترکیب هر دو منبع)
        const mediaByProject = new Map<string, HierarchyMedia[]>();

        // از جدول جدید
        phMedia?.forEach(m => {
          const pid = m.hierarchy_project_id;
          if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
          mediaByProject.get(pid)!.push({ id: m.id, file_path: m.file_path, file_type: m.file_type, created_at: m.created_at });
        });

        // از جدول قدیمی
        pmMedia.forEach(m => {
          const pid = v3?.find(v => v.id === m.project_id)?.hierarchy_project_id;
          if (!pid) return;
          if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
          mediaByProject.get(pid)!.push({ id: `${m.project_id}-${m.created_at}`, file_path: m.file_path, file_type: m.file_type, created_at: m.created_at });
        });

        // ترکیب نهایی و محدود کردن به ۳ تصویر جدید
        const projectsWithMediaData: ProjectWithMedia[] = projects.map(project => {
          const list = (mediaByProject.get(project.id) || []).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
          return { ...project, media: list.slice(0, 3) };
        });

        console.debug('[HybridGlobe] Projects with media prepared:', projectsWithMediaData.length, 
          'sample:', projectsWithMediaData.slice(0, 2).map(p => ({ 
            id: p.id, 
            title: p.title, 
            lat: p.locations?.lat, 
            lng: p.locations?.lng,
            mediaCount: p.media?.length 
          }))
        );
        
        setProjectsWithMedia(projectsWithMediaData);
        
        // تعریف تابع global برای باز کردن ویدیو
        (window as any).openProjectVideo = (url: string) => {
          setSelectedVideo(url);
        };
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
    console.debug('[HybridGlobe] Marker effect triggered:', {
      mapReady,
      loading,
      projectsCount: projectsWithMedia.length
    });
    
    if (!mapRef.current || !mapReady || loading || projectsWithMedia.length === 0) {
      console.debug('[HybridGlobe] Skipping marker creation - conditions not met');
      return;
    }

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // فیلتر پروژه‌هایی که مختصات معتبر دارند (بدون محدودیت باکس ایران)
    const projectsWithLocation = projectsWithMedia.filter(
      p => Number.isFinite(p.locations?.lat as number) && Number.isFinite(p.locations?.lng as number)
    );

    console.debug('[HybridGlobe] Creating markers:', {
      totalProjects: projectsWithMedia.length,
      withValidLocation: projectsWithLocation.length,
      samples: projectsWithLocation.slice(0, 3).map(p => ({ 
        id: p.id, 
        title: p.title,
        lat: p.locations?.lat, 
        lng: p.locations?.lng,
        hasMedia: (p.media?.length || 0) > 0
      }))
    });

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
      const firstMedia = project.media?.[0];
      if (firstMedia) {
        const url1 = supabase.storage
          .from('order-media')
          .getPublicUrl(firstMedia.file_path).data.publicUrl;
        const url2 = supabase.storage
          .from('project-media')
          .getPublicUrl(firstMedia.file_path).data.publicUrl;
        
        const isVideo = firstMedia.file_type === 'video';
        const mediaElement = isVideo 
          ? `<div style="width:100%;height:100%;position:relative;background:#000;display:flex;align-items:center;justify-content:center;">
              <svg style="width:32px;height:32px;color:#fff;opacity:0.9;" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:9px;padding:2px 4px;border-radius:3px;">ویدیو</span>
            </div>`
          : `<img src="${url1}" alt="تصویر پروژه" style="width:100%;height:100%;object-fit:cover"
              onerror="if(this.src==='${url1}'){this.src='${url2}'}else{this.style.display='none'}"/>`;
        
        const html = `
          <div style="width:70px;height:70px;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.3);border:3px solid #fff;background:#f0f0f0;position:relative;">
            ${mediaElement}
            <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));height:24px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-size:10px;font-weight:bold;">${project.media?.length || 0} فایل</span>
            </div>
          </div>`;
        iconToUse = L.divIcon({
          html,
          className: 'project-thumb-icon',
          iconSize: [70, 70],
          iconAnchor: [35, 70],
          popupAnchor: [0, -70],
        });
      }

      const marker = L.marker([project.locations.lat, project.locations.lng], { icon: iconToUse })
        .addTo(mapRef.current!);
      
      // تولید HTML برای عکس‌ها و ویدیوها در popup
      const mediaHTML = project.media && project.media.length > 0 
        ? `
          <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            ${project.media
              .map(m => {
                 const url1 = supabase.storage
                   .from('order-media')
                   .getPublicUrl(m.file_path).data.publicUrl;
                 const url2 = supabase.storage
                   .from('project-media')
                   .getPublicUrl(m.file_path).data.publicUrl;
                 
                 const isVideo = m.file_type === 'video';
                 
                 return isVideo 
                   ? `<div 
                       onclick="window.openProjectVideo('${url1}')"
                       style="width: 100%; height: 80px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #e5e7eb; background: #000; display: flex; align-items: center; justify-content: center; position: relative;"
                     >
                       <svg style="width:24px;height:24px;color:#fff;opacity:0.9;" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M8 5v14l11-7z"/>
                       </svg>
                       <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;">ویدیو</span>
                     </div>`
                   : `<img 
                       src="${url1}" 
                       alt="تصویر پروژه" 
                       style="width: 100%; height: 80px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #e5e7eb;"
                       onerror="if(this.src==='${url1}'){this.src='${url2}'}else{this.style.display='none'}"
                     />`;
              }).join('')}
          </div>
        `
        : '<p style="font-size: 12px; color: #999; margin-top: 8px;">هنوز تصویری ثبت نشده</p>';

      // اضافه کردن popup
      const popupContent = `
        <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 260px; max-width: 320px;">
          <strong style="font-size: 15px; color: #1f2937;">${project.title || 'پروژه'}</strong><br/>
          <span style="font-size: 12px; color: #6b7280; margin-top: 4px; display: block;">${project.locations?.address_line || ''}</span>
          ${mediaHTML}
        </div>
      `;
      marker.bindPopup(popupContent, {
        maxWidth: 340,
        className: 'custom-popup'
      });

      // کلیک روی مارکر
      marker.on('click', () => {
        setSelectedProject(project);
      });

      markersRef.current.push(marker);
      console.debug('[HybridGlobe] Marker added:', { 
        projectId: project.id, 
        lat: project.locations?.lat, 
        lng: project.locations?.lng,
        hasCustomIcon: !!firstMedia
      });
    });

    // تنظیم bounds نقشه برای نمایش همه پروژه‌ها بر اساس مارکرهای ساخته‌شده
    const allMarkers = markersRef.current;
    console.debug('[HybridGlobe] Total markers created:', allMarkers.length);
    
    if (allMarkers.length > 0) {
      const bounds = L.latLngBounds(allMarkers.map(m => m.getLatLng()));
      console.debug('[HybridGlobe] Fitting bounds:', bounds);
      try {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        console.warn('[HybridGlobe] fitBounds failed', e, bounds);
      }
    } else {
      console.warn('[HybridGlobe] No markers to display on map');
    }
  }, [projectsWithMedia, loading, mapReady]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* لایه‌ی روی نقشه برای کنترل‌ها */}
      <div className="absolute inset-0 z-[2000] pointer-events-none">
        {/* دکمه بازگشت */}
        <Button
          variant="default"
          size="lg"
          onClick={onClose}
          className="pointer-events-auto absolute top-6 right-6 shadow-2xl border-2 border-primary/20"
        >
          <ArrowRight className="h-5 w-5 ml-2" />
          <span className="font-semibold">بازگشت</span>
        </Button>

        {/* کارت تعداد پروژه‌ها */}
        <Card className="pointer-events-auto absolute top-6 left-6 bg-card shadow-2xl border-2 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary">{projectsWithMedia.length}</span>
              <span className="text-sm text-muted-foreground">پروژه فعال</span>
            </div>
          </div>
        </Card>
      </div>

      {/* نقشه */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* کارت اطلاعات پروژه انتخاب شده */}
      {selectedProject && (
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md bg-card shadow-2xl p-4 z-[2000] border-2 border-primary/20 pointer-events-auto">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-base font-semibold">{selectedProject.title || 'پروژه'}</h3>
                <p className="text-xs text-muted-foreground mt-1">{selectedProject.locations?.address_line}</p>
                {selectedProject.media && selectedProject.media.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedProject.media.length} فایل</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 relative">
                <Button 
                  size="sm" 
                  onClick={handleAddImage} 
                  disabled={uploading} 
                  className="w-full relative overflow-hidden"
                >
                  {uploading && (
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-primary/20 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {uploading ? `در حال آپلود... ${uploadProgress}%` : 'افزودن تصویر / فیلم'}
                  </span>
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      )}

      {/* دیالوگ نمایش ویدیو */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-right">پخش ویدیو</DialogTitle>
          </DialogHeader>
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            {selectedVideo && (
              <video
                src={selectedVideo}
                controls
                autoPlay
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
