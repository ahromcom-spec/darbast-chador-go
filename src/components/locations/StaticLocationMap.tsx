import { useEffect, useRef, useState } from 'react';
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // اگر نقشه قبلاً ساخته شده، آن را پاک کن
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // اعتبارسنجی مختصات
    const validLat = lat >= -90 && lat <= 90 ? lat : 34.6416;
    const validLng = lng >= -180 && lng <= 180 ? lng : 50.8746;

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
    <>
      {/* CSS fix for Leaflet tiles */}
      <style>{`
        .leaflet-tile-pane img {
          width: 256px !important;
          height: 256px !important;
        }
        .leaflet-tile {
          visibility: visible !important;
        }
        .leaflet-container {
          background: #f0f0f0 !important;
        }
      `}</style>
      <div 
        ref={mapContainer} 
        className="w-full h-full relative z-0"
        style={{ 
          minHeight: '400px',
          background: '#f0f0f0'
        }}
      />
    </>
  );
}
