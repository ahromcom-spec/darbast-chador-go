import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin, X, Plus, Camera, Video, Search, Satellite, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptimizedImage } from './OptimizedImage';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { MobileProjectPanel } from './MobileProjectPanel';
import { ServiceTypeSelectionDialog } from './ServiceTypeSelectionDialog';
import { useNavigate } from 'react-router-dom';
import { MapSearchBox } from '@/components/locations/MapSearchBox';
import { useIsMobile } from '@/hooks/use-mobile';
import { createNeshanTileLayer, NESHAN_ATTRIBUTION } from '@/lib/neshan';
import { createOSMBuildingsLayer } from '@/lib/osmBuildings';
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
  execution_stage?: string | null;
  address: string;
  created_at: string;
  approved_at?: string | null;
  subcategory?: { name: string; code: string };
  service_type?: { name: string; code: string };
  media?: HierarchyMedia[];
  is_archived?: boolean | null;
}

interface ProjectWithMedia extends ProjectHierarchy {
  media?: HierarchyMedia[];
  orders?: ProjectOrder[];
}

/** آیا این سفارش بایگانی شده است؟ فقط پرچم‌های بایگانی معتبرند، نه وضعیت اجرایی */
const isArchivedOrder = (o: any) => !!o?.is_archived || !!o?.is_deep_archived;

/** شمارش سفارش‌های فعال و بایگانی یک پروژه */
const getProjectOrderCounts = (p: ProjectWithMedia) => {
  const orders = p.orders || [];
  const archived = orders.filter(o => isArchivedOrder(o)).length;
  return { archived, active: orders.length - archived, total: orders.length };
};

/** پروژه فقط سفارش‌های تکمیل‌شده دارد؟ */
const isArchivedProject = (p: ProjectWithMedia) => {
  const { total, archived } = getProjectOrderCounts(p);
  if (total === 0) return false;
  return archived === total;
};


type MapOrderFilter = 'all' | 'active' | 'archived';

const getMarkerLocationTitle = (project: ProjectWithMedia): string => {
  const title = project.locations?.title?.trim();
  if (title) return title;
  return 'بدون عنوان';
};

interface HybridGlobeProps {
  onClose: () => void;
  /** فقط سفارش‌های در انتظار اجرا، در حال اجرا، در انتظار جمع‌آوری و در حال جمع‌آوری نمایش داده شوند */
  activeExecutionOnly?: boolean;
  /** نمایش نقشه به صورت جاسازی‌شده داخل صفحه (بدون پوشش تمام‌صفحه) */
  embedded?: boolean;
  /** باز کردن جزئیات سفارش در نمای امن گزارش روزانه */
  onViewOrderDetails?: (orderId: string) => void;
}

/** آیا سفارش در یکی از چهار وضعیت اجرایی است؟ */
const OPEN_REPAIR_STATUSES = ['pending', 'approved', 'awaiting_repair'];

const isActiveExecutionOrder = (o: any, repairOrderIds?: Set<string>) => {
  if (!o || o.status === 'rejected') return false;
  if (o.is_deep_archived) return false;
  // سفارش‌هایی که درخواست تعمیر باز دارند همیشه روی نقشه بمانند
  if (repairOrderIds?.has(o.id)) return true;
  if (o.is_archived) return false;
  // سفارش‌های در انتظار تایید مدیران هم روی نقشه اجرایی نمایش داده شوند
  if (o.status === 'pending') return true;
  if (o.execution_stage) {
    return o.execution_stage === 'awaiting_collection' || o.execution_stage === 'in_collection';
  }
  return ['approved', 'pending_execution', 'in_progress'].includes(o.status);
};

export default function HybridGlobe({ onClose, activeExecutionOnly = false, embedded = false, onViewOrderDetails }: HybridGlobeProps) {
  // رفرش همیشه به‌روز؛ در تعمیرهای داخل هندلرهای نقشه از رفر استفاده می‌کنیم تا مقدار قدیمی نشود
  const activeExecutionOnlyRef = useRef(activeExecutionOnly);
  activeExecutionOnlyRef.current = activeExecutionOnly;
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const linesRef = useRef<L.Polyline[]>([]);
  const centerMarkersRef = useRef<L.Marker[]>([]);
  const locationsMarkersRef = useRef<L.Marker[]>([]); // مرجع جداگانه برای آدرس‌های بدون پروژه
  const galleryIndexesRef = useRef<Map<string, number>>(new Map());
  const hasInitialZoomedRef = useRef(false); // برای تشخیص اولین بار زوم خودکار
  const [mapReady, setMapReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<string | null>(null);
  const [currentOrderMediaIndex, setCurrentOrderMediaIndex] = useState<Record<string, number>>({});
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; mimeType: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
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
  const [mobileSelectedProject, setMobileSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [mobileSelectedLocationProjects, setMobileSelectedLocationProjects] = useState<ProjectWithMedia[]>([]);
  const [serviceTypeDialogOpen, setServiceTypeDialogOpen] = useState(false);
  const [serviceTypeDialogLocationId, setServiceTypeDialogLocationId] = useState<string>('');
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');
  // فیلتر نمایش سفارش‌ها روی نقشه: همه / فعال / بایگانی
  const [mapOrderFilter, setMapOrderFilter] = useState<MapOrderFilter>('all');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const buildingsLayerRef = useRef<L.LayerGroup | null>(null);

  // مکان‌نمای ثابت مرکز نقشه + چسبیدن به مرکر پروژه‌های نزدیک (تا ۳ متر)
  const [centerPin, setCenterPin] = useState<{ lat: number; lng: number } | null>(null);
  const [snappedProject, setSnappedProject] = useState<ProjectWithMedia | null>(null);


  const isMobile = useIsMobile();
  const { projects: allProjects, loading, refetch } = useProjectsHierarchy();
  
  // مختصات مرکز استان قم
  const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };
  const MAX_DISTANCE_KM = 5;

  // تابع محاسبه فاصله با فرمول Haversine (کیلومتر)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // شعاع زمین به کیلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // حالت اجرایی: همه سفارش‌های شرکت (نه فقط سفارش‌های کاربر جاری)
  const [companyProjects, setCompanyProjects] = useState<ProjectHierarchy[]>([]);
  const [companyOrders, setCompanyOrders] = useState<any[]>([]);
  // سفارش‌هایی که درخواست تعمیر باز دارند (برای نمایش نشان «نیاز به تعمیر» روی نقشه)
  const [repairOrders, setRepairOrders] = useState<Record<string, string>>({});

  const fetchCompanyExecutionData = useCallback(async () => {
    try {
      const { data: ordersData, error } = await supabase
        .from('projects_v3')
        .select('id, code, status, execution_stage, address, created_at, approved_at, hierarchy_project_id, subcategory_id, location_lat, location_lng, is_archived, is_deep_archived')
        .order('created_at', { ascending: false })
        .limit(3000);

      if (error) throw error;

      // درخواست‌های تعمیر باز: این سفارش‌ها باید روی نقشه بمانند
      const { data: repairRows } = await supabase
        .from('repair_requests')
        .select('order_id, status, created_at')
        .in('status', OPEN_REPAIR_STATUSES)
        .order('created_at', { ascending: false });

      const repairRank: Record<string, number> = { pending: 1, approved: 2, awaiting_repair: 3 };
      const repairMap: Record<string, string> = {};
      (repairRows || []).forEach((r: any) => {
        const prev = repairMap[r.order_id];
        if (!prev || (repairRank[r.status] || 0) > (repairRank[prev] || 0)) repairMap[r.order_id] = r.status;
      });
      setRepairOrders(repairMap);
      const repairOrderIds = new Set(Object.keys(repairMap));

      const orders = (ordersData || []).filter((o: any) => isActiveExecutionOrder(o, repairOrderIds)).map((o: any) => ({
        ...o,
        hierarchy_project_id: o.hierarchy_project_id || `order:${o.id}`,
      }));

      const realHierarchyIds = [...new Set(
        orders
          .filter((o: any) => !String(o.hierarchy_project_id).startsWith('order:'))
          .map((o: any) => o.hierarchy_project_id as string)
      )];

      let hierarchyRows: any[] = [];
      if (realHierarchyIds.length > 0) {
        const { data: hData } = await supabase
          .from('projects_hierarchy')
          .select(`
            *,
            locations (
              title, address_line, lat, lng, province_id, district_id, is_active,
              provinces (id, name),
              districts (id, name)
            ),
            service_types_v3 (name, code),
            subcategories (name, code)
          `)
          .in('id', realHierarchyIds);
        hierarchyRows = hData || [];
      }

      const hierarchyMap = new Map(hierarchyRows.map((h: any) => [h.id, h]));
      const built = new Map<string, ProjectHierarchy>();

      orders.forEach((o: any) => {
        const pid = o.hierarchy_project_id as string;
        if (built.has(pid)) return;
        const h = hierarchyMap.get(pid);
        const lat = h?.locations?.lat ?? o.location_lat;
        const lng = h?.locations?.lng ?? o.location_lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        built.set(pid, {
          ...(h || {}),
          id: pid,
          user_id: h?.user_id || '',
          location_id: h?.location_id || '',
          service_type_id: h?.service_type_id || '',
          subcategory_id: h?.subcategory_id || o.subcategory_id || '',
          title: h?.title || o.code || 'سفارش',
          status: h?.status || 'active',
          created_at: h?.created_at || o.created_at || new Date().toISOString(),
          locations: {
            title: h?.locations?.title || undefined,
            address_line: h?.locations?.address_line || o.address || 'بدون آدرس',
            lat,
            lng,
            province_id: h?.locations?.province_id ?? null,
            district_id: h?.locations?.district_id ?? null,
            is_active: true,
            provinces: h?.locations?.provinces,
            districts: h?.locations?.districts,
          },
        } as ProjectHierarchy);
      });

      setCompanyOrders(orders);
      setCompanyProjects(Array.from(built.values()));
    } catch (e) {
      console.error('[HybridGlobe] خطا در دریافت سفارش‌های اجرایی شرکت:', e);
    }
  }, []);

  useEffect(() => {
    if (!activeExecutionOnly) return;
    fetchCompanyExecutionData();
  }, [activeExecutionOnly, fetchCompanyExecutionData]);

  // فیلتر کردن پروژه‌هایی که آدرسشان فعال است و در محدوده مجاز قرار دارند
  const userProjects = useMemo(() => {
    const activeProjects = allProjects.filter(project => 
      project.locations && 
      (project.locations as any).is_active !== false
    );

    if (activeProjects.length === 0) return [];

    // جمع‌آوری تمام موقعیت‌های پروژه‌های کاربر
    const userProjectLocations = activeProjects
      .filter(p => p.locations?.lat && p.locations?.lng)
      .map(p => ({
        lat: p.locations!.lat,
        lng: p.locations!.lng
      }));

    // اگر پروژه‌ای وجود ندارد، فقط پروژه‌های نزدیک قم را نمایش بده
    if (userProjectLocations.length === 0) {
      return activeProjects.filter(project => {
        if (!project.locations?.lat || !project.locations?.lng) return false;
        const distanceToQom = calculateDistance(
          project.locations.lat,
          project.locations.lng,
          QOM_CENTER.lat,
          QOM_CENTER.lng
        );
        return distanceToQom <= MAX_DISTANCE_KM;
      });
    }

    // فیلتر پروژه‌ها: نمایش فقط پروژه‌هایی که در شعاع 5 کیلومتری پروژه‌های کاربر یا قم هستند
    return activeProjects.filter(project => {
      if (!project.locations?.lat || !project.locations?.lng) return false;

      const projectLat = project.locations.lat;
      const projectLng = project.locations.lng;

      // بررسی فاصله از قم
      const distanceToQom = calculateDistance(
        projectLat,
        projectLng,
        QOM_CENTER.lat,
        QOM_CENTER.lng
      );
      if (distanceToQom <= MAX_DISTANCE_KM) return true;

      // بررسی فاصله از هر یک از پروژه‌های کاربر
      for (const userLoc of userProjectLocations) {
        const distanceToUserProject = calculateDistance(
          projectLat,
          projectLng,
          userLoc.lat,
          userLoc.lng
        );
        if (distanceToUserProject <= MAX_DISTANCE_KM) return true;
      }

      return false;
    });
  }, [allProjects]);

  const projects = activeExecutionOnly ? companyProjects : userProjects;

  const { toast } = useToast();
  const navigate = useNavigate();

  const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp', '3g2', 'ogv', 'ogg', 'mpeg', 'mpg']);
  const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const ALLOWED_VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/3gpp',
    'video/3gpp2',
    'video/x-matroska',
    'video/ogg',
    'video/mpeg',
  ]);
  const IMAGE_MIME_BY_EXT: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const VIDEO_MIME_BY_EXT: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    ogv: 'video/ogg',
    ogg: 'video/ogg',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
  };
  const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
  const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.3g2,.ogv,.ogg,.mpeg,.mpg';
  const ALL_MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

  const getFileExtension = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase().trim() || '';
    return extension.replace(/[^a-z0-9]/g, '');
  };

  const getUploadFileInfo = (file: File): { kind: 'image' | 'video' | null; mimeType: string; extension: string } => {
    const extension = getFileExtension(file);
    const type = (file.type || '').toLowerCase();

    if (type.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
      const mimeType = IMAGE_MIME_BY_EXT[extension] || (ALLOWED_IMAGE_MIME_TYPES.has(type) ? type : '');
      if (!mimeType) return { kind: null, mimeType: type || 'application/octet-stream', extension };

      return {
        kind: 'image',
        mimeType,
        extension: extension || 'jpg',
      };
    }

    if (ALLOWED_VIDEO_MIME_TYPES.has(type) || VIDEO_EXTENSIONS.has(extension)) {
      return {
        kind: 'video',
        mimeType: VIDEO_MIME_BY_EXT[extension] || (ALLOWED_VIDEO_MIME_TYPES.has(type) ? type : 'video/mp4'),
        extension: extension || 'mp4',
      };
    }

    return { kind: null, mimeType: type || 'application/octet-stream', extension };
  };

  const openMediaPicker = (accept: string) => {
    if (!selectedOrderForUpload || !fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.accept = accept;
    fileInputRef.current.multiple = true;
    fileInputRef.current.click();
  };

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
  // ✅ فقط سفارش‌های در انتظار تایید قابل حذف هستند
  const isOrderDeletable = (orderStatus: string): boolean => {
    return orderStatus === 'pending';
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
      const projectForOrder = projectsWithMedia.find(project => project.orders?.some(o => o.id === orderId));
      const { error } = await supabase
        .from('projects_v3')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;

      if (projectForOrder?.location_id) {
        const { count } = await supabase
          .from('projects_v3')
          .select('id', { count: 'exact', head: true })
          .eq('hierarchy_project_id', projectForOrder.id)
          .or('is_deep_archived.is.null,is_deep_archived.eq.false')
          .neq('status', 'rejected');

        await supabase
          .from('locations')
          .update({ is_active: (count ?? 0) > 0 })
          .eq('id', projectForOrder.location_id);
      }
      
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
    openMediaPicker(IMAGE_ACCEPT);
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
      let failedCount = 0;
      let skippedCount = 0;
      let lastErrorMessage = '';
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // قبول تصویر و ویدیو حتی اگر مرورگر mime-type را خالی/اشتباه بدهد
        const fileInfo = getUploadFileInfo(file);
        const isImage = fileInfo.kind === 'image';
        const isVideo = fileInfo.kind === 'video';
        
        console.log(`[Upload] File ${i + 1}/${fileArray.length}:`, file.name, 'Type:', file.type, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        if (!isImage && !isVideo) {
          console.warn('[Upload] Skipping invalid file type:', file.type);
          toast({ 
            title: 'فایل نامعتبر', 
            description: `فقط تصویر یا ویدیو قابل آپلود است: ${file.name}`, 
            variant: 'destructive' 
          });
          skippedCount++;
          continue;
        }
        
        // بررسی حجم فایل (حداکثر ۵۰ مگابایت برای ویدیو، ۱۰ مگابایت برای تصویر — همسو با محدودیت باکت)
        const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          const maxMB = isVideo ? 50 : 10;
          console.warn('[Upload] File too large:', file.size, 'bytes (max:', maxSize, 'bytes)');
          toast({ 
            title: 'حجم فایل بیش از حد', 
            description: `حداکثر ${maxMB} مگابایت مجاز است: ${file.name}`, 
            variant: 'destructive' 
          });
          skippedCount++;
          continue;
        }
        
        const filePath = `${user.id}/orders/${selectedOrderForUpload}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileInfo.extension}`;
        console.log('[Upload] Uploading to storage:', filePath);

        const startProgress = (i / fileArray.length) * 100;
        setUploadProgress(Math.round(startProgress));

        const { error: uploadErr } = await supabase.storage
          .from('project-media')
          .upload(filePath, file, { 
            contentType: fileInfo.mimeType, 
            upsert: false, 
            cacheControl: '3600'
          });
        
        const fileProgress = ((i + 1) / fileArray.length) * 100;
        setUploadProgress(Math.round(fileProgress));
        
        if (uploadErr) {
          console.error('[Upload] Storage upload error:', uploadErr);
          failedCount++;
          lastErrorMessage = uploadErr.message || 'مشکل در بارگذاری فایل';
          toast({ 
            title: 'خطا در آپلود', 
            description: lastErrorMessage, 
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
            mime_type: fileInfo.mimeType,
            file_size: file.size,
            user_id: user.id,
          })
          .select('id, file_path, file_type, created_at, mime_type')
          .single();

        if (insertErr) {
          console.error('[Upload] Database insert error:', insertErr);
          failedCount++;
          lastErrorMessage = insertErr.message || 'مشکل در ذخیره اطلاعات فایل';
          toast({ 
            title: 'خطا در ثبت', 
            description: lastErrorMessage, 
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
          description: `${newMedia.length} فایل با موفقیت آپلود شد و به گالری اضافه گردید.${failedCount + skippedCount > 0 ? ` (${failedCount + skippedCount} فایل اضافه نشد)` : ''}` 
        });

        const orderId = selectedOrderForUpload;
        const appendUploadedMedia = (projectList: ProjectWithMedia[]): ProjectWithMedia[] =>
          projectList.map(project => {
            const hasTargetOrder = project.orders?.some(order => order.id === orderId) || false;
            return {
              ...project,
              media: hasTargetOrder ? [...(project.media || []), ...newMedia] : project.media,
              orders: project.orders?.map(order =>
                order.id === orderId
                  ? { ...order, media: [...(order.media || []), ...newMedia] }
                  : order
              ) || project.orders,
            };
          });

        setProjectsWithMedia(prev => appendUploadedMedia(prev));
        setMobileSelectedProject(prev => prev ? appendUploadedMedia([prev])[0] : prev);
        setMobileSelectedLocationProjects(prev => appendUploadedMedia(prev));
        
        // بستن دیالوگ آپلود
        setSelectedOrderForUpload(null);
        
        // بارگذاری مجدد داده‌ها برای نمایش رسانه‌های جدید در نقشه
        await fetchProjectMedia();
      } else {
        toast({ 
          title: 'آپلود ناموفق', 
          description: lastErrorMessage || (skippedCount > 0 ? 'فایل انتخاب‌شده مجاز نبود یا حجم آن بیش از حد مجاز بود.' : 'فرمت فایل نامعتبر بود یا خطای موقت رخ داد.'), 
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
      setProjectsWithMedia([]);
      return;
    }

    console.debug('[HybridGlobe] Fetching media for', projects.length, 'projects');
    
    try {
      const projectIds = projects.map(p => p.id);

      let v3OrdersAll: any[] = [];
      if (activeExecutionOnly) {
        // همه سفارش‌های اجرایی شرکت
        v3OrdersAll = companyOrders;
      } else {
        // دریافت سفارشات با استفاده از تابع امنیتی تا RLS جلوی نمایش را نگیرد
        const { data: v3RpcDataFirst, error: v3ErrFirst } = await supabase
          .rpc('get_my_projects_v3');

        if (v3ErrFirst) {
          console.error('[HybridGlobe] Error fetching orders via RPC:', v3ErrFirst);
        }
        v3OrdersAll = (v3RpcDataFirst as any[] | null) ?? [];
      }

      // فقط سفارش‌هایی که به پروژه‌های فعلی روی نقشه تعلق دارند
      const v3OrdersFiltered = v3OrdersAll.filter(o => {
        if (!o.hierarchy_project_id || !projectIds.includes(o.hierarchy_project_id) || o.status === 'rejected') return false;
        if (!activeExecutionOnly) {
          if (mapOrderFilter === 'active' && isArchivedOrder(o)) return false;
          if (mapOrderFilter === 'archived' && !isArchivedOrder(o)) return false;
          return true;
        }
        // companyOrders پیش‌تر با وضعیت سفارش و درخواست تعمیر فیلتر شده است.
        // بررسی دوباره repairOrders در اینجا باعث چرخه واکشی و بازسازی مداوم مارکرها می‌شد.
        return true;
      });


      const projectIdsWithActiveOrders = new Set(
        v3OrdersFiltered.map((o: any) => o.hierarchy_project_id).filter(Boolean)
      );

      if (projectIdsWithActiveOrders.size === 0) {
        setProjectsWithMedia([]);
        return;
      }

      const visibleProjectIds = projectIds.filter(id => projectIdsWithActiveOrders.has(id));

      // فقط سفارش‌های مربوط به همین پروژه‌های روی نقشه را برای رسانه بگیریم تا بارگذاری سریع بماند
      const visibleOrderIds = v3OrdersFiltered.map(o => o.id);
      
      // دریافت موازی داده‌ها برای سرعت بیشتر
      console.debug('[HybridGlobe] Querying project_media for visible order IDs:', visibleOrderIds.slice(0, 5), '... total:', visibleOrderIds.length);
      
      const [phMediaResult, pmMediaResult] = await Promise.all([
        supabase
          .from('project_hierarchy_media')
          .select('id, hierarchy_project_id, file_path, file_type, created_at, mime_type')
          .in('hierarchy_project_id', visibleProjectIds)
          .in('file_type', ['image', 'video'])
          .order('created_at', { ascending: false })
          .limit(1000),
        
        visibleOrderIds.length > 0
          ? supabase
              .from('project_media')
              .select('id, project_id, file_path, file_type, created_at, mime_type')
              .in('project_id', visibleOrderIds)
              .in('file_type', ['image', 'video'])
              .order('created_at', { ascending: false })
              .limit(2000)
          : Promise.resolve({ data: [] as any[], error: null })
      ]);

      // Log any errors from queries
      if (phMediaResult.error) {
        console.error('[HybridGlobe] Error fetching hierarchy media:', phMediaResult.error);
      }
      if ((pmMediaResult as any).error) {
        console.error('[HybridGlobe] Error fetching project media:', (pmMediaResult as any).error);
      }

      const phMedia = phMediaResult.data || [];
      const pmMedia = (pmMediaResult as any).data || [];

      console.debug('[HybridGlobe] Hierarchy media fetched:', phMedia?.length || 0);
      console.debug('[HybridGlobe] Project media fetched:', pmMedia.length);
      console.debug('[HybridGlobe] Visible order IDs for media query:', visibleOrderIds.length);
      console.debug('[HybridGlobe] Sample pmMedia:', pmMedia.slice(0, 3));

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

      pmMedia.forEach((m: any) => {
        const order = v3OrdersFiltered.find((v: any) => v.id === m.project_id);
        if (!order) return;
        const pid = order.hierarchy_project_id;
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

      const orderMediaMap = new Map<string, HierarchyMedia[]>();
      
      // اضافه کردن media از project_media با بهینه‌سازی thumbnail
      pmMedia.forEach((m: any) => {
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
      if (phMedia && v3OrdersFiltered) {
        v3OrdersFiltered.forEach((order: any) => {
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

      // واکشی نام نوع خدمات و زیرمجموعه برای سفارش‌ها (subcategory / service_type)
      const subIds = Array.from(new Set(v3OrdersFiltered.map((o: any) => o.subcategory_id).filter(Boolean)));
      const stIds = Array.from(new Set(v3OrdersFiltered.map((o: any) => o.service_type_id).filter(Boolean)));
      const [subRes, stRes] = await Promise.all([
        subIds.length > 0
          ? supabase.from('subcategories').select('id, name, code').in('id', subIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        stIds.length > 0
          ? supabase.from('service_types_v3').select('id, name, code').in('id', stIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      const subMap = new Map<string, { name: string; code: string }>(
        ((subRes as any).data || []).map((s: any) => [s.id, { name: s.name, code: s.code }])
      );
      const stMap = new Map<string, { name: string; code: string }>(
        ((stRes as any).data || []).map((s: any) => [s.id, { name: s.name, code: s.code }])
      );

      const ordersByProject = new Map<string, ProjectOrder[]>();
      if (v3OrdersFiltered) {
        v3OrdersFiltered.forEach((order: any) => {
          if (!order.hierarchy_project_id) return;
          if (!ordersByProject.has(order.hierarchy_project_id)) {
            ordersByProject.set(order.hierarchy_project_id, []);
          }
          ordersByProject.get(order.hierarchy_project_id)!.push({
            id: order.id,
            code: order.code,
            status: order.status,
            execution_stage: order.execution_stage ?? null,
            address: order.address,
            created_at: order.created_at,
            approved_at: order.approved_at || null,
            is_archived: isArchivedOrder(order),
            subcategory: order.subcategory || (order.subcategory_id ? subMap.get(order.subcategory_id) : undefined),
            service_type: order.service_type || (order.service_type_id ? stMap.get(order.service_type_id) : undefined),
            media: orderMediaMap.get(order.id) || []
          });
        });
      }

      // ترکیب نهایی با بهینه‌سازی
      const projectsWithMediaData: ProjectWithMedia[] = projects
        .filter(project => projectIdsWithActiveOrders.has(project.id))
        .map(project => {
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
  }, [projects, activeExecutionOnly, companyOrders, mapOrderFilter]);

  // دریافت درخواست‌های تعمیر باز برای سفارش‌های نمایش‌داده‌شده روی نقشه
  useEffect(() => {
    if (activeExecutionOnly) return; // در حالت اجرایی، هنگام دریافت سفارش‌ها گرفته می‌شود
    const orderIds = projectsWithMedia.flatMap(p => (p.orders || []).map(o => o.id));
    if (orderIds.length === 0) {
      setRepairOrders({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('repair_requests')
        .select('order_id, status, created_at')
        .in('order_id', orderIds)
        .in('status', ['pending', 'approved', 'awaiting_repair'])
        .order('created_at', { ascending: false });
      if (cancelled || error) return;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        // اولویت نمایش: در انتظار تعمیر > تایید شده > در انتظار تایید
        const rank: Record<string, number> = { pending: 1, approved: 2, awaiting_repair: 3 };
        const prev = map[r.order_id];
        if (!prev || (rank[r.status] || 0) > (rank[prev] || 0)) map[r.order_id] = r.status;
      });
      setRepairOrders(map);
    })();
    return () => { cancelled = true; };
  }, [projectsWithMedia, activeExecutionOnly]);

  // آدرس‌های بدون پروژه دیگر روی نقشه نمایش داده نمی‌شوند - این قسمت حذف شده است

  // پروژه از پلتفرم نقشه ایرانی نشان استفاده می‌کند؛ نیازی به توکن Mapbox نیست.

  useEffect(() => {
    fetchProjectMedia();
  }, [fetchProjectMedia]);

  useEffect(() => {
    let initTimeout: ReturnType<typeof setTimeout>;
    const MAX_INIT_ATTEMPTS = 40; // تا حدود ۶ ثانیه صبر می‌کند تا container آماده شود
    // تلاش برای مقداردهی اولیه نقشه؛ اگر container هنوز اندازه ندارد، دوباره تلاش می‌کند
    // (قبلاً فقط یک‌بار چک می‌شد و اگر container آماده نبود، نقشه هرگز ساخته نمی‌شد)
    const attemptInitMap = (attempt: number = 0) => {
      if (!mapContainer.current || mapRef.current) return;

      let map: L.Map;
      
      try {
        console.log('[Map] Initializing Leaflet map...');
        
        // بررسی پشتیبانی از Leaflet
        if (typeof L === 'undefined') {
          console.error('[Map] Leaflet library not loaded');
          toast({
            title: 'خطای نقشه',
            description: 'کتابخانه نقشه بارگذاری نشد. لطفاً صفحه را رفرش کنید.',
            variant: 'destructive'
          });
          return;
        }

        // بررسی اندازه container قبل از ایجاد نقشه
        const containerRect = mapContainer.current.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
          if (attempt < MAX_INIT_ATTEMPTS) {
            console.warn('[Map] Container has zero dimensions, retrying...', attempt);
            initTimeout = setTimeout(() => attemptInitMap(attempt + 1), 150);
          } else {
            console.error('[Map] Container never got a size after multiple attempts');
            toast({
              title: 'خطای نقشه',
              description: 'نقشه بارگذاری نشد. لطفاً صفحه را رفرش کنید.',
              variant: 'destructive'
            });
          }
          return;
        }


        // ایجاد نقشه با نمای بازتر از ایران تا کل کشور در نگاه اول دیده شود
        map = L.map(mapContainer.current, {
          center: [32.4279, 53.6880],
          zoom: 6,
          minZoom: 4,
          maxZoom: 22,
          scrollWheelZoom: true,
          zoomControl: false,
          preferCanvas: true, // استفاده از Canvas برای عملکرد بهتر
          renderer: L.canvas({ tolerance: 5 }), // بهینه‌سازی رندرینگ
          trackResize: true,
          // تنظیمات اضافی برای سازگاری بهتر
          attributionControl: false,
          fadeAnimation: true,
          zoomAnimation: true,
          markerZoomAnimation: true,
        });

        mapRef.current = map;
        console.log('[Map] Leaflet map initialized successfully');
      } catch (error) {
        console.error('[Map] Error initializing map:', error);
        toast({
          title: 'خطای نقشه',
          description: 'نقشه قابل اجرا نیست. لطفاً مرورگر خود را به‌روزرسانی کنید.',
          variant: 'destructive'
        });
        return;
      }

    if (!map) return;

    // لایه تایل Mapbox (از طریق adapter در src/lib/neshan.ts)
    let tileLayerAdded = false;
    try {
      const layer = createNeshanTileLayer('standard-day', {
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4,
        errorTileUrl: '',
      }).addTo(map);
      tileLayerRef.current = layer;
      tileLayerAdded = true;

      layer.on('tileerror', (e) => {
        console.error('[Map] Tile load error:', e);
      });

      console.log('[Map] Mapbox tile layer added successfully');

      // لایه برداری ساختمان‌ها/قواره‌بندی از OSM Overpass
      // در زوم نزدیک (>=17) خودکار polygon ساختمان‌ها را روی نقشه می‌کشد
      // تا قواره‌بندی همه‌جا (که در داده OSM وجود دارد) دیده شود.
      try {
        const buildings = createOSMBuildingsLayer().addTo(map);
        buildingsLayerRef.current = buildings;
      } catch (err) {
        console.warn('[Map] Failed to add OSM buildings overlay:', err);
      }
    } catch (err) {
      console.warn('[Map] Failed to add Mapbox tile layer:', err);
    }
    
    if (!tileLayerAdded) {
      console.error('[Map] All tile layers failed to load');
      toast({
        title: 'خطای بارگذاری نقشه',
        description: 'تایل‌های نقشه قابل بارگذاری نیستند. لطفاً اتصال اینترنت خود را بررسی کنید.',
        variant: 'destructive'
      });
    }

    // اضافه کردن لایه قواره ساختمان‌ها از OpenStreetMap برای ایران و قم
    const fetchBuildingsLayer = async () => {
      // بررسی سطح زوم - فقط در زوم بالا قواره‌ها را نمایش بده
      if (map.getZoom() < 15) return;
      
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      
      // بررسی اینکه آیا در محدوده ایران هستیم (تقریبی)
      const isInIran = center.lat >= 25 && center.lat <= 40 && center.lng >= 44 && center.lng <= 63;
      if (!isInIran) return;
      
      const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
      
      // Overpass API برای دریافت قواره ساختمان‌ها
      const query = `[out:json][timeout:10];
        (
          way["building"](${bbox});
        );
        out geom;`;
      
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        // حذف لایه قبلی
        map.eachLayer((layer) => {
          if ((layer as any)._buildingLayer) {
            map.removeLayer(layer);
          }
        });
        
        // ایجاد polygons برای هر ساختمان
        if (data.elements && data.elements.length > 0) {
          data.elements.forEach((element: any) => {
            if (element.type === 'way' && element.geometry) {
              const coords = element.geometry.map((node: any) => [node.lat, node.lon]);
              if (coords.length > 2) {
                const polygon = L.polygon(coords, {
                  color: '#999999',
                  weight: 0.5,
                  fillColor: '#d4d4d4',
                  fillOpacity: 0.7,
                  interactive: false
                }).addTo(map);
                (polygon as any)._buildingLayer = true;
              }
            }
          });
          console.log(`[Map] Added ${data.elements.length} building footprints`);
        }
      } catch (error) {
        console.warn('[Map] Could not fetch buildings:', error);
      }
    };

    // فراخوانی اولیه و با تغییر زوم
    let buildingFetchTimeout: ReturnType<typeof setTimeout>;
    const debouncedFetchBuildings = () => {
      clearTimeout(buildingFetchTimeout);
      buildingFetchTimeout = setTimeout(fetchBuildingsLayer, 500);
    };
    
    map.on('zoomend', debouncedFetchBuildings);
    map.on('moveend', debouncedFetchBuildings);

    // بستن popup با debounce
    let longPressTimer: NodeJS.Timeout;
    let isLongPress = false;
    let isDragging = false; // برای ردیابی drag کردن نقشه
    let startPos: { x: number, y: number } | null = null; // موقعیت شروع
    const LONG_PRESS_DURATION = 750; // 0.75 ثانیه (750 میلی‌ثانیه) برای نگه‌داشتن ثابت
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
      // در تب «لوکیشن اجرایی پروژه» افزودن پروژه و انتخاب محل از روی نقشه لازم نیست
      if (activeExecutionOnlyRef.current) return;
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

      // کلیک ساده برای بستن پروژه‌های انتخاب شده و جمع کردن همه cluster ها
      setSelectedProject(null);
      setSelectedOrderForUpload(null);
      setExpandedClusters(new Set()); // جمع کردن همه پروژه‌ها

      // حذف مارکر موقت افزودن پروژه اگر وجود دارد
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
        setSelectedMapLocation(null);
      }
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
    };

    initTimeout = setTimeout(() => attemptInitMap(0), 50);


    return () => {
      clearTimeout(initTimeout);
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
    
    if (!mapRef.current || !mapReady || loading) {
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

    if (projectsWithMedia.length === 0) {
      console.debug('[HybridGlobe] No active-order projects to display');
      locationsMarkersRef.current.forEach(marker => marker.remove());
      locationsMarkersRef.current = [];
      return;
    }

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

    // زمان آخرین ویدیوی آپلود شده برای یک پروژه (بین همه سفارش‌های آن پروژه)
    const getProjectLatestVideoTime = (project: ProjectWithMedia) => {
      let latest = -Infinity;
      (project.orders || []).forEach(order => {
        (order.media || []).forEach(m => {
          if (m.file_type === 'video') {
            const t = new Date(m.created_at).getTime();
            if (t > latest) latest = t;
          }
        });
      });
      return latest;
    };

    Object.values(locationGroups).forEach(group => {
      // پروژه‌ای که آخرین‌بار ویدیو برایش آپلود شده، اول قرار می‌گیرد
      // تا در حالت خوشه‌ای (جمع‌شده روی نقشه) همان‌طور نمایش داده شود
      group.sort((a, b) => getProjectLatestVideoTime(b) - getProjectLatestVideoTime(a));
      const count = group.length;
      const firstProject = group[0];
      const centerLat = firstProject.locations!.lat;
      const centerLng = firstProject.locations!.lng;
      const clusterKey = centerLat.toFixed(6) + '_' + centerLng.toFixed(6);
      // اگر همه پروژه‌های این نقطه تکمیل‌شده باشند، نقطه با رنگ ملایم نمایش داده می‌شود
      const groupArchived = group.every(p => isArchivedProject(p));
      const clusterDotColor = groupArchived ? '#94a3b8' : '#ef4444';
      const clusterDotShadow = groupArchived ? 'rgba(148,163,184,0.5)' : 'rgba(239, 68, 68, 0.5)';

      // برای همه موقعیت‌ها (چه تکی چه چندتایی) نقطه مرکزی قرمز اضافه کنیم
      // ایجاد نقطه مرکزی قرمز کوچک
      const clusterIcon = L.divIcon({
        className: 'cluster-marker-icon',
        html: `
          <div style="
            position: relative;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${clusterDotColor};
              border: 2px solid white;
              box-shadow: 0 2px 8px ${clusterDotShadow};
              cursor: pointer;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.transform='scale(1.15)'"
            onmouseout="this.style.transform='scale(1)'"
            >
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10],
      });
      
      const centerMarker = L.marker([centerLat, centerLng], { 
        icon: clusterIcon,
        zIndexOffset: 1000 // مارکر مرکزی بالاتر از بقیه باشد
      }).addTo(mapRef.current!);
      
      // محاسبه تعداد نوع خدمات متفاوت (بر اساس subcategory_id یکتا)
      const uniqueServiceTypes = new Set(
        group.map(p => p.subcategory_id || 'unknown')
      ).size;
      
      if (count > 1) {
        // کلیک روی نقطه مرکزی: مارکرها را به صورت پخش‌شده (fan) نمایش بده
        // بدون باز کردن کادر لیست؛ کاربر مستقیماً مارکر سفارش موردنظر را انتخاب می‌کند
        centerMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (expandedClusters.has(clusterKey)) return;

          const newExpanded = new Set(expandedClusters);
          newExpanded.add(clusterKey);
          setExpandedClusters(newExpanded);

          // مخفی کردن نقطه قرمز مرکزی پس از پخش شدن
          centerMarker.setOpacity(0);
          centerMarker.closePopup();

          // انیمیشن حرکت مارکرها به موقعیت نهایی
          markersRef.current.forEach((m) => {
            if ((m as any).clusterKey === clusterKey) {
              const tLat = (m as any).targetLat;
              const tLng = (m as any).targetLng;
              if (typeof tLat === 'number' && typeof tLng === 'number') {
                setTimeout(() => {
                  m.setLatLng([tLat, tLng]);
                  m.setOpacity(1);
                }, 80);
              }
            }
          });

          // نمایش خطوط اتصال
          linesRef.current.forEach((line) => {
            if ((line as any).clusterKey === clusterKey) {
              setTimeout(() => line.setStyle({ opacity: 0.7 }), 80);
            }
          });
        });
      } else {

        // برای پروژه تکی، نقطه قرمز را کلیک‌پذیر کن تا popup پروژه باز شود
        (centerMarker as any).singleProjectId = firstProject.id;
        centerMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedProject(firstProject);
          setSelectedOrderForUpload(null);
          setSelectedMapLocation(null);
        });
      }
      
      centerMarkersRef.current.push(centerMarker);
      (centerMarker as any).clusterKey = clusterKey;

      group.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        
        // محاسبه آفست برای مارکرهای چندگانه در یک آدرس
        let targetLat = centerLat;
        let targetLng = centerLng;
        let lat = centerLat;
        let lng = centerLng;
        
        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          
          // فاصله دایره‌ای بر اساس پیکسل تا در همه سطوح زوم، جدا ولی نزدیک به مرکز باشد
          let targetLatLng: L.LatLngExpression = [centerLat, centerLng];
          if (mapRef.current) {
            const map = mapRef.current;
            const centerPoint = map.latLngToLayerPoint(L.latLng(centerLat, centerLng));
            // فاصله پایه تقریباً هم‌اندازه مارکر + کمی بیشتر
            const baseRadiusPx = 40;
            // اگر پروژه‌های بیشتری باشد کمی فاصله را بیشتر کن تا روی هم نیفتند
            const adaptiveRadiusPx = baseRadiusPx + Math.min(count, 6) * 4;
            const dx = adaptiveRadiusPx * Math.cos(angle);
            const dy = adaptiveRadiusPx * Math.sin(angle);
            const targetPoint = L.point(centerPoint.x + dx, centerPoint.y + dy);
            targetLatLng = map.layerPointToLatLng(targetPoint);
          } else {
            // حالت پشتیبان در صورت نبودن mapRef (بر اساس درجه جغرافیایی)
            const radiusDeg = 0.0002;
            targetLatLng = [
              centerLat + radiusDeg * Math.cos(angle),
              centerLng + radiusDeg * Math.sin(angle),
            ];
          }

          targetLat = (targetLatLng as any).lat;
          targetLng = (targetLatLng as any).lng;
          
          // اگر cluster قبلاً expand شده، مارکر را در موقعیت نهایی بگذار
          if (expandedClusters.has(clusterKey)) {
            lat = targetLat;
            lng = targetLng;
          } else {
            // در حالت جمع شده: مارکرها زیر نقطه مرکزی به صورت متراکب قرار گیرند
            const stackOffset = index * 0.00003; // آفست کوچک برای ایجاد افکت تراکم
            lat = centerLat + stackOffset;
            lng = centerLng + stackOffset * 0.8;
          }

          // اضافه کردن خط اتصال از پروژه به مرکز
          const line = L.polyline(
            [[targetLat, targetLng], [centerLat, centerLng]],
            {
              color: '#3b82f6',
              weight: 2,
              opacity: expandedClusters.has(clusterKey) ? 0.7 : 0, // نمایش خط اگر expand شده
              dashArray: '8, 12',
              className: 'connection-line'
            }
          ).addTo(mapRef.current!);
          linesRef.current.push(line);
          (line as any).clusterKey = clusterKey;
        }

        let iconToUse: any = projectIcon;
        // پیدا کردن آخرین ویدیو/عکس آپلود شده در بین همه سفارشات این پروژه (بر اساس زمان واقعی آپلود، نه ترتیب سفارش)
        let firstOrderImage: HierarchyMedia | undefined;
        let firstOrderVideo: any = null;
        let totalOrderImages = 0;
        
        if (project.orders && project.orders.length > 0) {
          let latestVideoTime = -Infinity;
          let latestImageTime = -Infinity;
          for (const order of project.orders) {
            const orderImages = (order.media || []).filter(m => m.file_type === 'image');
            const orderVideos = (order.media || []).filter(m => m.file_type === 'video');
            totalOrderImages += orderImages.length;
            orderImages.forEach(img => {
              const t = new Date(img.created_at).getTime();
              if (t > latestImageTime) {
                latestImageTime = t;
                firstOrderImage = img;
              }
            });
            orderVideos.forEach(vid => {
              const t = new Date(vid.created_at).getTime();
              if (t > latestVideoTime) {
                latestVideoTime = t;
                firstOrderVideo = vid;
              }
            });
          }
          
          console.debug('[HybridGlobe] Project marker:', project.id, 
            'orders:', project.orders.length, 
            'totalImages:', totalOrderImages, 
            'hasFirstImage:', !!firstOrderImage,
            'hasLatestVideo:', !!firstOrderVideo);
        }
        
        // عنوان موقعیت برای نمایش بالای مارکر (عنوان آدرس؛ نه آدرس کامل)
        const addressTitle = getMarkerLocationTitle(project).substring(0, 20);

        // وضعیت تعمیر این پروژه (بر اساس سفارش‌هایش)
        const repairStatuses = (project.orders || [])
          .map(o => repairOrders[o.id])
          .filter(Boolean) as string[];
        const repairRank: Record<string, number> = { pending: 1, approved: 2, awaiting_repair: 3 };
        const topRepairStatus = repairStatuses.sort(
          (a, b) => (repairRank[b] || 0) - (repairRank[a] || 0)
        )[0];
        const repairLabels: Record<string, string> = {
          pending: 'تعمیر: در انتظار تایید',
          approved: 'تعمیر: تایید شده',
          awaiting_repair: 'در انتظار تعمیر داربست',
        };
        const repairColors: Record<string, string> = {
          pending: 'rgba(234,179,8,0.95)',
          approved: 'rgba(37,99,235,0.95)',
          awaiting_repair: 'rgba(249,115,22,0.97)',
        };
        const repairBadgeHtml = topRepairStatus
          ? `<div style="
              background:${repairColors[topRepairStatus]};
              color:#fff;
              padding:3px 7px;
              border-radius:6px;
              font-family:Vazirmatn, sans-serif;
              font-size:9px;
              font-weight:700;
              white-space:nowrap;
              text-align:center;
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
              margin-bottom:3px;
              direction:rtl;
            ">🔧 ${repairLabels[topRepairStatus]}</div>`
          : '';

        const projectArchived = isArchivedProject(project);
        const orderCounts = getProjectOrderCounts(project);
        const labelGradient = projectArchived
          ? 'linear-gradient(135deg, rgba(100,116,139,0.95) 0%, rgba(71,85,105,0.95) 100%)'
          : 'linear-gradient(135deg, rgba(59,130,246,0.95) 0%, rgba(37,99,235,0.95) 100%)';
        const statusChip = (bg: string, text: string) => `<div style="
              background:${bg};
              color:#fff;
              padding:3px 7px;
              border-radius:6px;
              font-family:Vazirmatn, sans-serif;
              font-size:9px;
              font-weight:700;
              white-space:nowrap;
              text-align:center;
              box-shadow:0 2px 8px rgba(0,0,0,0.25);
              margin-bottom:3px;
              direction:rtl;
            ">${text}</div>`;
        const pendingCount = (project.orders || []).filter(
          (o: any) => o.status === 'pending' && !o.is_archived
        ).length;
        const pendingBadgeHtml = pendingCount > 0
          ? statusChip('rgba(234,179,8,0.97)', `⏳ در انتظار تایید مدیران${pendingCount > 1 ? ` (${pendingCount})` : ''}`)
          : '';
        const archivedBadgeHtml = orderCounts.total === 0
          ? ''
          : pendingBadgeHtml + [
              // واژه «فعال» روی مارکرهای تب لوکیشن اجرایی پروژه (گزارش روزانه) نمایش داده نمی‌شود
              orderCounts.active > 0 && !activeExecutionOnly
                ? statusChip('rgba(37,99,235,0.95)', `● فعال${orderCounts.archived > 0 ? ` (${orderCounts.active})` : ''}`)
                : '',
              orderCounts.archived > 0
                ? statusChip('rgba(100,116,139,0.95)', `✓ بایگانی شده${orderCounts.active > 0 ? ` (${orderCounts.archived})` : ''}`)
                : '',
            ].join('');


        const addressLabelHtml = `
          <div style="
            position:absolute;
            bottom:100%;
            left:50%;
            transform:translateX(-50%);
            display:flex;
            flex-direction:column;
            align-items:center;
            margin-bottom:4px;
            z-index:10;
          ">
            ${repairBadgeHtml}
            ${archivedBadgeHtml}
            <div style="
              background:${labelGradient};
              color:white;
              padding:4px 8px;
              border-radius:6px;
              font-family:Vazirmatn, sans-serif;
              font-size:10px;
              font-weight:600;
              white-space:nowrap;
              max-width:120px;
              overflow:hidden;
              text-overflow:ellipsis;
              text-align:center;
              box-shadow:0 2px 8px rgba(0,0,0,0.25);
              direction:rtl;
            ">${addressTitle}</div>
          </div>
        `;

        
        if (firstOrderVideo) {
          // اگر ویدیو وجود دارد، ویدیو را روی مارکر نمایش بده
          const videoUrl = supabase.storage
            .from('project-media')
            .getPublicUrl(firstOrderVideo.file_path).data.publicUrl;
          
          console.debug('[HybridGlobe] Marker video URL:', videoUrl);
          
          const html = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
              ${addressLabelHtml}
              <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.35);border:2px solid #fff;background:#000;position:relative;">
                <video src="${videoUrl}" autoplay muted playsinline preload="auto"
                  ontimeupdate="if(this.currentTime>=6){this.currentTime=0;this.play().catch(()=>{});}"
                  onended="this.currentTime=0;this.play().catch(()=>{});"
                  style="width:100%;height:100%;object-fit:cover;pointer-events:none;">
                </video>
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));height:18px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:10px;font-weight:bold;">${totalOrderImages}</span>
                </div>
              </div>
            </div>`;
          iconToUse = L.divIcon({
            html,
            className: 'project-thumb-icon',
            iconSize: [56, 80],
            iconAnchor: [28, 80],
            popupAnchor: [0, -80],
          });
        } else if (firstOrderImage) {
          const url1 = supabase.storage
            .from('project-media')
            .getPublicUrl(firstOrderImage.file_path).data.publicUrl;
          
          console.debug('[HybridGlobe] Marker thumbnail URL:', url1);
          
          const html = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
              ${addressLabelHtml}
              <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.35);border:2px solid ${projectArchived ? '#94a3b8' : '#fff'};background:#f0f0f0;position:relative;${projectArchived ? 'filter:grayscale(0.45) saturate(0.7);' : ''}">
                <img src="${url1}" alt="تصویر پروژه" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/>
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));height:18px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:10px;font-weight:bold;">${totalOrderImages}</span>
                </div>
              </div>
            </div>`;
          iconToUse = L.divIcon({
            html,
            className: 'project-thumb-icon',
            iconSize: [56, 80],
            iconAnchor: [28, 80],
            popupAnchor: [0, -80],
          });
        } else {
          // استفاده از لوگوی اهرم به عنوان تصویر پیش‌فرض برای پروژه‌های بدون عکس
          console.debug('[HybridGlobe] No image found for project, using default logo:', project.id);
          
          const defaultLogoHtml = `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
              ${addressLabelHtml}
              <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.35);border:2px solid #d97706;background:linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);position:relative;display:flex;align-items:center;justify-content:center;">
                <img src="/ahrom-logo.png" alt="لوگوی اهرم" loading="lazy" style="width:44px;height:44px;object-fit:contain" onerror="this.style.display='none'"/>
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(217,119,6,0.8));height:16px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:9px;font-weight:bold;">بدون عکس</span>
                </div>
              </div>
            </div>`;
          iconToUse = L.divIcon({
            html: defaultLogoHtml,
            className: 'project-thumb-icon project-no-image',
            iconSize: [56, 80],
            iconAnchor: [28, 80],
            popupAnchor: [0, -80],
          });
        }

        const marker = L.marker([lat, lng], { 
          icon: iconToUse,
          // پروژه‌ای که آخرین ویدیو را دارد (اولین عضو گروه پس از مرتب‌سازی) همیشه کامل و بالای پشته دیده می‌شود
          opacity: count > 1 ? (expandedClusters.has(clusterKey) ? 1 : (index === 0 ? 1 : 0.85 - (index * 0.12))) : 1,
          zIndexOffset: count > 1 && !expandedClusters.has(clusterKey) ? (count - index) * 10 : 0
        }).addTo(mapRef.current!);

        // ذخیره شناسه پروژه و اطلاعات cluster روی مارکر
        (marker as any).projectId = project.id;
        (marker as any).clusterKey = clusterKey;
        (marker as any).targetLat = targetLat;
        (marker as any).targetLng = targetLng;
        (marker as any).isInCluster = count > 1;
        
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
                      const url = supabase.storage.from('project-media').getPublicUrl(m.file_path).data.publicUrl;
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
                    const url = supabase.storage.from('project-media').getPublicUrl(m.file_path).data.publicUrl;
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

        // دکمه افزودن خدمات جدید بیرون از کادر با خط اتصال به نقطه قرمز
        const addNewServiceHTML = project.location_id ? `
          <div style="position:relative;margin-top:16px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
            <!-- نقطه قرمز با خط اتصال -->
            <div style="position:relative;display:flex;align-items:center;">
              <div style="width:16px;height:16px;background:#ef4444;border-radius:50%;border:3px solid #fecaca;box-shadow:0 0 8px rgba(239,68,68,0.5);flex-shrink:0;"></div>
              <div style="width:24px;height:2px;background:linear-gradient(90deg, #ef4444, #8b5cf6);"></div>
            </div>
            <!-- دکمه افزودن نوع خدمات جدید - با ناحیه لمسی بزرگ‌تر -->
            <button 
              class="add-new-service-type-btn"
              data-location-id="${project.location_id}"
              style="flex:1;padding:14px 16px;min-height:48px;background:linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;font-family:Vazirmatn,sans-serif;transition:all 0.15s ease;box-shadow:0 4px 12px rgba(139,92,246,0.4);display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;"
              onmousedown="this.style.transform='scale(0.97)';this.style.boxShadow='0 2px 8px rgba(139,92,246,0.3)'"
              onmouseup="this.style.transform='scale(1)';this.style.boxShadow='0 4px 12px rgba(139,92,246,0.4)'"
              ontouchstart="this.style.transform='scale(0.97)';this.style.background='linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'"
              ontouchend="this.style.transform='scale(1)';this.style.background='linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'"
            >
              🆕 افزودن خدمات جدید (نوع دیگر)
            </button>
          </div>
        ` : '';

        // ✅ هر «نوع خدمات» (هر پروژه) باید کادر جدا داشته باشد
        // بنابراین در هر کادر فقط سفارش‌های همان پروژه را نمایش می‌دهیم (نه همه پروژه‌های یک لوکیشن)
        const allOrdersAtLocation: ProjectOrder[] = project.orders || [];

        const projectServiceTypeName = project.service_types_v3?.name || '';
        const projectSubcategoryCode = project.subcategories?.code || allOrdersAtLocation[0]?.subcategory?.code || 'unknown';
        const projectSubcategoryName = project.subcategories?.name || allOrdersAtLocation[0]?.subcategory?.name || 'نامشخص';

        const serviceTypeGroups = [
          {
            serviceTypeName: projectServiceTypeName,
            subcategoryName: projectSubcategoryName,
            name: projectSubcategoryName,
            code: projectSubcategoryCode,
            orders: allOrdersAtLocation,
            projectId: project.id,
            serviceTypeId: project.service_type_id,
            subcategoryId: project.subcategory_id,
          },
        ];

        // لیست سفارشات پروژه - گروه‌بندی شده بر اساس نوع خدمات
        const ordersHTML = allOrdersAtLocation.length > 0
          ? `
            <div style="margin-top:10px;max-height:60vh;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;">
              ${serviceTypeGroups.map(group => `
                <!-- کادر نوع خدمات: ${group.serviceTypeName} - ${group.subcategoryName} -->
                <div style="margin-bottom:12px;padding:10px;background:linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.05));border:2px solid rgba(102, 126, 234, 0.3);border-radius:10px;">
                  <!-- هدر نوع خدمات با نمایش نوع خدمات اصلی و زیردسته -->
                  <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(102, 126, 234, 0.2);">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:10px;height:10px;background:#667eea;border-radius:50%;"></div>
                      <span style="font-size:13px;font-weight:700;color:#667eea;">${group.serviceTypeName || group.subcategoryName}</span>
                      ${group.serviceTypeName && group.subcategoryName && group.serviceTypeName !== group.subcategoryName ? `
                        <span style="font-size:10px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:2px 8px;border-radius:10px;font-weight:600;">${group.subcategoryName}</span>
                      ` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-right:18px;">
                      <span style="font-size:9px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;">${group.orders.length} سفارش</span>
                      <button 
                        class="add-new-order-btn"
                        data-project-id="${group.projectId || project.id}"
                        data-location-id="${project.location_id}"
                        data-service-type-id="${group.serviceTypeId || project.service_type_id}"
                        data-subcategory-id="${group.subcategoryId || project.subcategory_id}"
                        data-subcategory-code="${group.code}"
                        style="margin-right:auto;padding:4px 10px;background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:9px;font-family:Vazirmatn,sans-serif;transition:all 0.2s;box-shadow:0 2px 4px rgba(16,185,129,0.3);"
                        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 8px rgba(16,185,129,0.4)'"
                        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(16,185,129,0.3)'"
                      >
                        ➕ سفارش جدید
                      </button>
                    </div>
                  </div>
                  
                  <!-- سفارشات این نوع خدمات -->
                  ${group.orders.map((order, orderIdx) => {
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
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                          <div style="font-size:11px;font-weight:600;color:#1f2937;">کد: ${order.code}</div>
                          ${isArchivedOrder(order)
                            ? `<span style="font-size:9px;font-weight:700;color:#fff;background:#64748b;border-radius:5px;padding:2px 6px;">✓ بایگانی شده</span>`
                            : `<span style="font-size:9px;font-weight:700;color:#fff;background:#2563eb;border-radius:5px;padding:2px 6px;">● فعال</span>`}
                        </div>

                        <div id="order-gallery-${order.id}" class="swipeable-gallery" style="position:relative;margin-top:6px;touch-action:pan-y;">
                          <div style="overflow:hidden;border-radius:6px;background:#f9fafb;position:relative;height:160px;">
                            ${allMedia.map((m, idx) => {
                              const { data: baseData } = supabase.storage
                                .from('project-media')
                                .getPublicUrl(m.file_path);
                              const baseUrl = baseData.publicUrl;
                              const isVideo = m.file_type === 'video';
                              const thumbUrl = isVideo
                                ? baseUrl
                                : supabase.storage
                                    .from('project-media')
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
                                    <video src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;user-select:none;background:#000;" autoplay muted loop playsinline preload="auto" draggable="false"></video>
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
                              ${order.status === 'pending' ? `
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
                              ` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `).join('')}
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

        // نوار ابزار بالای کادر سفارش: تمام‌صفحه، کوچک‌کردن، زوم + / -، بستن
        const mobileCloseBtn = `
          <div class="popup-toolbar" style="position:absolute;top:6px;left:6px;display:flex;gap:4px;z-index:10000;direction:ltr;">
            <button class="popup-zoom-out-btn" title="کوچک‌نمایی" aria-label="کوچک‌نمایی" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.95);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:bold;color:#374151;box-shadow:0 1px 4px rgba(0,0,0,0.15);">−</button>
            <button class="popup-zoom-in-btn" title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.95);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:bold;color:#374151;box-shadow:0 1px 4px rgba(0,0,0,0.15);">+</button>
            <button class="popup-minimize-btn" title="کوچک کردن" aria-label="کوچک کردن" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.95);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#374151;box-shadow:0 1px 4px rgba(0,0,0,0.15);">
              <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 12h14"/></svg>
            </button>
            <button class="popup-fullscreen-btn" title="تمام‌صفحه" aria-label="تمام‌صفحه" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.95);border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#374151;box-shadow:0 1px 4px rgba(0,0,0,0.15);">
              <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/></svg>
            </button>
            <button class="mobile-popup-close-btn popup-close-trigger" aria-label="بستن" style="width:30px;height:30px;border-radius:50%;background:#ef4444;border:1px solid #dc2626;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.2);">
              <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        `;

        // استخراج عنوان موقعیت - نمایش فقط عنوان آدرس و نه نوع خدمات
        const locationTitle = getMarkerLocationTitle(project);
        const customerName = allOrdersAtLocation.length > 0 && allOrdersAtLocation[0]
          ? '' // نام مشتری در سفارشات موجود است
          : '';

        const popupContent = `
          ${mobileCloseBtn}
          <!-- دکمه افزودن خدمات جدید بیرون از کادر اصلی با خط اتصال به نقطه قرمز -->
          ${addNewServiceHTML}
          <div class="mobile-popup-inner" style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width: 260px;${count > 1 ? 'border:3px solid #667eea;border-radius:10px;' : ''}">
            ${locationHeader}
            <strong style="font-size: 15px; color: #1f2937;">${locationTitle}</strong>
            <span style="font-size: 13px; color: #6b7280; margin-top: 6px; display: block;">${project.locations?.address_line || ''}</span>
            <div class="neshan-plaque-line" data-lat="${project.locations?.lat}" data-lng="${project.locations?.lng}" style="font-size: 12px; color: #0ea5e9; margin-top: 4px; display: block; font-weight: 600;">در حال دریافت پلاک…</div>
            
            ${ordersHTML}
          </div>
        `;

        
        // popup قدیمی Leaflet عمداً bind نمی‌شود تا فقط پنل React قابل تغییر اندازه باز شود.
        marker.unbindPopup();

        // اتصال event listeners بعد از باز شدن popup
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (!popup) return;
          
          const popupElement = popup.getElement();
          if (!popupElement) return;
          
          // اضافه کردن کلاس fullscreen برای موبایل
          const isMobile = window.innerWidth < 768;
          if (isMobile) {
            popupElement.classList.add('mobile-fullscreen-popup');
            // اطمینان از اینکه content-wrapper هم استایل درست می‌گیرد
            const wrapper = popupElement.querySelector('.leaflet-popup-content-wrapper');
            if (wrapper) {
              (wrapper as HTMLElement).style.cssText = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;margin:0!important;padding:0!important;border-radius:0!important;background:#fff!important;overflow:hidden!important;';
            }
            const content = popupElement.querySelector('.leaflet-popup-content');
            if (content) {
              (content as HTMLElement).style.cssText = 'width:100vw!important;height:100vh!important;height:100dvh!important;margin:0!important;padding:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;';
            }
            const tip = popupElement.querySelector('.leaflet-popup-tip-container');
            if (tip) {
              (tip as HTMLElement).style.display = 'none';
            }
          }
          
          // هندلر دکمه بستن
          const closeBtn = popupElement.querySelector('.popup-close-trigger');
          if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              marker.closePopup();
            });
          }

          // زوم داخلی کادر
          const innerEl = popupElement.querySelector('.mobile-popup-inner') as HTMLElement | null;
          const wrapperEl = popupElement.querySelector('.leaflet-popup-content-wrapper') as HTMLElement | null;
          const contentEl = popupElement.querySelector('.leaflet-popup-content') as HTMLElement | null;
          let popupScale = 1;
          const applyScale = () => {
            if (innerEl) {
              innerEl.style.transform = `scale(${popupScale})`;
              innerEl.style.transformOrigin = 'top right';
            }
          };
          popupElement.querySelector('.popup-zoom-in-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            popupScale = Math.min(2, popupScale + 0.1);
            applyScale();
          });
          popupElement.querySelector('.popup-zoom-out-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            popupScale = Math.max(0.5, popupScale - 0.1);
            applyScale();
          });

          // تمام‌صفحه / خروج از تمام‌صفحه
          let isFullscreen = window.innerWidth < 768;
          const applyFullscreen = (on: boolean) => {
            isFullscreen = on;
            if (on) {
              popupElement.classList.add('mobile-fullscreen-popup');
              if (wrapperEl) wrapperEl.style.cssText = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;margin:0!important;padding:0!important;border-radius:0!important;background:#fff!important;overflow:hidden!important;z-index:9999!important;';
              if (contentEl) contentEl.style.cssText = 'width:100vw!important;height:100vh!important;height:100dvh!important;margin:0!important;padding:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;';
              const tipEl = popupElement.querySelector('.leaflet-popup-tip-container') as HTMLElement | null;
              if (tipEl) tipEl.style.display = 'none';
            } else {
              popupElement.classList.remove('mobile-fullscreen-popup');
              if (wrapperEl) wrapperEl.style.cssText = '';
              if (contentEl) contentEl.style.cssText = '';
              const tipEl = popupElement.querySelector('.leaflet-popup-tip-container') as HTMLElement | null;
              if (tipEl) tipEl.style.display = '';
            }
          };
          popupElement.querySelector('.popup-fullscreen-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            applyFullscreen(!isFullscreen);
          });

          // کوچک کردن کادر
          let isMinimized = false;
          popupElement.querySelector('.popup-minimize-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            isMinimized = !isMinimized;
            if (innerEl) innerEl.style.display = isMinimized ? 'none' : '';
            if (isMinimized && isFullscreen) applyFullscreen(false);
          });

          // واکشی پلاک از نشان و درج در کادر
          const plaqueEl = popupElement.querySelector('.neshan-plaque-line') as HTMLElement | null;
          if (plaqueEl) {
            const lat = parseFloat(plaqueEl.dataset.lat || '');
            const lng = parseFloat(plaqueEl.dataset.lng || '');
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              import('@/lib/neshan').then(({ neshanReverseGeocode }) => {
                neshanReverseGeocode(lat, lng).then((res) => {
                  if (!res) { plaqueEl.style.display = 'none'; return; }
                  const parts: string[] = [];
                  if (res.neighbourhood) parts.push(`محله: ${res.neighbourhood}`);
                  if (res.route_name) parts.push(`${res.route_type || 'خیابان'}: ${res.route_name}`);
                  if (res.house_number) {
                    const suffix = res.house_number_source === 'nearby'
                      ? ` نزدیک‌ترین پلاک${res.plaque_distance_m ? ` در حدود ${res.plaque_distance_m} متر` : ''}`
                      : 'پلاک';
                    parts.push(`${suffix}: ${res.house_number}`);
                  } else {
                    parts.push('پلاک ثبت‌شده‌ای برای این نقطه پیدا نشد');
                  }
                  plaqueEl.innerHTML = parts.length
                    ? `📍 ${parts.join(' • ')}`
                    : (res.formatted_address ? `📍 ${res.formatted_address}` : '');
                  if (!plaqueEl.innerHTML) plaqueEl.style.display = 'none';
                }).catch(() => { plaqueEl.style.display = 'none'; });
              });
            } else {
              plaqueEl.style.display = 'none';
            }
          }

          
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

              // کلیک روی تصاویر و ویدیوها برای بزرگ‌نمایی/پخش داخل مودال یکپارچه
              const mediaItemsAll = popupElement.querySelectorAll<HTMLElement>(
                `#order-gallery-${order.id} .order-image-clickable, #order-gallery-${order.id} .order-video-item-${order.id}`
              );
              if (mediaItemsAll.length > 0) {
                const mediaUrls = Array.from(mediaItemsAll).map((el) => {
                  if (el.tagName === 'IMG') {
                    return (el as HTMLImageElement).dataset.imageUrl || (el as HTMLImageElement).src;
                  }
                  return el.dataset.url || '';
                }).filter(Boolean);

                mediaItemsAll.forEach((el, idx) => {
                  el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setZoomedImages(mediaUrls);
                    setZoomedImageIndex(idx);
                    setZoomedImage(mediaUrls[idx]);
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
                    .from('project-media')
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
          
          // هندلر افزودن سفارش جدید به پروژه - برای همه دکمه‌های سفارش جدید
          const addNewOrderBtns = popupElement.querySelectorAll('.add-new-order-btn');
          addNewOrderBtns.forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const projectId = (btn as HTMLElement).dataset.projectId;
              const locationId = (btn as HTMLElement).dataset.locationId;
              const serviceTypeId = (btn as HTMLElement).dataset.serviceTypeId;
              const subcategoryId = (btn as HTMLElement).dataset.subcategoryId;
              const subcategoryCode = (btn as HTMLElement).dataset.subcategoryCode;
              
              console.log('[Map] Adding new order to project:', { projectId, locationId, serviceTypeId, subcategoryId, subcategoryCode });
              
              // دریافت آدرس پروژه از location
              let addressLine = '';
              if (locationId) {
                const { data: locationData } = await supabase
                  .from('locations')
                  .select('address_line')
                  .eq('id', locationId)
                  .single();
                
                if (locationData) {
                  addressLine = locationData.address_line;
                }
              }
              
              // دریافت IDs برای قم (استان و شهر)
              const { data: qomProvince } = await supabase
                .from('provinces')
                .select('id, name')
                .eq('name', 'قم')
                .single();
              
              const { data: qomDistrict } = await supabase
                .from('districts')
                .select('id, name')
                .eq('name', 'قم')
                .eq('province_id', qomProvince?.id)
                .maybeSingle();
              
              const provinceId = qomProvince?.id || null;
              const districtId = qomDistrict?.id || null;
              const provinceName = 'قم';
              const districtName = 'قم';
              
              // بستن popup
              marker.closePopup();
              
              // ✅ مسیریابی بر اساس subcategoryCode واقعی
              // '10' و '15' و '20' → /scaffolding/form (فرم جامع)
              // '30' → /scaffolding/rental-form
              let targetRoute = '/scaffolding/form'; // default
              if (subcategoryCode === '30') {
                targetRoute = '/scaffolding/rental-form';
              }
              
              navigate(targetRoute, {
                state: {
                  fromMap: true,
                  hierarchyProjectId: projectId,
                  projectId: projectId,
                  locationId: locationId,
                  serviceTypeId: serviceTypeId,
                  subcategoryId: subcategoryId,
                  subcategoryCode: subcategoryCode,
                  provinceId: provinceId,
                  districtId: districtId,
                  locationAddress: addressLine,
                  provinceName: provinceName,
                  districtName: districtName
                }
              });
            });
          });
          
          // هندلر افزودن نوع خدمات جدید (خدمات متفاوت) - با پشتیبانی بهتر از touch
          const addNewServiceTypeBtn = popupElement.querySelector('.add-new-service-type-btn');
          if (addNewServiceTypeBtn) {
            const handleAddNewServiceType = (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              const locationId = (addNewServiceTypeBtn as HTMLElement).dataset.locationId;
              
              console.log('[Map] Adding new service type at location:', locationId);
              
              // بستن popup
              marker.closePopup();
              
              // باز کردن دیالوگ انتخاب نوع خدمات با تاخیر کوتاه
              if (locationId) {
                setTimeout(() => {
                  setServiceTypeDialogLocationId(locationId);
                  setServiceTypeDialogOpen(true);
                }, 100);
              }
            };
            
            // استفاده از هر دو event برای پوشش بهتر موبایل و دسکتاپ
            addNewServiceTypeBtn.addEventListener('click', handleAddNewServiceType);
            addNewServiceTypeBtn.addEventListener('touchend', handleAddNewServiceType, { passive: false });
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

         marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          
          // اگر مارکر در cluster است و expand نشده، ابتدا expand کنیم
          if ((marker as any).isInCluster && !expandedClusters.has((marker as any).clusterKey)) {
            const markerClusterKey = (marker as any).clusterKey;
            const newExpanded = new Set(expandedClusters);
            newExpanded.add(markerClusterKey);
            setExpandedClusters(newExpanded);
            
            // نمایش مارکرهای قرمز مرکزی
            centerMarkersRef.current.forEach((cm) => {
              if ((cm as any).clusterKey === markerClusterKey) {
                cm.setOpacity(0);
                cm.closePopup();
              }
            });
            
            // انیمیشن حرکت مارکرها به موقعیت نهایی
            markersRef.current.forEach((m) => {
              if ((m as any).clusterKey === markerClusterKey) {
                const targetLat = (m as any).targetLat;
                const targetLng = (m as any).targetLng;
                
                setTimeout(() => {
                  m.setLatLng([targetLat, targetLng]);
                  m.setOpacity(1);
                }, 100);
              }
            });
            
            // نمایش خطوط
            linesRef.current.forEach((line) => {
              if ((line as any).clusterKey === markerClusterKey) {
                setTimeout(() => {
                  line.setStyle({ opacity: 0.7 });
                }, 100);
              }
            });
            
            // فقط پخش (expand) کن؛ کادر پروژه را باز نکن تا کاربر خودش یکی را انتخاب کند
            return;

          } else {
            // اگر cluster expand شده یا پروژه تکی است
            setSelectedProject(project);
            setSelectedOrderForUpload(null);
            setSelectedMapLocation(null);
            // فقط پروژه‌های همان نوع خدمات (subcategory/service_type) در همین مکان
            const locationProjects = projectsWithMedia.filter(p =>
              p.location_id === project.location_id &&
              (p.subcategory_id ?? null) === (project.subcategory_id ?? null) &&
              (p.service_type_id ?? null) === (project.service_type_id ?? null)
            );
            // همیشه از پنل React استفاده می‌کنیم (هم موبایل هم دسکتاپ)
            setMobileSelectedProject(project);
            setMobileSelectedLocationProjects(locationProjects);
          }
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

    // پاپ‌آپ Leaflet دیگر استفاده نمی‌شود؛ پنل React جایگزین شده است


    // نمایش سریع مارکرها بدون زوم شدید؛ نمای اول باید کل ایران را نشان بدهد
    const allMarkers = markersRef.current;
    console.debug('[HybridGlobe] Total markers created:', allMarkers.length);
    
    if (allMarkers.length > 0 && !hasInitialZoomedRef.current) {
      hasInitialZoomedRef.current = true;

      // ابتدا نمای کلی ایران را نشان بده تا کاربر موقعیت کلی را ببیند
      const iranBounds = L.latLngBounds([24.5, 43.5], [40.5, 64.5]);
      try {
        mapRef.current?.fitBounds(iranBounds, { padding: [24, 24], animate: false });
      } catch (e) {
        console.warn('[HybridGlobe] Iran overview fit failed', e);
      }

      markersRef.current.forEach(m => {
        if (!(m as any).isInCluster) m.setOpacity(1);
      });
      centerMarkersRef.current.forEach(cm => cm.setOpacity(1));

      // سپس به‌صورت خودکار روی مارکرهای واقعی پروژه‌ها زوم کن
      setTimeout(() => {
        try {
          const points: L.LatLng[] = [];
          markersRef.current.forEach(m => {
            if (!(m as any).isInCluster) points.push(m.getLatLng());
          });
          centerMarkersRef.current.forEach(cm => points.push(cm.getLatLng()));

          if (points.length === 1) {
            mapRef.current?.flyTo(points[0], 15, { duration: 1.2 });
          } else if (points.length > 1) {
            const bounds = L.latLngBounds(points);
            mapRef.current?.flyToBounds(bounds, {
              padding: [60, 60],
              maxZoom: 14,
              duration: 1.2,
            });
          }
        } catch (e) {
          console.warn('[HybridGlobe] Auto-zoom to markers failed', e);
        }
      }, 1500);
    } else if (allMarkers.length > 0) {
      // در بارهای بعدی، فقط مارکرها را بدون حرکت نقشه نمایش بده
      setTimeout(() => {
        markersRef.current.forEach(m => {
          if (!(m as any).isInCluster) {
            m.setOpacity(1);
          }
        });
        centerMarkersRef.current.forEach(cm => cm.setOpacity(1));
      }, 100);
    } else {
      console.warn('[HybridGlobe] No markers to display on map');
    }
  }, [projectsWithMedia, loading, mapReady, navigate, expandedClusters, repairOrders]);

  // تغییر نمای نقشه بین استاندارد و ماهواره‌ای
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    
    const map = mapRef.current;
    
    // حذف لایه قبلی
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    
    let newLayer: L.TileLayer;
    
    if (mapStyle === 'satellite') {
      // لایه ماهواره‌ای همراه با برچسب‌های فارسی استان‌ها، شهرها و خیابان‌ها
      newLayer = createNeshanTileLayer('satellite', {
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4,
        errorTileUrl: '',
      });
    } else {
      // لایه استاندارد با نام‌های محلی/فارسی
      newLayer = createNeshanTileLayer('standard-day', {
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4,
        errorTileUrl: '',
      });
    }
    
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;

    // لایه قواره‌بندی همیشه روی تایل پایه باشد
    if (buildingsLayerRef.current && map.hasLayer(buildingsLayerRef.current)) {
      map.removeLayer(buildingsLayerRef.current);
      buildingsLayerRef.current.addTo(map);
    }
    
    console.log('[Map] Switched to', mapStyle, 'view');
  }, [mapStyle, mapReady]);

  // اطمینان از اندازه صحیح نقشه در حالت جاسازی‌شده
  useEffect(() => {
    if (!mapReady || !mapContainer.current) return;
    const fix = () => mapRef.current?.invalidateSize();
    const t = window.setTimeout(fix, 300);
    const ro = new ResizeObserver(fix);
    ro.observe(mapContainer.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [mapReady]);

  // رهگیری مرکز نقشه برای مکان‌نمای ثابت و چسبیدن (snap) به پروژه‌های تا ۳ متری

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const SNAP_METERS = 3;

    const update = () => {
      const c = map.getCenter();
      setCenterPin({ lat: c.lat, lng: c.lng });

      let nearest: ProjectWithMedia | null = null;
      let nearestDist = Infinity;
      projectsWithMedia.forEach((p) => {
        const lat = p.locations?.lat;
        const lng = p.locations?.lng;
        if (!Number.isFinite(lat as number) || !Number.isFinite(lng as number)) return;
        const d = map.distance(c, L.latLng(lat as number, lng as number));
        if (d < nearestDist) {
          nearestDist = d;
          nearest = p;
        }
      });

      setSnappedProject(nearestDist <= SNAP_METERS ? nearest : null);
    };

    update();
    map.on('move', update);
    map.on('zoom', update);

    return () => {
      map.off('move', update);
      map.off('zoom', update);
    };
  }, [mapReady, projectsWithMedia]);

  // اگر نوار «مشاهده حساب کاربر» (impersonation) بالای صفحه باشد، نقشه تمام‌صفحه را پایین‌تر شروع کن
  // تا سربرگ و کلید بازگشت زیر آن پنهان نشود
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    if (embedded) return;
    const measure = () => {
      const banner = document.querySelector('[data-impersonation-banner]') as HTMLElement | null;
      setTopOffset(banner ? banner.getBoundingClientRect().height : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    const id = window.setInterval(measure, 1000);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(id);
    };
  }, [embedded]);

  return (
    <div
      className={embedded ? 'relative w-full h-[75vh] min-h-[420px] rounded-xl overflow-hidden border bg-background' : 'fixed inset-x-0 bottom-0 z-[70] flex flex-col bg-background'}
      style={embedded ? undefined : { top: topOffset }}
    >
      {/* سربرگ بالای نقشه (نوار اطلاعات و بازگشت) */}
      {!embedded && (
        <div className="shrink-0 z-[80] border-b bg-card/95 backdrop-blur-sm shadow-sm">

          <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm sm:text-base text-foreground truncate">لوکیشن اجرایی پروژه</h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{projectsWithMedia.length} پروژه فعال</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="gap-1.5 shrink-0 text-xs h-8 sm:h-9"
              >
                <ArrowRight className="h-4 w-4" />
                <span className="hidden sm:inline">بازگشت</span>
                <span className="sm:hidden">بازگشت</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* لایه‌ی روی نقشه برای کنترل‌ها */}
      <div className="relative flex-1 min-h-0">
        {/* دکمه تغییر نمای نقشه (استاندارد/ماهواره‌ای) - بالا سمت چپ */}
        <Button
          variant="default"
          size="sm"
          onClick={() => setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard')}
          className="pointer-events-auto absolute left-2 top-2 shadow-lg border border-primary/20 text-[10px] px-2 py-0.5 h-6 rounded-md bg-primary/60 hover:bg-primary/75 backdrop-blur-md z-[2100]"
          title={mapStyle === 'standard' ? 'نمای ماهواره‌ای' : 'نمای استاندارد'}
        >
          {mapStyle === 'standard' ? (
            <>
              <Satellite className="h-2.5 w-2.5 ml-1" />
              <span className="font-semibold text-[10px]">ماهواره‌ای</span>
            </>
          ) : (
            <>
              <MapIcon className="h-2.5 w-2.5 ml-1" />
              <span className="font-semibold text-[10px]">نقشه</span>
            </>
          )}
        </Button>

        {/* فیلتر نمایش سفارش‌ها: همه / فعال / بایگانی */}
        {!activeExecutionOnly && (
          <Card className="pointer-events-auto absolute right-2 top-2 bg-card/80 backdrop-blur-md shadow-lg border border-primary/20 p-1 rounded-md z-[2100]" dir="rtl">
            <div className="flex items-center gap-1">
              {([
                { key: 'all', label: 'همه' },
                { key: 'active', label: 'فعال' },
                { key: 'archived', label: 'بایگانی' },
              ] as { key: MapOrderFilter; label: string }[]).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMapOrderFilter(opt.key)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                    mapOrderFilter === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* کارت تعداد پروژه‌ها - زیر دکمه ماهواره‌ای */}
        <Card className="pointer-events-auto absolute left-2 top-10 bg-card/50 backdrop-blur-md shadow-lg border border-primary/20 p-1 rounded-md z-[2100]">
          <div className="flex items-center gap-1">
            <div className="p-0.5 bg-primary/10 rounded">
              <MapPin className="h-2.5 w-2.5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-primary leading-none">{projectsWithMedia.length}</span>
              <span className="text-[8px] text-muted-foreground leading-tight">پروژه فعال</span>
            </div>
          </div>
        </Card>

        {/* مکان‌نمای ثابت مرکز نقشه — فقط نقشه عمومی؛ در تب اجرایی نقشه تمیز می‌ماند */}
        {!activeExecutionOnly && (
        <Button
          variant="ghost"
          disabled={!centerPin}
          aria-label="تایید محل"
          className="pointer-events-auto absolute left-1/2 top-1/2 z-[2200] -translate-x-1/2 -translate-y-full h-[52px] w-[42px] p-0 overflow-visible hover:bg-transparent"
          onClick={() => {
            if (!centerPin) return;
            navigate('/user/new-location', {
              state: { lat: centerPin.lat, lng: centerPin.lng, fromMap: true },
            });
          }}
        >
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-md">
            تایید محل
          </span>
          <svg width="42" height="52" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="20" cy="48" rx="7" ry="2" fill="rgba(0,0,0,0.25)" />
            <path
              d="M20 2C12 2 6 8 6 16C6 25 20 42 20 42C20 42 34 25 34 16C34 8 28 2 20 2Z"
              fill={snappedProject ? '#16a34a' : '#ef4444'}
              stroke="white"
              strokeWidth="2.5"
            />
            <circle cx="20" cy="16" r="5.5" fill="white" />
          </svg>
        </Button>
        )}

        {/* دکمه انتخاب پروژه فقط زمانی که مکان‌نما روی پروژه قرار گرفته — در تب اجرایی نمایش داده نمی‌شود */}
        {!activeExecutionOnly && snappedProject && (
          <div className={`pointer-events-auto absolute ${activeExecutionOnly ? 'bottom-4' : 'bottom-[4.75rem]'} left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[2200]`}>
            <Button
              className="w-full h-11 text-sm font-bold shadow-xl bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                if (isMobile) {
                  setMobileSelectedProject(snappedProject);
                  setMobileSelectedLocationProjects(
                    projectsWithMedia.filter(p => p.location_id === snappedProject.location_id)
                  );
                } else {
                  setSelectedProject(snappedProject);
                }
              }}
            >
              <MapPin className="h-4 w-4 ml-1.5" />
              {`انتخاب پروژه: ${snappedProject.title || 'پروژه من'}`}
            </Button>
          </div>
        )}

        {/* نقشه عمومی (کره زمین): کادر جستجوی آدرس - پایین نقشه */}
        {!activeExecutionOnly && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[2100]">
            <MapSearchBox
              onLocationSelect={(lat, lng) => {
                if (mapRef.current) {
                  mapRef.current.flyTo([lat, lng], 16, {
                    duration: 1.5,
                    easeLinearity: 0.25
                  });
                }
              }}
              placeholder="جستجوی آدرس یا محل..."
              className="w-full"
              showSearchButton={true}
              resultsPlacement="top"
            />
          </div>
        )}




        {/* نقشه */}
        <div ref={mapContainer} className="absolute inset-0" style={{ touchAction: 'pan-x pan-y' }} />
      </div>


      {/* کادر آپلود برای سفارش خاص */}
      {selectedOrderForUpload && typeof document !== 'undefined' && createPortal((() => {
        const currentOrder = projectsWithMedia
          .flatMap(p => p.orders || [])
          .find(o => o.id === selectedOrderForUpload);
        return (
          <div
            className="fixed inset-0 flex items-center justify-center px-3 pointer-events-none"
            style={{ zIndex: 2147483647, isolation: 'isolate' }}
          >
            <Card
              className="relative w-full max-w-sm bg-card shadow-2xl p-4 rounded-2xl border-2 border-primary/40 animate-in slide-in-from-top duration-300 pointer-events-auto"
              style={{ zIndex: 2147483647 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">افزودن عکس و فیلم به سفارش</h3>
                    {currentOrder?.code && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">سفارش </span>
                        <span className="font-bold text-primary">#{currentOrder.code}</span>
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedOrderForUpload(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      if (fileInputRef.current) {
                        openMediaPicker(IMAGE_ACCEPT);
                      }
                    }}
                    disabled={uploading}
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                  >
                    <Camera className="h-6 w-6 text-primary" />
                    <span className="text-sm">افزودن عکس</span>
                  </Button>
                  <Button
                    onClick={() => {
                      if (fileInputRef.current) {
                        openMediaPicker(VIDEO_ACCEPT);
                      }
                    }}
                    disabled={uploading}
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                  >
                    <Video className="h-6 w-6 text-primary" />
                    <span className="text-sm">افزودن فیلم</span>
                  </Button>
                </div>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>در حال آپلود...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => {
                    if (fileInputRef.current) {
                      openMediaPicker(ALL_MEDIA_ACCEPT);
                    }
                  }}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? 'در حال آپلود...' : 'انتخاب همزمان عکس و فیلم'}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  حداکثر حجم فیلم ۵۰ مگابایت (فرمت mp4، mov، webm، mkv و ...)
                </p>
              </div>
            </Card>
          </div>
        );
      })(), document.body)}

      {/* Input مخفی برای انتخاب فایل */}
      <input
        ref={fileInputRef}
        type="file"
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
        type="order"
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

      {/* پنل تمام‌صفحه موبایل برای نمایش سفارشات پروژه */}
      {mobileSelectedProject && (
        <MobileProjectPanel
          project={mobileSelectedProject}
          dailyReportMode={activeExecutionOnly}
          allProjectsAtLocation={mobileSelectedLocationProjects}
          hideFinancials={activeExecutionOnly}
          managerView={activeExecutionOnly}
          onViewOrderDetails={(orderId) => {
            setMobileSelectedProject(null);
            setMobileSelectedLocationProjects([]);
            setSelectedProject(null);
            onViewOrderDetails?.(orderId);
          }}
          onClose={() => {
            setMobileSelectedProject(null);
            setMobileSelectedLocationProjects([]);
            setSelectedProject(null);
          }}
          onDeleteOrder={(orderId) => {
            setDeleteOrderId(orderId);
          }}
          onDeleteProject={(projectId) => {
            setDeleteProjectId(projectId);
          }}
          onAddMedia={(orderId) => {
            setSelectedOrderForUpload(orderId);
            // پنل سفارش باز می‌ماند تا کاربر بداند رسانه برای کدام سفارش اضافه می‌شود
          }}
          onViewImage={(images, index) => {
            setZoomedImages(images);
            setZoomedImageIndex(index);
            setZoomedImage(images[index]);
          }}
          onViewVideo={(url) => {
            window.open(url, '_blank');
          }}
        />
      )}

      {/* دیالوگ انتخاب نوع خدمات */}
      <ServiceTypeSelectionDialog
        open={serviceTypeDialogOpen}
        onOpenChange={setServiceTypeDialogOpen}
        locationId={serviceTypeDialogLocationId}
      />
    </div>
  );
}
