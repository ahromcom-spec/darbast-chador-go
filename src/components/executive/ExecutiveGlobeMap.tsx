import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Package, Building2 } from 'lucide-react';
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

interface OrderData {
  id: string;
  code: string;
  address: string;
  status: OrderStatus;
  customer_name: string | null;
  location_lat: number;
  location_lng: number;
  first_image_url?: string | null;
  images_count?: number;
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
}

export default function ExecutiveGlobeMap({ onClose, onOrderClick }: ExecutiveGlobeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const osmLayerRef = useRef<L.TileLayer | null>(null);
  const mapboxLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();

  // مختصات مرکز استان قم
  const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

  // دریافت سفارشات داربست به همراه اجناس
  const { data: orders, isLoading } = useQuery({
    queryKey: ['executive-globe-map-orders'],
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
          subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code,
            service_types_v3 (
              id,
              name,
              code
            )
          )
        `)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .neq('location_lat', 0)
        .neq('location_lng', 0)
        .in('status', ['pending', 'pending_execution', 'approved', 'in_progress', 'completed', 'paid']);

      if (error) throw error;

      // فیلتر کردن فقط سفارشات داربست به همراه اجناس
      const scaffoldOrders =
        data?.filter((order) => {
          const subcategoryCode = order.subcategories?.code;
          const serviceTypeCode = order.subcategories?.service_types_v3?.code;
          return subcategoryCode === '10' && serviceTypeCode === '10';
        }) || [];

      const typedOrders = scaffoldOrders as OrderData[];
      const orderIds = typedOrders.map((o) => o.id);

      if (orderIds.length === 0) return [];

      // دریافت media برای هر سفارش (برای ساخت marker های تصویری مثل نقشه صفحه اصلی)
      const { data: mediaData, error: mediaError } = await supabase
        .from('project_media')
        .select('id, project_id, file_path, thumbnail_path, file_type, created_at, mime_type')
        .in('project_id', orderIds)
        .in('file_type', ['image', 'video'])
        .order('created_at', { ascending: false })
        .limit(2000);

      if (mediaError) {
        console.warn('[ExecutiveGlobeMap] Failed to fetch media for orders:', mediaError);
      }

      const mediaByOrder = new Map<string, OrderMedia[]>();
      (mediaData || []).forEach((m) => {
        const oid = (m as any).project_id as string;
        if (!mediaByOrder.has(oid)) mediaByOrder.set(oid, []);
        mediaByOrder.get(oid)!.push(m as any);
      });

      const imageCountByOrder = new Map<string, number>();
      const firstImageByOrder = new Map<string, OrderMedia>();

      orderIds.forEach((oid) => {
        const list = mediaByOrder.get(oid) || [];
        const images = list.filter((x) => x.file_type === 'image');
        imageCountByOrder.set(oid, images.length);
        if (images[0]) firstImageByOrder.set(oid, images[0]);
      });

      // برای هر سفارش، URL قابل نمایش بسازیم (اول signed؛ اگر نشد public)
      const urlByOrder = new Map<string, string>();
      const entries = Array.from(firstImageByOrder.entries()).map(([orderId, m]) => ({
        orderId,
        path: m.thumbnail_path || m.file_path,
      }));

      const chunkSize = 12;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map(async ({ orderId, path }) => {
            try {
              const { data: signedData, error: signedError } = await supabase.storage
                .from('order-media')
                .createSignedUrl(path, 3600);

              if (signedData?.signedUrl && !signedError) {
                return [orderId, signedData.signedUrl] as const;
              }
            } catch (_) {}

            const pub = supabase.storage
              .from('order-media')
              .getPublicUrl(path, { transform: { width: 240, quality: 70 } }).data.publicUrl;

            return [orderId, pub] as const;
          })
        );

        results.forEach(([orderId, url]) => urlByOrder.set(orderId, url));
      }

      return typedOrders.map((o) => ({
        ...o,
        images_count: imageCountByOrder.get(o.id) ?? 0,
        first_image_url: urlByOrder.get(o.id) ?? null,
      }));
    },
  });

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

      toast({
        title: 'نقشه جایگزین فعال شد',
        description: 'به دلیل عدم دسترسی پایدار به سرویس نقشه، از نقشه جایگزین استفاده شد.',
        variant: 'default',
      });
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

  // تابع کلیک روی سفارش
  const handleOrderClick = useCallback((orderId: string) => {
    if (onOrderClick) {
      onOrderClick(orderId);
    } else {
      navigate(`/executive/orders?orderId=${orderId}`);
    }
    onClose();
  }, [onOrderClick, navigate, onClose]);

  // رسم مارکرها (مثل نقشه صفحه اصلی: تک‌سفارش = عکس، چندسفارش = دایره عددی)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (orderMarkers.length === 0) return;

    const map = mapRef.current;

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

    const clusterIcon = (count: number) =>
      L.divIcon({
        className: 'exec-order-marker',
        html: `<div class="exec-order-marker__cluster"><span>${count}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -18],
      });

    const dotIcon = (color: string) =>
      L.divIcon({
        className: 'exec-order-marker',
        html: `<div class="exec-order-marker__dot" style="--dot-bg:${color};"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });

    const thumbIcon = (url: string, count: number) => {
      const safeUrl = escapeHtml(url);
      const badge = count > 1 ? `<div class="exec-order-marker__thumb-badge">${count}</div>` : '';
      return L.divIcon({
        className: 'exec-order-marker',
        html: `
          <div class="exec-order-marker__thumb">
            <img src="${safeUrl}" alt="عکس سفارش" loading="lazy" decoding="async" />
            ${badge}
            <div class="exec-order-marker__pin" aria-hidden="true"></div>
          </div>
        `,
        iconSize: [56, 63],
        iconAnchor: [28, 56],
        popupAnchor: [0, -54],
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

      return `
        <div class="exec-popup__order">
          ${img}
          <div class="exec-popup__meta">
            <div class="exec-popup__code">کد: ${code}</div>
            <div class="exec-popup__address">📍 ${address}</div>
            ${customer ? `<div class="exec-popup__customer">👤 ${customer}</div>` : ''}
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

    orderMarkers.forEach((group) => {
      const hasMultiple = group.orders.length > 1;
      const count = group.orders.length;
      const first = group.orders[0];

      const icon = hasMultiple
        ? clusterIcon(count)
        : first.first_image_url
          ? thumbIcon(first.first_image_url, first.images_count ?? 0)
          : dotIcon(statusColor(first.status || 'pending'));

      const header = hasMultiple
        ? `<div class="exec-popup__title">📦 ${count} سفارش در این موقعیت</div>`
        : `<div class="exec-popup__title">📍 جزئیات سفارش</div>`;

      const body = group.orders.map(renderOrderCard).join('');

      const popupContent = `
        <div class="exec-popup">
          ${header}
          <div class="exec-popup__list">${body}</div>
        </div>
      `;

      const marker = L.marker([group.lat, group.lng], {
        icon,
        riseOnHover: true,
        zIndexOffset: hasMultiple ? 400 : 600,
      }).addTo(map);

      marker.bindPopup(popupContent, {
        maxWidth: 360,
        className: 'exec-order-popup',
        autoPan: true,
        autoPanPadding: [50, 50],
      });

      marker.on('popupopen', (e) => {
        const popupEl = (e.popup as any)?.getElement?.() as HTMLElement | null;
        if (!popupEl) return;
        popupEl.querySelectorAll<HTMLElement>('[data-order-id]').forEach((btn) => {
          btn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const id = btn.dataset.orderId;
            if (id) handleOrderClick(id);
          });
        });
      });

      markersRef.current.push(marker);
    });

    // تنظیم نمای نقشه برای نمایش همه مارکرها
    if (orderMarkers.length === 1) {
      map.setView([orderMarkers[0].lat, orderMarkers[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(orderMarkers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [handleOrderClick, mapReady, orderMarkers]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* دکمه بستن */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-background/90 backdrop-blur-sm shadow-lg"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* کارت اطلاعات */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
        <Card className="p-6 bg-gradient-to-br from-background/95 to-background/90 backdrop-blur-md border-2 border-amber-500/30 shadow-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
              <p className="text-center text-xl font-bold text-foreground">
                سفارشات داربست به همراه اجناس
              </p>
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">استان قم</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">{orderMarkers.length} موقعیت</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-full">
                <Package className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">{orders?.length || 0} سفارش</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">برای مدیریت روی هر سفارش کلیک کنید</p>
          </div>
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

        .exec-order-marker__cluster {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-construction);
          border: 3px solid hsl(var(--background));
          color: hsl(var(--accent-foreground));
          font-size: 14px;
          font-weight: 800;
          box-shadow: var(--shadow-construction);
          transition: transform 150ms ease, filter 150ms ease;
          user-select: none;
        }

        .exec-order-marker__cluster:hover {
          transform: scale(1.08);
          filter: brightness(1.02);
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

        .exec-popup__title {
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid hsl(var(--border));
        }

        .exec-popup__list {
          display: grid;
          gap: 10px;
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
