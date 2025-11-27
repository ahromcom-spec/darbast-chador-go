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
  approved_at?: string | null;
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
  const locationsMarkersRef = useRef<L.Marker[]>([]); // مرجع جداگانه برای آدرس‌های بدون پروژه
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
  
  // States למחיקה
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { projects: allProjects, loading, refetch } = useProjectsHierarchy();
  
  // فیلتر کردن پروژه‌هایی که آدرسشان فعال است
  const projects = useMemo(() => {
    return allProjects.filter(project => 
      project.locations && 
      (project.locations as any).is_active !== false
    );
  }, [allProjects]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // دریافت مجدد داده‌ها وقتی component مانت می‌شود (برای نمایش تغییرات)
  useEffect(() => {
    refetch();
  }, []); // فقط یک بار در mount

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


  // Helper functions for deletion validation
  const isOrderDeletable = (orderStatus: string): boolean => {
    return orderStatus === 'pending' || orderStatus === 'rejected' || 
           orderStatus === 'completed' || orderStatus === 'paid' || orderStatus === 'closed';
  };

  const canDeleteProject = (project: ProjectWithMedia): { canDelete: boolean; reason?: string } => {
    const projectOrders = project.orders || [];
    
    if (projectOrders.length === 0) {
      return { canDelete: true };
    }

    const activeOrders = projectOrders.filter(order => !isOrderDeletable(order.status));
    
    if (activeOrders.length > 0) {
      return { 
        canDelete: false, 
        reason: `شما ${activeOrders.length} سفارش فعال دارید و نمی‌توانید پروژه را حذف کنید`
      };
    }

    return { canDelete: true };
  };

  const canDeleteLocation = (locationId: string): { canDelete: boolean; reason?: string } => {
    const locationProjects = projectsWithMedia.filter(p => p.location_id === locationId);
    
    if (locationProjects.length === 0) {
      return { canDelete: true };
    }

    for (const project of locationProjects) {
      const projectCheck = canDeleteProject(project);
      if (!projectCheck.canDelete) {
        return { 
          canDelete: false, 
          reason: 'شما پروژه فعال دارید و برای حذف آدرس باید تکلیف پروژه و سفارش را روشن کنید'
        };
      }
    }

    return { canDelete: true };
  };

  // פונקציות מחיקה
  const handleDeleteOrder = async (orderId: string) => {
    // Find the order
    const order = projectsWithMedia
      .flatMap(p => p.orders || [])
      .find(o => o.id === orderId);
    
    if (!order) {
      toast({
        title: 'خطا',
        description: 'سفارش یافت نشد',
        variant: 'destructive'
      });
      setDeleteOrderId(null);
      return;
    }

    // Check if order can be deleted
    if (!isOrderDeletable(order.status)) {
      toast({
        title: 'امکان حذف وجود ندارد',
        description: 'شما نمی‌توانید سفارش خود را حذف کنید چون سفارش شما تایید شده و در مراحل اجرا است',
        variant: 'destructive'
      });
      setDeleteOrderId(null);
      return;
    }

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('projects_v3')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
      
      toast({
        title: 'موفق',
        description: 'سفارش با موفقیت حذف شد'
      });
      
      setDeleteOrderId(null);
      // پروژه انتخاب‌شده را نگه می‌داریم تا کادر سفارش باز بماند
      await fetchProjectMedia();
    } catch (error) {
      console.error('خطا در حذف سفارش:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف سفارش',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    // Find the project
    const project = projectsWithMedia.find(p => p.id === projectId);
    
    if (!project) {
      toast({
        title: 'خطا',
        description: 'پروژه یافت نشد',
        variant: 'destructive'
      });
      setDeleteProjectId(null);
      return;
    }

    // Check if project can be deleted
    const { canDelete, reason } = canDeleteProject(project);
    
    if (!canDelete) {
      toast({
        title: 'امکان حذف وجود ندارد',
        description: reason || 'نمی‌توانید پروژه را حذف کنید',
        variant: 'destructive'
      });
      setDeleteProjectId(null);
      return;
    }

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('projects_hierarchy')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      
      toast({
        title: 'موفق',
        description: 'پروژه با موفقیت حذف شد'
      });
      
      setDeleteProjectId(null);
      setSelectedProject(null);
      await fetchProjectMedia();
    } catch (error) {
      console.error('خطا در حذف پروژه:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف پروژه',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    // Check if location can be deleted
    const { canDelete, reason } = canDeleteLocation(locationId);
    
    if (!canDelete) {
      toast({
        title: 'امکان حذف وجود ندارد',
        description: reason || 'نمی‌توانید آدرس را حذف کنید',
        variant: 'destructive'
      });
      setDeleteLocationId(null);
      return;
    }

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('id', locationId);
      
      if (error) throw error;
      
      toast({
        title: 'موفق',
        description: 'آدرس با موفقیت حذف شد'
      });
      
      setDeleteLocationId(null);
      setSelectedProject(null);
      
      await fetchProjectMedia();
    } catch (error) {
      console.error('خطا در حذف آدرس:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف آدرس',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
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
        toast({ 
          title: 'موفق', 
          description: `${newMedia.length} فایل با موفقیت آپلود شد و به گالری اضافه گردید.` 
        });
        
        // بستن دیالوگ آپلود
        setSelectedOrderForUpload(null);
        
        // بارگذاری مجدد داده‌ها برای نمایش رسانه‌های جدید در نقشه
        await fetchProjectMedia();
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

      let pmMedia: { id: string; project_id: string; file_path: string; file_type: string; created_at: string; mime_type?: string }[] = [];
      if (v3 && v3.length > 0) {
        const v3Ids = v3.map(x => x.id);
        const { data } = await supabase
          .from('project_media')
          .select('id, project_id, file_path, file_type, created_at, mime_type')
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
          id: m.id, 
          file_path: m.file_path, 
          file_type: m.file_type, 
          created_at: m.created_at, 
          mime_type: m.mime_type 
        });
      });

      // دریافت سفارشات
      const { data: v3Orders } = await supabase
        .from('projects_v3')
        .select('id, code, status, address, created_at, approved_at, hierarchy_project_id, subcategory:subcategories(name, code)')
        .in('hierarchy_project_id', projectIds)
        .limit(200);

      const orderMediaMap = new Map<string, HierarchyMedia[]>();
      
      // اضافه کردن media از project_media با بهینه‌سازی thumbnail
      pmMedia.forEach(m => {
        if (!orderMediaMap.has(m.project_id)) orderMediaMap.set(m.project_id, []);
        orderMediaMap.get(m.project_id)!.push({ 
          id: m.id, 
          file_path: m.file_path, 
          file_type: m.file_type, 
          created_at: m.created_at, 
          mime_type: m.mime_type 
        });
      });
      
      // اضافه کردن media از project_hierarchy_media برای سفارشات
      if (phMedia && v3Orders) {
        v3Orders.forEach(order => {
          const hierarchyProjectId = order.hierarchy_project_id;
          if (!hierarchyProjectId) return;
          
          // پیدا کردن media مربوط به این hierarchy project
          const hierarchyMedia = phMedia.filter(m => m.hierarchy_project_id === hierarchyProjectId);
          
          if (hierarchyMedia.length > 0) {
            if (!orderMediaMap.has(order.id)) orderMediaMap.set(order.id, []);
            hierarchyMedia.forEach(m => {
              orderMediaMap.get(order.id)!.push({
                id: m.id,
                file_path: m.file_path,
                file_type: m.file_type,
                created_at: m.created_at,
                mime_type: m.mime_type
              });
            });
          }
        });
      }

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
            approved_at: order.approved_at || null,
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

      // فیلتر کردن پروژه‌ها: فقط پروژه‌هایی که حداقل یک سفارش دارند نمایش داده شوند
      const filteredProjectsWithMedia = projectsWithMediaData.filter(project => 
        project.orders && project.orders.length > 0
      );

      console.debug('[HybridGlobe] Projects with media prepared:', filteredProjectsWithMedia.length);
      
      setProjectsWithMedia(filteredProjectsWithMedia);
      
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

  // آدرس‌های بدون پروژه دیگر روی نقشه نمایش داده نمی‌شوند - این قسمت حذف شده است

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
    let isDragging = false; // برای ردیابی drag کردن نقشه
    let startPos: { x: number, y: number } | null = null; // موقعیت شروع
    const LONG_PRESS_DURATION = 500; // میلی‌ثانیه
    const DRAG_THRESHOLD = 5; // حداقل حرکت برای تشخیص drag (پیکسل)


    // هندلر شروع long press (موس و تاچ)
    const startLongPress = (e: L.LeafletMouseEvent) => {
      const clickedOnMarker = (e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon');
      if (clickedOnMarker) return;

      isLongPress = false;
      isDragging = false;
      
      // ذخیره موقعیت شروع
      const mouseEvent = e.originalEvent as MouseEvent;
      const touchEvent = e.originalEvent as unknown as TouchEvent;
      
      startPos = {
        x: mouseEvent.clientX || touchEvent.touches?.[0]?.clientX || 0,
        y: mouseEvent.clientY || touchEvent.touches?.[0]?.clientY || 0
      };
      
      longPressTimer = setTimeout(() => {
        // فقط اگر کاربر drag نکرده باشد، مارکر را نشان بده
        if (!isDragging) {
          isLongPress = true;
          showAddProjectMarker(e);
        }
      }, LONG_PRESS_DURATION);
    };

    // هندلر حرکت - برای تشخیص drag
    const handleMove = (e: L.LeafletMouseEvent) => {
      if (!startPos) return;
      
      const mouseEvent = e.originalEvent as MouseEvent;
      const touchEvent = e.originalEvent as unknown as TouchEvent;
      
      const currentX = mouseEvent.clientX || touchEvent.touches?.[0]?.clientX || 0;
      const currentY = mouseEvent.clientY || touchEvent.touches?.[0]?.clientY || 0;
      
      const deltaX = Math.abs(currentX - startPos.x);
      const deltaY = Math.abs(currentY - startPos.y);
      
      // اگر بیشتر از threshold حرکت کرد، به عنوان drag شناسایی شود
      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        isDragging = true;
        clearTimeout(longPressTimer);
      }
    };

    // هندلر پایان long press
    const endLongPress = () => {
      clearTimeout(longPressTimer);
      startPos = null;
      isDragging = false;
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
      const btnId = `add-project-btn-${Date.now()}`;
      const popupContent = `
        <div style="text-align: center; padding: 8px;">
          <button 
            id="${btnId}"
            style="
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 20px;
              font-family: Vazirmatn, sans-serif;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              transition: all 0.2s ease;
              width: 100%;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)';"
          >
            ➕ افزودن پروژه در این موقعیت
          </button>
        </div>
      `;
      
      const popup = L.popup({
        closeButton: false,
        className: 'custom-add-project-popup',
        offset: [0, -40],
        autoClose: false,
        closeOnClick: false,
        autoPan: false // جلوگیری از جابجایی خودکار نقشه هنگام باز شدن کادر
      })
        .setLatLng([e.latlng.lat, e.latlng.lng])
        .setContent(popupContent)
        .openOn(map);
      
      newTempMarker.bindPopup(popup);
      
      // اضافه کردن event listener به دکمه بعد از باز شدن popup
      setTimeout(() => {
        const addBtn = document.getElementById(btnId) as HTMLButtonElement;
        if (addBtn) {
          console.log('✅ دکمه افزودن پروژه پیدا شد');
          addBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            console.log('🚀 کلیک روی دکمه - انتقال به صفحه ثبت آدرس', { lat: e.latlng.lat, lng: e.latlng.lng });
            
            // حذف مارکر موقت و popup
            if (tempMarkerRef.current) {
              map.removeLayer(tempMarkerRef.current);
              tempMarkerRef.current = null;
            }
            popup.remove();
            
            // انتقال به صفحه افزودن آدرس با مختصات
            navigate('/user/new-location', {
              state: {
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                fromMap: true
              }
            });
          };
        } else {
          console.error('❌ دکمه افزودن پروژه پیدا نشد - btnId:', btnId);
        }
      }, 200);
      
      tempMarkerRef.current = newTempMarker;
      setSelectedMapLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    // هندلر کلیک روی نقشه
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedOnMarker = (e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon');
      
      // اگر روی مارکر کلیک شد، خارج شو
      if (clickedOnMarker) {
        return;
      }

      // اگر این یک long press بود، کار ما تمام است
      if (isLongPress) {
        isLongPress = false;
        return;
      }

      // کلیک ساده برای بستن پروژه‌های انتخاب شده
      setSelectedProject(null);
      setSelectedOrderForUpload(null);
    });

    // رویدادهای long press
    map.on('mousedown', startLongPress);
    map.on('mouseup', endLongPress);
    map.on('mousemove', handleMove); // استفاده از handleMove برای تشخیص drag
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
    
    // هندلر حرکت تاچ - برای تشخیص drag
    map.getContainer().addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const point = map.containerPointToLatLng([touch.clientX, touch.clientY]);
        const leafletEvent = {
          latlng: point,
          originalEvent: e
        } as unknown as L.LeafletMouseEvent;
        handleMove(leafletEvent);
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

  // حذف مارکر موقت وقتی پروژه انتخاب می‌شود یا selectedMapLocation null می‌شود
  useEffect(() => {
    if (!selectedMapLocation && tempMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(tempMarkerRef.current);
      tempMarkerRef.current = null;
    }
  }, [selectedMapLocation]);

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

    // پاک کردن مارکرها، خطوط و مارکرهای مرکزی قبلی (اما نه آدرس‌های بدون پروژه)
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
          className: 'custom-popup center-marker-popup',
          autoPan: false // جلوگیری از جابجایی خودکار نقشه هنگام باز شدن کادر
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

        // ذخیره شناسه پروژه روی مارکر برای باز کردن مجدد پاپ‌آپ
        (marker as any).projectId = project.id;
        
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
                      <div style="overflow:hidden;border-radius:6px;background:#f9fafb;position:relative;height:160px;">
                        ${allMedia.map((m, idx) => {
                          const { data: baseData } = supabase.storage
                            .from('order-media')
                            .getPublicUrl(m.file_path);
                          const baseUrl = baseData.publicUrl;
                          const isVideo = m.file_type === 'video';
                          // استفاده از thumbnail بهینه‌شده برای عکس‌ها (عرض ۴۰۰ و کیفیت ۷۰)
                          const thumbUrl = isVideo
                            ? baseUrl
                            : supabase.storage
                                .from('order-media')
                                .getPublicUrl(m.file_path, {
                                  transform: { width: 400, quality: 70 },
                                }).data.publicUrl;
                          const showDeleteBtn = !order.approved_at;
                          
                          if (isVideo) {
                            return `
                              <div 
                                id="order-media-${order.id}-${idx}" 
                                class="order-video-item-${order.id}" 
                                data-url="${baseUrl}"
                                style="position:relative;width:100%;height:100%;background:#f0f0f0;display:${idx === 0 ? 'block' : 'none'};cursor:pointer;"
                              >
                                <video src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;user-select:none;background:#000;" preload="metadata" draggable="false" loading="lazy"></video>
                                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;">
                                  <svg style="width:28px;height:28px;color:#fff;" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                                <span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:9px;padding:2px 5px;border-radius:3px;">ویدیو</span>
                                ${showDeleteBtn ? `
                                  <button 
                                    class="delete-media-btn"
                                    data-media-id="${m.id}"
                                    data-media-path="${m.file_path}"
                                    data-order-id="${order.id}"
                                    style="position:absolute;top:4px;left:4px;background:#ef4444;color:white;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;transition:background 0.2s;pointer-events:auto;"
                                    onmouseover="this.style.background='#dc2626'"
                                    onmouseout="this.style.background='#ef4444'"
                                    onclick="event.stopPropagation();"
                                  >
                                    <svg style="width:14px;height:14px;" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                    </svg>
                                  </button>
                                ` : ''}
                              </div>
                            `;
                          } else {
                            return `
                              <div 
                                id="order-media-${order.id}-${idx}" 
                                style="position:relative;width:100%;height:100%;display:${idx === 0 ? 'block' : 'none'};"
                              >
                                <img 
                                  class="order-image-clickable"
                                  data-image-url="${baseUrl}"
                                  data-order-id="${order.id}"
                                  src="${thumbUrl}" 
                                  alt="تصویر سفارش" 
                                  style="width:100%;height:100%;object-fit:cover;cursor:pointer;user-select:none;background:#f0f0f0;"
                                  draggable="false"
                                  loading="eager"
                                  decoding="async"
                                  onerror="this.style.backgroundColor='#e0e0e0';this.alt='خطا در بارگذاری';"
                                />
                                ${showDeleteBtn ? `
                                  <button 
                                    class="delete-media-btn"
                                    data-media-id="${m.id}"
                                    data-media-path="${m.file_path}"
                                    data-order-id="${order.id}"
                                    style="position:absolute;top:4px;left:4px;background:#ef4444;color:white;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;transition:background 0.2s;"
                                    onmouseover="this.style.background='#dc2626'"
                                    onmouseout="this.style.background='#ef4444'"
                                    onclick="event.stopPropagation();"
                                  >
                                    <svg style="width:14px;height:14px;" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                    </svg>
                                  </button>
                                ` : ''}
                              </div>
                            `;
                          }
                        }).join('')}
                        
                        <!-- کادر افزودن عکس/فیلم -->
                        <div 
                          id="order-media-${order.id}-add" 
                          class="order-add-media-${order.id}"
                          data-is-add="true"
                          style="display:${allMedia.length === 0 ? 'flex' : 'none'};flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px 15px;background:linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));border:2px dashed #667eea;border-radius:6px;cursor:pointer;height:100%;"
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
                        <div style="display:flex;gap:6px;">
                          <button 
                            class="view-order-detail-${order.id}"
                            data-order-id="${order.id}"
                            data-subcategory-code="${order.subcategory?.code || ''}"
                            style="flex:1;padding:6px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:10px;font-family:inherit;"
                          >
                            مشاهده جزئیات
                          </button>
                          <button 
                            class="delete-order-btn-${order.id}"
                            data-order-id="${order.id}"
                            data-order-status="${order.status}"
                            data-order-code="${order.code}"
                            style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:10px;font-family:inherit;transition:background 0.2s;"
                            onmouseover="this.style.background='#dc2626'"
                            onmouseout="this.style.background='#ef4444'"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `
          : `
            <div style="margin-top:10px;padding:16px;background:#f9fafb;border:2px dashed #d1d5db;border-radius:12px;text-align:center;">
              <div style="font-size:24px;margin-bottom:8px;">📦</div>
              <div style="font-size:12px;color:#6b7280;margin-bottom:12px;font-family:Vazirmatn,sans-serif;">
                این پروژه هیچ سفارشی ندارد
              </div>
              <button 
                class="delete-project-btn"
                data-project-id="${project.id}"
                style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:11px;font-family:Vazirmatn,sans-serif;font-weight:600;transition:background 0.2s;"
                onmouseover="this.style.background='#dc2626'"
                onmouseout="this.style.background='#ef4444'"
              >
                🗑️ حذف پروژه
              </button>
            </div>
          `;

        const popupContent = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 260px; max-width: 340px;${count > 1 ? 'border:3px solid #667eea;border-radius:10px;' : ''}">
            ${locationHeader}
            <strong style="font-size: 13px; color: #1f2937;">${project.title || 'پروژه'}</strong><br/>
            ${project.locations?.title ? `<div style="font-size: 12px; color: #667eea; font-weight: 600; margin-top: 6px; display: block;">${project.locations.title}</div>` : ''}
            <span style="font-size: 11px; color: #6b7280; margin-top: 4px; display: block;">${project.locations?.address_line || ''}</span>
            ${count > 1 ? `<div style="margin-top:8px;padding:5px 8px;background:#f3f4f6;border-radius:6px;text-align:center;font-size:10px;color:#6b7280;">پروژه ${index + 1} از ${count}</div>` : ''}
            ${ordersHTML}
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 360,
          className: 'custom-popup',
          autoPan: false // جلوگیری از جابجایی خودکار نقشه هنگام باز شدن کادر
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
                  
                  // انتقال به صفحه جزئیات سفارش برای مشاهده فرم ثبت‌شده
                  if (orderId) {
                    window.location.href = `/orders/${orderId}`;
                  }
                });
              }

              // هندلر گالری سفارش (قبلی/بعدی + شمارنده)
              if (allMedia.length > 0) {
                const gallerySelector = `#order-gallery-${order.id} [id^="order-media-${order.id}-"]`;
                const mediaElements = Array.from(
                  popupElement.querySelectorAll<HTMLElement>(gallerySelector)
                );
                let currentIndex = 0;
                const total = mediaElements.length;

                const counterEl = popupElement.querySelector<HTMLSpanElement>(`#order-counter-${order.id}`);
                const updateGallery = () => {
                  mediaElements.forEach((el, idx) => {
                    const isAdd = (el as HTMLElement).dataset.isAdd === 'true';
                    (el as HTMLElement).style.display = idx === currentIndex ? (isAdd ? 'flex' : 'block') : 'none';
                  });
                  if (counterEl) {
                    counterEl.textContent = `${currentIndex + 1} از ${total}`;
                  }
                };

                const prevBtn = popupElement.querySelector<HTMLButtonElement>(`.order-gallery-prev-${order.id}`);
                const nextBtn = popupElement.querySelector<HTMLButtonElement>(`.order-gallery-next-${order.id}`);

                if (prevBtn) {
                  prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (total <= 1) return;
                    currentIndex = (currentIndex - 1 + total) % total;
                    updateGallery();
                  });
                }

                if (nextBtn) {
                  nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (total <= 1) return;
                    currentIndex = (currentIndex + 1) % total;
                    updateGallery();
                  });
                }

                // اطمینان از هم‌خوانی اولیه با شمارنده
                updateGallery();
              }

              // کلیک روی کادر افزودن رسانه
              const addMediaCard = popupElement.querySelector(`.order-add-media-${order.id}`) as HTMLElement | null;
              if (addMediaCard) {
                addMediaCard.addEventListener('click', (e) => {
                  e.stopPropagation();
                  setSelectedOrderForUpload(order.id);
                });
              }

              // کلیک روی تصاویر برای بزرگ‌نمایی
              const clickableImages = popupElement.querySelectorAll<HTMLImageElement>(
                `.order-image-clickable[data-order-id="${order.id}"]`
              );
              if (clickableImages.length > 0) {
                const imageUrls = Array.from(clickableImages).map(
                  (img) => img.dataset.imageUrl || img.src
                );
                clickableImages.forEach((img, idx) => {
                  img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setZoomedImages(imageUrls);
                    setZoomedImageIndex(idx);
                    setZoomedImage(imageUrls[idx]);
                  });
                });
              }

              // کلیک روی ویدیوها برای پخش در تب جدید
              const videoItems = popupElement.querySelectorAll<HTMLElement>(`#order-gallery-${order.id} .order-video-item-${order.id}`);
              if (videoItems.length > 0) {
                videoItems.forEach((item) => {
                  item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = (item as HTMLElement).dataset.url;
                    if (url && (window as any).openProjectVideo) {
                      (window as any).openProjectVideo(url, 'video/mp4');
                    } else if (url) {
                      window.open(url, '_blank');
                    }
                  });
                });
              }
            });

            // کلیک روی دکمه‌های حذف رسانه (برای همه سفارشات این پروژه)
            const deleteMediaBtns = popupElement.querySelectorAll('.delete-media-btn') as NodeListOf<HTMLButtonElement>;
            deleteMediaBtns.forEach((btn) => {
              btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const mediaId = btn.dataset.mediaId;
                const mediaPath = btn.dataset.mediaPath;

                if (!mediaId || !mediaPath) return;

                if (!confirm('آیا از حذف این رسانه اطمینان دارید؟\n\nاین عملیات قابل بازگشت نیست.')) {
                  return;
                }

                try {
                  const orderId = btn.dataset.orderId;

                  // حذف از storage (در صورت امکان)
                  const { error: storageError } = await supabase.storage
                    .from('order-media')
                    .remove([mediaPath]);

                  if (storageError) {
                    console.error('[Map] Storage deletion error:', storageError);
                  }

                  // حذف از دیتابیس
                  const { error: dbError } = await supabase
                    .from('project_media')
                    .delete()
                    .eq('id', mediaId);

                  if (dbError) {
                    console.error('[Map] DB delete error:', dbError);
                    throw dbError;
                  }

                  toast({
                    title: 'رسانه حذف شد',
                    description: 'رسانه با موفقیت حذف شد',
                  });

                  // به‌روزرسانی state تا این رسانه از سفارش‌ها حذف شود
                  if (orderId) {
                    setProjectsWithMedia((prev) =>
                      prev.map((project) => ({
                        ...project,
                        orders:
                          project.orders?.map((order) =>
                            order.id === orderId
                              ? {
                                  ...order,
                                  media: (order.media || []).filter((m) => m.id === undefined ? true : m.id !== mediaId),
                                }
                              : order
                          ) || project.orders,
                      }))
                    );
                  }

                  // فقط حذف از DOM و به‌روزرسانی گالری برای حفظ باز بودن کادر
                  const mediaElement = btn.closest('[id^="order-media-"]') as HTMLElement | null;


                  if (mediaElement) {
                    mediaElement.style.transition = 'opacity 0.3s ease';
                    mediaElement.style.opacity = '0';
                    setTimeout(() => {
                      mediaElement.remove();

                      // به‌روزرسانی گالری همان سفارش بعد از حذف
                      if (orderId) {
                        const galleryRoot = popupElement.querySelector(`#order-gallery-${orderId}`) as HTMLElement | null;
                        if (galleryRoot) {
                          const addCard = galleryRoot.querySelector<HTMLElement>(`#order-media-${orderId}-add`);
                          const counterEl = galleryRoot.querySelector<HTMLSpanElement>(`#order-counter-${orderId}`);
                          const prevBtn = galleryRoot.querySelector<HTMLButtonElement>(`.order-gallery-prev-${orderId}`);
                          const nextBtn = galleryRoot.querySelector<HTMLButtonElement>(`.order-gallery-next-${orderId}`);

                          const allSlides = Array.from(
                            galleryRoot.querySelectorAll<HTMLElement>(`[id^="order-media-${orderId}-"]`)
                          );
                          const mediaSlides = allSlides.filter((el) => el.dataset.isAdd !== 'true');

                          if (mediaSlides.length === 0) {
                            // هیچ رسانه‌ای نمانده → فقط کادر افزودن را نشان بده
                            if (addCard) addCard.style.display = 'flex';
                            if (prevBtn) prevBtn.style.display = 'none';
                            if (nextBtn) nextBtn.style.display = 'none';
                            if (counterEl) counterEl.textContent = 'بدون رسانه';
                          } else {
                            // حداقل یک رسانه باقی مانده → اولین را نشان بده و شمارنده را تنظیم کن
                            mediaSlides.forEach((el, idx) => {
                              el.style.display = idx === 0 ? 'block' : 'none';
                            });
                            if (addCard) addCard.style.display = 'none';
                            if (counterEl) {
                              const total = mediaSlides.length + (addCard ? 1 : 0);
                              counterEl.textContent = `1 از ${total}`;
                            }
                            if (prevBtn) prevBtn.style.display = '';
                            if (nextBtn) nextBtn.style.display = '';
                          }
                        }
                      }
                    }, 300);
                  }

                } catch (error: any) {
                  console.error('[Map] Error deleting media:', error);
                  toast({
                    title: 'خطا در حذف رسانه',
                    description: error?.message || 'لطفاً دوباره تلاش کنید',
                    variant: 'destructive',
                  });
                }
              });
            });

            // کلیک روی دکمه‌های حذف سفارش در این پروژه
            if (project.orders && project.orders.length > 0) {
              project.orders.forEach((order) => {
                const deleteOrderBtn = popupElement.querySelector<HTMLButtonElement>(`.delete-order-btn-${order.id}`);
                if (deleteOrderBtn) {
                  deleteOrderBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setDeleteOrderId(order.id);
                  });
                }
              });
            }
          }
          
          // هندلر حذف پروژه بدون سفارش
          if (!project.orders || project.orders.length === 0) {
            const deleteProjectBtn = popupElement.querySelector('.delete-project-btn');
            if (deleteProjectBtn) {
              deleteProjectBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('آیا از حذف این پروژه اطمینان دارید؟')) {
                  try {
                    await supabase.from('projects_hierarchy').delete().eq('id', project.id);
                    toast({ title: "پروژه حذف شد" });
                    marker.closePopup();
                    refetch();
                  } catch {
                    toast({ title: "خطا", variant: "destructive" });
                  }
                }
              });
            }
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

    // آدرس‌های بدون پروژه دیگر روی نقشه نمایش داده نمی‌شوند
    // پاک کردن مارکرهای قبلی
    locationsMarkersRef.current.forEach(marker => marker.remove());
    locationsMarkersRef.current = [];

    // اگر پروژه‌ای انتخاب شده باشد، پاپ‌آپ همان پروژه را پس از به‌روزرسانی مجدد باز نگه می‌داریم
    if (selectedProject) {
      const targetMarker = markersRef.current.find(
        (m) => (m as any).projectId === selectedProject.id
      );
      if (targetMarker) {
        targetMarker.openPopup();
      }
    }

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
  }, [projectsWithMedia, loading, mapReady, navigate, selectedProject]);

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

      {/* AlertDialog למחיקת סفארש */}
      <Dialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف سفارش</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">آیا از حذف این سفارش اطمینان دارید؟ این عملیات قابل بازگشت نیست.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOrderId(null)} disabled={isDeleting}>
              انصراف
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteOrderId && handleDeleteOrder(deleteOrderId)}
              disabled={isDeleting}
            >
              {isDeleting ? 'در حال حذف...' : 'حذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog למחיקת פרויקט */}
      <Dialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف پروژه</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">آیا از حذف این پروژه اطمینان دارید؟ این عملیات قابل بازگشت نیست.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteProjectId(null)} disabled={isDeleting}>
              انصراف
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteProjectId && handleDeleteProject(deleteProjectId)}
              disabled={isDeleting}
            >
              {isDeleting ? 'در حال حذف...' : 'حذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog למחיקת כתובת */}
      <Dialog open={!!deleteLocationId} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف آدرس</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">آיا از حذف این آدرس اطمینان دارید؟ این عملیات قابل بازگشت نیست.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteLocationId(null)} disabled={isDeleting}>
              انصراف
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteLocationId && handleDeleteLocation(deleteLocationId)}
              disabled={isDeleting}
            >
              {isDeleting ? 'در حال حذف...' : 'حذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
