import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface StaticLocationMapProps {
  lat: number;
  lng: number;
  address?: string;
  detailedAddress?: string;
  showNavigationButton?: boolean;
}

export default function StaticLocationMap({
  lat,
  lng,
  address,
  detailedAddress,
  showNavigationButton = true
}: StaticLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showNavSheet, setShowNavSheet] = useState(false);
  const isMobile = useIsMobile();

  // اعتبارسنجی مختصات
  const validLat = lat >= -90 && lat <= 90 ? lat : 34.6416;
  const validLng = lng >= -180 && lng <= 180 ? lng : 50.8746;

  // Navigation Apps
  const navigationApps = [
    {
      name: 'Google Maps',
      icon: '🗺️',
      url: `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`
    },
    {
      name: 'Waze',
      icon: '🚗',
      url: `https://waze.com/ul?ll=${validLat},${validLng}&navigate=yes`
    },
    {
      name: 'نشان',
      icon: '📍',
      url: `https://nshn.ir?lat=${validLat}&lng=${validLng}`
    },
    {
      name: 'بلد',
      icon: '🧭',
      url: `https://balad.ir/directions?destination=${validLat},${validLng}`
    },
    {
      name: 'Apple Maps',
      icon: '🍎',
      url: `http://maps.apple.com/?daddr=${validLat},${validLng}&dirflg=d`
    }
  ];

  const handleNavigate = () => {
    if (isMobile) {
      setShowNavSheet(true);
    } else {
      // در دسکتاپ مستقیم گوگل مپ باز شود
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`, '_blank');
    }
  };

  const openNavigationApp = (url: string) => {
    window.open(url, '_blank');
    setShowNavSheet(false);
  };

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // اگر نقشه قبلاً ساخته شده، آن را پاک کن
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      // Initialize map
      const map = L.map(mapContainer.current, {
        center: [validLat, validLng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        attributionControl: true,
        preferCanvas: true
      });

      mapRef.current = map;

      // Add OpenStreetMap tile layer with error handling
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous'
      });

      tileLayer.on('load', () => {
        setIsReady(true);
      });

      tileLayer.on('tileerror', (e) => {
        console.warn('Tile load error, trying fallback:', e);
      });

      tileLayer.addTo(map);

      // Custom marker icon
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: hsl(var(--primary));
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 18px;
              font-weight: bold;
            ">📍</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      // Add marker
      const marker = L.marker([validLat, validLng], { icon: customIcon }).addTo(map);

      // Add popup with address
      if (address) {
        // فقط اگر detailedAddress متفاوت از address باشد نمایش داده شود
        const showDetailedAddress = detailedAddress && detailedAddress.trim() !== address.trim();
        const popupContent = `
          <div style="padding: 8px; max-width: 200px;">
            <p style="font-weight: bold; margin-bottom: 4px; color: hsl(var(--foreground));">${address}</p>
            ${showDetailedAddress ? `<p style="font-size: 12px; color: hsl(var(--muted-foreground));">${detailedAddress}</p>` : ''}
          </div>
        `;
        marker.bindPopup(popupContent).openPopup();
      }

      // invalidateSize پس از mount کامل برای حل مشکل خطوط افقی - چندین بار
      const invalidateSizeMultiple = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      };

      // صدا زدن چندین بار با تاخیرهای مختلف برای اطمینان از رندر صحیح
      const timeouts = [
        setTimeout(invalidateSizeMultiple, 50),
        setTimeout(invalidateSizeMultiple, 150),
        setTimeout(invalidateSizeMultiple, 300),
        setTimeout(invalidateSizeMultiple, 500),
        setTimeout(invalidateSizeMultiple, 1000),
      ];

      // ResizeObserver برای container changes
      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      });
      
      if (mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

      // Cleanup
      return () => {
        timeouts.forEach(t => clearTimeout(t));
        resizeObserver.disconnect();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [lat, lng, address, detailedAddress]);

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        className="w-full h-full relative z-0"
        style={{ 
          minHeight: '400px',
          background: '#f5f5f5',
          // جلوگیری از تداخل CSS zoom با نقشه
          zoom: 1,
          transform: 'translateZ(0)'
        }}
      />
      
      {/* Navigation Button */}
      {showNavigationButton && (
        <Button
          onClick={handleNavigate}
          className="absolute bottom-4 right-4 z-10 gap-2 shadow-lg"
          variant="default"
        >
          <Navigation className="h-4 w-4" />
          مسیریابی
        </Button>
      )}

      {/* Navigation Apps Sheet (Mobile) */}
      <Sheet open={showNavSheet} onOpenChange={setShowNavSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-right">
            <SheetTitle>انتخاب اپلیکیشن مسیریاب</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 py-4">
            {navigationApps.map((app) => (
              <Button
                key={app.name}
                variant="outline"
                className="w-full justify-start gap-3 h-14 text-base"
                onClick={() => openNavigationApp(app.url)}
              >
                <span className="text-2xl">{app.icon}</span>
                <span>{app.name}</span>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
