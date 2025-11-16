import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface LeafletFallbackMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

// Fix default marker icons paths in Vite
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LeafletFallbackMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: LeafletFallbackMapProps) {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon;
  }, []);

  const center = useMemo(() => [initialLat, initialLng] as [number, number], [initialLat, initialLng]);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full rounded-xl"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler
          onPick={(lat, lng) => {
            setPos([lat, lng]);
            onLocationSelect(lat, lng);
          }}
        />
        {pos && <Marker position={pos} />} 
      </MapContainer>
    </div>
  );
}
