import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface LeafletFallbackMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

// ایران: غرب-شرق, جنوب-شمال
const IRAN_BOUNDS: [[number, number], [number, number]] = [[44.0, 24.0], [64.0, 40.0]];

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

function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const t = setTimeout(invalidate, 200);
    window.addEventListener('resize', invalidate);
    document.addEventListener('visibilitychange', invalidate);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', invalidate);
      document.removeEventListener('visibilitychange', invalidate);
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

export default function LeafletFallbackMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: LeafletFallbackMapProps) {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    (L.Marker.prototype as any).options.icon = defaultIcon;
  }, []);

  const center = useMemo(() => [initialLat, initialLng] as [number, number], [initialLat, initialLng]);
  const bounds = useMemo(() => L.latLngBounds(
    L.latLng(IRAN_BOUNDS[0][1], IRAN_BOUNDS[0][0]),
    L.latLng(IRAN_BOUNDS[1][1], IRAN_BOUNDS[1][0])
  ), []);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        minZoom={5}
        maxZoom={18}
        maxBounds={bounds}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        preferCanvas
        className="h-full w-full"
        attributionControl={false}
      >
        <AutoResize />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          updateWhenIdle
          keepBuffer={0}
          detectRetina
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
