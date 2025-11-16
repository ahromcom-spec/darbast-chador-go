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
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // حذف marker قبلی
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // اضافه کردن marker جدید
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      markerRef.current = marker;

      // محاسبه فاصله هوایی تا مرکز قم
      const distance = calculateDistance(lat, lng, QOM_CENTER.lat, QOM_CENTER.lng);

      // ذخیره موقعیت و فاصله هوایی
      setSelectedPos({ lat, lng, distance });
      onLocationSelect(lat, lng);

      // محاسبه فاصله جاده‌ای
      setLoadingRoute(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${QOM_CENTER.lng},${QOM_CENTER.lat};${lng},${lat}?overview=false`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const roadDistanceKm = data.routes[0].distance / 1000; // تبدیل متر به کیلومتر
          setSelectedPos({ lat, lng, distance, roadDistance: roadDistanceKm });
        }
      } catch (error) {
        console.error('خطا در محاسبه مسیر جاده‌ای:', error);
      } finally {
        setLoadingRoute(false);
      }
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full w-full relative">
      <div 
        ref={mapContainer} 
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
      {selectedPos && (
        <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-4 shadow-lg z-[1000]">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="font-medium text-foreground text-base">
              {loadingRoute ? (
                <span>در حال محاسبه مسیر جاده‌ای...</span>
              ) : selectedPos.roadDistance ? (
                <span>فاصله جاده‌ای تا مرکز شهر قم: <span className="font-bold text-primary">{selectedPos.roadDistance.toFixed(1)}</span> کیلومتر</span>
              ) : null}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
