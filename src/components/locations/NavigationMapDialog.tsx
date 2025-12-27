import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Navigation, Locate, AlertCircle, Loader2, X, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NavigationMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
}

export function NavigationMapDialog({
  open,
  onOpenChange,
  destinationLat,
  destinationLng,
  destinationAddress
}: NavigationMapDialogProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  
  const { toast } = useToast();

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainer.current) return;
    
    // Clean up previous map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      const map = L.map(mapContainer.current, {
        center: [destinationLat, destinationLng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
      });

      mapRef.current = map;

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous' as const,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Custom destination marker
      const destIcon = L.divIcon({
        className: 'destination-marker',
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: hsl(var(--destructive));
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 20px;
              font-weight: bold;
            ">🏠</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      const destMarker = L.marker([destinationLat, destinationLng], { icon: destIcon }).addTo(map);
      if (destinationAddress) {
        destMarker.bindPopup(`<div style="padding: 8px; max-width: 200px;"><strong>مقصد:</strong><br/>${destinationAddress}</div>`).openPopup();
      }
      destMarkerRef.current = destMarker;

      // Invalidate size after mount
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      }, 100);

      // Cleanup
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing navigation map:', error);
    }
  }, [open, destinationLat, destinationLng, destinationAddress]);

  // Get user location
  const getUserLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);

        // Add user marker on map
        if (mapRef.current) {
          // Remove previous user marker
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }

          // Custom user marker (blue dot)
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div style="
                width: 24px;
                height: 24px;
                background: hsl(var(--primary));
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 0 10px rgba(0,0,0,0.3), 0 0 40px hsl(var(--primary) / 0.4);
                animation: pulse 2s infinite;
              "></div>
              <style>
                @keyframes pulse {
                  0% { box-shadow: 0 0 10px rgba(0,0,0,0.3), 0 0 40px hsl(var(--primary) / 0.4); }
                  50% { box-shadow: 0 0 15px rgba(0,0,0,0.4), 0 0 60px hsl(var(--primary) / 0.6); }
                  100% { box-shadow: 0 0 10px rgba(0,0,0,0.3), 0 0 40px hsl(var(--primary) / 0.4); }
                }
              </style>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapRef.current);
          userMarker.bindPopup('<div style="padding: 8px;"><strong>موقعیت شما</strong></div>');
          userMarkerRef.current = userMarker;

          // Fit bounds to show both markers
          const bounds = L.latLngBounds(
            [latitude, longitude],
            [destinationLat, destinationLng]
          );
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });

          // Calculate route
          await calculateRoute(latitude, longitude);
        }
      },
      (error) => {
        setIsLocating(false);
        let errorMessage = 'خطا در دریافت موقعیت';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'لطفاً دسترسی به موقعیت را در تنظیمات مرورگر فعال کنید';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'موقعیت در دسترس نیست. لطفاً GPS را روشن کنید';
            break;
          case error.TIMEOUT:
            errorMessage = 'زمان درخواست موقعیت به پایان رسید';
            break;
        }
        
        setLocationError(errorMessage);
        toast({
          title: 'خطا در موقعیت‌یابی',
          description: errorMessage,
          variant: 'destructive'
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Calculate route
  const calculateRoute = async (userLat: number, userLng: number) => {
    setIsCalculatingRoute(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-road-route', {
        body: {
          origin: { lat: userLat, lng: userLng },
          dest: { lat: destinationLat, lng: destinationLng }
        }
      });

      if (!error && data?.geometry?.coordinates?.length) {
        const distanceKm = data.distanceKm as number;
        setRouteDistance(distanceKm);
        
        // Estimate duration (average 40 km/h in city)
        const durationMinutes = Math.round((distanceKm / 40) * 60);
        setRouteDuration(durationMinutes);

        // Remove previous route
        if (routeLineRef.current) {
          routeLineRef.current.remove();
        }

        // Draw route on map
        if (mapRef.current) {
          const coordinates = (data.geometry.coordinates as [number, number][])
            .map((coord) => [coord[1], coord[0]] as [number, number]);
          
          const routeLine = L.polyline(coordinates, {
            color: 'hsl(var(--primary))',
            weight: 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(mapRef.current);

          // Add a subtle shadow for depth
          L.polyline(coordinates, {
            color: 'rgba(0,0,0,0.3)',
            weight: 10,
            opacity: 0.3,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(mapRef.current).bringToBack();

          routeLineRef.current = routeLine;

          // Fit bounds to show entire route
          const bounds = L.latLngBounds(coordinates);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast({
        title: 'خطا در محاسبه مسیر',
        description: 'مسیر جاده‌ای محاسبه نشد',
        variant: 'destructive'
      });
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Open in navigation apps
  const openInGoogleMaps = () => {
    const url = userLocation
      ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${destinationLat},${destinationLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              مسیریابی به مقصد
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative flex-1 h-full">
          {/* Map Container */}
          <div 
            ref={mapContainer} 
            className="w-full h-full"
            style={{ 
              minHeight: 'calc(90vh - 60px)',
              background: '#e8e8e8',
              zoom: '1',
              transform: 'translateZ(0)',
            }}
          />

          {/* Location Button */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <Button
              onClick={getUserLocation}
              disabled={isLocating}
              className="gap-2 shadow-lg"
              variant={userLocation ? "secondary" : "default"}
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Locate className="h-4 w-4" />
              )}
              {userLocation ? 'به‌روزرسانی موقعیت' : 'موقعیت من'}
            </Button>
            
            {userLocation && (
              <Button
                onClick={openInGoogleMaps}
                className="gap-2 shadow-lg"
                variant="outline"
              >
                <Navigation className="h-4 w-4" />
                Google Maps
              </Button>
            )}
          </div>

          {/* Location Error */}
          {locationError && (
            <div className="absolute top-4 left-4 right-20 z-[1000] bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{locationError}</p>
            </div>
          )}

          {/* Route Info Panel */}
          {(routeDistance || isCalculatingRoute) && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-background/95 backdrop-blur border rounded-xl p-4 shadow-lg">
              {isCalculatingRoute ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال محاسبه مسیر...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">فاصله</p>
                        <p className="font-bold text-lg text-primary">
                          {routeDistance?.toFixed(1)} کیلومتر
                        </p>
                      </div>
                    </div>
                    {routeDuration && (
                      <div className="border-r pr-4">
                        <p className="text-xs text-muted-foreground">زمان تقریبی</p>
                        <p className="font-bold text-lg">
                          {routeDuration < 60 
                            ? `${routeDuration} دقیقه`
                            : `${Math.floor(routeDuration / 60)} ساعت ${routeDuration % 60} دقیقه`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                  <Button onClick={openInGoogleMaps} className="gap-2">
                    <Navigation className="h-4 w-4" />
                    شروع مسیریابی
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!userLocation && !isLocating && !locationError && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-primary/10 border border-primary/20 rounded-xl p-4 shadow-lg text-center">
              <Locate className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium text-primary">روی دکمه "موقعیت من" کلیک کنید</p>
              <p className="text-sm text-muted-foreground mt-1">
                برای نمایش مسیر، ابتدا موقعیت خود را فعال کنید
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
