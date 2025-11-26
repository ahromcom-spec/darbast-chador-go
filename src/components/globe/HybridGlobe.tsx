import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptimizedImage } from './OptimizedImage';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { useNavigate } from 'react-router-dom';
type ProjectHierarchy = ReturnType<typeof useProjectsHierarchy>['projects'][0];

interface HierarchyMedia {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  created_at: string;
}

interface ProjectOrder {
  id: string;
  code: string;
  status: string;
  address: string;
  created_at: string;
  subcategory?: { name: string; code: string };
  media?: HierarchyMedia[];
}

interface ProjectWithMedia extends ProjectHierarchy {
  media?: HierarchyMedia[];
  orders?: ProjectOrder[];
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
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<string | null>(null);
  const [currentOrderMediaIndex, setCurrentOrderMediaIndex] = useState<Record<string, number>>({});
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; mimeType: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomedImages, setZoomedImages] = useState<string[]>([]);
  const [zoomedImageIndex, setZoomedImageIndex] = useState(0);
  const [selectedMapLocation, setSelectedMapLocation] = useState<{ lat: number; lng: number } | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  const { projects, loading } = useProjectsHierarchy();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const handleAddImage = () => {
    if (!selectedOrderForUpload) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedOrderForUpload) return;
    
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
        
        const filePath = `${user.id}/orders/${selectedOrderForUpload}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        console.log('[Upload] Uploading to storage:', filePath);

        const startProgress = (i / fileArray.length) * 100;
        setUploadProgress(Math.round(startProgress));

        const { error: uploadErr } = await supabase.storage
          .from('order-media')
          .upload(filePath, file, { 
            contentType: file.type, 
            upsert: false, 
            cacheControl: '3600'
          });
        
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
          .from('project_media')
          .insert({
            project_id: selectedOrderForUpload,
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
        // ذخیره اطلاعات پروژه و سفارش برای بازگرداندن popup
        const currentOrderId = selectedOrderForUpload;
        const currentProjectId = projectsWithMedia.find(p => 
          p.orders?.some(o => o.id === currentOrderId)
        )?.id;
        
        toast({ 
          title: 'موفق', 
          description: `${newMedia.length} فایل با موفقیت آپلود شد و به گالری اضافه گردید.` 
        });
        
        // بستن دیالوگ آپلود
        setSelectedOrderForUpload(null);
        
        // بارگذاری مجدد داده‌ها و سپس باز کردن popup با داده‌های جدید
        await fetchProjectMedia();
        
        // استفاده از setTimeout برای اطمینان از به‌روزرسانی state
        setTimeout(() => {
          if (currentProjectId) {
            const updatedProject = projectsWithMedia.find(p => p.id === currentProjectId);
            if (updatedProject) {
              setSelectedProject(updatedProject);
              // اسکرول به آخرین عکس اضافه شده
              const order = updatedProject.orders?.find(o => o.id === currentOrderId);
              if (order && order.media && order.media.length > 0) {
                setCurrentOrderMediaIndex(prev => ({
                  ...prev,
                  [currentOrderId]: order.media!.length - 1
                }));
              }
            }
          }
        }, 100);
      } else {
        toast({ 
          title: 'آپلود ناموفق', 
          description: 'فرمت فایل نامعتبر بود یا خطای موقت رخ داد.', 
          variant: 'destructive' 
        });
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


  // دریافت عکس‌های پروژه‌ها - بهینه‌سازی شده
  const fetchProjectMedia = useCallback(async () => {
    if (projects.length === 0) {
      console.debug('[HybridGlobe] No projects to fetch media for');
      return;
    }

    console.debug('[HybridGlobe] Fetching media for', projects.length, 'projects');
    
    try {
      const projectIds = projects.map(p => p.id);
      
      // دریافت موازی داده‌ها برای سرعت بیشتر
      const [phMediaResult, v3Result] = await Promise.all([
        supabase
          .from('project_hierarchy_media')
          .select('id, hierarchy_project_id, file_path, file_type, created_at, mime_type')
          .in('hierarchy_project_id', projectIds)
          .in('file_type', ['image', 'video'])
          .order('created_at', { ascending: false })
          .limit(100), // محدودیت برای بهینه‌سازی
        
        supabase
          .from('projects_v3')
          .select('id, hierarchy_project_id')
          .in('hierarchy_project_id', projectIds)
      ]);

      const phMedia = phMediaResult.data;
      const v3 = v3Result.data;

      console.debug('[HybridGlobe] Hierarchy media fetched:', phMedia?.length || 0);

      let pmMedia: { project_id: string; file_path: string; file_type: string; created_at: string; mime_type?: string }[] = [];
      if (v3 && v3.length > 0) {
        const v3Ids = v3.map(x => x.id);
        const { data } = await supabase
          .from('project_media')
          .select('project_id, file_path, file_type, created_at, mime_type')
          .in('project_id', v3Ids)
          .in('file_type', ['image', 'video'])
          .order('created_at', { ascending: false })
          .limit(100);
        pmMedia = data || [];
      }

      console.debug('[HybridGlobe] Project media fetched:', pmMedia.length);

      // استفاده از Map برای بهینه‌سازی جستجو
      const mediaByProject = new Map<string, HierarchyMedia[]>();

      if (phMedia) {
        phMedia.forEach(m => {
          const pid = m.hierarchy_project_id;
          if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
          mediaByProject.get(pid)!.push({ 
            id: m.id, 
            file_path: m.file_path, 
            file_type: m.file_type, 
            created_at: m.created_at, 
            mime_type: m.mime_type 
          });
        });
      }

      pmMedia.forEach(m => {
        const pid = v3?.find(v => v.id === m.project_id)?.hierarchy_project_id;
        if (!pid) return;
        if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
        mediaByProject.get(pid)!.push({ 
          id: m.project_id + '-' + m.created_at, 
          file_path: m.file_path, 
          file_type: m.file_type, 
          created_at: m.created_at, 
          mime_type: m.mime_type 
        });
      });

      // دریافت سفارشات
      const { data: v3Orders } = await supabase
        .from('projects_v3')
        .select('id, code, status, address, created_at, hierarchy_project_id, subcategory:subcategories(name, code)')
        .in('hierarchy_project_id', projectIds)
        .limit(200);

      const orderMediaMap = new Map<string, HierarchyMedia[]>();
      pmMedia.forEach(m => {
        if (!orderMediaMap.has(m.project_id)) orderMediaMap.set(m.project_id, []);
        orderMediaMap.get(m.project_id)!.push({ 
          id: m.project_id + '-' + m.created_at, 
          file_path: m.file_path, 
          file_type: m.file_type, 
          created_at: m.created_at, 
          mime_type: m.mime_type 
        });
      });

      const ordersByProject = new Map<string, ProjectOrder[]>();
      if (v3Orders) {
        v3Orders.forEach(order => {
          if (!order.hierarchy_project_id) return;
          if (!ordersByProject.has(order.hierarchy_project_id)) {
            ordersByProject.set(order.hierarchy_project_id, []);
          }
          ordersByProject.get(order.hierarchy_project_id)!.push({
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            created_at: order.created_at,
            subcategory: order.subcategory || undefined,
            media: orderMediaMap.get(order.id) || []
          });
        });
      }

      // ترکیب نهایی با بهینه‌سازی
      const projectsWithMediaData: ProjectWithMedia[] = projects.map(project => {
        const list = (mediaByProject.get(project.id) || [])
          .sort((a, b) => a.created_at > b.created_at ? -1 : 1)
          .slice(0, 2); // فقط 2 تصویر اول
        const orders = (ordersByProject.get(project.id) || [])
          .sort((a, b) => a.created_at > b.created_at ? -1 : 1);
        return { ...project, media: list, orders };
      });

      console.debug('[HybridGlobe] Projects with media prepared:', projectsWithMediaData.length);
      
      setProjectsWithMedia(projectsWithMediaData);
      
      // تابع global برای ویدیو
      (window as any).openProjectVideo = (videoUrl: string, mimeType: string) => {
        console.log('[Video] Opening in new tab:', videoUrl);
        window.open(videoUrl, '_blank');
      };
    } catch (error) {
      console.error('خطا در دریافت عکس‌های پروژه:', error);
      setProjectsWithMedia(projects.map(p => ({ ...p, media: [], orders: [] })));
    }
  }, [projects]);

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

    // ایجاد نقشه با مرکز ایران - بهینه‌سازی شده
    const map = L.map(mapContainer.current, {
      center: [32.4279, 53.6880],
      zoom: 6,
      minZoom: 5,
      maxZoom: 22,
      scrollWheelZoom: true,
      zoomControl: true,
      preferCanvas: true, // استفاده از Canvas برای عملکرد بهتر
      renderer: L.canvas({ tolerance: 5 }), // بهینه‌سازی رندرینگ
      trackResize: true,
    });

    mapRef.current = map;

    // لایه تایل با کش و بهینه‌سازی
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 22,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4, // نگهداری تایل‌ها در حافظه
      maxNativeZoom: 19,
    }).addTo(map);

    // بستن popup با debounce
    let longPressTimer: NodeJS.Timeout;
    let isLongPress = false;
    let clickCount = 0;
    let lastClickTime = 0;
    const DOUBLE_CLICK_DELAY = 300; // میلی‌ثانیه
    const LONG_PRESS_DURATION = 500; // میلی‌ثانیه

    // هندلر شروع long press (موس و تاچ)
    const startLongPress = (e: L.LeafletMouseEvent) => {
      const clickedOnMarker = (e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon');
      if (clickedOnMarker) return;

      isLongPress = false;
      longPressTimer = setTimeout(() => {
        isLongPress = true;
        showAddProjectMarker(e);
      }, LONG_PRESS_DURATION);
    };

    // هندلر پایان long press
    const endLongPress = () => {
      clearTimeout(longPressTimer);
    };

    // تابع نمایش مارکر افزودن پروژه
    const showAddProjectMarker = (e: L.LeafletMouseEvent) => {
      setSelectedProject(null);
      setSelectedOrderForUpload(null);
      
      // حذف مارکر موقت قبلی اگر وجود دارد
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }

      // ایجاد مارکر موقت جدید با آیکون پین
      const tempIcon = L.divIcon({
        className: 'custom-temp-marker',
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 50px;
            animation: bounce 1s ease-in-out infinite;
          ">
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="20" cy="48" rx="8" ry="2" fill="rgba(0,0,0,0.2)"/>
              <path d="M20 2C12 2 6 8 6 16C6 25 20 42 20 42C20 42 34 25 34 16C34 8 28 2 20 2Z" 
                    fill="url(#pinGradient)" 
                    stroke="white" 
                    stroke-width="2"
                    filter="url(#shadow)"/>
              <circle cx="20" cy="16" r="6" fill="white" opacity="0.9"/>
              <defs>
                <linearGradient id="pinGradient" x1="20" y1="2" x2="20" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#3b82f6"/>
                  <stop offset="100%" stop-color="#1d4ed8"/>
                </linearGradient>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                </filter>
              </defs>
            </svg>
          </div>
          <style>
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-5px); }
            }
          </style>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
      });

      const newTempMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: tempIcon }).addTo(map);
      
      // اضافه کردن popup به مارکر
      const popupContent = `
        <div style="text-align: center; padding: 8px;">
          <button 
            id="add-project-btn"
            style="
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 20px;
              font-family: inherit;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              transition: all 0.2s ease;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)';"
          >
            ➕ افزودن پروژه در این موقعیت
          </button>
        </div>
      `;
      
      newTempMarker.bindPopup(popupContent, {
        closeButton: false,
        className: 'custom-add-project-popup',
        offset: [0, -40]
      }).openPopup();
      
      // اضافه کردن event listener به دکمه بعد از باز شدن popup
      setTimeout(() => {
        const addBtn = document.getElementById('add-project-btn');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            navigate('/user/new-location', {
              state: {
                lat: e.latlng.lat,
                lng: e.latlng.lng
              }
            });
          });
        }
      }, 100);
      
      tempMarkerRef.current = newTempMarker;
      setSelectedMapLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    // هندلر دوبار کلیک
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedOnMarker = (e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon');
      
      // اگر روی مارکر کلیک شد، پروژه‌ها را ببند و خارج شو
      if (clickedOnMarker) {
        return;
      }

      // اگر این یک long press بود، کار ما تمام است
      if (isLongPress) {
        isLongPress = false;
        return;
      }

      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastClickTime;

      if (timeDiff < DOUBLE_CLICK_DELAY && clickCount === 1) {
        // دوبار کلیک شناسایی شد
        clickCount = 0;
        lastClickTime = 0;
        showAddProjectMarker(e);
      } else {
        // اولین کلیک
        clickCount = 1;
        lastClickTime = currentTime;
        
        // پس از تاخیر، اگر دومین کلیک نیامد، کلیک‌ها را ریست کن
        setTimeout(() => {
          if (clickCount === 1) {
            clickCount = 0;
            lastClickTime = 0;
            // بستن پروژه‌های انتخاب شده با کلیک ساده
            setSelectedProject(null);
            setSelectedOrderForUpload(null);
          }
        }, DOUBLE_CLICK_DELAY);
      }
    });

    // رویدادهای long press
    map.on('mousedown', startLongPress);
    map.on('mouseup', endLongPress);
    map.on('mousemove', endLongPress);
    map.getContainer().addEventListener('touchstart', (e: TouchEvent) => {
      // Only trigger long press if exactly one finger is touching
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const point = map.containerPointToLatLng([touch.clientX, touch.clientY]);
        const leafletEvent = {
          latlng: point,
          originalEvent: e
        } as unknown as L.LeafletMouseEvent;
        startLongPress(leafletEvent);
      } else {
        // Cancel long press if multiple fingers detected (pinch zoom or multi-touch pan)
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          isLongPress = false;
        }
      }
    });
    map.getContainer().addEventListener('touchend', (e: TouchEvent) => {
      // Only process if it was a single touch ending
      if (e.changedTouches.length === 1 && e.touches.length === 0) {
        endLongPress();
      } else {
        // Cancel if multiple fingers involved
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          isLongPress = false;
        }
      }
    });
    map.getContainer().addEventListener('touchmove', (e: TouchEvent) => {
      // Cancel long press on movement or if multiple fingers detected
      if (longPressTimer && e.touches.length !== 1) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        isLongPress = false;
      }
    });

    map.whenReady(() => {
      setMapReady(true);
    });

    return () => {
      clearTimeout(longPressTimer);
      setMapReady(false);
      if (tempMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }
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
    const projectsWithLocation = projectsWithMedia.filter(function(p) {
      return Number.isFinite(p.locations?.lat as number) && Number.isFinite(p.locations?.lng as number);
    });

    console.debug('[HybridGlobe] Creating markers:', {
      totalProjects: projectsWithMedia.length,
      withValidLocation: projectsWithLocation.length,
      samples: projectsWithLocation.slice(0, 3).map(function(p) { 
        return { 
          id: p.id, 
          title: p.title,
          lat: p.locations?.lat, 
          lng: p.locations?.lng,
          hasMedia: (p.media?.length || 0) > 0
        };
      })
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
    projectsWithLocation.forEach(function(project) {
      if (!project.locations?.lat || !project.locations?.lng) return;
      const key = project.locations.lat.toFixed(6) + '_' + project.locations.lng.toFixed(6);
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
        // استفاده از قدیمی‌ترین تصویر از قدیمی‌ترین سفارش برای مارکر
        let firstOrderImage: HierarchyMedia | undefined;
        let totalOrderImages = 0;
        
        // سفارشات به ترتیب جدید به قدیم هستند، پس آخرین سفارش قدیمی‌ترین است
        if (project.orders && project.orders.length > 0) {
          const oldestOrder = project.orders[project.orders.length - 1]; // قدیمی‌ترین سفارش
          
          // مرتب‌سازی media از قدیمی به جدید و انتخاب اولین تصویر
          const orderImages = (oldestOrder.media || [])
            .filter(m => m.file_type === 'image')
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // قدیمی‌ترین اول
          
          firstOrderImage = orderImages[0]; // قدیمی‌ترین عکس
          
          // شمارش کل تصاویر تمام سفارشات
          project.orders.forEach(order => {
            totalOrderImages += (order.media || []).filter(m => m.file_type === 'image').length;
          });
        }
        
        if (firstOrderImage) {
          const url1 = supabase.storage
            .from('order-media')
            .getPublicUrl(firstOrderImage.file_path).data.publicUrl;
          
          const html = `
            <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff;background:#f0f0f0;position:relative;">
              <img src="${url1}" alt="تصویر پروژه" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>
              <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));height:14px;display:flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:7px;font-weight:bold;">${totalOrderImages}</span>
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
                <div id="gallery-${project.id}" class="swipeable-gallery" style="position:relative;touch-action:pan-y;">
                  <div style="overflow:hidden;border-radius:8px;background:#f9fafb;position:relative;">
                    ${images.map((m, idx) => {
                      const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                      return `<img 
                        id="img-${project.id}-${idx}" 
                        src="${url}" 
                        alt="تصویر پروژه" 
                        loading="lazy"
                        style="width:100%;height:200px;object-fit:contain;display:${idx === 0 ? 'block' : 'none'};user-select:none;"
                        draggable="false"
                      />`;
                    }).join('')}
                    ${images.length > 1 ? `
                      <button class="gallery-prev-${project.id}" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                        <svg style="width:18px;height:18px;transform:rotate(180deg);" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                      </button>
                      <button class="gallery-next-${project.id}" style="position:absolute;top:50%;left:8px;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                        <svg style="width:18px;height:18px;" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                      </button>
                      <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:4px 12px;border-radius:12px;font-family:Vazirmatn;font-size:11px;pointer-events:none;">
                        <span id="counter-${project.id}">1 از ${images.length}</span>
                      </div>
                    ` : ''}
                  </div>
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
          ? `<div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:6px 10px;border-radius:8px 8px 0 0;margin:-8px -8px 8px -8px;text-align:center;">
              <span style="font-size:11px;font-weight:bold;">📍 ${count} پروژه در این مکان</span>
            </div>`
          : '';

        // لیست سفارشات پروژه
        const ordersHTML = project.orders && project.orders.length > 0
          ? `
            <div style="margin-top:10px;padding:8px;background:#f9fafb;border-radius:8px;max-height:60vh;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;">
              <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:6px;">سفارشات این پروژه (${project.orders.length})</div>
              ${project.orders.map((order, orderIdx) => {
                const allMedia = (order.media || []).sort((a, b) => {
                  if (a.file_type === 'image' && b.file_type === 'video') return -1;
                  if (a.file_type === 'video' && b.file_type === 'image') return 1;
                  return 0;
                });
                
                return `
                  <div 
                    class="order-card-${order.id}" 
                    style="padding:8px;margin-bottom:6px;background:white;border:2px solid #e5e7eb;border-radius:6px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.borderColor='#3b82f6';this.style.boxShadow='0 4px 12px rgba(59,130,246,0.2)'"
                    onmouseout="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'"
                  >
                    <div style="font-size:11px;font-weight:600;color:#1f2937;">کد: ${order.code}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">${order.subcategory?.name || 'نامشخص'}</div>
                    <div id="order-gallery-${order.id}" class="swipeable-gallery" style="position:relative;margin-top:6px;touch-action:pan-y;">
                      <div style="overflow:hidden;border-radius:6px;background:#f9fafb;position:relative;">
                        ${allMedia.map((m, idx) => {
                          const url = supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl;
                          const isVideo = m.file_type === 'video';
                          
                          if (isVideo) {
                            return `
                              <div 
                                id="order-media-${order.id}-${idx}" 
                                class="order-video-item-${order.id}" 
                                data-url="${url}"
                                style="position:relative;width:100%;height:100px;background:#000;display:${idx === 0 ? 'block' : 'none'};cursor:pointer;"
                              >
                                <video src="${url}" style="width:100%;height:100%;object-fit:cover;user-select:none;" preload="metadata" draggable="false"></video>
                                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;">
                                  <svg style="width:28px;height:28px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                                <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:9px;padding:2px 5px;border-radius:3px;">ویدیو</span>
                              </div>
                            `;
                          } else {
                            return `
                              <img 
                                id="order-media-${order.id}-${idx}" 
                                class="order-image-clickable"
                                data-image-url="${url}"
                                src="${url}" 
                                alt="تصویر سفارش" 
                                loading="lazy"
                                style="width:100%;height:100px;object-fit:cover;display:${idx === 0 ? 'block' : 'none'};cursor:pointer;user-select:none;"
                                draggable="false"
                              />
                            `;
                          }
                        }).join('')}
                        
                        <!-- کادر افزودن عکس/فیلم -->
                        <div 
                          id="order-media-${order.id}-add" 
                          class="order-add-media-${order.id}"
                          style="display:${allMedia.length === 0 ? 'flex' : 'none'};flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px 15px;background:linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));border:2px dashed #667eea;border-radius:6px;cursor:pointer;height:100px;"
                        >
                          <div style="font-size:28px;">📷</div>
                          <div style="text-align:center;">
                            <div style="font-weight:600;font-size:11px;color:#1f2937;margin-bottom:2px;">افزودن عکس یا فیلم</div>
                            <div style="font-size:9px;color:#6b7280;">برای این سفارش رسانه جدید اضافه کنید</div>
                            ${allMedia.length > 0 ? `<div style="font-size:9px;color:#667eea;margin-top:4px;font-weight:600;">در حال حاضر ${allMedia.length} رسانه موجود است</div>` : ''}
                          </div>
                        </div>
                        
                        ${allMedia.length > 0 ? `
                          <button class="order-gallery-prev-${order.id}" style="position:absolute;top:50%;right:4px;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                            <svg style="width:14px;height:14px;transform:rotate(180deg);" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                          <button class="order-gallery-next-${order.id}" style="position:absolute;top:50%;left:4px;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                            <svg style="width:14px;height:14px;" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                          <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:2px 8px;border-radius:10px;font-family:Vazirmatn;font-size:9px;pointer-events:none;">
                            <span id="order-counter-${order.id}">1 از ${allMedia.length + 1}</span>
                          </div>
                        ` : ''}
                      </div>
                      <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;">
                        <button 
                          class="view-order-detail-${order.id}"
                          data-order-id="${order.id}"
                          data-subcategory-code="${order.subcategory?.code || ''}"
                          style="width:100%;padding:6px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:10px;font-family:inherit;"
                        >
                          مشاهده جزئیات سفارش
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `
          : '';

        const popupContent = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 260px; max-width: 340px;${count > 1 ? 'border:3px solid #667eea;border-radius:10px;' : ''}">
            ${locationHeader}
            <strong style="font-size: 13px; color: #1f2937;">${project.title || 'پروژه'}</strong><br/>
            <span style="font-size: 11px; color: #6b7280; margin-top: 4px; display: block;">${project.locations?.address_line || ''}</span>
            ${count > 1 ? `<div style="margin-top:8px;padding:5px 8px;background:#f3f4f6;border-radius:6px;text-align:center;font-size:10px;color:#6b7280;">پروژه ${index + 1} از ${count}</div>` : ''}
            ${ordersHTML}
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 360,
          className: 'custom-popup'
        });

        // اتصال event listeners بعد از باز شدن popup
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (!popup) return;
          
          const popupElement = popup.getElement();
          if (!popupElement) return;
          
          // هندلر برای سفارشات (کلیک + گالری)
          if (project.orders) {
            project.orders.forEach((order) => {
              // ترکیب تمام media (عکس + ویدیو)
              const allMedia = (order.media || []).sort((a, b) => {
                if (a.file_type === 'image' && b.file_type === 'video') return -1;
                if (a.file_type === 'video' && b.file_type === 'image') return 1;
                return 0;
              });
              
              // کلیک روی دکمه "مشاهده جزئیات سفارش"
              const viewDetailBtn = popupElement.querySelector(`.view-order-detail-${order.id}`);
              if (viewDetailBtn) {
                viewDetailBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const orderId = (viewDetailBtn as HTMLElement).dataset.orderId;
                  const subcategoryCode = (viewDetailBtn as HTMLElement).dataset.subcategoryCode;
                  
                  if (subcategoryCode === '10') {
                    // داربست اجرا با اجناس - به فرم
                    window.location.href = `/scaffolding/form?edit=${orderId}`;
                  } else if (subcategoryCode === '30') {
                    // اجاره داربست - به فرم
                    window.location.href = `/scaffolding/rental?edit=${orderId}`;
                  } else {
                    // سایر سفارشات - به صفحه جزئیات سفارش
                    window.location.href = `/user/order-detail/${orderId}`;
                  }
                });
              }
              
              // هندلر برای کلیک روی ویدیوها در گالری
              const videoItems = popupElement.querySelectorAll(`.order-video-item-${order.id}`);
              videoItems.forEach(videoEl => {
                videoEl.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const url = (videoEl as HTMLElement).dataset.url;
                  if (url) {
                    window.open(url, '_blank');
                  }
                });
              });
              
              // اضافه کردن قابلیت زوم برای تصاویر
              const imageElements = popupElement.querySelectorAll('.order-image-clickable');
              imageElements.forEach(imgEl => {
                imgEl.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const imageUrl = (imgEl as HTMLElement).dataset.imageUrl;
                  const imageIndex = parseInt((imgEl as HTMLElement).id.split('-').pop() || '0');
                  
                  if (imageUrl) {
                    // پیدا کردن تمام تصاویر این order
                    const orderImages = allMedia
                      .filter(m => m.file_type === 'image')
                      .map(m => supabase.storage.from('order-media').getPublicUrl(m.file_path).data.publicUrl);
                    
                    setZoomedImages(orderImages);
                    setZoomedImageIndex(imageIndex);
                    setZoomedImage(imageUrl);
                  }
                });
              });
              
              // گالری یکپارچه با کادر افزودن
              let currentOrderIndex = 0;
              const totalItems = allMedia.length + 1; // +1 برای کادر افزودن
              
              const prevBtn = popupElement.querySelector(`.order-gallery-prev-${order.id}`);
              const nextBtn = popupElement.querySelector(`.order-gallery-next-${order.id}`);
              const addMediaCard = popupElement.querySelector(`.order-add-media-${order.id}`) as HTMLElement;
              const orderGalleryEl = popupElement.querySelector(`#order-gallery-${order.id}`) as HTMLElement;
              
              if (prevBtn && nextBtn) {
                prevBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  currentOrderIndex = (currentOrderIndex - 1 + totalItems) % totalItems;
                  updateOrderGallery(order.id, currentOrderIndex, allMedia.length);
                });
                
                nextBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  currentOrderIndex = (currentOrderIndex + 1) % totalItems;
                  updateOrderGallery(order.id, currentOrderIndex, allMedia.length);
                });
              }
              
              // اضافه کردن swipe/drag برای گالری سفارش
              if (orderGalleryEl && totalItems > 1) {
                let startX = 0;
                let startY = 0;
                let isDragging = false;
                
                const handleStart = (e: TouchEvent | MouseEvent) => {
                  isDragging = true;
                  startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                  startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
                };
                
                const handleMove = (e: TouchEvent | MouseEvent) => {
                  if (!isDragging) return;
                  
                  const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                  const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
                  const diffX = startX - currentX;
                  const diffY = startY - currentY;
                  
                  // فقط اگر حرکت افقی بیشتر از عمودی بود
                  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                    e.preventDefault();
                  }
                };
                
                const handleEnd = (e: TouchEvent | MouseEvent) => {
                  if (!isDragging) return;
                  isDragging = false;
                  
                  const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
                  const diffX = startX - endX;
                  
                  // حداقل 50 پیکسل حرکت
                  if (Math.abs(diffX) > 50) {
                    if (diffX > 0) {
                      // سوایپ به چپ -> بعدی
                      currentOrderIndex = (currentOrderIndex + 1) % totalItems;
                    } else {
                      // سوایپ به راست -> قبلی
                      currentOrderIndex = (currentOrderIndex - 1 + totalItems) % totalItems;
                    }
                    updateOrderGallery(order.id, currentOrderIndex, allMedia.length);
                  }
                };
                
                orderGalleryEl.addEventListener('touchstart', handleStart as any, { passive: true });
                orderGalleryEl.addEventListener('touchmove', handleMove as any, { passive: false });
                orderGalleryEl.addEventListener('touchend', handleEnd as any, { passive: true });
                orderGalleryEl.addEventListener('mousedown', handleStart as any);
                orderGalleryEl.addEventListener('mousemove', handleMove as any);
                orderGalleryEl.addEventListener('mouseup', handleEnd as any);
                orderGalleryEl.addEventListener('mouseleave', () => { isDragging = false; });
              }
              
              // کلیک روی کادر افزودن
              if (addMediaCard) {
                addMediaCard.addEventListener('click', (e) => {
                  e.stopPropagation();
                  setSelectedOrderForUpload(order.id);
                  setSelectedProject(project);
                });
              }
              
              function updateOrderGallery(orderId: string, index: number, mediaCount: number) {
                // مخفی کردن همه رسانه‌ها
                for (let i = 0; i < mediaCount; i++) {
                  const mediaEl = popupElement.querySelector(`#order-media-${orderId}-${i}`) as HTMLElement;
                  if (mediaEl) mediaEl.style.display = 'none';
                }
                
                // نمایش/مخفی کردن کادر افزودن
                const addCard = popupElement.querySelector(`.order-add-media-${orderId}`) as HTMLElement;
                if (addCard) {
                  addCard.style.display = index === mediaCount ? 'flex' : 'none';
                }
                
                // نمایش رسانه فعلی
                if (index < mediaCount) {
                  const mediaEl = popupElement.querySelector(`#order-media-${orderId}-${index}`) as HTMLElement;
                  if (mediaEl) mediaEl.style.display = 'block';
                }
                
                const counter = popupElement.querySelector(`#order-counter-${orderId}`);
                if (counter) {
                  counter.textContent = `${index + 1} از ${mediaCount + 1}`;
                }
              }
            });
          }
          
          // هندلر برای گالری اصلی پروژه
          const projectImages = images;
          if (projectImages.length > 1) {
            let currentProjectIndex = 0;
            const projectGalleryEl = popupElement.querySelector(`#gallery-${project.id}`) as HTMLElement;
            const projectPrevBtn = popupElement.querySelector(`.gallery-prev-${project.id}`);
            const projectNextBtn = popupElement.querySelector(`.gallery-next-${project.id}`);
            
            if (projectPrevBtn && projectNextBtn) {
              projectPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentProjectIndex = (currentProjectIndex - 1 + projectImages.length) % projectImages.length;
                updateProjectGallery(currentProjectIndex);
              });
              
              projectNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentProjectIndex = (currentProjectIndex + 1) % projectImages.length;
                updateProjectGallery(currentProjectIndex);
              });
            }
            
            // اضافه کردن swipe/drag برای گالری پروژه
            if (projectGalleryEl) {
              let startX = 0;
              let startY = 0;
              let isDragging = false;
              
              const handleStart = (e: TouchEvent | MouseEvent) => {
                isDragging = true;
                startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
              };
              
              const handleMove = (e: TouchEvent | MouseEvent) => {
                if (!isDragging) return;
                
                const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
                const diffX = startX - currentX;
                const diffY = startY - currentY;
                
                // فقط اگر حرکت افقی بیشتر از عمودی بود
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                  e.preventDefault();
                }
              };
              
              const handleEnd = (e: TouchEvent | MouseEvent) => {
                if (!isDragging) return;
                isDragging = false;
                
                const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
                const diffX = startX - endX;
                
                // حداقل 50 پیکسل حرکت
                if (Math.abs(diffX) > 50) {
                  if (diffX > 0) {
                    // سوایپ به چپ -> بعدی
                    currentProjectIndex = (currentProjectIndex + 1) % projectImages.length;
                  } else {
                    // سوایپ به راست -> قبلی
                    currentProjectIndex = (currentProjectIndex - 1 + projectImages.length) % projectImages.length;
                  }
                  updateProjectGallery(currentProjectIndex);
                }
              };
              
              projectGalleryEl.addEventListener('touchstart', handleStart as any, { passive: true });
              projectGalleryEl.addEventListener('touchmove', handleMove as any, { passive: false });
              projectGalleryEl.addEventListener('touchend', handleEnd as any, { passive: true });
              projectGalleryEl.addEventListener('mousedown', handleStart as any);
              projectGalleryEl.addEventListener('mousemove', handleMove as any);
              projectGalleryEl.addEventListener('mouseup', handleEnd as any);
              projectGalleryEl.addEventListener('mouseleave', () => { isDragging = false; });
            }
            
            function updateProjectGallery(index: number) {
              // مخفی کردن همه تصاویر
              for (let i = 0; i < projectImages.length; i++) {
                const imgEl = popupElement.querySelector(`#img-${project.id}-${i}`) as HTMLElement;
                if (imgEl) imgEl.style.display = 'none';
              }
              
              // نمایش تصویر فعلی
              const currentImg = popupElement.querySelector(`#img-${project.id}-${index}`) as HTMLElement;
              if (currentImg) currentImg.style.display = 'block';
              
              // به‌روزرسانی شمارنده
              const counter = popupElement.querySelector(`#counter-${project.id}`);
              if (counter) {
                counter.textContent = `${index + 1} از ${projectImages.length}`;
              }
            }
          }
        });

         marker.on('click', () => {
          setSelectedProject(project);
          setSelectedOrderForUpload(null);
          setSelectedMapLocation(null); // Clear map location selection when clicking on a marker
        });

        markersRef.current.push(marker);
        console.debug('[HybridGlobe] Marker added:', { 
          projectId: project.id, 
          lat, 
          lng,
          hasCustomIcon: !!firstOrderImage,
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
          size="sm"
          onClick={onClose}
          className="pointer-events-auto absolute top-4 right-4 shadow-2xl border-2 border-primary/20 text-xs px-3 py-1.5 h-8"
        >
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          <span className="font-semibold text-xs">بازگشت</span>
        </Button>

        {/* کارت تعداد پروژه‌ها */}
        <Card className="pointer-events-auto absolute top-16 left-4 bg-card shadow-2xl border-2 border-primary/20 p-2">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-primary/10 rounded-lg">
              <MapPin className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-primary">{projectsWithMedia.length}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">پروژه فعال</span>
            </div>
          </div>
        </Card>

      </div>

      {/* نقشه */}
      <div ref={mapContainer} className="w-full h-full" style={{ touchAction: 'pan-x pan-y' }} />

      {/* کادر آپلود برای سفارش خاص */}
      {selectedOrderForUpload && (
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md bg-card shadow-2xl p-4 z-[2000] border-2 border-primary/20 pointer-events-auto">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-base font-semibold">افزودن عکس/فیلم به سفارش</h3>
                <p className="text-xs text-muted-foreground mt-1">فایل‌های انتخابی به سفارش اضافه می‌شود</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedOrderForUpload(null);
                  setSelectedProject(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleAddImage}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? `در حال آپلود... ${uploadProgress}%` : '+ انتخاب فایل'}
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

      <ImageZoomModal
        isOpen={!!zoomedImage}
        imageUrl={zoomedImage || ''}
        images={zoomedImages}
        initialIndex={zoomedImageIndex}
        onClose={() => {
          setZoomedImage(null);
          setZoomedImages([]);
          setZoomedImageIndex(0);
        }}
      />
    </div>
  );
}
