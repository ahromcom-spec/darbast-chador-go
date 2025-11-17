import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';

interface MapboxGlobeProps {
  onClose: () => void;
}

export default function MapboxGlobe({ onClose }: MapboxGlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { projects } = useProjectsHierarchy();
  const [currentZoom, setCurrentZoom] = useState(0);

  // Get Mapbox token from edge function
  useEffect(() => {
    const getToken = async () => {
      try {
        console.log('Fetching Mapbox token...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        console.log('Token response:', { data, error });
        
        if (error) {
          console.error('Error from edge function:', error);
          setError('خطا در دریافت توکن نقشه');
          setLoading(false);
          return;
        }
        
        if (data?.token) {
          console.log('Token received successfully');
          setMapboxToken(data.token);
          setLoading(false);
        } else {
          console.error('No token in response');
          setError('توکن نقشه دریافت نشد');
          setLoading(false);
        }
      } catch (error) {
        console.error('Exception getting Mapbox token:', error);
        setError('خطا در اتصال به سرور');
        setLoading(false);
      }
    };
    getToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) {
      console.log('Waiting for container or token...', { 
        hasContainer: !!mapContainer.current, 
        hasToken: !!mapboxToken 
      });
      return;
    }
    if (map.current) return; // Initialize map only once

    console.log('Initializing Mapbox map...');
    mapboxgl.accessToken = mapboxToken;

    // Create map instance
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12', // Detailed street map
      projection: 'globe',
      zoom: 3,
      center: [53.688, 32.4279], // Iran center
      pitch: 45,
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add scale control
    map.current.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      }),
      'bottom-left'
    );

    // Enable RTL for Persian text
    if (mapboxgl.getRTLTextPluginStatus() === 'unavailable') {
      mapboxgl.setRTLTextPlugin(
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js',
        () => {},
        true
      );
    }

    // Track zoom level
    map.current.on('zoom', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    // Add atmosphere for globe view
    map.current.on('style.load', () => {
      if (!map.current) return;
      
      map.current.setFog({
        color: 'rgb(220, 220, 220)',
        'high-color': 'rgb(200, 200, 225)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.15
      });
    });

    // Animation sequence
    setTimeout(() => {
      if (!map.current) return;
      // Fly to Iran
      map.current.flyTo({
        center: [53.688, 32.4279],
        zoom: 5.5,
        pitch: 50,
        bearing: 0,
        duration: 2500,
        essential: true
      });
    }, 1000);

    setTimeout(() => {
      if (!map.current || projects.length === 0) return;
      
      // Get Qom coordinates or first project location
      const firstProject = projects[0];
      const qomLat = 34.6401;
      const qomLng = 50.8764;
      
      // Fly to Qom province
      map.current.flyTo({
        center: [qomLng, qomLat],
        zoom: 10,
        pitch: 55,
        bearing: 30,
        duration: 2000,
        essential: true
      });
    }, 4000);

    setTimeout(() => {
      if (!map.current || projects.length === 0) return;
      
      const firstProject = projects[0];
      if (firstProject.locations?.lat && firstProject.locations?.lng) {
        // Fly to exact project location with street-level zoom
        map.current.flyTo({
          center: [firstProject.locations.lng, firstProject.locations.lat],
          zoom: 17, // Street level zoom
          pitch: 60,
          bearing: 45,
          duration: 2000,
          essential: true
        });
      }
    }, 6500);

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, projects]);

  // Add markers for projects
  useEffect(() => {
    if (!map.current || projects.length === 0) return;

    // Wait for map to load
    map.current.on('load', () => {
      projects.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        if (!map.current) return;

        const isFirst = index === 0;
        
        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = isFirst ? '40px' : '30px';
        el.style.height = isFirst ? '40px' : '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = isFirst ? '#ef4444' : '#fbbf24';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = isFirst ? '20px' : '16px';
        el.innerHTML = isFirst ? '⭐' : '📍';

        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 8px; font-family: 'IRANSans', sans-serif; direction: rtl;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${project.title || 'پروژه'}</h3>
            <p style="font-size: 12px; color: #666;">${project.locations?.address_line || ''}</p>
          </div>`
        );

        // Add marker to map
        new mapboxgl.Marker(el)
          .setLngLat([project.locations.lng, project.locations.lat])
          .setPopup(popup)
          .addTo(map.current);
      });
    });
  }, [projects]);


  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-background/90 backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-lg font-semibold">در حال بارگذاری نقشه...</p>
            </div>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <Card className="p-8 max-w-md">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="text-6xl">⚠️</div>
              <h2 className="text-xl font-bold text-destructive">خطا در بارگذاری نقشه</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={onClose} variant="outline">بستن</Button>
            </div>
          </Card>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <Card className="p-6 bg-gradient-to-br from-background/95 to-background/90 backdrop-blur-md border-2 border-primary/30 shadow-2xl">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <p className="text-center text-xl font-bold text-foreground">
                    پروژه‌های شما در قم
                  </p>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">استان قم</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span className="text-muted-foreground">{projects.length} پروژه فعال</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  زوم فعلی: {currentZoom.toFixed(1)} • برای دیدن جزئیات بیشتر زوم کنید
                </p>
              </div>
            </Card>
          </div>

          <div ref={mapContainer} className="absolute inset-0" />
        </>
      )}
    </div>
  );
}
