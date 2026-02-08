import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ArrowRight, Package, Building2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

type OrderStatus =
  | 'pending'
  | 'pending_execution'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | string;

interface OrderMedia {
  id: string;
  project_id: string;
  file_path: string;
  thumbnail_path: string | null;
  file_type: 'image' | 'video' | string;
  created_at: string;
  mime_type: string | null;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[ch] as string
  );

interface OrderNotes {
  dimensions?: Array<{ length?: number; width?: number; height?: number }>;
  description?: string;
  locationPurpose?: string;
  service_type?: string;
}

interface OrderData {
  id: string;
  code: string;
  address: string;
  status: OrderStatus;
  customer_name: string | null;
  hierarchy_project_id?: string | null;
  location_lat: number;
  location_lng: number;
  first_image_url?: string | null;
  images_count?: number;
  notes?: string | OrderNotes | null;
  subcategories: {
    id: string;
    name: string;
    code: string;
    service_types_v3: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
}
interface ExecutiveGlobeMapProps {
  onClose: () => void;
  onOrderClick?: (orderId: string) => void;
  activeModuleKey?: string;
  moduleName?: string;
}

export default function ExecutiveGlobeMap({ onClose, onOrderClick, activeModuleKey, moduleName }: ExecutiveGlobeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const osmLayerRef = useRef<L.TileLayer | null>(null);
  const mapboxLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // مختصات مرکز استان قم
  const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

  // تشخیص نوع ماژول برای فیلتر کردن سفارشات
  const isAllOrdersModule = activeModuleKey === 'all_orders_management' || 
                             activeModuleKey?.includes('سفارشات کل') ||
                             moduleName?.includes('سفارشات کل') ||
                             moduleName?.includes('مدیریت کلی کل');

  const isScaffoldWithMaterialsModule = activeModuleKey === 'scaffold_execution_with_materials' ||
                                         activeModuleKey?.includes('101010') ||
                                         moduleName?.includes('داربست به همراه اجناس');

  const isRentalItemsModule = moduleName?.includes('کرایه اجناس داربست') ||
                               moduleName?.includes('کرایه اجناس');

  // دریافت سفارشات بر اساس ماژول فعال
  const {
    data: baseOrders,
    isLoading: isLoadingOrders,
    isFetching: isFetchingOrders,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['executive-globe-map-orders', activeModuleKey, moduleName],
    queryFn: async (): Promise<OrderData[]> => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          address,
          status,
          customer_name,
          location_lat,
          location_lng,
          hierarchy_project_id,
          notes,
          subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code,
            service_types_v3 (
              id,
              name,
              code
            )
          ),
          projects_hierarchy:projects_hierarchy!projects_v3_hierarchy_project_id_fkey (
            id,
            locations (lat, lng)
          )
        `)
        .in('status', [
          'pending',
          'pending_execution',
          'approved',
          'in_progress',
          'completed',
          'paid',
          'closed',
        ])
        .or('is_archived.is.null,is_archived.eq.false')
        .or('is_deep_archived.is.null,is_deep_archived.eq.false')
        .order('code', { ascending: false })
        .limit(800);

      if (error) throw error;

      // فیلتر کردن سفارشات بر اساس ماژول فعال
      let filteredOrders = data || [];

      if (isAllOrdersModule) {
        // ماژول مدیریت کلی - همه سفارشات
        filteredOrders = data || [];
      } else if (isRentalItemsModule) {
        // ماژول کرایه اجناس داربست - فقط کد 30
        filteredOrders = data?.filter((order: any) => {
          const subcategoryCode = order.subcategories?.code;
          return subcategoryCode === '30';
        }) || [];
      } else if (isScaffoldWithMaterialsModule) {
        // ماژول داربست به همراه اجناس - فقط کد 10
        filteredOrders = data?.filter((order: any) => {
          const subcategoryCode = order.subcategories?.code;
          const serviceTypeCode = order.subcategories?.service_types_v3?.code;
          return subcategoryCode === '10' && serviceTypeCode === '10';
        }) || [];
      } else {
        // پیش‌فرض - داربست به همراه اجناس
        filteredOrders = data?.filter((order: any) => {
          const subcategoryCode = order.subcategories?.code;
          const serviceTypeCode = order.subcategories?.service_types_v3?.code;
          return subcategoryCode === '10' && serviceTypeCode === '10';
        }) || [];
      }

      // نرمال‌سازی مختصات: اگر lat/lng روی سفارش خالی بود از پروژه‌ی سلسله‌مراتبی و لوکیشن آن استفاده کن
      const normalized = (filteredOrders as any[])
        .map((o) => {
          const directLat = typeof o.location_lat === 'number' ? o.location_lat : null;
          const directLng = typeof o.location_lng === 'number' ? o.location_lng : null;

          const fallbackLat = typeof o.projects_hierarchy?.locations?.lat === 'number'
            ? o.projects_hierarchy.locations.lat
            : null;
          const fallbackLng = typeof o.projects_hierarchy?.locations?.lng === 'number'
            ? o.projects_hierarchy.locations.lng
            : null;

          const lat = directLat && directLat !== 0 ? directLat : fallbackLat && fallbackLat !== 0 ? fallbackLat : null;
          const lng = directLng && directLng !== 0 ? directLng : fallbackLng && fallbackLng !== 0 ? fallbackLng : null;

          if (!lat || !lng) return null;

          return {
            id: o.id,
            code: o.code,
            address: o.address,
            status: o.status,
            customer_name: o.customer_name ?? null,
            hierarchy_project_id: o.hierarchy_project_id ?? null,
            location_lat: lat,
            location_lng: lng,
            notes: o.notes ?? null,
            subcategories: o.subcategories ?? null,
          } as OrderData;
        })
        .filter(Boolean) as OrderData[];

      return normalized;
    },
    staleTime: 15_000,
    retry: 1,
  });

  // دریافت media (فقط برای ساخت thumbnail های مارکر) — جدا از سفارشات تا UI گیر نکند
  const MAX_MEDIA_ORDERS = 300;
  const orderIdsForMedia = useMemo(
    () => (baseOrders || []).map((o) => o.id).slice(0, MAX_MEDIA_ORDERS),
    [baseOrders]
  );

  const { data: mediaByOrder } = useQuery({
    queryKey: ['executive-globe-map-media', orderIdsForMedia],
    enabled: orderIdsForMedia.length > 0,
    queryFn: async () => {
      const { data: mediaData, error: mediaError } = await supabase
        .from('project_media')
        .select('id, project_id, file_path, thumbnail_path, file_type, created_at, mime_type')
        .in('project_id', orderIdsForMedia)
        .in('file_type', ['image'])
        .order('created_at', { ascending: false })
        .limit(2000);

      if (mediaError) throw mediaError;

      const firstByOrder = new Map<string, OrderMedia>();
      const countByOrder = new Map<string, number>();

      (mediaData || []).forEach((m: any) => {
        const oid = m.project_id as string;
        countByOrder.set(oid, (countByOrder.get(oid) || 0) + 1);
        if (!firstByOrder.has(oid)) firstByOrder.set(oid, m as OrderMedia);
      });

      const out: Record<string, { first_image_url: string | null; images_count: number }> = {};
      orderIdsForMedia.forEach((oid) => {
        const first = firstByOrder.get(oid);
        const count = countByOrder.get(oid) || 0;
        const path = first ? (first.thumbnail_path || first.file_path) : null;

        const publicUrl = path
          ? supabase.storage
              .from('project-media')
              .getPublicUrl(path, { transform: { width: 240, quality: 70 } }).data.publicUrl
          : null;

        out[oid] = { first_image_url: publicUrl, images_count: count };
      });

      return out;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const orders = useMemo(() => {
    const list = baseOrders || [];
    if (!mediaByOrder) return list;
    return list.map((o) => ({
      ...o,
      ...mediaByOrder[o.id],
    }));
  }, [baseOrders, mediaByOrder]);

  const isLoading = isLoadingOrders || isFetchingOrders;

  // گروه‌بندی سفارشات بر اساس موقعیت
  const orderMarkers = useMemo(() => {
    if (!orders || orders.length === 0) return [] as { lat: number; lng: number; orders: OrderData[] }[];

    const locationGroups: { [key: string]: OrderData[] } = {};
    
    orders.forEach(order => {
      if (!order.location_lat || !order.location_lng) return;
      
      const key = `${order.location_lat.toFixed(5)}_${order.location_lng.toFixed(5)}`;
      
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(order);
    });

    return Object.values(locationGroups).map(group => ({
      lat: group[0].location_lat,
      lng: group[0].location_lng,
      orders: group
    }));
  }, [orders]);

  // دریافت توکن Mapbox
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (err) {
        console.error('Error fetching mapbox token:', err);
      }
    };
    fetchToken();
  }, []);

  // راه‌اندازی نقشه (همیشه با OpenStreetMap شروع می‌کنیم)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [QOM_CENTER.lat, QOM_CENTER.lng],
      zoom: 12,
      zoomControl: true,
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    osmLayerRef.current = osmLayer;
    mapRef.current = map;
    setMapReady(true);

    // اطمینان از رندر صحیح (خصوصاً در مودال/اورلی)
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      osmLayerRef.current = null;
      mapboxLayerRef.current = null;
    };
  }, []);

  // تلاش برای استفاده از Mapbox؛ اگر لود نشود، خودکار روی OSM می‌مانیم
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapboxToken) return;

    // اگر قبلاً لایه Mapbox اضافه شده، پاکش کنیم
    if (mapboxLayerRef.current) {
      mapboxLayerRef.current.remove();
      mapboxLayerRef.current = null;
    }

    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;

    const layer = L.tileLayer(url, {
      attribution: '© Mapbox © OpenStreetMap',
      tileSize: 512,
      zoomOffset: -1,
    });

    mapboxLayerRef.current = layer;

    let tileLoaded = false;
    let tileErrors = 0;

    const cleanupAndFallback = () => {
      if (mapboxLayerRef.current) {
        mapboxLayerRef.current.off('tileload', onTileLoad);
        mapboxLayerRef.current.off('load', onAnyLoad);
        mapboxLayerRef.current.off('tileerror', onTileError);
        mapboxLayerRef.current.remove();
        mapboxLayerRef.current = null;
      }

      // پیام هشدار نقشه جایگزین طبق درخواست نمایش داده نمی‌شود
    };

    const onTileLoad = () => {
      tileLoaded = true;
    };

    const onAnyLoad = () => {
      tileLoaded = true;
    };

    const onTileError = () => {
      tileErrors += 1;
      if (tileErrors >= 3) cleanupAndFallback();
    };

    layer.on('tileload', onTileLoad);
    layer.on('load', onAnyLoad);
    layer.on('tileerror', onTileError);

    layer.addTo(map);

    const timeoutId = window.setTimeout(() => {
      if (!tileLoaded) cleanupAndFallback();
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
      layer.off('tileload', onTileLoad);
      layer.off('load', onAnyLoad);
      layer.off('tileerror', onTileError);
      // اگر هنوز روی نقشه هست، پاکش کنیم
      if (mapboxLayerRef.current === layer) {
        layer.remove();
        mapboxLayerRef.current = null;
      }
    };
  }, [mapboxToken, toast]);

  // تابع کلیک روی سفارش - ذخیره وضعیت نقشه قبل از رفتن
  const handleOrderClick = useCallback((orderId: string) => {
    // ذخیره اینکه کاربر از نقشه اومده
    sessionStorage.setItem('executive_map_return', 'true');
    
    if (onOrderClick) {
      onOrderClick(orderId);
    } else {
      navigate(`/executive/orders?orderId=${orderId}`);
    }
    onClose();
  }, [onOrderClick, navigate, onClose]);

  // رسم مارکرها: هر موقعیت = یک مارکر، و Popup شامل لیست همه سفارشات همان نقطه با اسکرول
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // برای اطمینان از رندر صحیح در حالت فول‌اسکرین/مودال
    window.setTimeout(() => map.invalidateSize(), 0);

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (orderMarkers.length === 0) return;

    const statusLabel: Record<string, string> = {
      pending: 'در انتظار تایید',
      pending_execution: 'آماده اجرا',
      approved: 'تایید شده',
      in_progress: 'در حال اجرا',
      completed: 'تکمیل شده',
      paid: 'پرداخت شده',
    };

    const statusColor = (status: string) => {
      switch (status) {
        case 'approved':
          return 'hsl(var(--primary))';
        case 'in_progress':
          return 'hsl(var(--primary-light))';
        case 'completed':
          return 'hsl(var(--gold))';
        case 'paid':
          return 'hsl(var(--primary-glow))';
        case 'pending_execution':
        case 'pending':
        default:
          return 'hsl(var(--construction))';
      }
    };

    const centerClusterIcon = (count: number) =>
      L.divIcon({
        className: 'exec-order-marker',
        html: `
          <div class="exec-center-marker">
            <div class="exec-center-marker__dot" aria-hidden="true"></div>
            ${
              count > 1
                ? `<div class="exec-center-marker__count" aria-label="${count} سفارش">${count}</div>`
                : ''
            }
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

    const dotIcon = (color: string) =>
      L.divIcon({
        className: 'exec-order-marker',
        html: `<div class="exec-order-marker__dot" style="--dot-bg:${color};"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });

    const thumbIcon = (url: string, count: number, orderCode?: string) => {
      const safeUrl = escapeHtml(url);
      const badge = count > 1 ? `<div class="exec-order-marker__thumb-badge">${count}</div>` : '';
      const labelHtml = orderCode ? `
        <div class="exec-order-marker__label" style="
          position:absolute;
          bottom:100%;
          left:50%;
          transform:translateX(-50%);
          background:linear-gradient(135deg, rgba(217,119,6,0.95) 0%, rgba(180,83,9,0.95) 100%);
          color:white;
          padding:3px 8px;
          border-radius:6px;
          font-family:Vazirmatn, sans-serif;
          font-size:10px;
          font-weight:700;
          white-space:nowrap;
          max-width:100px;
          overflow:hidden;
          text-overflow:ellipsis;
          text-align:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          margin-bottom:4px;
          z-index:10;
          direction:rtl;
        ">${escapeHtml(orderCode)}</div>
      ` : '';
      return L.divIcon({
        className: 'exec-order-marker',
        html: `
          <div class="exec-order-marker__thumb" style="position:relative;display:flex;flex-direction:column;align-items:center;">
            ${labelHtml}
            <div style="position:relative;width:56px;height:56px;">
              <img
                src="${safeUrl}"
                alt="عکس سفارش"
                loading="lazy"
                decoding="async"
                style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;border-radius:8px;"
              />
              ${badge}
              <div class="exec-order-marker__pin" aria-hidden="true"></div>
            </div>
          </div>
        `,
        iconSize: [56, 80],
        iconAnchor: [28, 73],
        popupAnchor: [0, -71],
      });
    };

    const renderOrderCard = (o: OrderData) => {
      const color = statusColor(o.status || 'pending');
      const statusText = statusLabel[o.status] || o.status;
      const address = escapeHtml(o.address || 'بدون آدرس');
      const code = escapeHtml(o.code || '');
      const customer = o.customer_name ? escapeHtml(o.customer_name) : '';
      const img = o.first_image_url
        ? `<div class="exec-popup__thumb"><img src="${escapeHtml(o.first_image_url)}" alt="تصویر سفارش" loading="lazy" decoding="async" /></div>`
        : `<div class="exec-popup__thumb exec-popup__thumb--empty"></div>`;

      // پارس کردن notes برای استخراج ابعاد و شرح فعالیت (پشتیبانی از چندین ساختار)
      let description = '';
      let dimensions = '';
      let serviceType = '';

      const normalizeText = (v: unknown) => {
        if (typeof v !== 'string') return '';
        const t = v.trim();
        return t ? escapeHtml(t) : '';
      };

      const toNumber = (v: unknown): number | undefined => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const s = v.trim();
          if (!s) return undefined;
          const n = Number(s);
          return Number.isFinite(n) ? n : undefined;
        }
        return undefined;
      };

      if (o.notes) {
        try {
          const notesData: any = typeof o.notes === 'string' ? JSON.parse(o.notes) : o.notes;

          // شرح فعالیت
          description =
            normalizeText(notesData.locationPurpose) ||
            normalizeText(notesData.description) ||
            normalizeText(notesData.activity) ||
            normalizeText(notesData.activity_description);

          // نوع سرویس
          if (notesData.service_type) {
            const raw = String(notesData.service_type);
            const serviceLabels: Record<string, string> = {
              facade: 'نما',
              rental: 'اجاره',
              comprehensive: 'جامع',
            };
            serviceType = escapeHtml(serviceLabels[raw] || raw);
          }

          // ابعاد
          const dimSource = Array.isArray(notesData.dimensions)
            ? notesData.dimensions[0]
            : notesData.dimensions;

          if (dimSource && typeof dimSource === 'object') {
            const d: any = dimSource;
            const len = toNumber(d.length ?? d.len ?? d.l ?? d.L);
            const wid = toNumber(d.width ?? d.w ?? d.W);
            const hei = toNumber(d.height ?? d.h ?? d.H);

            const parts = [len, wid, hei].filter((x) => typeof x === 'number') as number[];
            if (parts.length) {
              dimensions = `${parts.join(' × ')} متر`;
            }
          }
        } catch (e) {
          console.error('Error parsing notes:', e, o.notes);
        }
      }

      // اگر چیزی ثبت نشده بود، یک متن کوتاه نشان بدهیم تا مدیر متوجه کمبود اطلاعات شود
      if (!description) description = 'ثبت نشده';
      if (!dimensions) dimensions = 'ثبت نشده';

      return `
        <div class="exec-popup__order">
          ${img}
          <div class="exec-popup__meta">
            <div class="exec-popup__code">کد: ${code}</div>
            <div class="exec-popup__address">📍 ${address}</div>
            ${customer ? `<div class="exec-popup__customer">👤 ${customer}</div>` : ''}
            ${description ? `<div class="exec-popup__description">🏗️ محل: ${description}</div>` : ''}
            ${dimensions ? `<div class="exec-popup__dimensions">📐 ابعاد: ${dimensions}</div>` : ''}
            ${serviceType ? `<div class="exec-popup__service-type">🔧 نوع: ${serviceType}</div>` : ''}
            <div class="exec-popup__status">
              <span class="exec-popup__status-dot" style="background:${color};"></span>
              <span>${escapeHtml(statusText)}</span>
            </div>
            <button class="exec-popup__cta" type="button" data-order-id="${escapeHtml(o.id)}">
              مشاهده و مدیریت
            </button>
          </div>
        </div>
      `;
    };

    // آیکون پیش‌فرض برای سفارشات بدون عکس
    const defaultThumbIcon = (count: number, orderCode?: string) => {
      const badge = count > 1 ? `<div class="exec-order-marker__thumb-badge">${count}</div>` : '';
      const labelHtml = orderCode ? `
        <div class="exec-order-marker__label" style="
          position:absolute;
          bottom:100%;
          left:50%;
          transform:translateX(-50%);
          background:linear-gradient(135deg, rgba(217,119,6,0.95) 0%, rgba(180,83,9,0.95) 100%);
          color:white;
          padding:3px 8px;
          border-radius:6px;
          font-family:Vazirmatn, sans-serif;
          font-size:10px;
          font-weight:700;
          white-space:nowrap;
          max-width:100px;
          overflow:hidden;
          text-overflow:ellipsis;
          text-align:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          margin-bottom:4px;
          z-index:10;
          direction:rtl;
        ">${escapeHtml(orderCode)}</div>
      ` : '';
      return L.divIcon({
        className: 'exec-order-marker',
        html: `
          <div class="exec-order-marker__thumb exec-order-marker__thumb--default" style="position:relative;display:flex;flex-direction:column;align-items:center;">
            ${labelHtml}
            <div style="position:relative;width:56px;height:56px;">
              <div class="exec-order-marker__default-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              ${badge}
              <div class="exec-order-marker__pin" aria-hidden="true"></div>
            </div>
          </div>
        `,
        iconSize: [56, 80],
        iconAnchor: [28, 73],
        popupAnchor: [0, -71],
      });
    };

    // ایجاد مارکرها - همه سفارشات با عکس نمایش داده میشن
    orderMarkers.forEach((group) => {
      const count = group.orders.length;
      // پیدا کردن اولین سفارش با عکس
      const orderWithImage = group.orders.find(o => o.first_image_url);
      const representative = orderWithImage || group.orders[0];
      
      // استخراج کد سفارش برای نمایش بالای مارکر
      const orderLabel = count > 1 
        ? `${count} سفارش` 
        : representative.code;

      // همه مارکرها با عکس نمایش داده میشن
      const icon = representative.first_image_url
        ? thumbIcon(representative.first_image_url, count, orderLabel)
        : defaultThumbIcon(count, orderLabel);

      const popupContent = `
        <div class="exec-popup" data-popup-id="${group.orders[0].id}">
          <div class="exec-popup__header">
            <div class="exec-popup__title">📍 سفارشات این موقعیت (${count})</div>
            <div class="exec-popup__actions">
              <button class="exec-popup__resize-btn" data-action="resize-toggle" title="تغییر اندازه">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
              </button>
              <button class="exec-popup__fullscreen-btn" data-action="fullscreen" title="تمام صفحه">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="exec-popup__list exec-popup__list--scroll">${group.orders.map(renderOrderCard).join('')}</div>
          <div class="exec-popup__resize-handle" data-action="resize-handle"></div>
        </div>
      `;

      const marker = L.marker([group.lat, group.lng], {
        icon,
        riseOnHover: true,
        zIndexOffset: count > 1 ? 900 : 750,
      }).addTo(map);

      marker.bindPopup(popupContent, {
        maxWidth: 600,
        minWidth: 300,
        className: 'exec-order-popup',
        autoPan: true,
        autoPanPadding: [50, 50],
      });

      marker.on('popupopen', (e) => {
        const popupEl = (e.popup as any)?.getElement?.() as HTMLElement | null;
        if (!popupEl) return;

        const root = popupEl.querySelector('.exec-popup') as HTMLElement | null;
        if (!root) return;

        const contentWrapper = popupEl.querySelector('.leaflet-popup-content-wrapper') as HTMLElement | null;
        const popupContent = popupEl.querySelector('.leaflet-popup-content') as HTMLElement | null;

        // جلوگیری از drag نقشه هنگام اسکرول داخل popup
        L.DomEvent.disableClickPropagation(root);
        L.DomEvent.disableScrollPropagation(root);

        if (root.dataset.boundClick === '1') return;
        root.dataset.boundClick = '1';

        // متغیرهای resize
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        // Handler برای resize
        const resizeHandle = root.querySelector('[data-action="resize-handle"]') as HTMLElement | null;
        if (resizeHandle) {
          resizeHandle.addEventListener('mousedown', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            isResizing = true;
            startX = evt.clientX;
            startY = evt.clientY;
            startWidth = root.offsetWidth;
            startHeight = root.offsetHeight;
            document.body.style.cursor = 'nwse-resize';
            document.body.style.userSelect = 'none';
          });

          document.addEventListener('mousemove', (evt: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(280, Math.min(800, startWidth + (evt.clientX - startX)));
            const newHeight = Math.max(200, Math.min(600, startHeight + (evt.clientY - startY)));
            root.style.width = newWidth + 'px';
            const listEl = root.querySelector('.exec-popup__list--scroll') as HTMLElement | null;
            if (listEl) {
              listEl.style.maxHeight = (newHeight - 60) + 'px';
            }
            if (contentWrapper) {
              contentWrapper.style.width = (newWidth + 28) + 'px';
            }
          });

          document.addEventListener('mouseup', () => {
            if (isResizing) {
              isResizing = false;
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
            }
          });
        }

        // Handler برای resize toggle
        const resizeToggleBtn = root.querySelector('[data-action="resize-toggle"]') as HTMLElement | null;
        if (resizeToggleBtn) {
          resizeToggleBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const isExpanded = root.classList.contains('exec-popup--expanded');
            if (isExpanded) {
              root.classList.remove('exec-popup--expanded');
              root.style.width = '';
              const listEl = root.querySelector('.exec-popup__list--scroll') as HTMLElement | null;
              if (listEl) listEl.style.maxHeight = '';
              if (contentWrapper) contentWrapper.style.width = '';
            } else {
              root.classList.add('exec-popup--expanded');
              root.style.width = '450px';
              const listEl = root.querySelector('.exec-popup__list--scroll') as HTMLElement | null;
              if (listEl) listEl.style.maxHeight = '400px';
              if (contentWrapper) contentWrapper.style.width = '478px';
            }
          });
        }

        // Handler برای fullscreen
        const fullscreenBtn = root.querySelector('[data-action="fullscreen"]') as HTMLElement | null;
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const isFullscreen = root.classList.contains('exec-popup--fullscreen');
            if (isFullscreen) {
              root.classList.remove('exec-popup--fullscreen');
              popupEl.classList.remove('exec-order-popup--fullscreen');
              root.style.width = '';
              const listEl = root.querySelector('.exec-popup__list--scroll') as HTMLElement | null;
              if (listEl) listEl.style.maxHeight = '';
              if (contentWrapper) contentWrapper.style.width = '';
            } else {
              root.classList.add('exec-popup--fullscreen');
              popupEl.classList.add('exec-order-popup--fullscreen');
            }
          });
        }

        root.addEventListener('click', (evt) => {
          const target = evt.target as HTMLElement | null;
          const btn = target?.closest?.('[data-order-id]') as HTMLElement | null;
          if (!btn) return;
          evt.preventDefault();
          evt.stopPropagation();
          const id = btn.dataset.orderId;
          if (id) handleOrderClick(id);
        });
      });

      markersRef.current.push(marker);
    });

    // تنظیم نمای نقشه برای نمایش همه موقعیت‌ها
    if (orderMarkers.length === 1) {
      map.setView([orderMarkers[0].lat, orderMarkers[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(orderMarkers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [handleOrderClick, mapReady, orderMarkers]);

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* دکمه بازگشت */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="gap-2 bg-background/90 backdrop-blur-sm shadow-lg"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>
      </div>

      {/* کارت اطلاعات - قابل باز/بسته شدن */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[95vw]">
        <Card className={`bg-gradient-to-br from-background/95 to-background/90 backdrop-blur-md border-2 border-amber-500/30 shadow-2xl transition-all duration-300 ${infoCollapsed ? 'p-2' : 'p-4 sm:p-6'}`}>
          {/* دکمه باز/بسته کردن - ناحیه کلیک بزرگتر */}
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoCollapsed(!infoCollapsed);
            }}
            role="button"
            tabIndex={0}
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-20 h-20 flex items-center justify-center cursor-pointer z-[1001]"
            aria-label={infoCollapsed ? 'نمایش اطلاعات' : 'مخفی کردن اطلاعات'}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
          >
            <span className="w-14 h-14 rounded-full bg-amber-500 text-white shadow-xl flex items-center justify-center hover:bg-amber-600 active:bg-amber-700 active:scale-90 transition-all duration-100 border-4 border-white/30">
              {infoCollapsed ? <ChevronUp className="w-7 h-7" /> : <ChevronDown className="w-7 h-7" />}
            </span>
          </div>
          
          {infoCollapsed ? (
            // حالت بسته - فقط خلاصه
            <div className="flex items-center gap-3 pt-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold">{orders?.length || 0} سفارش</span>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-sm">{orderMarkers.length} موقعیت</span>
            </div>
          ) : (
            // حالت باز - اطلاعات کامل
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                <p className="text-center text-base sm:text-xl font-bold text-foreground">
                  سفارشات داربست به همراه اجناس
                </p>
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
              </div>
              <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap justify-center">
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary/10 rounded-full">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <span className="text-muted-foreground">استان قم</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 rounded-full">
                  <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                  <span className="text-muted-foreground">{orderMarkers.length} موقعیت</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/10 rounded-full">
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                  <span className="text-muted-foreground">{orders?.length || 0} سفارش</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">برای مدیریت روی هر سفارش کلیک کنید</p>
            </div>
          )}
        </Card>
      </div>

      {/* لودینگ */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-[999]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            <p className="text-lg font-semibold">در حال بارگذاری نقشه...</p>
          </div>
        </div>
      )}

      {/* نقشه */}
      <div ref={mapContainer} className="absolute inset-0" />

       {/* استایل سفارشی */}
      <style>{`
        .exec-order-marker {
          background: transparent !important;
          border: none !important;
        }

        .exec-center-marker {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          position: relative;
          user-select: none;
        }

        .exec-center-marker__dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: hsl(var(--destructive));
          border: 2px solid hsl(var(--background));
          box-shadow: 0 10px 24px hsl(var(--destructive) / 0.28);
          transition: transform 150ms ease, filter 150ms ease;
        }

        .exec-center-marker:hover .exec-center-marker__dot {
          transform: scale(1.16);
          filter: brightness(1.02);
        }

        .exec-center-marker__count {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-construction);
          color: hsl(var(--accent-foreground));
          border: 2px solid hsl(var(--background));
          box-shadow: var(--shadow-construction);
          font-size: 11px;
          font-weight: 900;
        }

        .exec-order-marker__dot {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: var(--dot-bg, hsl(var(--construction)));
          border: 3px solid hsl(var(--background));
          box-shadow: var(--shadow-md);
          transition: transform 150ms ease;
        }

        .exec-order-marker__dot:hover {
          transform: scale(1.08);
        }

        .exec-order-marker__thumb {
          width: 56px;
          height: 56px;
          border-radius: 10px;
          overflow: hidden;
          background: hsl(var(--muted));
          border: 2px solid hsl(var(--background));
          box-shadow: var(--shadow-lg);
          position: relative;
        }

        .exec-order-marker__thumb img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .exec-order-marker__thumb-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          background: hsl(var(--background) / 0.72);
          color: hsl(var(--foreground));
          font-size: 11px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          backdrop-filter: blur(6px);
        }

        .exec-order-marker__pin {
          position: absolute;
          left: 50%;
          bottom: -7px;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: hsl(var(--destructive));
          border: 2px solid hsl(var(--background));
          box-shadow: 0 8px 18px hsl(var(--destructive) / 0.35);
        }

        .exec-order-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: var(--shadow-xl);
          padding: 0;
          background: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
        }

        .exec-order-popup .leaflet-popup-content {
          margin: 12px 14px;
          direction: rtl;
          text-align: right;
          font-family: Vazirmatn, sans-serif;
        }

        .exec-order-popup .leaflet-popup-tip {
          background: hsl(var(--popover));
          box-shadow: var(--shadow-md);
        }

        .exec-order-popup .leaflet-popup-close-button {
          color: hsl(var(--muted-foreground));
          font-size: 20px;
          padding: 6px 8px;
        }

        .exec-order-popup .leaflet-popup-close-button:hover {
          color: hsl(var(--foreground));
        }

        .exec-popup {
          position: relative;
          transition: width 0.2s ease, height 0.2s ease;
        }

        .exec-popup__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid hsl(var(--border));
        }

        .exec-popup__title {
          font-weight: 900;
          font-size: 13px;
          flex: 1;
        }

        .exec-popup__actions {
          display: flex;
          gap: 4px;
        }

        .exec-popup__resize-btn,
        .exec-popup__fullscreen-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
          border-radius: 6px;
          cursor: pointer;
          color: hsl(var(--muted-foreground));
          transition: all 0.15s ease;
        }

        .exec-popup__resize-btn:hover,
        .exec-popup__fullscreen-btn:hover {
          background: hsl(var(--accent));
          color: hsl(var(--foreground));
        }

        .exec-popup__resize-handle {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 20px;
          height: 20px;
          cursor: nwse-resize;
          opacity: 0.5;
          transition: opacity 0.15s ease;
        }

        .exec-popup__resize-handle::before {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 4px;
          width: 10px;
          height: 10px;
          border-left: 2px solid hsl(var(--muted-foreground));
          border-bottom: 2px solid hsl(var(--muted-foreground));
        }

        .exec-popup__resize-handle:hover {
          opacity: 1;
        }

        .exec-popup--expanded .exec-popup__resize-btn svg {
          transform: rotate(180deg);
        }

        .exec-popup--fullscreen {
          position: fixed !important;
          top: 60px !important;
          left: 20px !important;
          right: 20px !important;
          bottom: 20px !important;
          width: auto !important;
          max-width: none !important;
          z-index: 10000 !important;
          background: hsl(var(--popover));
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .exec-popup--fullscreen .exec-popup__list--scroll {
          max-height: calc(100vh - 200px) !important;
        }

        .exec-popup--fullscreen .exec-popup__fullscreen-btn svg {
          transform: rotate(180deg);
        }

        .exec-order-popup--fullscreen .leaflet-popup-content-wrapper {
          position: fixed !important;
          top: 50px !important;
          left: 10px !important;
          right: 10px !important;
          bottom: 10px !important;
          width: auto !important;
          max-width: none !important;
          border-radius: 16px;
        }

        .exec-order-popup--fullscreen .leaflet-popup-content {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 16px !important;
        }

        .exec-order-popup--fullscreen .leaflet-popup-tip-container {
          display: none;
        }

        .exec-popup__list {
          display: grid;
          gap: 10px;
        }

        .exec-popup__list--scroll {
          max-height: 280px;
          overflow-y: auto;
          padding: 0 2px;
          -webkit-overflow-scrolling: touch;
        }

        .exec-popup__list--scroll::-webkit-scrollbar {
          width: 8px;
        }

        .exec-popup__list--scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 999px;
        }

        .exec-popup__list--scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .exec-popup__order {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px;
          border-radius: 12px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }

        .exec-popup__thumb {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          overflow: hidden;
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }

        .exec-popup__thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .exec-popup__thumb--empty {
          background: hsl(var(--muted));
        }

        .exec-order-marker__thumb--default {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--border)) 100%);
        }

        .exec-order-marker__default-icon {
          width: 28px;
          height: 28px;
          color: hsl(var(--muted-foreground));
        }

        .exec-order-marker__default-icon svg {
          width: 100%;
          height: 100%;
        }

        .exec-popup__meta {
          flex: 1;
          min-width: 0;
        }

        .exec-popup__code {
          font-weight: 800;
          font-size: 13px;
          color: hsl(var(--foreground));
        }

        .exec-popup__address {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          margin-top: 4px;
          line-height: 1.5;
        }

        .exec-popup__customer {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          margin-top: 4px;
        }

        .exec-popup__description {
          font-size: 11px;
          color: hsl(var(--primary));
          margin-top: 4px;
          font-weight: 500;
        }

        .exec-popup__dimensions {
          font-size: 11px;
          color: #d97706;
          margin-top: 4px;
          font-weight: 600;
          background: rgba(254, 243, 199, 0.5);
          padding: 2px 8px;
          border-radius: 4px;
          display: inline-block;
        }

        .exec-popup__service-type {
          font-size: 11px;
          color: #059669;
          margin-top: 4px;
          font-weight: 500;
        }

        .exec-popup__status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
          font-size: 11px;
          font-weight: 800;
        }

        .exec-popup__status-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
        }

        .exec-popup__cta {
          margin-top: 10px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          cursor: pointer;
          background: var(--gradient-construction);
          color: hsl(var(--accent-foreground));
          font-weight: 900;
          font-size: 12px;
          padding: 9px 12px;
          border-radius: 10px;
          box-shadow: var(--shadow-construction);
          transition: transform 150ms ease, filter 150ms ease;
          font-family: Vazirmatn, sans-serif;
        }

        .exec-popup__cta:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }
      `}</style>
    </div>
  );
}
