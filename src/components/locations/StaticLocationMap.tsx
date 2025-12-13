import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface StaticLocationMapProps {
  lat: number;
  lng: number;
  address?: string;
  detailedAddress?: string;
}

export default function StaticLocationMap({
  lat,
  lng,
  address,
  detailedAddress
}: StaticLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      // Initialize map
      const map = L.map(mapContainer.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        attributionControl: true
      });

      mapRef.current = map;

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

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
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

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

      // Cleanup
      return () => {
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
    <div 
      ref={mapContainer} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
