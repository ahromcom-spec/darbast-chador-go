import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptimizedImage } from './OptimizedImage';
type ProjectHierarchy = ReturnType<typeof useProjectsHierarchy>['projects'][0];

interface HierarchyMedia {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
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
  const linesRef = useRef<L.Polyline[]>([]);
  const centerMarkersRef = useRef<L.CircleMarker[]>([]);
  const galleryIndexesRef = useRef<Map<string, number>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; mimeType: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');

  const { projects, loading } = useProjectsHierarchy();
  const { toast } = useToast();

  // مدیریت منبع ویدیو و آزادسازی blob ها
  useEffect(() => {
    if (selectedVideo) {
      setVideoSrc(selectedVideo.url);
      setVideoLoading(false);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setVideoSrc(null);
    }
  }, [selectedVideo]);

  // در صورت خطا در پخش مستقیم، به blob تبدیل کنیم تا مشکل Content-Disposition/CORS برطرف شود
  const fallbackToBlob = async () => {
    if (!selectedVideo || blobUrl) return;
    try {
      setVideoLoading(true);
      const res = await fetch(selectedVideo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setVideoSrc(url);
    } catch (err) {
      console.error('[Video] Blob fallback failed:', err);
      toast({
        title: 'خطا در پخش ویدیو',
        description: 'در تبدیل ویدیو برای پخش مشکلی رخ داد.',
        variant: 'destructive',
      });
    } finally {
      setVideoLoading(false);
    }
  };

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
      console.log('[Upload] Starting upload process...', files.length, 'files');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'خطا', description: 'برای آپلود باید وارد شوید', variant: 'destructive' });
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const newMedia: HierarchyMedia[] = [];
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // قبول تصویر و ویدیو
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        console.log(`[Upload] File ${i + 1}/${fileArray.length}:`, file.name, 'Type:', file.type, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        if (!isImage && !isVideo) {
          console.warn('[Upload] Skipping invalid file type:', file.type);
          toast({ 
            title: 'فایل نامعتبر', 
            description: `فقط تصویر یا ویدیو قابل آپلود است: ${file.name}`, 
            variant: 'destructive' 
          });
          continue;
        }
        
        // بررسی حجم فایل (حداکثر 100MB برای ویدیو، 10MB برای تصویر)
        const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          const maxMB = isVideo ? 100 : 10;
          console.warn('[Upload] File too large:', file.size, 'bytes (max:', maxSize, 'bytes)');
          toast({ 
            title: 'حجم فایل بیش از حد', 
            description: `حداکثر ${maxMB} مگابایت مجاز است: ${file.name}`, 
            variant: 'destructive' 
          });
          continue;
        }
        
        const filePath = `${user.id}/hierarchy/${selectedProject.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        console.log('[Upload] Uploading to storage:', filePath);

        // محاسبه و نمایش پیشرفت قبل از آپلود
        const startProgress = (i / fileArray.length) * 100;
        setUploadProgress(Math.round(startProgress));

        // آپلود با نمایش درصد پیشرفت
        const { error: uploadErr } = await supabase.storage
          .from('order-media')
          .upload(filePath, file, { 
            contentType: file.type, 
            upsert: false, 
            cacheControl: '3600'
          });
        
        // محاسبه درصد کلی بر اساس تعداد فایل‌ها
        const fileProgress = ((i + 1) / fileArray.length) * 100;
        setUploadProgress(Math.round(fileProgress));
        
        if (uploadErr) {
          console.error('[Upload] Storage upload error:', uploadErr);
          toast({ 
            title: 'خطا در آپلود', 
            description: uploadErr.message || 'مشکل در بارگذاری فایل', 
            variant: 'destructive' 
          });
          continue;
        }
        
        console.log('[Upload] File uploaded successfully, saving to database...');

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
          .select('id, file_path, file_type, created_at, mime_type')
          .single();

        if (insertErr) {
          console.error('[Upload] Database insert error:', insertErr);
          toast({ 
            title: 'خطا در ثبت', 
            description: insertErr.message || 'مشکل در ذخیره اطلاعات فایل', 
            variant: 'destructive' 
          });
          continue;
        }

        if (insertData) {
          console.log('[Upload] File saved successfully:', insertData.id);
          newMedia.push(insertData);
        }
      }

      console.log('[Upload] Upload complete. Total successful:', newMedia.length);
      
      if (newMedia.length > 0) {
        setProjectsWithMedia(prev => prev.map(p => p.id === selectedProject.id
          ? { ...p, media: [...newMedia, ...(p.media || [])].slice(0, 3) }
          : p
        ));
        setSelectedProject(prev => prev ? { ...prev, media: [...newMedia, ...(prev.media || [])].slice(0, 3) } : prev);
        toast({ title: 'موفق', description: `${newMedia.length} فایل با موفقیت آپلود شد.` });
      } else {
        toast({ title: 'آپلود ناموفق', description: 'فرمت فایل نامعتبر بود یا خطای موقت رخ داد.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('[Upload] Fatal error:', err);
      toast({ title: 'خطا در آپلود', description: err?.message || 'مشکل غیرمنتظره در بارگذاری', variant: 'destructive' });
    } finally {
      console.log('[Upload] Cleaning up...');
      setUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };


  // دریافت عکس‌های پروژه‌ها - با useMemo برای بهینه‌سازی
  const fetchProjectMedia = useCallback(async () => {
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
        .select('id, hierarchy_project_id, file_path, file_type, created_at, mime_type')
        .in('hierarchy_project_id', projectIds)
        .in('file_type', ['image', 'video'])
        .order('created_at', { ascending: false });

      console.debug('[HybridGlobe] Hierarchy media fetched:', phMedia?.length || 0);

      // پشتیبانی سازگاری قدیمی: تصاویر موجود در project_media از طریق projects_v3
      const { data: v3 } = await supabase
        .from('projects_v3')
        .select('id, hierarchy_project_id')
        .in('hierarchy_project_id', projectIds);

      let pmMedia: { project_id: string; file_path: string; file_type: string; created_at: string; mime_type?: string }[] = [];
      if (v3 && v3.length > 0) {
        const v3Ids = v3.map(x => x.id);
        const { data } = await supabase
          .from('project_media')
          .select('project_id, file_path, file_type, created_at, mime_type')
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
        mediaByProject.get(pid)!.push({ id: m.id, file_path: m.file_path, file_type: m.file_type, created_at: m.created_at, mime_type: m.mime_type });
      });

      // از جدول قدیمی
      pmMedia.forEach(m => {
        const pid = v3?.find(v => v.id === m.project_id)?.hierarchy_project_id;
        if (!pid) return;
        if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
        mediaByProject.get(pid)!.push({ id: `${m.project_id}-${m.created_at}`, file_path: m.file_path, file_type: m.file_type, created_at: m.created_at, mime_type: m.mime_type });
      });

      // ترکیب نهایی و محدود کردن به ۲ تصویر جدید (کاهش از ۳ برای بهینه‌سازی)
      const projectsWithMediaData: ProjectWithMedia[] = projects.map(project => {
        const list = (mediaByProject.get(project.id) || []).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
        return { ...project, media: list.slice(0, 2) };
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
      
      // تابع global برای باز کردن ویدیو در تب جدید
      (window as any).openProjectVideo = (videoUrl: string, mimeType: string) => {
        console.log('[Video] openProjectVideo called - opening in new tab:', videoUrl);
        window.open(videoUrl, '_blank');
      };
    } catch (error) {
      console.error('خطا در دریافت عکس‌های پروژه:', error);
      setProjectsWithMedia(projects.map(p => ({ ...p, media: [] })));
    }
  }, [projects, toast]);

  // دریافت توکن Mapbox برای نمایش قواره‌های ساختمان‌ها
  useEffect(() => {
    const cached = sessionStorage.getItem('mapbox_token');
    if (cached) {
      setMapboxToken(cached);
      return;
    }

    const tryEdgeThenEnv = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
          sessionStorage.setItem('mapbox_token', data.token);
          return;
        }
      } catch (_) {}

      const envToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (envToken) {
        setMapboxToken(envToken);
        sessionStorage.setItem('mapbox_token', envToken);
      }
    };

    tryEdgeThenEnv();
  }, []);

  useEffect(() => {
    fetchProjectMedia();
  }, [fetchProjectMedia]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // ایجاد نقشه با مرکز ایران
    const map = L.map(mapContainer.current, {
      center: [32.4279, 53.6880], // مرکز ایران
      zoom: 6,
      minZoom: 5,
      maxZoom: 22,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    mapRef.current = map;

    // اضافه کردن لایه تایل OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 22,
    }).addTo(map);

    // بستن پنجره آپلود با کلیک روی نقشه
    map.on('click', (e: L.LeafletMouseEvent) => {
      // بررسی اینکه آیا کلیک روی مارکر بوده یا نه
      const clickedOnMarker = (e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon');
      if (!clickedOnMarker) {
        setSelectedProject(null);
      }
    });

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

  // اضافه کردن مارکرهای پروژه‌ها با خطوط اتصال
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

    // پاک کردن مارکرها، خطوط و مارکرهای مرکزی قبلی
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    linesRef.current.forEach(line => line.remove());
    linesRef.current = [];
    centerMarkersRef.current.forEach(cm => cm.remove());
    centerMarkersRef.current = [];

    // فیلتر پروژه‌هایی که مختصات معتبر دارند
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

    // گروه‌بندی پروژه‌ها بر اساس موقعیت جغرافیایی
    const locationGroups: Record<string, ProjectWithMedia[]> = {};
    projectsWithLocation.forEach(project => {
      if (!project.locations?.lat || !project.locations?.lng) return;
      const key = `${project.locations.lat.toFixed(6)}_${project.locations.lng.toFixed(6)}`;
      if (!locationGroups[key]) locationGroups[key] = [];
      locationGroups[key].push(project);
    });

    Object.values(locationGroups).forEach(group => {
      const count = group.length;
      const firstProject = group[0];
      const centerLat = firstProject.locations!.lat;
      const centerLng = firstProject.locations!.lng;

      // اگر بیش از یک پروژه در این موقعیت وجود دارد، مارکر مرکزی قرمز و خطوط اتصال اضافه کنیم
      if (count > 1) {
        const centerMarker = L.circleMarker([centerLat, centerLng], {
          radius: 12,
          fillColor: '#ef4444',
          fillOpacity: 0, // مخفی در ابتدا
          color: '#ffffff',
          weight: 3,
          opacity: 0, // مخفی در ابتدا
          className: 'location-center-marker'
        }).addTo(mapRef.current!);
        
        // اضافه کردن popup به مارکر قرمز برای نمایش تعداد پروژه‌ها
        const centerPopupContent = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: center; padding: 8px;">
            <div style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);color:white;padding:12px;border-radius:8px;margin-bottom:8px;">
              <span style="font-size:16px;font-weight:bold;">📍 ${count} پروژه</span>
            </div>
            <span style="font-size:12px;color:#6b7280;">روی پروژه‌ها کلیک کنید</span>
          </div>
        `;
        centerMarker.bindPopup(centerPopupContent, {
          maxWidth: 200,
          className: 'custom-popup center-marker-popup'
        });
        
        // کلیک روی مارکر قرمز همه پاپ‌آپ‌های پروژه‌ها را می‌بندد تا کاربر بتواند پروژه‌ها را ببیند
        centerMarker.on('click', () => {
          centerMarker.openPopup();
        });
        
        centerMarkersRef.current.push(centerMarker);
      }

      group.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        
        // محاسبه آفست برای مارکرهای چندگانه در یک آدرس - فاصله بسیار کم
        let lat = centerLat;
        let lng = centerLng;
        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          const radius = 0.00008; // فاصله خیلی کم برای قرارگیری بسیار نزدیک به نقطه قرمز
          lat = centerLat + radius * Math.cos(angle);
          lng = centerLng + radius * Math.sin(angle);

          // اضافه کردن خط اتصال از پروژه به مرکز
          const line = L.polyline(
            [[lat, lng], [centerLat, centerLng]],
            {
              color: '#3b82f6',
              weight: 2,
              opacity: 0, // مخفی در ابتدا
              dashArray: '8, 12',
              className: 'connection-line'
            }
          ).addTo(mapRef.current!);
          linesRef.current.push(line);
        }

        let iconToUse: any = projectIcon;
        const firstMedia = project.media?.[0];
        if (firstMedia) {
          const url1 = supabase.storage
            .from('order-media')
            .getPublicUrl(firstMedia.file_path).data.publicUrl;
          
          const isVideo = firstMedia.file_type === 'video';
          const mediaElement = isVideo 
            ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#333;">
                <svg style="width:32px;height:32px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:9px;padding:2px 4px;border-radius:3px;">ویدیو</span>
              </div>`
            : `<img src="${url1}" alt="تصویر پروژه" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          
          const html = `
            <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff;background:#f0f0f0;position:relative;">
              ${mediaElement}
              <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));height:14px;display:flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:7px;font-weight:bold;">${project.media?.length || 0}</span>
              </div>
            </div>`;
          iconToUse = L.divIcon({
            html,
            className: 'project-thumb-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40],
          });
        }

        const marker = L.marker([lat, lng], { 
          icon: iconToUse,
          opacity: 0 // مخفی در ابتدا تا انیمیشن تمام شود
        }).addTo(mapRef.current!);
        
        // تولید HTML برای تصاویر و ویدیوها با قابلیت گالری
        const images = (project.media || []).filter(m => m.file_type === 'image');
        const videos = (project.media || []).filter(m => m.file_type === 'video');
        
        const mediaHTML = images.length > 0 || videos.length > 0
          ? `
            <div style="margin-top: 12px;">
              ${images.length > 0 ? `
                <div id="gallery-${project.id}" style="position:relative;">
                  <div style="overflow:hidden;border-radius:8px;background:#f9fafb;">
                    ${images.map((m, idx) => {
                      const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                      return `<img 
                        id="img-${project.id}-${idx}" 
                        src="${url}" 
                        alt="تصویر پروژه" 
                        loading="lazy"
                        style="width:100%;height:200px;object-fit:contain;display:${idx === 0 ? 'block' : 'none'};"
                      />`;
                    }).join('')}
                  </div>
                  ${images.length > 1 ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:0 4px;">
                      <button class="gallery-prev-${project.id}" style="background:#3b82f6;color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-family:Vazirmatn;font-size:12px;font-weight:500;">قبلی</button>
                      <span id="counter-${project.id}" style="font-family:Vazirmatn;font-size:12px;color:#6b7280;">1 از ${images.length}</span>
                      <button class="gallery-next-${project.id}" style="background:#3b82f6;color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-family:Vazirmatn;font-size:12px;font-weight:500;">بعدی</button>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
              ${videos.length > 0 ? `
                <div style="margin-top: 12px;">
                  ${videos.map(m => {
                    const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                    return `
                      <div class="video-player-${project.id}" data-url="${url}" style="position:relative;width:100%;height:200px;background:#000;border-radius:8px;overflow:hidden;cursor:pointer;margin-bottom:8px;">
                        <video src="${url}" style="width:100%;height:100%;object-fit:contain;" preload="none"></video>
                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;">
                          <svg style="width:48px;height:48px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                        <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.8);color:#fff;font-size:11px;padding:4px 8px;border-radius:4px;">ویدیو - کلیک برای مشاهده</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>`
          : '';

        const locationHeader = count > 1
          ? `<div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:8px 12px;border-radius:8px 8px 0 0;margin:-8px -8px 8px -8px;text-align:center;">
              <span style="font-size:13px;font-weight:bold;">📍 ${count} پروژه در این مکان</span>
            </div>`
          : '';

        const popupContent = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 300px; max-width: 400px;${count > 1 ? 'border:3px solid #667eea;border-radius:10px;' : ''}">
            ${locationHeader}
            <strong style="font-size: 15px; color: #1f2937;">${project.title || 'پروژه'}</strong><br/>
            <span style="font-size: 12px; color: #6b7280; margin-top: 4px; display: block;">${project.locations?.address_line || ''}</span>
            ${count > 1 ? `<div style="margin-top:8px;padding:6px 10px;background:#f3f4f6;border-radius:6px;text-align:center;font-size:11px;color:#6b7280;">پروژه ${index + 1} از ${count}</div>` : ''}
            ${mediaHTML}
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 420,
          className: 'custom-popup'
        });

        // اتصال event listeners بعد از باز شدن popup
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (!popup) return;
          
          const popupElement = popup.getElement();
          if (!popupElement) return;
          
          let currentIndex = 0;
          
          // دکمه‌های ناوبری گالری
          const prevBtn = popupElement.querySelector(`.gallery-prev-${project.id}`);
          const nextBtn = popupElement.querySelector(`.gallery-next-${project.id}`);
          
          if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              currentIndex = (currentIndex - 1 + images.length) % images.length;
              updateGallery();
            });
            
            nextBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              currentIndex = (currentIndex + 1) % images.length;
              updateGallery();
            });
          }
          
          function updateGallery() {
            for (let i = 0; i < images.length; i++) {
              const img = popupElement.querySelector(`#img-${project.id}-${i}`) as HTMLElement;
              if (img) img.style.display = i === currentIndex ? 'block' : 'none';
            }
            
            const counter = popupElement.querySelector(`#counter-${project.id}`);
            if (counter) counter.textContent = `${currentIndex + 1} از ${images.length}`;
          }
          
          // کلیک روی ویدیو
          const videoPlayers = popupElement.querySelectorAll(`.video-player-${project.id}`);
          videoPlayers.forEach(player => {
            player.addEventListener('click', (e) => {
              e.stopPropagation();
              const url = (player as HTMLElement).getAttribute('data-url');
              if (url) window.open(url, '_blank');
            });
          });
        });

        marker.on('click', () => {
          setSelectedProject(project);
        });

        markersRef.current.push(marker);
        console.debug('[HybridGlobe] Marker added:', { 
          projectId: project.id, 
          lat, 
          lng,
          hasCustomIcon: !!firstMedia,
          groupSize: count,
          indexInGroup: index,
        });
      });
    });

    // انیمیشن زوم از نمای کل ایران به پروژه‌ها (مثل Google Earth)
    const allMarkers = markersRef.current;
    console.debug('[HybridGlobe] Total markers created:', allMarkers.length);
    
    if (allMarkers.length > 0) {
      const bounds = L.latLngBounds(allMarkers.map(m => m.getLatLng()));
      console.debug('[HybridGlobe] Animating to project bounds:', bounds);
      
      // ابتدا نقشه را در نمای کل ایران نگه می‌داریم (همان مقدار اولیه)
      // بعد از 1000ms با انیمیشن نرم به پروژه‌ها می‌رویم
      setTimeout(() => {
        try {
          mapRef.current?.flyToBounds(bounds, {
            padding: [80, 80],
            maxZoom: 14,
            duration: 5, // مدت زمان انیمیشن به ثانیه - کندتر برای حس بهتر
            easeLinearity: 0.15, // نرمی انیمیشن (کمتر = نرم‌تر)
          });
          
          // نمایش تدریجی مارکرها و خطوط بعد از اتمام انیمیشن
          setTimeout(() => {
            markersRef.current.forEach(m => m.setOpacity(1));
            linesRef.current.forEach(l => l.setStyle({ opacity: 0.7 }));
            centerMarkersRef.current.forEach(cm => cm.setStyle({ fillOpacity: 0.95, opacity: 1 }));
          }, 5000); // بعد از 5 ثانیه (مدت زمان انیمیشن)
        } catch (e) {
          console.warn('[HybridGlobe] flyToBounds failed', e, bounds);
        }
      }, 1000);
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProject(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleAddImage}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? `در حال آپلود... ${uploadProgress}%` : '+ افزودن عکس یا ویدیو'}
            </Button>
          </div>
        </Card>
      )}

      {/* Input مخفی برای انتخاب فایل */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* دیالوگ نمایش ویدیو */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>پخش ویدیو</DialogTitle>
          </DialogHeader>
          {videoLoading && <p className="text-center p-4">در حال بارگذاری...</p>}
          {videoSrc && (
            <video 
              controls 
              autoPlay 
              className="w-full max-h-[70vh] rounded-lg"
              onError={fallbackToBlob}
            >
              <source src={videoSrc} type={selectedVideo?.mimeType || 'video/mp4'} />
              مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
            </video>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
