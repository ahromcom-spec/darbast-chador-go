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
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number; distance: number } | null>(null);

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
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // حذف marker قبلی
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // اضافه کردن marker جدید
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      markerRef.current = marker;

      // محاسبه فاصله تا مرکز قم
      const distance = calculateDistance(lat, lng, QOM_CENTER.lat, QOM_CENTER.lng);

      // ذخیره موقعیت و فاصله
      setSelectedPos({ lat, lng, distance });
      onLocationSelect(lat, lng);
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
        <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg z-[1000]">
          <div className="flex items-center justify-center gap-2 text-sm">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-foreground">
              فاصله موقعیت انتخابی تا مرکز شهر قم: <span className="font-bold text-primary">{selectedPos.distance.toFixed(1)}</span> کیلومتر
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
