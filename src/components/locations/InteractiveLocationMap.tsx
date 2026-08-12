import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Locate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SimpleLeafletMap, { SimpleLeafletMapRef } from './SimpleLeafletMap';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number, distance?: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
  districtId?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// مختصات مراکز استان‌های ایران
const provinceCoordinates: { [key: string]: { lat: number; lng: number; zoom: number } } = {
  '10': { lat: 34.6416, lng: 50.8746, zoom: 12 }, // قم
  '08': { lat: 35.6892, lng: 51.3890, zoom: 11 }, // تهران
  '01': { lat: 38.0800, lng: 46.2919, zoom: 10 },
  '03': { lat: 37.4531, lng: 45.0000, zoom: 10 },
  '02': { lat: 34.7981, lng: 48.5146, zoom: 10 },
  '04': { lat: 31.8974, lng: 54.3569, zoom: 10 },
  '17': { lat: 34.0817, lng: 49.7013, zoom: 10 },
  '05': { lat: 31.3183, lng: 48.6706, zoom: 10 },
  '06': { lat: 27.1865, lng: 56.2808, zoom: 10 },
  '07': { lat: 35.5611, lng: 51.4231, zoom: 11 },
  '09': { lat: 32.6546, lng: 51.6679, zoom: 10 },
  '11': { lat: 36.2381, lng: 59.6161, zoom: 10 },
  '29': { lat: 32.8663, lng: 59.2210, zoom: 10 },
  '30': { lat: 37.4713, lng: 57.3314, zoom: 10 },
  '12': { lat: 31.3201, lng: 48.6940, zoom: 10 },
  '13': { lat: 36.5699, lng: 53.0586, zoom: 10 },
  '14': { lat: 36.6472, lng: 48.5104, zoom: 10 },
  '15': { lat: 27.5342, lng: 60.5820, zoom: 10 },
  '16': { lat: 29.6103, lng: 52.5311, zoom: 10 },
  '18': { lat: 36.6367, lng: 48.6814, zoom: 10 },
  '19': { lat: 34.3143, lng: 47.0658, zoom: 10 },
  '20': { lat: 30.2839, lng: 57.0833, zoom: 10 },
  '21': { lat: 34.3142, lng: 47.0658, zoom: 10 },
  '22': { lat: 30.9800, lng: 50.8200, zoom: 10 },
  '23': { lat: 36.8500, lng: 54.4167, zoom: 10 },
  '24': { lat: 37.2808, lng: 49.5926, zoom: 10 },
  '25': { lat: 33.5894, lng: 49.7910, zoom: 10 },
  '26': { lat: 36.5654, lng: 52.6778, zoom: 10 },
  '27': { lat: 34.3600, lng: 50.8764, zoom: 10 },
  '28': { lat: 27.1939, lng: 56.2772, zoom: 10 },
  '31': { lat: 34.7992, lng: 48.5146, zoom: 10 },
  '32': { lat: 31.8934, lng: 54.3608, zoom: 10 },
};

/**
 * این کامپوننت قبلاً با Mapbox GL پیاده‌سازی شده بود اما اکنون به صورت
 * کامل به نقشه نشان (SimpleLeafletMap) منتقل شده است. هیچ کدی از Mapbox
 * در این فایل باقی نمانده است.
 */
export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
  provinceCode,
  onFullscreenChange,
}: InteractiveLocationMapProps) {
  const { toast } = useToast();
  const mapRef = useRef<SimpleLeafletMapRef>(null);

  // تعیین موقعیت اولیه بر اساس استان (در صورت ارسال provinceCode)
  const [startCoords, setStartCoords] = useState({ lat: initialLat, lng: initialLng });

  useEffect(() => {
    if (provinceCode && provinceCoordinates[provinceCode]) {
      const c = provinceCoordinates[provinceCode];
      setStartCoords({ lat: c.lat, lng: c.lng });
      // اگر نقشه ساخته شده، به محل استان پرواز کن
      mapRef.current?.flyTo(c.lat, c.lng, c.zoom);
    }
  }, [provinceCode]);

  // دریافت موقعیت فعلی کاربر و پرواز به آن
  const handleGetUserLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'خطا',
        description: 'مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.current?.setMarker(latitude, longitude);
        toast({
          title: '✓ موقعیت شما یافت شد',
          description: 'موقعیت شما روی نقشه نشان انتخاب شد',
        });
      },
      () => {
        toast({
          title: 'خطا',
          description: 'دریافت موقعیت ناموفق بود',
          variant: 'destructive',
        });
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative h-[500px] w-full rounded-xl overflow-hidden border-2 shadow-lg">
        <SimpleLeafletMap
          ref={mapRef}
          onLocationSelect={(lat, lng, distance) => {
            onLocationSelect(lat, lng, distance);
          }}
          initialLat={startCoords.lat}
          initialLng={startCoords.lng}
          onFullscreenChange={onFullscreenChange}
        />

        {/* دکمه موقعیت من */}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute top-16 right-4 bg-background/95 backdrop-blur shadow-lg hover:scale-105 transition-transform z-[1003]"
          onClick={handleGetUserLocation}
          title="موقعیت من"
        >
          <Locate className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
