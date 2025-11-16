import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';


interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
}

function LocationSelector({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 35.6892,
  initialLng = 51.3890,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const position: [number, number] = [initialLat, initialLng];

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

  if (!isMounted) {
    return (
      <div className="h-[400px] w-full rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری نقشه...</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border">
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
        <LocationSelector onLocationSelect={onLocationSelect} />
        <Marker position={position}>
          <Popup>موقعیت انتخاب شده</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

