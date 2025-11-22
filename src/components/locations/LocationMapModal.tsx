import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState, useEffect } from 'react';

import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';


interface LocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

function LocationMarker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? <Marker position={position} /> : null;
}

export const LocationMapModal = ({
  isOpen,
  onClose,
  onLocationSelect,
  initialLat = 35.6892,
  initialLng = 51.3890,
}: LocationMapModalProps) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Set default Leaflet marker icon dynamically (client-only)
    import('leaflet').then((L) => {
      const DefaultIcon = L.icon({
        iconUrl: icon,
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      // @ts-ignore - prototype options exists at runtime
      L.Marker.prototype.options.icon = DefaultIcon;
    }).catch(() => {
      // ignore icon setup errors
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPosition([initialLat, initialLng]);
    }
  }, [isOpen, initialLat, initialLng]);

  const handleConfirm = () => {
    onLocationSelect(position[0], position[1]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>انتخاب موقعیت مکانی (کلیک کنید)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="h-[500px] w-full rounded-lg overflow-hidden border">
            {isMounted && isOpen ? (
              <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">در حال بارگذاری نقشه...</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              موقعیت انتخاب شده: {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button onClick={handleConfirm}>
              تأیید موقعیت
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
