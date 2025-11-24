import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin } from 'lucide-react';
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

    // گروه‌بندی پروژه‌ها بر اساس موقعیت جغرافیایی برای جلوگیری از هم‌پوشانی مارکرها
    const locationGroups: Record<string, ProjectWithMedia[]> = {};
    projectsWithLocation.forEach(project => {
      if (!project.locations?.lat || !project.locations?.lng) return;
      const key = `${project.locations.lat.toFixed(6)}_${project.locations.lng.toFixed(6)}`;
      if (!locationGroups[key]) locationGroups[key] = [];
      locationGroups[key].push(project);
    });

    Object.values(locationGroups).forEach(group => {
      const count = group.length;

      group.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        
        // محاسبه آفست کوچک برای مارکرهای چندگانه در یک آدرس
        let lat = project.locations.lat;
        let lng = project.locations.lng;
        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          const radius = 0.00018; // حدوداً ۲۰ متر جابجایی در نقشه
          lat = lat + radius * Math.cos(angle);
          lng = lng + radius * Math.sin(angle);
        }

        let iconToUse: any = projectIcon;
        const firstMedia = project.media?.[0];
        if (firstMedia) {
          const url1 = supabase.storage
            .from('order-media')
            .getPublicUrl(firstMedia.file_path).data.publicUrl;
          
          const isVideo = firstMedia.file_type === 'video';
          // ویدیوها را در thumbnail نمایش نمی‌دهیم برای کاهش بار
          const mediaElement = isVideo 
            ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#333;">
                <svg style="width:32px;height:32px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:9px;padding:2px 4px;border-radius:3px;">ویدیو</span>
              </div>`
            : `<img src="${url1}" alt="تصویر پروژه" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
          
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

        const marker = L.marker([lat, lng], { icon: iconToUse })
          .addTo(mapRef.current!);
        
        // تولید HTML برای تصاویر و ویدیوها
        const images = (project.media || []).filter(m => m.file_type === 'image').slice(0, 2);
        const videos = (project.media || []).filter(m => m.file_type === 'video').slice(0, 2);
        
        const mediaHTML = images.length > 0 || videos.length > 0
          ? `
            <div style="margin-top: 12px;">
              ${images.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;">
                  ${images.map(m => {
                    const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                    return `<img 
                      src="${url}" 
                      alt="تصویر" 
                      loading="lazy"
                      style="width:100%;height:80px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;cursor:pointer;"
                      onerror="this.style.display='none'"
                    />`;
                  }).join('')}
                </div>
              ` : ''}
              ${videos.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                  ${videos.map(m => {
                    const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                    const mimeType = m.mime_type || 'video/mp4';
                    return `<div 
                      onclick="window.openProjectVideo('${url}', '${mimeType}')"
                      style="width:100%;height:80px;background:#1a1a1a;border-radius:6px;border:2px solid #e5e7eb;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;overflow:hidden;"
                    >
                      <svg style="width:32px;height:32px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      <span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;">کلیک برای پخش</span>
                    </div>`;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `
          : '<p style="font-size: 12px; color: #999; margin-top: 8px;">هنوز فایلی ثبت نشده</p>';

        // اگر چند پروژه در یک مکان هستند، هدر گروهی نمایش بده
        const locationHeader = count > 1
          ? `<div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:#fff;padding:10px;border-radius:8px 8px 0 0;margin:-8px -8px 12px;text-align:center;font-weight:bold;font-size:13px;">
              📍 ${count} پروژه در این مکان
            </div>`
          : '';

        // خطی که پروژه‌های یک مکان را به هم وصل می‌کند
        const connectionLine = count > 1 && index < count - 1
          ? `<div style="width:3px;height:20px;background:linear-gradient(to bottom, #667eea, #764ba2);margin:8px auto;"></div>`
          : '';

        // اضافه کردن popup با عنوان و آدرس و نوع خدمت
        const popupContent = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 260px; max-width: 320px;${count > 1 ? 'border:3px solid #667eea;border-radius:10px;' : ''}">
            ${locationHeader}
            <strong style="font-size: 15px; color: #1f2937;">${project.title || 'پروژه'}</strong><br/>
            <span style="font-size: 12px; color: #6b7280; margin-top: 4px; display: block;">${project.locations?.address_line || ''}</span>
            ${count > 1 ? `<div style="margin-top:8px;padding:6px 10px;background:#f3f4f6;border-radius:6px;text-align:center;font-size:11px;color:#6b7280;">پروژه ${index + 1} از ${count}</div>` : ''}
            ${mediaHTML}
            ${connectionLine}
          </div>
        `;
        marker.bindPopup(popupContent, {
          maxWidth: 340,
          className: 'custom-popup'
        });

        marker.on('click', () => {
          setSelectedProject(project);
        });

        markersRef.current.push(marker);
        console.debug('[HybridGlobe] Marker added:', { 
          projectId: project.id, 
          lat: project.locations?.lat, 
          lng: project.locations?.lng,
          hasCustomIcon: !!firstMedia,
          groupSize: count,
          indexInGroup: index,
        });
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

      {/* دیالوگ پخش ویدیو */}
      <Dialog open={videoLoading || !!selectedVideo} onOpenChange={(open) => {
        if (!open) {
          setSelectedVideo(null);
          setVideoLoading(false);
        }
      }}>
        <DialogContent className="max-w-4xl w-[95vw] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-right">
              {videoLoading ? 'در حال آماده‌سازی ویدیو...' : 'پخش ویدیو'}
            </DialogTitle>
          </DialogHeader>
          
          {videoLoading ? (
            <div className="p-8 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                لطفاً صبر کنید، ویدیو در حال آماده‌سازی است...
              </p>
            </div>
          ) : (
            selectedVideo && (
              <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
                <video
                  key={selectedVideo.url}
                  src={selectedVideo.url}
                  controls
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: 'contain' }}
                  preload="metadata"
                >
                  مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
                </video>
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <a href={selectedVideo.url} target="_blank" rel="noreferrer">
                      باز کردن در تب جدید
                    </a>
                  </Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
