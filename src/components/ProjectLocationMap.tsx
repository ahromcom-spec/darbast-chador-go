import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Map, Satellite, Locate } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectLocationMapProps {
  onLocationSelect?: (location: {
    address: string;
    coordinates: [number, number];
    distance: number;
  }) => void;
}

// مختصات مرکز شهر قم
const QOM_CENTER: [number, number] = [50.8764, 34.6400];

const ProjectLocationMap: React.FC<ProjectLocationMapProps> = ({ onLocationSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxToken = 'pk.eyJ1Ijoia2hhZGFtYXRlLWFocm9tIiwiYSI6ImNtZzZ4ajQ3cTBicHEybW9oazdhd3d5NHUifQ.NYnEZq8GrqvL6ACcYR1fag';
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('satellite');
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);

  // محاسبه فاصله جاده‌ای واقعی با استفاده از Mapbox Directions API
  const calculateRoadDistance = async (coord1: [number, number], coord2: [number, number]): Promise<number> => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coord1[0]},${coord1[1]};${coord2[0]},${coord2[1]}?access_token=${mapboxToken}&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // فاصله به متر است، تبدیل به کیلومتر
        const distanceInKm = data.routes[0].distance / 1000;
        return distanceInKm;
      }
      
      // اگر مسیری پیدا نشد، از فاصله هوایی استفاده کن
      console.warn('No route found, using straight-line distance');
      return calculateStraightLineDistance(coord1, coord2);
    } catch (error) {
      console.error('Error calculating road distance:', error);
      // در صورت خطا از فاصله هوایی استفاده کن
      return calculateStraightLineDistance(coord1, coord2);
    }
  };

  // محاسبه فاصله هوایی (خط مستقیم) بین دو نقطه
  const calculateStraightLineDistance = (coord1: [number, number], coord2: [number, number]): number => {
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
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      // فعال‌سازی RTL Text Plugin برای فارسی (غیرفعال کردن lazy تا شکل‌دهی حروف از ابتدا اعمال شود)
      mapboxgl.setRTLTextPlugin(
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
        (error) => {
          if (error) console.error('Error loading RTL plugin:', error);
        },
        false
      );

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle === 'satellite' 
          ? 'mapbox://styles/mapbox/satellite-streets-v12'  // نقشه ماهواره‌ای با لیبل خیابان‌ها
          : 'mapbox://styles/mapbox/streets-v12',
        center: QOM_CENTER,
        zoom: 17,
        attributionControl: false,
      });

      // اطمینان از رندر صحیح هنگام نمایش داخل layout های واکنش‌گرا
      map.current.on('load', () => {
        map.current?.resize();
      });

      // اضافه کردن پلاگین زبان فارسی و اعمال آن پس از بارگذاری استایل
      const language = new MapboxLanguage({ defaultLanguage: 'fa' });
      map.current.addControl(language as any);
      map.current.on('style.load', () => {
        try {
          (language as any).setLanguage('fa');
        } catch (e) {
          console.warn('Failed to set map language to fa', e);
        }
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

        // محاسبه فاصله جاده‌ای واقعی
        toast.info('در حال محاسبه فاصله جاده‌ای...', {
          duration: 2000,
        });
        
        const distance = await calculateRoadDistance(QOM_CENTER, coordinates);

        // دریافت آدرس
        const address = await getAddressFromCoordinates(lng, lat);

        const location = {
          address,
          coordinates,
          distance: Math.round(distance * 10) / 10,
        };

        setSelectedLocation(location);
        if (onLocationSelect) {
          onLocationSelect(location);
        }

        toast.success('موقعیت انتخاب شد', {
          description: `فاصله جاده‌ای از کارگاه: ${location.distance} کیلومتر`,
        });
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('خطا در بارگذاری نقشه');
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []); // فقط یکبار در mount اجرا شود

  // تغییر استایل نقشه
  const toggleMapStyle = () => {
    if (!map.current) return;
    
    const newStyle = mapStyle === 'streets' ? 'satellite' : 'streets';
    const styleUrl = newStyle === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/streets-v12';
    
    map.current.setStyle(styleUrl);
    setMapStyle(newStyle);

    // اضافه مجدد مارکرها پس از تغییر استایل
    map.current.once('style.load', () => {
      // مارکر کارگاه
      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat(QOM_CENTER)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>کارگاه</strong><br>قم'))
        .addTo(map.current!);

      // مارکر موقعیت انتخابی
      if (selectedLocation) {
        markerRef.current = new mapboxgl.Marker({ color: '#f59e0b' })
          .setLngLat(selectedLocation.coordinates)
          .addTo(map.current!);
      }
    });
  };

  // رفتن به موقعیت فعلی کاربر
  const goToUserLocation = () => {
    if (!map.current) return;
    
    if (!navigator.geolocation) {
      toast.error('مرورگر شما از GPS پشتیبانی نمی‌کند');
      return;
    }

    toast.info('در حال دریافت موقعیت شما...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords: [number, number] = [longitude, latitude];
        
        // انتقال نقشه به موقعیت کاربر
        map.current?.flyTo({
          center: userCoords,
          zoom: 15,
          duration: 2000
        });

        toast.success('موقعیت شما یافت شد');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('خطا در دریافت موقعیت شما');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  return (
    <Card className="shadow-elegant persian-slide">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-2xl">
          <MapPin className="h-4 w-4 md:h-5 md:w-5 text-construction" />
          انتخاب موقعیت پروژه
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          روی نقشه کلیک کنید تا موقعیت پروژه خود را مشخص کنید
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6">
        {/* دکمه‌های کنترل نقشه */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToUserLocation}
            className="gap-2 w-full sm:w-auto"
          >
            <Locate className="h-4 w-4" />
            <span className="text-sm">موقعیت من</span>
          </Button>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={mapStyle === 'streets' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleMapStyle}
              className="gap-2 flex-1 sm:flex-none"
            >
              <Map className="h-4 w-4" />
              <span className="text-xs sm:text-sm">نقشه معمولی</span>
            </Button>
            <Button
              variant={mapStyle === 'satellite' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleMapStyle}
              className="gap-2 flex-1 sm:flex-none"
            >
              <Satellite className="h-4 w-4" />
              <span className="text-xs sm:text-sm">تصویر ماهواره‌ای</span>
            </Button>
          </div>
        </div>

        {/* نقشه */}
        <div
          ref={mapContainer}
          className="w-full h-[300px] sm:h-[350px] md:h-[400px] rounded-lg border border-border"
        />

        {/* اطلاعات موقعیت انتخاب شده */}
        {selectedLocation && (
          <div className="space-y-2 md:space-y-3 p-3 md:p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 md:h-5 md:w-5 text-construction mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-xs md:text-sm font-medium">آدرس انتخاب شده:</p>
                <p className="text-xs md:text-sm text-muted-foreground break-words">{selectedLocation.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Navigation className="h-4 w-4 md:h-5 md:w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium">
                  فاصله جاده‌ای از کارگاه: <span className="text-construction">{selectedLocation.distance} کیلومتر</span>
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground break-all" dir="ltr">
              {selectedLocation.coordinates[1].toFixed(6)}, {selectedLocation.coordinates[0].toFixed(6)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectLocationMap;
