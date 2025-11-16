import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SimpleLeafletMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

// مختصات مرکز شهر قم
const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

// محاسبه فاصله بین دو نقطه جغرافیایی (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // شعاع زمین به کیلومتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SimpleLeafletMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: SimpleLeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const qomCenterMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number; distance: number; roadDistance?: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // محاسبه نقطه شروع: اگر مختصات نامعتبر یا 0 باشند، روی قم قرار بده
    const startLat = (initialLat >= 24 && initialLat <= 40) ? initialLat : 34.6416;
    const startLng = (initialLng >= 44 && initialLng <= 64) ? initialLng : 50.8746;

    // ایجاد نقشه
    const map = L.map(mapContainer.current, {
      center: [startLat, startLng],
      zoom: 12,
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

    // تنظیم marker icon
    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    // اضافه کردن مارکر دائمی برای مرکز شهر قم
    const qomCenterIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [30, 49],
      iconAnchor: [15, 49],
      popupAnchor: [1, -34],
      shadowSize: [49, 49],
    });

    const qomCenterMarker = L.marker([QOM_CENTER.lat, QOM_CENTER.lng], { icon: qomCenterIcon }).addTo(map);
    qomCenterMarker.bindPopup('<div style="text-align: center; font-family: Vazir, sans-serif;"><strong>مرکز شهر قم</strong></div>');
    qomCenterMarkerRef.current = qomCenterMarker;

    // رویداد کلیک روی نقشه
    // کمک‌تابع: رسم خط مستقیم در صورت عدم دسترسی به سرویس مسیریابی
    const drawStraightLine = (lat: number, lng: number) => {
      // حذف مسیر قبلی
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }
      const straight = L.polyline(
        [
          [QOM_CENTER.lat, QOM_CENTER.lng],
          [lat, lng],
        ],
        { color: '#2563eb', weight: 4, opacity: 0.7 }
      ).addTo(map);
      routeLineRef.current = straight;
      // نمایش کل خط در قاب
      const bounds = L.latLngBounds([
        [QOM_CENTER.lat, QOM_CENTER.lng],
        [lat, lng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    };

    // کمک‌تابع: محاسبه و رسم مسیر جاده‌ای
    const computeRoute = async (lat: number, lng: number) => {
      const distance = calculateDistance(QOM_CENTER.lat, QOM_CENTER.lng, lat, lng);
      // ذخیره موقعیت و فاصله هوایی
      setSelectedPos({ lat, lng, distance });
      onLocationSelect(lat, lng);

      setLoadingRoute(true);
      try {
        const endpoints = [
          'https://router.project-osrm.org/route/v1/driving',
          'https://routing.openstreetmap.de/routed-car/route/v1/driving'
        ];

        let routeData: any | null = null;
        for (const endpoint of endpoints) {
          try {
            const url = `${endpoint}/${QOM_CENTER.lng},${QOM_CENTER.lat};${lng},${lat}?overview=full&geometries=geojson&alternatives=false`;
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) continue;
            const json = await res.json();
            if (json?.routes?.length) {
              routeData = json;
              break;
            }
          } catch (_) {
            // try next endpoint
          }
        }

        if (routeData?.routes?.length) {
          const roadDistanceKm = routeData.routes[0].distance / 1000;
          setSelectedPos({ lat, lng, distance, roadDistance: roadDistanceKm });

          // حذف مسیر قبلی
          if (routeLineRef.current) {
            routeLineRef.current.remove();
          }

          // رسم مسیر جاده‌ای روی نقشه
          const coordinates = routeData.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
          );
          const routeLine = L.polyline(coordinates, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // نمایش مسیر کامل در قاب
          const bounds = L.latLngBounds(coordinates as [number, number][]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

          routeLineRef.current = routeLine;
        } else {
          // اگر هیچ سرویس مسیری پاسخ نداد، خط مستقیم رسم شود
          drawStraightLine(lat, lng);
        }
      } catch (error) {
        console.error('خطا در محاسبه مسیر جاده‌ای:', error);
        drawStraightLine(lat, lng);
      } finally {
        setLoadingRoute(false);
      }
    };

    // رویداد کلیک روی نقشه
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // حذف marker قبلی
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // اضافه کردن marker جدید (قابل‌جابجایی)
      const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
      markerRef.current = marker;

      // محاسبه و رسم مسیر برای این نقطه
      await computeRoute(lat, lng);

      // در صورت drag شدن مارکر، مسیر مجدد محاسبه شود
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await computeRoute(pos.lat, pos.lng);
      });
    });

    // Resize handler برای modal - فقط یک بار اجرا می‌شود
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // فقط یک بار resize می‌کنیم بعد از 200ms
    const resizeTimeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
      }
    }, 200);

    // Cleanup
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (qomCenterMarkerRef.current) {
        qomCenterMarkerRef.current.remove();
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full">
      <div
        ref={mapContainer}
        className="w-full rounded-lg border border-border"
        style={{ minHeight: '420px' }}
      />

      {selectedPos && (
        <div className="mt-3 w-full text-center">
          {loadingRoute ? (
            <span className="text-sm text-muted-foreground">در حال محاسبه مسیر جاده‌ای...</span>
          ) : selectedPos.roadDistance ? (
            <span className="text-sm font-medium text-foreground">
              فاصله جاده‌ای تا مرکز شهر قم: <span className="font-bold text-primary">{selectedPos.roadDistance.toFixed(1)}</span> کیلومتر
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">مسیر جاده‌ای در دسترس نبود، خط مستقیم نمایش داده شد.</span>
          )}
        </div>
      )}
    </div>
  );
}
