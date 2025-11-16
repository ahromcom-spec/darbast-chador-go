import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue by providing explicit assets
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string;
}

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 35.6892,
  initialLng = 51.3890,
}: InteractiveLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
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
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        leaflet = await import('leaflet');

        // Custom animated marker icon with smooth appearance
        const DefaultIcon = leaflet.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="marker-pin animate-scale-in">
              <div class="marker-pulse"></div>
              <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 13 16 26 16 26s16-13 16-26c0-8.837-7.163-16-16-16z" fill="hsl(var(--primary))" stroke="white" stroke-width="2"/>
                <circle cx="16" cy="16" r="6" fill="white"/>
              </svg>
            </div>
          `,
          iconSize: [32, 42],
          iconAnchor: [16, 42],
        });

        // Initialize map with smooth animations
        const startPos: [number, number] = [initialLat, initialLng];
        mapRef.current = leaflet.map(mapContainerRef.current, {
          center: startPos,
          zoom: 13,
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
        }).setView(startPos, 13);

        // Add smooth tile layer
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
            className: 'map-tiles',
          })
          .addTo(mapRef.current);

        // Wait for tiles to load
        mapRef.current.whenReady(() => {
          setIsMapReady(true);
        });

        // Ensure proper rendering
        setTimeout(() => {
          try {
            mapRef.current?.invalidateSize();
          } catch {}
        }, 150);

        // Add resize observer for responsive behavior
        if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            try {
              mapRef.current?.invalidateSize();
            } catch {}
          });
          resizeObserver.observe(mapContainerRef.current);
        }

        // Add initial marker with animation
        markerRef.current = leaflet.marker(startPos, { 
          icon: DefaultIcon,
          draggable: false,
        }).addTo(mapRef.current);

        // Click handler with smooth marker animation
        clickHandler = (e: any) => {
          const { lat, lng } = e.latlng;
          
          // Animate marker movement
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            
            // Add ripple effect on click
            const ripple = leaflet.circle([lat, lng], {
              color: 'hsl(var(--primary))',
              fillColor: 'hsl(var(--primary))',
              fillOpacity: 0.2,
              radius: 50,
              weight: 2,
            }).addTo(mapRef.current);

            // Fade out and remove ripple
            setTimeout(() => {
              mapRef.current?.removeLayer(ripple);
            }, 600);
          } else {
            markerRef.current = leaflet.marker([lat, lng], { icon: DefaultIcon }).addTo(mapRef.current);
          }
          
          onLocationSelect(lat, lng);
        };

        mapRef.current.on('click', clickHandler);
      } catch (err) {
        console.error('Map initialization error:', err);
      }
    })();

    return () => {
      try {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
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
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm">در حال بارگذاری نقشه...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border shadow-lg relative animate-scale-in">
      <div ref={mapContainerRef} className="h-full w-full map-container" />
      {!isMapReady && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground text-sm">در حال بارگذاری نقشه...</p>
          </div>
        </div>
      )}
      <style>{`
        .custom-map-marker {
          background: transparent;
          border: none;
        }
        .marker-pin {
          position: relative;
          animation: markerBounce 0.5s ease-out;
        }
        .marker-pulse {
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: hsl(var(--primary) / 0.3);
          animation: pulse 2s infinite;
          transform: translate(0, 5px);
        }
        @keyframes markerBounce {
          0% { transform: translateY(-20px) scale(0.8); opacity: 0; }
          50% { transform: translateY(0) scale(1.1); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: translate(0, 5px) scale(0.8); opacity: 0.6; }
          50% { transform: translate(0, 5px) scale(1.5); opacity: 0; }
        }
        .map-container {
          transition: all 0.3s ease;
        }
        .map-tiles {
          filter: contrast(1.05) saturate(1.1);
        }
        .leaflet-container {
          font-family: inherit;
          border-radius: inherit;
        }
        .leaflet-control-zoom a {
          color: hsl(var(--foreground)) !important;
          background: hsl(var(--background)) !important;
          border-color: hsl(var(--border)) !important;
          transition: all 0.2s ease;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
          transform: scale(1.05);
        }
        .leaflet-bar {
          border-radius: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
        }
      `}</style>
    </div>
  );
}
