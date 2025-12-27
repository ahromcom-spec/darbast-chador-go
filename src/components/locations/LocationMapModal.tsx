import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  initialLat = 35.6892,
  initialLng = 51.3890,
}: LocationMapModalProps) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [mapInitKey, setMapInitKey] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Update position when initial values change
  useEffect(() => {
    if (isOpen) {
      setPosition([initialLat, initialLng]);
    }
  }, [isOpen, initialLat, initialLng]);

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    setIsMapReady(false);
    setMapStatus('loading');

    let disposed = false;
    let readyFallback: number | undefined;

    // Small delay to ensure dialog animation finished and container has size
    const initTimeout = window.setTimeout(() => {
      const containerEl = mapContainerRef.current;
      if (!containerEl || disposed) return;

      try {
        console.log('[LocationMapModal] init');

        // Remove existing map if any
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Clear container to prevent "Map container is already initialized" issues
        containerEl.innerHTML = '';
        if ((containerEl as any)._leaflet_id) {
          delete (containerEl as any)._leaflet_id;
        }

        // Create custom icon
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
                font-size: 14px;
                font-weight: bold;
              ">📍</div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        // Initialize map
        const map = L.map(containerEl, {
          center: [initialLat, initialLng],
          zoom: 15,
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true,
        });

        mapRef.current = map;

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Add draggable marker
        const marker = L.marker([initialLat, initialLng], {
          icon: customIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        // Update position on marker drag
        marker.on('dragend', () => {
          const latlng = marker.getLatLng();
          setPosition([latlng.lat, latlng.lng]);
        });

        // Update marker position on map click
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          setPosition([lat, lng]);
        });

        map.whenReady(() => {
          if (disposed) return;
          setIsMapReady(true);
          setMapStatus('ready');
          window.setTimeout(() => {
            map.invalidateSize({ animate: false });
          }, 50);
        });

        // Fallback: even if whenReady doesn't fire due to sizing issues, show map UI
        readyFallback = window.setTimeout(() => {
          if (disposed) return;
          if (!mapRef.current) return;
          setIsMapReady(true);
          setMapStatus('ready');
          mapRef.current.invalidateSize({ animate: false });
        }, 1200);
      } catch (error) {
        console.error('[LocationMapModal] Error initializing map:', error);
        if (!disposed) {
          setMapStatus('error');
          setIsMapReady(false);
        }
      }
    }, 150);

    return () => {
      disposed = true;
      window.clearTimeout(initTimeout);
      if (readyFallback) window.clearTimeout(readyFallback);

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      setIsMapReady(false);
      setMapStatus('idle');
    };
  }, [isOpen, initialLat, initialLng, mapInitKey]);

  const handleRetry = () => {
    setMapInitKey((k) => k + 1);
  };

  const handleConfirm = () => {
    onLocationSelect(position[0], position[1]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            ویرایش موقعیت مکانی
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            برای تغییر موقعیت، روی نقشه کلیک کنید یا نشانگر را جابجا کنید.
          </p>
          
          <div className="h-[450px] w-full rounded-lg overflow-hidden border-2 border-border relative">
            {mapStatus !== 'ready' && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                {mapStatus === 'error' ? (
                  <div className="flex flex-col items-center gap-3 text-center p-6">
                    <p className="text-sm font-medium">خطا در بارگذاری نقشه</p>
                    <p className="text-xs text-muted-foreground">لطفاً دوباره تلاش کنید.</p>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      تلاش مجدد
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">در حال آماده‌سازی نقشه...</p>
                  </div>
                )}
              </div>
            )}
            <div
              ref={mapContainerRef}
              className="h-full w-full"
              style={{ minHeight: '450px' }}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">موقعیت انتخاب شده:</span>
            <span className="text-sm font-mono text-muted-foreground" dir="ltr">
              {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </span>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              <MapPin className="h-4 w-4" />
              تأیید موقعیت جدید
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};