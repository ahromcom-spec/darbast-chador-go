import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SimpleLeafletMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function SimpleLeafletMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: SimpleLeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(null);

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

      // ذخیره موقعیت
      setSelectedPos({ lat, lng });
      onLocationSelect(lat, lng);
    });

    // Resize handler برای modal
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    // اطمینان از resize صحیح
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (markerRef.current) {
        markerRef.current.remove();
      }
      map.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLng, onLocationSelect]);

  return (
    <div className="h-full w-full relative">
      <div 
        ref={mapContainer} 
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
      {selectedPos && (
        <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg z-[1000]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span className="font-medium text-sm">موقعیت انتخاب شده:</span>
            </div>
            <div className="flex items-center gap-4 text-sm font-mono">
              <span className="text-muted-foreground">
                عرض: <span className="text-foreground font-semibold">{selectedPos.lat.toFixed(6)}</span>
              </span>
              <span className="text-muted-foreground">
                طول: <span className="text-foreground font-semibold">{selectedPos.lng.toFixed(6)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
