import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-rtl-text';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
}

// مختصات مرکز استان‌ها
const PROVINCE_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  '10': { lat: 34.6416, lng: 50.8746, zoom: 11 }, // قم
  '01': { lat: 35.6892, lng: 51.3890, zoom: 10 }, // تهران
  '02': { lat: 38.0800, lng: 46.2919, zoom: 9 },  // آذربایجان شرقی
  '03': { lat: 37.5500, lng: 45.0800, zoom: 9 },  // آذربایجان غربی
  '04': { lat: 34.7993, lng: 48.5146, zoom: 10 }, // اردبیل
  '05': { lat: 32.6546, lng: 51.6680, zoom: 10 }, // اصفهان
  '06': { lat: 36.2605, lng: 59.6168, zoom: 9 },  // خراسان رضوی
  '07': { lat: 31.8974, lng: 54.3569, zoom: 9 },  // خراسان جنوبی
  '08': { lat: 37.4713, lng: 57.3317, zoom: 9 },  // خراسان شمالی
  '09': { lat: 33.4877, lng: 48.3551, zoom: 10 }, // خوزستان
  '11': { lat: 36.8431, lng: 54.4751, zoom: 10 }, // مازندران
  '12': { lat: 29.4963, lng: 60.8632, zoom: 9 },  // سیستان و بلوچستان
  '13': { lat: 36.5659, lng: 53.0586, zoom: 10 }, // گلستان
  '14': { lat: 37.2808, lng: 49.5932, zoom: 10 }, // گیلان
  '15': { lat: 35.7011, lng: 51.4050, zoom: 10 }, // البرز
  '16': { lat: 28.3665, lng: 52.5272, zoom: 10 }, // فارس
  '17': { lat: 34.0917, lng: 49.6947, zoom: 10 }, // مرکزی
  '18': { lat: 27.1937, lng: 56.2778, zoom: 10 }, // هرمزگان
  '19': { lat: 35.3219, lng: 50.9934, zoom: 10 }, // سمنان
  '20': { lat: 33.6190, lng: 46.1097, zoom: 10 }, // کرمانشاه
  '21': { lat: 30.2839, lng: 57.0834, zoom: 9 },  // کرمان
  '22': { lat: 33.9869, lng: 50.8489, zoom: 10 }, // قزوین
  '23': { lat: 34.3420, lng: 47.0650, zoom: 10 }, // کردستان
  '24': { lat: 31.8934, lng: 49.5669, zoom: 10 }, // کهگیلویه و بویراحمد
  '25': { lat: 34.0800, lng: 59.1048, zoom: 10 }, // یزد
  '26': { lat: 33.6320, lng: 48.6858, zoom: 10 }, // لرستان
  '27': { lat: 35.5528, lng: 52.5289, zoom: 10 }, // زنجان
  '28': { lat: 28.8700, lng: 50.8380, zoom: 10 }, // بوشهر
  '29': { lat: 35.5569, lng: 45.0761, zoom: 10 }, // اردبیل
  '30': { lat: 34.6401, lng: 50.8764, zoom: 10 }, // قم
  '31': { lat: 32.4279, lng: 53.6880, zoom: 10 }, // یزد
};

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
  provinceCode
}: InteractiveLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Resolve Mapbox token (public)
    const mapboxToken =
      (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ||
      (document.querySelector('meta[name="mapbox-token"]')?.getAttribute('content') || '');
    
    if (!mapboxToken) {
      console.warn('Mapbox token not configured. Map will not be displayed.');
      setIsLoading(false);
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Determine initial center based on province or initial coordinates
    let center: [number, number] = [initialLng, initialLat];
    let zoom = 12;

    if (provinceCode && PROVINCE_CENTERS[provinceCode]) {
      const provinceCenter = PROVINCE_CENTERS[provinceCode];
      center = [provinceCenter.lng, provinceCenter.lat];
      zoom = provinceCenter.zoom;
    }

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom,
      language: 'fa'
    });

    // Add RTL support for Persian text
    map.current.on('load', () => {
      setIsLoading(false);
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: false,
      }),
      'top-left'
    );

    // Add marker if initial coordinates are provided
    if (initialLat && initialLng && initialLat !== 0 && initialLng !== 0) {
      marker.current = new mapboxgl.Marker({
        draggable: true,
        color: '#FF6B35'
      })
        .setLngLat([initialLng, initialLat])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        if (marker.current) {
          const lngLat = marker.current.getLngLat();
          onLocationSelect(lngLat.lat, lngLat.lng);
        }
      });
    }

    // Add click event to place marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;

      // Remove existing marker if any
      if (marker.current) {
        marker.current.remove();
      }

      // Add new draggable marker
      marker.current = new mapboxgl.Marker({
        draggable: true,
        color: '#FF6B35'
      })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      marker.current.on('dragend', () => {
        if (marker.current) {
          const lngLat = marker.current.getLngLat();
          onLocationSelect(lngLat.lat, lngLat.lng);
        }
      });

      onLocationSelect(lat, lng);
    });

    // Cleanup
    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Update map center when province changes
  useEffect(() => {
    if (map.current && provinceCode && PROVINCE_CENTERS[provinceCode]) {
      const provinceCenter = PROVINCE_CENTERS[provinceCode];
      map.current.flyTo({
        center: [provinceCenter.lng, provinceCenter.lat],
        zoom: provinceCenter.zoom,
        duration: 2000
      });
    }
  }, [provinceCode]);

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden border-2 border-primary/20">
      <div ref={mapContainer} className="absolute inset-0" />
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">در حال بارگذاری نقشه...</p>
          </div>
        </div>
      )}
      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="font-medium">روی نقشه کلیک کنید</span>
        </div>
      </div>
    </div>
  );
}
