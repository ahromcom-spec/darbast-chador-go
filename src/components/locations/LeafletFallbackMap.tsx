import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface LeafletFallbackMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapInitializer() {
  const map = useMap();
  
  useEffect(() => {
    // Fix for map rendering in modals/dialogs
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

import { MapErrorBoundary } from './MapErrorBoundary';

export default function LeafletFallbackMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: LeafletFallbackMapProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);

  const center: [number, number] = useMemo(() => [initialLat, initialLng], [initialLat, initialLng]);
  
  // Default zoom level matching InteractiveGlobe
  const defaultZoom = 13;

  const handleLocationPick = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationSelect(lat, lng);
  };

  return (
    <MapErrorBoundary>
      <div className="h-full w-full relative rounded-lg overflow-hidden border-2 border-primary/20 shadow-lg">
        <MapContainer
          center={center}
          zoom={defaultZoom}
          minZoom={5}
          maxZoom={22}
          scrollWheelZoom={true}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          preferCanvas={true}
        >
          <MapInitializer />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22}
          />
          <ClickHandler onPick={handleLocationPick} />
          {position && <Marker position={position} icon={customIcon} />}
        </MapContainer>
      </div>
    </MapErrorBoundary>
  );
}
