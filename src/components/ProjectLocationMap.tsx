import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectLocationMapProps {
  onLocationSelect?: (location: {
    address: string;
    coordinates: [number, number];
    distance: number;
  }) => void;
}

// مختصات مرکز قم (کارگاه)
const QOM_CENTER: [number, number] = [50.8764, 34.6416];

const ProjectLocationMap: React.FC<ProjectLocationMapProps> = ({ onLocationSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxToken = 'pk.eyJ1Ijoia2hhZGFtYXRlLWFocm9tIiwiYSI6ImNtZzZ4ajQ3cTBicHEybW9oazdhd3d5NHUifQ.NYnEZq8GrqvL6ACcYR1fag';
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);

  // محاسبه فاصله بین دو نقطه (به کیلومتر)
  const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
    const R = 6371; // شعاع زمین به کیلومتر
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // دریافت آدرس از مختصات
  const getAddressFromCoordinates = async (lng: number, lat: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=fa`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // راه‌اندازی نقشه
  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken || isMapInitialized) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: QOM_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    // اضافه کردن کنترل‌های ناوبری
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // اضافه کردن مارکر برای کارگاه (قم)
    new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat(QOM_CENTER)
      .setPopup(new mapboxgl.Popup().setHTML('<strong>کارگاه</strong><br>قم'))
      .addTo(map.current);

    // رویداد کلیک روی نقشه
    map.current.on('click', async (e) => {
      const { lng, lat } = e.lngLat;
      const coordinates: [number, number] = [lng, lat];

      // حذف مارکر قبلی
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // اضافه کردن مارکر جدید
      markerRef.current = new mapboxgl.Marker({ color: '#f59e0b' })
        .setLngLat(coordinates)
        .addTo(map.current!);

      // محاسبه فاصله
      const distance = calculateDistance(QOM_CENTER, coordinates);

      // دریافت آدرس
      const address = await getAddressFromCoordinates(lng, lat);

      const location = {
        address,
        coordinates,
        distance: Math.round(distance * 10) / 10, // گرد کردن به یک رقم اعشار
      };

      setSelectedLocation(location);
      if (onLocationSelect) {
        onLocationSelect(location);
      }

      toast.success('موقعیت انتخاب شد', {
        description: `فاصله از کارگاه: ${location.distance} کیلومتر`,
      });
    });

    setIsMapInitialized(true);
  };

  useEffect(() => {
    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []); // فقط یکبار در mount اجرا شود

  return (
    <Card className="shadow-elegant persian-slide">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-construction" />
          انتخاب موقعیت پروژه
        </CardTitle>
        <CardDescription>
          روی نقشه کلیک کنید تا موقعیت پروژه خود را مشخص کنید
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* نقشه */}
        <div
          ref={mapContainer}
          className="w-full h-[400px] rounded-lg border border-border"
        />

        {/* اطلاعات موقعیت انتخاب شده */}
        {selectedLocation && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-construction mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">آدرس انتخاب شده:</p>
                <p className="text-sm text-muted-foreground">{selectedLocation.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  فاصله از کارگاه: <span className="text-construction">{selectedLocation.distance} کیلومتر</span>
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground" dir="ltr">
              {selectedLocation.coordinates[1].toFixed(6)}, {selectedLocation.coordinates[0].toFixed(6)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectLocationMap;
