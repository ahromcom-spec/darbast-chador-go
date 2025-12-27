import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Navigation, Locate, AlertCircle, Loader2, X, MapPin, CheckCircle, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NavigationMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
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
  const shadowLineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  
  const { toast } = useToast();

  // Cleanup watch position on unmount or close
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Stop tracking when dialog closes
  useEffect(() => {
    if (!open && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
    }
  }, [open]);

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainer.current) return;

    // Clean up previous map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Reset Leaflet binding on the DOM node (prevents "Map container is already initialized" -> grey box)
    const container = mapContainer.current;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((container as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (container as any)._leaflet_id;
      }
    } catch {
      // ignore
    }
    container.innerHTML = '';

    // Reset state
    setHasArrived(false);
    setDistanceToDestination(null);

    // Delay to ensure Dialog is fully laid out
    const initTimer = window.setTimeout(() => {
      if (!mapContainer.current) return;

      try {
        const map = L.map(mapContainer.current, {
          center: [destinationLat, destinationLng],
          zoom: 14,
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
          dragging: true,
          preferCanvas: true,
        });

        mapRef.current = map;

        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          crossOrigin: 'anonymous',
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 4,
        });

        tileLayer.on('tileerror', (e) => {
          console.warn('[NavigationMapDialog] tileerror', e);
        });

        tileLayer.addTo(map);

        // Custom destination marker
        const destIcon = L.divIcon({
          className: 'destination-marker',
          html: `
            <div style="
              width: 40px;
              height: 40px;
              background: hsl(var(--destructive));
              border: 3px solid hsl(var(--background));
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px hsl(var(--foreground) / 0.25);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                transform: rotate(45deg);
                color: hsl(var(--destructive-foreground));
                font-size: 20px;
                font-weight: bold;
              ">🏠</div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const destMarker = L.marker([destinationLat, destinationLng], { icon: destIcon }).addTo(map);
        if (destinationAddress) {
          destMarker.bindPopup(
            `<div style="padding: 8px; max-width: 200px;"><strong>مقصد:</strong><br/>${destinationAddress}</div>`
          );
        }
        destMarkerRef.current = destMarker;

        const doInvalidate = () => mapRef.current?.invalidateSize({ animate: false });
        map.whenReady(() => {
          doInvalidate();
          window.setTimeout(doInvalidate, 50);
          window.setTimeout(doInvalidate, 200);
          window.setTimeout(doInvalidate, 500);
          window.setTimeout(doInvalidate, 1000);
        });
      } catch (error) {
        console.error('Error initializing navigation map:', error);
        toast({
          variant: 'destructive',
          title: 'خطا در نمایش نقشه',
          description: 'بارگذاری نقشه با مشکل مواجه شد. لطفاً صفحه را رفرش کنید.',
        });
      }
    }, 250);

    // Cleanup
    return () => {
      window.clearTimeout(initTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [open, destinationLat, destinationLng, destinationAddress, toast]);

  // Update user marker position
  const updateUserMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;

    // Remove previous user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Custom user marker (blue pulsing dot)
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-marker-pulse" style="
          width: 24px;
          height: 24px;
          background: hsl(var(--primary));
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,0,0,0.3), 0 0 40px hsl(var(--primary) / 0.4);
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(mapRef.current);
    userMarker.bindPopup('<div style="padding: 8px;"><strong>موقعیت شما</strong></div>');
    userMarkerRef.current = userMarker;
  }, []);

  // Calculate and draw route
  const calculateRoute = useCallback(async (userLat: number, userLng: number) => {
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

        // Remove previous routes
        if (routeLineRef.current) {
          routeLineRef.current.remove();
        }
        if (shadowLineRef.current) {
          shadowLineRef.current.remove();
        }

        // Draw route on map
        if (mapRef.current) {
          const coordinates = (data.geometry.coordinates as [number, number][])
            .map((coord) => [coord[1], coord[0]] as [number, number]);
          
          // Shadow line for depth
          const shadowLine = L.polyline(coordinates, {
            color: 'rgba(0,0,0,0.3)',
            weight: 10,
            opacity: 0.3,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(mapRef.current);
          shadowLine.bringToBack();
          shadowLineRef.current = shadowLine;

          // Main route line
          const routeLine = L.polyline(coordinates, {
            color: '#2563eb',
            weight: 6,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(mapRef.current);
          routeLineRef.current = routeLine;

          // Fit bounds to show entire route
          const bounds = L.latLngBounds(coordinates);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [destinationLat, destinationLng]);

  // Check if user has arrived (within 50 meters)
  const checkArrival = useCallback((lat: number, lng: number) => {
    const distance = calculateDistance(lat, lng, destinationLat, destinationLng);
    setDistanceToDestination(distance);
    
    if (distance <= 50 && !hasArrived) {
      setHasArrived(true);
      
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsTracking(false);
      }
      
      // Show arrival notification
      toast({
        title: '🎉 به مقصد رسیدید!',
        description: destinationAddress || 'شما به مقصد خود رسیده‌اید',
      });

      // Try to play a sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQwPT5W7zqlrFxxRlLPGpGshKVWYq7qYaiE0XqKorIddMlKkqKyDUT9cp6aljlFNY6uhmpFYWmeopp2QX2dlp6Wck2NlaKGjnJhpaGijoZ2WanBopaGdmXJwaaOgn5t3dGqgn5+bfHlqnp2fnYB+bJubnZ6DgG6Zmp6fhYNvl5mfnoeGb5WYnp2Ih3CTl52biYlxk5abnouLc5GVmpyMjXSPlpmajI91jZWYmI2PeIuTlpaNkHqJkpWUjpF8h5GTk46Rf4WQkpGNkYKDj5CQjJGEgo2PjoyQhoGLjo2LkImAiY2Mi5CJf4eMi4qPiH+GioqKjoiAhYmJiY6Jf4SIiImNioCDh4eHjIuBgoaHh4yLgYGFhoWLioKAhIWFi4qDf4OEhIqJhH+CgwOJiYV+gYMDiImFfoGCA4iJhX6BgQOHiIV+gYEDh4iFfoCBA4eHhH5/gAOGhoR9f38DhoWDfX5+A4WFg3x9fgOEhIJ8fH0DhIOCe3t8A4OCgXp6fAOCgYB5eXsDgYB/eHh6A4CAf3d3eQN/f351dngDfn59dHV3A31+fHNzdgN8fXtycnUDe3x6cXFzA3p7eXBwcgN5enhubnEDeHl3bW1wA3d4dm1scAN2d3VrbG8DdXZ0amtvA3R1c2lqbgNzdHJoaG0DcnNxZ2dsA3FycGZmagNwcW9lZWkDb3BuZGRoA25vbWNjZwNtbmxiYmYDbG1rYWFlA2tsamBgZANqamleX2MDaWloXl5iA2hoZ11dYQNnZ2ZcXGADZmZlW1tfA2VlZFpaXgNkZGNZWV0DY2NiWFhcA2JiYVdXWwNhYWBWVloDYGBfVVVZA19fXlRUWANeXl1TU1cDXV1cUlJWA1xcW1FRVQNbW1pQUFQDWlpZT09TA1lZWE5OUgNYWFdNTVEDV1dWTExQA1ZWVUtLTwNVVVRKSk4DVFRTSUlNA1NTUkhITANSUlFHR0sDUVFQRkZKA1BQTYV/A09PT0RERgNOTk5DQ0UDTU1NQkJEA0xMTEFBQwNLS0tAQEIDSkpKPz9BA0lJST4+QANISEg9PT8DR0dHPDw+A0ZGRT09PQNFRkQ7Ozw=');
        audio.play().catch(() => {});
      } catch {}
    }
  }, [destinationLat, destinationLng, destinationAddress, hasArrived, toast]);

  // Start live tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('مرورگر شما از موقعیت‌یابی پشتیبانی نمی‌کند');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setHasArrived(false);

    // First get current position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);
        setIsTracking(true);

        // Update marker
        updateUserMarker(latitude, longitude);

        // Calculate initial route
        await calculateRoute(latitude, longitude);

        // Check if already at destination
        checkArrival(latitude, longitude);

        // Start watching position for live updates
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            setUserLocation({ lat, lng });
            
            // Update marker position
            updateUserMarker(lat, lng);
            
            // Check arrival
            checkArrival(lat, lng);

            // Recalculate route every update
            await calculateRoute(lat, lng);
            
            // Center map on user
            if (mapRef.current) {
              mapRef.current.panTo([lat, lng], { animate: true });
            }
          },
          (error) => {
            console.error('Watch position error:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      },
      (error) => {
        setIsLocating(false);
        let errorMessage = 'خطا در دریافت موقعیت';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'لطفاً دسترسی به موقعیت را در تنظیمات مرورگر فعال کنید. ابتدا روی آیکون قفل در نوار آدرس کلیک کرده و موقعیت را مجاز کنید.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'موقعیت در دسترس نیست. لطفاً GPS را روشن کنید';
            break;
          case error.TIMEOUT:
            errorMessage = 'زمان درخواست موقعیت به پایان رسید. دوباره تلاش کنید';
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
  }, [updateUserMarker, calculateRoute, checkArrival, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Open in navigation apps
  const openInGoogleMaps = () => {
    const url = userLocation
      ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${destinationLat},${destinationLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;
    window.open(url, '_blank');
  };

  // Format distance for display
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} متر`;
    }
    return `${(meters / 1000).toFixed(1)} کیلومتر`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              مسیریابی به مقصد
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                stopTracking();
                onOpenChange(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative flex-1 overflow-hidden" style={{ minHeight: '500px' }}>
          {/* Map Container */}
          <div 
            ref={mapContainer} 
            className="absolute inset-0"
            style={{ 
              background: '#f0f0f0',
              zoom: '1',
              transform: 'translateZ(0)',
            }}
          />

          {/* Arrived Banner */}
          {hasArrived && (
            <div className="absolute top-4 left-4 right-4 z-[1000] bg-green-500 text-white p-4 rounded-xl shadow-lg flex items-center gap-3 animate-pulse">
              <CheckCircle className="h-8 w-8 flex-shrink-0" />
              <div>
                <p className="font-bold text-lg">🎉 به مقصد رسیدید!</p>
                <p className="text-sm opacity-90">{destinationAddress || 'شما به مقصد خود رسیده‌اید'}</p>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            {!isTracking ? (
              <Button
                onClick={startTracking}
                disabled={isLocating}
                className="gap-2 shadow-lg"
                size="lg"
              >
                {isLocating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Locate className="h-5 w-5" />
                )}
                {isLocating ? 'در حال یافتن موقعیت...' : 'شروع مسیریابی'}
              </Button>
            ) : (
              <Button
                onClick={stopTracking}
                variant="destructive"
                className="gap-2 shadow-lg"
                size="lg"
              >
                <X className="h-5 w-5" />
                توقف مسیریابی
              </Button>
            )}
            
            {userLocation && (
              <Button
                onClick={openInGoogleMaps}
                className="gap-2 shadow-lg"
                variant="secondary"
              >
                <Navigation className="h-4 w-4" />
                Google Maps
              </Button>
            )}
          </div>

          {/* Location Error */}
          {locationError && (
            <div className="absolute top-20 left-4 right-4 z-[1000] bg-destructive/95 text-destructive-foreground p-4 rounded-lg shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">دسترسی به موقعیت</p>
                  <p className="text-sm">{locationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Live Distance Panel */}
          {isTracking && distanceToDestination !== null && !hasArrived && (
            <div className="absolute top-20 left-4 z-[1000] bg-primary text-primary-foreground p-3 rounded-xl shadow-lg">
              <div className="text-center">
                <p className="text-xs opacity-80">فاصله تا مقصد</p>
                <p className="font-bold text-xl">{formatDistance(distanceToDestination)}</p>
              </div>
            </div>
          )}

          {/* Route Info Panel */}
          {(routeDistance || isCalculatingRoute) && !hasArrived && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-background/95 backdrop-blur border rounded-xl p-4 shadow-lg">
              {isCalculatingRoute ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال محاسبه مسیر...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">فاصله مسیر</p>
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
                  {isTracking && (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">مسیریابی فعال</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!userLocation && !isLocating && !locationError && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-primary/10 border border-primary/20 rounded-xl p-5 shadow-lg text-center">
              <Locate className="h-12 w-12 mx-auto mb-3 text-primary animate-bounce" />
              <p className="font-bold text-lg text-primary mb-2">شروع مسیریابی</p>
              <p className="text-sm text-muted-foreground mb-4">
                روی دکمه "شروع مسیریابی" کلیک کنید تا موقعیت شما پیدا شود و مسیر تا مقصد نمایش داده شود
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">⚠️ توجه:</p>
                <p>اگر اولین بار است، مرورگر از شما اجازه دسترسی به موقعیت را می‌خواهد. لطفاً "مجاز" را بزنید.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
