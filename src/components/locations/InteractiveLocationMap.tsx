import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue by providing explicit assets
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string; // currently unused but kept for API compatibility
}

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 35.6892,
  initialLng = 51.3890,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !mapContainerRef.current) return;

    let leaflet: any;
    let clickHandler: any;

    (async () => {
      try {
        leaflet = await import('leaflet');

        // Configure default icon explicitly to avoid missing assets
        const DefaultIcon = leaflet.icon({
          iconUrl: iconUrl as unknown as string,
          shadowUrl: iconShadow as unknown as string,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });

        // Initialize map
        const startPos: [number, number] = [initialLat, initialLng];
        mapRef.current = leaflet.map(mapContainerRef.current).setView(startPos, 13);

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          })
          .addTo(mapRef.current);

        markerRef.current = leaflet.marker(startPos, { icon: DefaultIcon }).addTo(mapRef.current);

        clickHandler = (e: any) => {
          const { lat, lng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = leaflet.marker([lat, lng], { icon: DefaultIcon }).addTo(mapRef.current);
          }
          onLocationSelect(lat, lng);
        };

        mapRef.current.on('click', clickHandler);
      } catch (err) {
        // Silently ignore to prevent UI crash; map just won't render
        // You can add logging here if needed
      }
    })();

    return () => {
      try {
        if (mapRef.current) {
          if (clickHandler) mapRef.current.off('click', clickHandler);
          mapRef.current.remove();
        }
      } catch {}
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [isMounted, initialLat, initialLng, onLocationSelect]);

  if (!isMounted) {
    return (
      <div className="h-[400px] w-full rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری نقشه...</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border">
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
