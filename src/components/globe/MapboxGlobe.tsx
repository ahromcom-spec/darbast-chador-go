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
        } else {
          console.error('No token in response');
          setError('توکن نقشه دریافت نشد');
        }
        setLoading(false);
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

    // Create map instance with globe view using real satellite imagery
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9', // Real Earth satellite imagery
      projection: 'globe',
      zoom: 0.8, // Start from full globe view
      center: [0, 20], // Global center
      pitch: 0,
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

    // Track zoom level and switch style/projection
    map.current.on('zoom', () => {
      if (map.current) {
        const zoom = map.current.getZoom();
        setCurrentZoom(zoom);
        
        // Switch to mercator projection and streets style at higher zoom levels
        if (zoom > 6 && map.current.getProjection().name === 'globe') {
          map.current.setProjection('mercator');
          // Switch to detailed streets map for better clarity
          map.current.setStyle('mapbox://styles/mapbox/streets-v12');
        }
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

    // Smooth animation sequence - Google Earth style
    setTimeout(() => {
      if (!map.current) return;
      // Step 1: Rotate to show Iran
      map.current.flyTo({
        center: [53.688, 32.4279],
        zoom: 2.5,
        pitch: 30,
        bearing: 0,
        duration: 3000,
        essential: true
      });
    }, 800);

    setTimeout(() => {
      if (!map.current) return;
      // Step 2: Zoom to Iran
      map.current.flyTo({
        center: [53.688, 32.4279],
        zoom: 5.5,
        pitch: 45,
        bearing: 0,
        duration: 2500,
        essential: true
      });
    }, 4000);

    setTimeout(() => {
      if (!map.current || projects.length === 0) return;
      
      const qomLat = 34.6401;
      const qomLng = 50.8764;
      
      // Step 3: Zoom to Qom province with mercator
      map.current.setProjection('mercator');
      map.current.flyTo({
        center: [qomLng, qomLat],
        zoom: 11,
        pitch: 50,
        bearing: 20,
        duration: 2500,
        essential: true
      });
    }, 6800);

    setTimeout(() => {
      if (!map.current || projects.length === 0) return;
      
      const firstProject = projects[0];
      if (firstProject.locations?.lat && firstProject.locations?.lng) {
        // Step 4: Zoom to exact building/street location
        map.current.flyTo({
          center: [firstProject.locations.lng, firstProject.locations.lat],
          zoom: 18.5, // Very close street-level zoom to see buildings
          pitch: 65,
          bearing: 30,
          duration: 3000,
          essential: true
        });
      }
    }, 9500);

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, projects]);

  // Add markers for projects
  useEffect(() => {
    if (!map.current || projects.length === 0) return;

    const addMarkers = () => {
      projects.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;
        if (!map.current) return;

        const isFirst = index === 0;
        
        // Create custom 3D-style marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = isFirst ? '50px' : '36px';
        el.style.height = isFirst ? '50px' : '36px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = isFirst ? '#ef4444' : '#f59e0b';
        el.style.border = '4px solid white';
        el.style.boxShadow = '0 8px 16px rgba(0,0,0,0.4), 0 0 0 2px rgba(239,68,68,0.3)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = isFirst ? '24px' : '18px';
        el.style.transition = 'transform 0.2s';
        el.innerHTML = isFirst ? '📍' : '📌';
        
        // Hover effect
        el.onmouseenter = () => {
          el.style.transform = 'scale(1.2)';
        };
        el.onmouseleave = () => {
          el.style.transform = 'scale(1)';
        };

        // Create popup with better styling
        const popup = new mapboxgl.Popup({ 
          offset: 30,
          closeButton: false,
          className: 'custom-popup'
        }).setHTML(
          `<div style="padding: 12px; font-family: 'IRANSans', sans-serif; direction: rtl; min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 16px; color: #1f2937;">${project.title || 'پروژه'}</h3>
            <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">${project.locations?.address_line || ''}</p>
          </div>`
        );

        // Add marker to map
        new mapboxgl.Marker(el)
          .setLngLat([project.locations.lng, project.locations.lat])
          .setPopup(popup)
          .addTo(map.current);
      });
    };

    // Wait for map to load before adding markers
    if (map.current.loaded()) {
      addMarkers();
    } else {
      map.current.on('load', addMarkers);
    }
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
            <Card className="p-6 bg-gradient-to-br from-background/98 to-background/95 backdrop-blur-lg border-2 border-primary/40 shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                  <p className="text-center text-xl font-bold text-foreground">
                    {currentZoom < 6 ? 'در حال پرواز به ایران...' : 
                     currentZoom < 11 ? 'استان قم' : 
                     currentZoom < 16 ? 'نزدیک می‌شویم...' : 
                     'موقعیت دقیق پروژه شما'}
                  </p>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">استان قم</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span className="text-muted-foreground">{projects.length} پروژه فعال</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  زوم: {currentZoom.toFixed(1)}x • 
                  {currentZoom < 16 ? ' در حال نزدیک شدن به موقعیت دقیق...' : ' می‌توانید خیابان و ساختمان را ببینید'}
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
