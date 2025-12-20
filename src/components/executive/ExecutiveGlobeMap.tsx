import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, MapPin, X, Package, Building2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface OrderData {
  id: string;
  code: string;
  address: string;
  status: string;
  customer_name: string | null;
  location_lat: number;
  location_lng: number;
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

interface OrderMarker {
  lat: number;
  lng: number;
  orders: OrderData[];
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
    queryFn: async () => {
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
      const scaffoldOrders = data?.filter(order => {
        const subcategoryCode = order.subcategories?.code;
        const serviceTypeCode = order.subcategories?.service_types_v3?.code;
        return subcategoryCode === '10' && serviceTypeCode === '10';
      }) || [];

      return scaffoldOrders as OrderData[];
    }
  });

  // گروه‌بندی سفارشات بر اساس موقعیت
  const orderMarkers = useMemo(() => {
    if (!orders || orders.length === 0) return [];

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
    })) as OrderMarker[];
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

  // رسم مارکرها - استایل مشابه نقشه مشتری
  useEffect(() => {
    if (!mapRef.current || !mapReady || orderMarkers.length === 0) return;

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const statusColors: Record<string, string> = {
      pending: '#f59e0b',
      pending_execution: '#f59e0b',
      approved: '#22c55e',
      in_progress: '#3b82f6',
      completed: '#8b5cf6',
      paid: '#06b6d4',
    };

    orderMarkers.forEach(marker => {
      const hasMultiple = marker.orders.length > 1;
      const count = marker.orders.length;
      const firstOrder = marker.orders[0];
      const singleColor = statusColors[firstOrder.status] || '#f59e0b';

      // ساخت آیکون سفارشی - مشابه نقشه مشتری
      let icon: L.DivIcon;
      
      if (hasMultiple) {
        // مارکر چندتایی با عدد - مثل نقشه مشتری
        icon = L.divIcon({
          className: 'cluster-order-marker',
          html: `
            <div style="
              position: relative;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(245, 158, 11, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                color: white;
                font-size: 14px;
                font-weight: bold;
                font-family: Vazirmatn, sans-serif;
              "
              onmouseover="this.style.transform='scale(1.1)'"
              onmouseout="this.style.transform='scale(1)'"
              >
                ${count}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });
      } else {
        // مارکر تکی - دایره رنگی بدون عدد
        icon = L.divIcon({
          className: 'single-order-marker',
          html: `
            <div style="
              position: relative;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${singleColor} 0%, ${singleColor}dd 100%);
                border: 3px solid white;
                box-shadow: 0 3px 10px ${singleColor}66;
                cursor: pointer;
                transition: all 0.2s ease;
              "
              onmouseover="this.style.transform='scale(1.1)'"
              onmouseout="this.style.transform='scale(1)'"
              >
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });
      }

      const m = L.marker([marker.lat, marker.lng], { icon }).addTo(mapRef.current!);

      // ساخت محتوای پاپ‌آپ
      let popupContent = `
        <div style="direction: rtl; text-align: right; min-width: 220px; max-width: 300px; font-family: Vazirmatn, sans-serif;">
      `;

      if (hasMultiple) {
        popupContent += `
          <div style="
            font-weight: bold; 
            color: #d97706; 
            margin-bottom: 10px; 
            display: flex; 
            align-items: center; 
            gap: 6px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f59e0b20;
          ">
            <span style="font-size: 18px;">📦</span>
            <span style="font-size: 15px;">${count} سفارش در این موقعیت</span>
          </div>
        `;
      }

      marker.orders.forEach((order, index) => {
        const statusLabel = {
          pending: 'در انتظار تایید',
          pending_execution: 'آماده اجرا',
          approved: 'تایید شده',
          in_progress: 'در حال اجرا',
          completed: 'تکمیل شده',
          paid: 'پرداخت شده'
        }[order.status] || order.status;

        const statusColor = statusColors[order.status] || '#f59e0b';

        popupContent += `
          <div style="
            ${index > 0 ? 'border-top: 1px solid #e5e7eb; margin-top: 10px; padding-top: 10px;' : ''}
          ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <div style="
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: ${statusColor};
                flex-shrink: 0;
              "></div>
              <span style="font-weight: 600; font-size: 14px; color: #1f2937;">
                کد: ${order.code}
              </span>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px; line-height: 1.5;">
              📍 ${order.address || 'بدون آدرس'}
            </div>
            ${order.customer_name ? `
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
                👤 ${order.customer_name}
              </div>
            ` : ''}
            <div style="
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
              background: ${statusColor}15;
              color: ${statusColor};
              margin-bottom: 8px;
            ">
              ${statusLabel}
            </div>
            <button 
              onclick="window.dispatchEvent(new CustomEvent('orderClick', {detail: '${order.id}'}))"
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                width: 100%;
                padding: 8px 14px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                font-family: Vazirmatn, sans-serif;
                transition: all 0.2s ease;
                box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
              "
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 10px rgba(245, 158, 11, 0.4)';"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(245, 158, 11, 0.3)';"
            >
              <span>👁️</span>
              <span>مشاهده و مدیریت</span>
            </button>
          </div>
        `;
      });

      popupContent += '</div>';

      m.bindPopup(popupContent, {
        maxWidth: 320,
        className: 'order-popup',
        autoPan: true,
        autoPanPadding: [50, 50]
      });

      markersRef.current.push(m);
    });

    // تنظیم نمای نقشه برای نمایش همه مارکرها
    if (orderMarkers.length > 0) {
      const bounds = L.latLngBounds(orderMarkers.map(m => [m.lat, m.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

  }, [mapReady, orderMarkers]);

  // گوش دادن به رویداد کلیک سفارش
  useEffect(() => {
    const handleCustomOrderClick = (e: CustomEvent) => {
      handleOrderClick(e.detail);
    };

    window.addEventListener('orderClick', handleCustomOrderClick as EventListener);
    return () => {
      window.removeEventListener('orderClick', handleCustomOrderClick as EventListener);
    };
  }, [handleOrderClick]);

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
        .cluster-order-marker,
        .single-order-marker {
          background: transparent !important;
          border: none !important;
        }
        .order-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          padding: 0;
        }
        .order-popup .leaflet-popup-content {
          margin: 14px 16px;
        }
        .order-popup .leaflet-popup-tip {
          background: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .order-popup .leaflet-popup-close-button {
          color: #9ca3af;
          font-size: 20px;
          padding: 6px 8px;
        }
        .order-popup .leaflet-popup-close-button:hover {
          color: #374151;
        }
      `}</style>
    </div>
  );
}
