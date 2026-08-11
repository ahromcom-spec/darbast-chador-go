import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Plus, Camera, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceTypeSelectionDialog } from './ServiceTypeSelectionDialog';
import { extractOrderDescription } from '@/lib/orderDescription';

const formatToman = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0));

// ✅ مپ مسیرهای فرم بر اساس کد زیرشاخه — برای رفتن مستقیم به فرم همان خدماتی که قبلا ثبت شده
// برای داربست (10/15) به فرم جامع می‌رویم که شامل ثبت برای دیگری، درخواست قیمت‌گذاری و چند سفارش همزمان است
const SUBCATEGORY_FORM_ROUTES: Record<string, string> = {
  '20': '/scaffolding/form',
  '30': '/scaffolding/rental-form',
};
const COMPREHENSIVE_SCAFFOLDING_CODES = new Set(['10', '15', '20']);


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
}

interface ProjectData {
  id: string;
  title?: string | null;
  location_id?: string;
  locations?: {
    title?: string | null;
    address_line?: string;
    lat?: number;
    lng?: number;
    province_id?: string | null;
    district_id?: string | null;
    provinces?: { id?: string; name?: string } | null;
    districts?: { id?: string; name?: string } | null;
  } | null;
  orders?: ProjectOrder[];
  subcategory_id?: string;
  service_type_id?: string;
  service_types_v3?: { name?: string; code?: string } | null;
  subcategories?: { name?: string; code?: string } | null;
}

type ServiceTypeGroup = {
  name: string;
  code: string;
  orders: ProjectOrder[];
  projectId: string;
  locationId?: string;
  serviceTypeId?: string;
  subcategoryId?: string;
  locationAddress?: string;
  locationTitle?: string | null;
  provinceId?: string | null;
  districtId?: string | null;
  provinceName?: string;
  districtName?: string;
  serviceName?: string;
  subcategoryName?: string;
};

interface MobileProjectPanelProps {
  project: ProjectData;
  allProjectsAtLocation?: ProjectData[]; // همه پروژه‌های این location
  onClose: () => void;
  onDeleteOrder: (orderId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onAddMedia: (orderId: string) => void;
  onViewImage: (images: string[], index: number) => void;
  onViewVideo: (url: string) => void;
  /** مخفی‌کردن مبالغ و اطلاعات مالی (برای مدیران و سرپرستان اجرایی) */
  hideFinancials?: boolean;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface PanelRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PANEL_PADDING = 8;
const PANEL_TOP_SAFE = 24; // کمی بالاتر بیاید

// چون پنل داخل #root مونت می‌شود و روی دسکتاپ #root معمولاً با CSS zoom (مثلاً 0.5)
// کوچک شده است، مختصات داخلی پنل باید بر اساس فضای «قبل از زوم» محاسبه شوند
// تا کادر دقیقاً وسط ویوپورت واقعی مرورگر بنشیند و درگ هم درست کار کند.
const getRootZoom = (): number => {
  if (typeof document === 'undefined') return 1;
  const appRoot = document.getElementById('root');
  if (!appRoot) return 1;
  const z = parseFloat((appRoot.style as any).zoom || '1');
  return Number.isFinite(z) && z > 0 ? z : 1;
};

const getPanelViewportMetrics = () => {
  const zoom = getRootZoom();
  return {
    // ابعاد ویوپورت در فضای «بدون زوم» = ابعاد واقعی تقسیم بر zoom
    width: typeof window === 'undefined' ? 900 : window.innerWidth / zoom,
    height: typeof window === 'undefined' ? 800 : window.innerHeight / zoom,
    padding: PANEL_PADDING,
    zoom,
  };
};

const getInitialPanelRect = (): PanelRect => {
  if (typeof window === 'undefined') {
    return { top: 56, left: 180, width: 1080, height: 760 };
  }

  const viewport = getPanelViewportMetrics();
  const availableWidth = viewport.width - viewport.padding * 2;
  const availableHeight = viewport.height - PANEL_TOP_SAFE - viewport.padding;
  const isMobileView = window.innerWidth < 768;
  const preferredWidth = isMobileView ? availableWidth : Math.round(viewport.width * 0.60);
  const preferredHeight = isMobileView ? availableHeight : Math.round(availableHeight * 0.88 * 1.7);
  const width = Math.min(preferredWidth, availableWidth);
  const height = Math.min(preferredHeight, availableHeight);

  return {
    width,
    height,
    left: Math.max(viewport.padding, (viewport.width - width) / 2),
    top: Math.max(PANEL_TOP_SAFE, PANEL_TOP_SAFE + (availableHeight - height) / 2),
  };
};

const clampPanelRect = (rect: PanelRect): PanelRect => {
  if (typeof window === 'undefined') return rect;

  const viewport = getPanelViewportMetrics();
  const maxWidth = Math.max(320, viewport.width - viewport.padding * 2);
  const maxHeight = Math.max(320, viewport.height - PANEL_TOP_SAFE - viewport.padding);
  const minWidth = Math.min(420, maxWidth);
  const minHeight = Math.min(520, maxHeight);
  const width = Math.min(Math.max(rect.width, minWidth), maxWidth);
  const height = Math.min(Math.max(rect.height, minHeight), maxHeight);

  const maxLeft = Math.max(viewport.padding, viewport.width - width - viewport.padding);
  const maxTop = Math.max(PANEL_TOP_SAFE, viewport.height - height - viewport.padding);
  const top = Math.max(PANEL_TOP_SAFE, Math.min(rect.top, maxTop));

  return {
    width,
    height,
    left: Math.min(Math.max(rect.left, viewport.padding), maxLeft),
    top,
  };
};

/** مرحله‌ای که سفارش در آن قرار دارد (اولویت با مرحله اجرایی) */
const getEffectiveStage = (order: { status: string; execution_stage?: string | null }): string => {
  const stage = order.execution_stage;
  if (stage && ['awaiting_payment', 'awaiting_collection', 'in_collection', 'collected', 'order_executed'].includes(stage)) {
    return stage;
  }
  return order.status;
};

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'در انتظار تایید',
    approved: 'در انتظار اجرای سفارش',
    pending_execution: 'در انتظار اجرای سفارش',
    scheduled: 'زمان‌بندی شده',
    paid: 'پرداخت شده',
    active: 'در جریان',
    closed: 'بسته شده',
    rejected: 'رد شده',
    draft: 'پیش‌نویس',
    in_progress: 'در حال اجرا',
    completed: 'تکمیل شده',
    cancelled: 'لغو شده',
    awaiting_payment: 'در انتظار پرداخت',
    order_executed: 'سفارش اجرا شده',
    awaiting_collection: 'در انتظار جمع‌آوری',
    in_collection: 'در حال جمع‌آوری',
    collected: 'جمع‌آوری شده',
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-sky-100 text-sky-800',
    pending_execution: 'bg-sky-100 text-sky-800',
    scheduled: 'bg-indigo-100 text-indigo-800',
    paid: 'bg-green-100 text-green-800',
    active: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800',
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
    awaiting_payment: 'bg-orange-100 text-orange-800',
    order_executed: 'bg-purple-100 text-purple-800',
    awaiting_collection: 'bg-indigo-100 text-indigo-800',
    in_collection: 'bg-cyan-100 text-cyan-800',
    collected: 'bg-teal-100 text-teal-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};

export function MobileProjectPanel({
  project,
  allProjectsAtLocation,
  onClose,
  onDeleteOrder,
  onDeleteProject,
  onAddMedia,
  onViewImage,
  onViewVideo,
  hideFinancials = false,
}: MobileProjectPanelProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mediaIndexes, setMediaIndexes] = useState<Record<string, number>>({});
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  // در موبایل پیش‌فرض تمام صفحه، در دسکتاپ پیش‌فرض پنجره‌ای
  const [isFullscreen, setIsFullscreen] = useState(isMobile);
  const [contentScale, setContentScale] = useState(1);
  const [panelRect, setPanelRect] = useState<PanelRect>(() => getInitialPanelRect());
  const resizeStartRef = useRef<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    rect: PanelRect;
  } | null>(null);

  useEffect(() => {
    const handleWindowResize = () => setPanelRect(prev => clampPanelRect(prev));
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    // هر بار که پنل برای پروژه‌ای باز می‌شود، به وسط صفحه ریست شود تا در کنج گیر نکند
    setPanelRect(getInitialPanelRect());
  }, [project.id]);


  const getMediaIndex = (orderId: string) => mediaIndexes[orderId] || 0;

  const setMediaIndex = (orderId: string, index: number) => {
    setMediaIndexes(prev => ({ ...prev, [orderId]: index }));
  };

  const getPublicUrl = (filePath: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/project-media/${filePath}`;
  };

  const handleViewOrderDetail = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  // جمع‌آوری همه سفارشات از تمام پروژه‌های این location
  const projectsToUse = allProjectsAtLocation && allProjectsAtLocation.length > 0 
    ? allProjectsAtLocation 
    : [project];
  
  const allOrders: ProjectOrder[] = [];
  projectsToUse.forEach(p => {
    if (p.orders) {
      allOrders.push(...p.orders);
    }
  });
  
  const hasOrders = allOrders.length > 0;

  // خلاصه مالی + توضیحات هر سفارش
  const orderIds = useMemo(() => allOrders.map(o => o.id), [allOrders]);
  const { data: orderSummaries } = useQuery({
    queryKey: ['mobile-panel-order-summary', orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select('id, total_price, total_paid, notes, payment_confirmed_at')
        .in('id', orderIds);
      if (error) throw error;
      const map: Record<string, { total_price: number; total_paid: number; notes: string | null; settled: boolean }> = {};
      (data || []).forEach((r: any) => {
        map[r.id] = {
          total_price: Number(r.total_price) || 0,
          total_paid: Number(r.total_paid) || 0,
          notes: r.notes || null,
          settled: !!r.payment_confirmed_at,
        };
      });
      return map;
    },
    staleTime: 30_000,
  });

  // گروه‌بندی سفارشات بر اساس هر پروژه/نوع خدمات تا دکمه «سفارش جدید» همان پروژه و همان فرم کامل را باز کند
  const serviceTypeGroups = projectsToUse
    .map((p): ServiceTypeGroup | null => {
      const orders = p.orders || [];
      if (orders.length === 0) return null;
      const firstOrder = orders[0];
      const subCode = p.subcategories?.code || firstOrder.subcategory?.code || '';
      const stName = p.service_types_v3?.name?.trim() || firstOrder.service_type?.name?.trim() || '';
      const subName = p.subcategories?.name?.trim() || firstOrder.subcategory?.name?.trim() || '';
      const displayName = stName && subName && stName !== subName ? `${stName} - ${subName}` : stName || subName || 'نامشخص';

      return {
        name: displayName,
        code: subCode || firstOrder.service_type?.code || 'unknown',
        orders,
        projectId: p.id,
        locationId: p.location_id,
        serviceTypeId: p.service_type_id,
        subcategoryId: p.subcategory_id,
        locationAddress: p.locations?.address_line,
        locationTitle: p.locations?.title,
        provinceId: p.locations?.province_id || p.locations?.provinces?.id || null,
        districtId: p.locations?.district_id || p.locations?.districts?.id || null,
        provinceName: p.locations?.provinces?.name,
        districtName: p.locations?.districts?.name,
        serviceName: stName,
        subcategoryName: subName,
      };
    })
    .filter(Boolean) as ServiceTypeGroup[];
  const fullAddress = [
    project.locations?.address_line?.trim(),
    project.locations?.districts?.name?.trim(),
    project.locations?.provinces?.name?.trim(),
  ].filter(Boolean).join('، ');

  const locationDisplayTitle =
    fullAddress ||
    project.locations?.title?.trim() ||
    project.title?.trim() ||
    'موقعیت';


  const startPanelResize = (direction: ResizeDirection) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;

    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      rect: panelRect,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;

      const zoom = getRootZoom();
      const dx = (moveEvent.clientX - start.startX) / zoom;
      const dy = (moveEvent.clientY - start.startY) / zoom;
      let { top, left, width, height } = start.rect;

      if (start.direction.includes('e')) width = start.rect.width + dx;
      if (start.direction.includes('s')) height = start.rect.height + dy;
      if (start.direction.includes('w')) {
        width = start.rect.width - dx;
        left = start.rect.left + (start.rect.width - width);
      }
      if (start.direction.includes('n')) {
        height = start.rect.height - dy;
        top = start.rect.top + (start.rect.height - height);
      }

      setPanelRect(clampPanelRect({ top, left, width, height }));
    };

    const handleEnd = () => {
      resizeStartRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  // جابجایی کادر با گرفتن و کشیدن سربرگ (موس یا انگشت)
  const startPanelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;
    // اگر روی دکمه‌ای داخل سربرگ کلیک شد، درگ را شروع نکن
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = panelRect;

    const handleMove = (moveEvent: PointerEvent) => {
      const zoom = getRootZoom();
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      setPanelRect(clampPanelRect({
        ...startRect,
        left: startRect.left + dx,
        top: startRect.top + dy,
      }));
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  // کلاس کانتینر بسته به حالت تمام صفحه یا پنجره‌ای — در حالت تمام صفحه هم سربرگ کادر نباید زیر سربرگ مرورگر برود
  const containerClass = isFullscreen
    ? "fixed left-0 right-0 bottom-0 z-[100000] bg-background flex flex-col"
    : "fixed z-[100000] bg-background flex flex-col shadow-2xl border border-border rounded-2xl overflow-hidden";
  const fullscreenStyle: React.CSSProperties | undefined = isFullscreen ? { top: PANEL_TOP_SAFE } : undefined;


  // ⚠️ پنل را داخل #root مونت می‌کنیم تا CSS zoom سراسری اپ را به ارث ببرد
  // و در کروم/اج تولید (که zoom سایت ۵۰٪ است) با بقیه‌ی رابط هم‌مقیاس شود،
  // نه این که نسبت به محتوای زوم‌شده غول‌آسا به نظر برسد.
  const portalTarget = (typeof document !== 'undefined' && document.getElementById('root')) || document.body;
  return createPortal((
    <>
      {/* Overlay فقط در حالت پنجره‌ای دسکتاپ برای امکان خروج با کلیک بیرون */}
      {!isFullscreen && (
        <div
          className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
    <div
      className={containerClass}
      style={isFullscreen ? fullscreenStyle : panelRect}
    >
      {!isFullscreen && (
        <>
          <div onPointerDown={startPanelResize('n')} className="absolute top-0 left-8 right-8 h-4 cursor-ns-resize z-30 touch-none" />
          <div onPointerDown={startPanelResize('s')} className="absolute bottom-0 left-8 right-8 h-4 cursor-ns-resize z-30 touch-none" />
          <div onPointerDown={startPanelResize('e')} className="absolute top-8 bottom-8 right-0 w-4 cursor-ew-resize z-30 touch-none" />
          <div onPointerDown={startPanelResize('w')} className="absolute top-8 bottom-8 left-0 w-4 cursor-ew-resize z-30 touch-none" />
        </>
      )}
      <div className="flex flex-col flex-1" style={{ zoom: contentScale, width: '100%', height: '100%' }}>
      {/* Header */}
      <div
        className={`flex-shrink-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-2 shadow-lg ${!isFullscreen ? 'cursor-move select-none touch-none' : ''}`}
        onPointerDown={!isFullscreen ? startPanelDrag : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="bg-white/25 hover:bg-white/45 text-white h-11 w-11 rounded-full shadow-lg border-2 border-white/60 flex-shrink-0 touch-manipulation"
            title="بستن"
          >
            <X className="h-6 w-6" strokeWidth={3} />
          </Button>
          <div className="flex-1 text-center px-2 min-w-0">
            <h2 className="text-sm font-bold leading-tight truncate">
              {locationDisplayTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setContentScale(s => Math.max(0.15, +(s - 0.1).toFixed(2)))}
              className="bg-white/25 hover:bg-white/45 text-white h-11 w-11 rounded-full border-2 border-white/40 touch-manipulation"
              title="کوچک‌نمایی محتوا"
            >
              <ZoomOut className="h-5 w-5" strokeWidth={2.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setContentScale(s => Math.min(2, +(s + 0.1).toFixed(2)))}
              className="bg-white/25 hover:bg-white/45 text-white h-11 w-11 rounded-full border-2 border-white/40 touch-manipulation"
              title="بزرگ‌نمایی محتوا"
            >
              <ZoomIn className="h-5 w-5" strokeWidth={2.5} />
            </Button>
            <span className="text-xs font-bold text-white px-1.5 min-w-[42px] text-center bg-white/15 rounded-md py-1">
              {Math.round(contentScale * 100)}%
            </span>
          </div>
        </div>
      </div>


      {/* دکمه افزودن خدمات جدید - بیرون از کادر سفارشات با ناحیه لمسی بزرگ */}
      {project.location_id && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-muted/30 to-muted/10">
          <div className="flex items-center gap-0">
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-red-200 shadow-[0_0_8px_rgba(239,68,68,0.5)] flex-shrink-0" />
            <div className="w-6 h-0.5 bg-gradient-to-r from-red-500 to-purple-600" />
          </div>
          <Button
            variant="outline"
            className="flex-1 min-h-[48px] bg-gradient-to-r from-purple-500 to-violet-600 text-white border-none hover:from-purple-600 hover:to-violet-700 active:from-purple-700 active:to-violet-800 shadow-lg py-3 text-sm font-bold touch-manipulation"
            onClick={() => {
              console.log('[MobilePanel] Opening service type dialog for location:', project.location_id);
              setServiceDialogOpen(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              console.log('[MobilePanel] Touch end - Opening service type dialog');
              setServiceDialogOpen(true);
            }}
          >
            🆕 افزودن خدمات جدید (نوع دیگر)
          </Button>
        </div>
      )}

      {/* Content - هر نوع خدمات در کادر جداگانه */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 pb-8">

          {hasOrders ? (
            serviceTypeGroups.map((group, groupIndex) => (
              <div key={`${group.projectId}-${group.code}`} className="space-y-3">
                {/* هدر نوع خدمات با دکمه سفارش جدید */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-3 border-2 border-primary/20">
                  <div className="flex items-center flex-wrap gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                    <h3 className="text-sm font-bold text-primary">
                      {group.name}
                    </h3>
                    {/* دکمه سفارش جدید کنار نام نوع خدمات */}
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3 text-xs font-bold"
                      onClick={() => {
                        const locationId = group.locationId || project.location_id;
                        const subcategoryCode = group.code;
                        if (!locationId) return;
                        // ✅ برای داربست فلزی (کد 10/15) به فرم جامع می‌رویم که شامل همه‌ی کنترل‌ها است
                        if (COMPREHENSIVE_SCAFFOLDING_CODES.has(subcategoryCode) && group.projectId) {
                          navigate(`/scaffolding/form/${group.projectId}`, {
                            state: {
                              fromMap: true,
                              hierarchyProjectId: group.projectId,
                              projectId: group.projectId,
                              locationId,
                              serviceTypeId: group.serviceTypeId,
                              subcategoryId: group.subcategoryId,
                              subcategoryCode,
                              serviceName: group.serviceName,
                              subcategoryName: group.subcategoryName,
                              locationAddress: group.locationAddress,
                              locationTitle: group.locationTitle,
                              provinceId: group.provinceId,
                              districtId: group.districtId,
                              provinceName: group.provinceName,
                              districtName: group.districtName,
                              returnToMap: true,
                            },
                          });
                          return;
                        }
                        // ✅ رفتن مستقیم به فرم همان نوع خدماتی که قبلا ثبت شده
                        const formRoute = SUBCATEGORY_FORM_ROUTES[subcategoryCode] || '/user/select-service';
                        navigate(formRoute, {
                          state: {
                            fromMap: true,
                            locationId,
                            subcategoryCode,
                            returnToMap: true,
                          },
                        });
                      }}

                    >
                      <Plus className="w-4 h-4 ml-1" />
                      سفارش جدید
                    </Button>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full mr-auto">
                      {group.orders.length} سفارش
                    </span>
                  </div>
                </div>

                {/* سفارشات این نوع خدمات */}
                {group.orders.map((order) => {
                  const allMedia = (order.media || []).sort((a, b) => {
                    if (a.file_type === 'image' && b.file_type === 'video') return -1;
                    if (a.file_type === 'video' && b.file_type === 'image') return 1;
                    return 0;
                  });
                  const currentIndex = getMediaIndex(order.id);
                  const totalMedia = allMedia.length;

                  return (
                    <div
                      key={order.id}
                      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mr-4"
                    >
                      {/* Order Header */}
                      <div className="p-3 bg-muted/50 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{order.code}
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getStatusColor(getEffectiveStage(order))}`}>
                              مرحله: {getStatusLabel(getEffectiveStage(order))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Media Gallery */}
                      <div className="relative h-[20vh] min-h-[120px] bg-muted">
                        {totalMedia > 0 ? (
                          <>
                            {allMedia.map((media, idx) => {
                              const url = getPublicUrl(media.file_path);
                              const isVisible = idx === currentIndex;
                              const isVideo = media.file_type === 'video';

                              if (!isVisible) return null;

                              const openUnifiedViewer = () => {
                                const mediaUrls = allMedia.map(m => getPublicUrl(m.file_path));
                                const mediaIdx = allMedia.findIndex(m => m.id === media.id);
                                onViewImage(mediaUrls, mediaIdx >= 0 ? mediaIdx : 0);
                              };

                              return isVideo ? (
                                <div
                                  key={media.id}
                                  className="absolute inset-0 flex items-center justify-center bg-black cursor-pointer"
                                  onClick={openUnifiedViewer}
                                >
                                  <video
                                    src={url}
                                    className="w-full h-full object-contain"
                                    preload="metadata"
                                    muted
                                    playsInline
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                                      <svg className="w-8 h-8 text-primary ml-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                    </div>
                                  </div>
                                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    ویدیو
                                  </span>
                                </div>
                              ) : (
                                <img
                                  key={media.id}
                                  src={url}
                                  alt="تصویر سفارش"
                                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                  onClick={openUnifiedViewer}
                                />
                              );
                            })}

                            {/* Navigation Arrows */}
                            {totalMedia > 1 && (
                              <>
                                <button
                                  onClick={() => setMediaIndex(order.id, (currentIndex - 1 + totalMedia) % totalMedia)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => setMediaIndex(order.id, (currentIndex + 1) % totalMedia)}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                                  {currentIndex + 1} از {totalMedia}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => onAddMedia(order.id)}
                          >
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                              <Camera className="w-8 h-8 text-primary" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground">افزودن عکس یا فیلم</p>
                              <p className="text-xs text-muted-foreground">برای این سفارش رسانه اضافه کنید</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add Media Button (when has media) */}
                      {totalMedia > 0 && (
                        <button
                          onClick={() => onAddMedia(order.id)}
                          className="w-full py-2 border-b border-border flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">افزودن رسانه جدید</span>
                        </button>
                      )}

                      {/* خلاصه توضیحات و مالی سفارش */}
                      {(() => {
                        const s = orderSummaries?.[order.id];
                        if (!s) return null;
                        const remaining = Math.max(0, s.total_price - s.total_paid);
                        const isSettled = s.settled || (s.total_price > 0 && remaining === 0);
                        return (
                          <div className="px-3 py-2.5 border-b border-border bg-muted/30 space-y-2">
                            {(() => {
                              const desc = extractOrderDescription(s.notes);
                              if (!desc) return null;
                              return (
                                <div className="text-xs text-foreground/90 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                                  <span className="font-medium text-muted-foreground">توضیحات: </span>
                                  {desc}
                                </div>
                              );
                            })()}
                            {!hideFinancials && (
                              <>
                                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                                  <div className="rounded-md bg-background border border-border px-2 py-1.5 text-center">
                                    <div className="text-muted-foreground">قیمت کل</div>
                                    <div className="font-bold text-foreground mt-0.5">{formatToman(s.total_price)}</div>
                                  </div>
                                  <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-2 py-1.5 text-center">
                                    <div className="text-green-700 dark:text-green-400">پرداختی</div>
                                    <div className="font-bold text-green-700 dark:text-green-400 mt-0.5">{formatToman(s.total_paid)}</div>
                                  </div>
                                  <div className={`rounded-md border px-2 py-1.5 text-center ${remaining > 0 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900' : 'bg-muted border-border'}`}>
                                    <div className={remaining > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-muted-foreground'}>مانده</div>
                                    <div className={`font-bold mt-0.5 ${remaining > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>{formatToman(remaining)}</div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-center">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isSettled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                    {isSettled ? '✓ تسویه شده' : '● تسویه نشده'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Action Buttons */}

                      <div className="p-3 flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleViewOrderDetail(order.id)}
                        >
                          <Eye className="w-4 h-4 ml-2" />
                          مشاهده جزئیات
                        </Button>
                        {/* دکمه حذف فقط برای سفارش‌های در انتظار تایید */}
                        {order.status === 'pending' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDeleteOrder(order.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                این پروژه سفارشی ندارد
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                می‌توانید این پروژه را حذف کنید
              </p>
              <Button
                variant="destructive"
                onClick={() => onDeleteProject(project.id)}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف پروژه
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
      </div>

      {/* دیالوگ انتخاب نوع خدمات */}
      <ServiceTypeSelectionDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        locationId={project.location_id || ''}
      />
    </div>
    </>
  ), portalTarget);
}
