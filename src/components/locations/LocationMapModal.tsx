import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';

interface LocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export const LocationMapModal = ({
  isOpen,
  onClose,
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746
}: LocationMapModalProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !mapContainer.current || map.current) return;

    // استفاده از توکن Mapbox (اولویت: ENV -> localStorage -> توکن پیش‌فرض آموزشی)
    const mapboxToken =
      import.meta.env.VITE_MAPBOX_TOKEN ||
      (typeof window !== 'undefined' ? localStorage.getItem('MAPBOX_TOKEN') || undefined : undefined) ||
      'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 14,
      pitch: 0,
    });

    // Add language control for Persian/Farsi labels
    const language = new MapboxLanguage({ defaultLanguage: 'fa' });
    map.current.addControl(language);

    // Ensure proper rendering when inside modal
    map.current.on('load', () => {
      map.current?.resize();
    });
    map.current.on('error', (e) => {
      console.error('Mapbox error:', e);
    });
    setTimeout(() => map.current?.resize(), 200);

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Create marker
    marker.current = new mapboxgl.Marker({
      draggable: true,
      color: '#22c55e'
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map.current);

    // Update location when marker is dragged
    marker.current.on('dragend', () => {
      if (marker.current) {
        const lngLat = marker.current.getLngLat();
        setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
      }
    });

    // Set location on map click
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedLocation({ lat, lng });
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      }
    });

    // Set initial selected location
    setSelectedLocation({ lat: initialLat, lng: initialLng });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      marker.current = null;
    };
  }, [isOpen, initialLat, initialLng]);

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation.lat, selectedLocation.lng);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedLocation(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            انتخاب موقعیت روی نقشه
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          <div className="px-6 py-3 bg-muted/50 text-sm text-muted-foreground">
            روی نقشه کلیک کنید یا نشانگر را بکشید تا موقعیت دقیق را انتخاب کنید
          </div>
          
          <div ref={mapContainer} className="flex-1 w-full min-h-[400px]" />
          
          {selectedLocation && (
            <div className="p-4 bg-background border-t">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">موقعیت انتخاب شده:</p>
                  <p className="font-mono text-xs">
                    عرض جغرافیایی: {selectedLocation.lat.toFixed(6)}
                  </p>
                  <p className="font-mono text-xs">
                    طول جغرافیایی: {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    <X className="w-4 h-4 ml-2" />
                    انصراف
                  </Button>
                  <Button onClick={handleConfirm}>
                    <MapPin className="w-4 h-4 ml-2" />
                    تایید موقعیت
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
