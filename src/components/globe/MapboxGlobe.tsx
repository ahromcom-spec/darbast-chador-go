import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import LeafletFallbackMap from '@/components/locations/LeafletFallbackMap';

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
  const [animationStatus, setAnimationStatus] = useState('در حال آماده‌سازی...');
  const [useFallback, setUseFallback] = useState(false);

  // Get Mapbox token
  useEffect(() => {
    const getToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          setError('خطا در دریافت توکن نقشه');
          setUseFallback(true);
          setLoading(false);
          return;
        }
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('توکن نقشه دریافت نشد');
          setUseFallback(true);
        }
        setLoading(false);
      } catch (error) {
        setError('خطا در اتصال به سرور');
        setUseFallback(true);
        setLoading(false);
      }
    };
    getToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    // Create map with real Earth satellite
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      projection: 'globe',
      zoom: 1,
      center: [30, 20],
      pitch: 0,
      bearing: 0,
    });

    // Basic render watchdog: if nothing renders, fallback to OSM
    let hadRender = false;
    map.current.on('render', () => { hadRender = true; });
    setTimeout(() => {
      if (!hadRender) {
        console.warn('Mapbox did not render in time, switching to Leaflet fallback');
        setError('عدم نمایش داده‌های Mapbox');
        setUseFallback(true);
      }
    }, 6000);

    // Any map error -> fallback
    map.current.on('error', (e) => {
      console.error('Mapbox error', e);
      setError('مشکل در بارگذاری نقشه (Mapbox). در حال نمایش نقشه جایگزین.');
      setUseFallback(true);
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    // RTL support
    if (mapboxgl.getRTLTextPluginStatus() === 'unavailable') {
      mapboxgl.setRTLTextPlugin(
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js',
        () => {},
        true
      );
    }

    // Track zoom and switch to street map when close
    map.current.on('zoom', () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      setCurrentZoom(zoom);
      
      if (zoom > 8 && map.current.getStyle().name !== 'Mapbox Streets') {
        map.current.setStyle('mapbox://styles/mapbox/streets-v12');
        if (map.current.getProjection().name === 'globe') {
          map.current.setProjection('mercator');
        }
      }
    });

    // Atmosphere
    map.current.on('style.load', () => {
      if (!map.current) return;
      map.current.setFog({
        color: 'rgb(220, 220, 220)',
        'high-color': 'rgb(200, 200, 225)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.2
      });
    });

    // Animation sequence - Google Earth style
    map.current.on('load', () => {
      setTimeout(() => {
        if (!map.current) return;
        setAnimationStatus('در حال پرواز به ایران...');
        map.current.flyTo({
          center: [53.688, 32.4279],
          zoom: 5,
          pitch: 40,
          duration: 3500,
          essential: true
        });
      }, 1000);

      setTimeout(() => {
        if (!map.current || projects.length === 0) return;
        setAnimationStatus('در حال نزدیک شدن به قم...');
        map.current.flyTo({
          center: [50.8764, 34.6401],
          zoom: 11,
          pitch: 50,
          bearing: 20,
          duration: 3000,
          essential: true
        });
      }, 5000);

      setTimeout(() => {
        if (!map.current || projects.length === 0) return;
        
        const firstProject = projects[0];
        if (firstProject.locations?.lat && firstProject.locations?.lng) {
          setAnimationStatus('موقعیت دقیق پروژه شما');
          map.current.setStyle('mapbox://styles/mapbox/streets-v12');
          map.current.setProjection('mercator');
          map.current.flyTo({
            center: [firstProject.locations.lng, firstProject.locations.lat],
            zoom: 18,
            pitch: 60,
            bearing: 30,
            duration: 3500,
            essential: true
          });
        }
      }, 8500);

      // Add markers after animation
      if (projects.length > 0) {
        setTimeout(() => {
          projects.forEach((project, index) => {
            if (!project.locations?.lat || !project.locations?.lng || !map.current) return;

            const isFirst = index === 0;
            const el = document.createElement('div');
            el.style.width = isFirst ? '50px' : '36px';
            el.style.height = isFirst ? '50px' : '36px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = isFirst ? '#ef4444' : '#f59e0b';
            el.style.border = '4px solid white';
            el.style.boxShadow = '0 8px 16px rgba(0,0,0,0.4)';
            el.style.cursor = 'pointer';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = isFirst ? '24px' : '18px';
            el.style.transition = 'transform 0.2s';
            el.innerHTML = isFirst ? '📍' : '📌';
            
            el.onmouseenter = () => el.style.transform = 'scale(1.2)';
            el.onmouseleave = () => el.style.transform = 'scale(1)';

            const popup = new mapboxgl.Popup({ offset: 30, closeButton: false }).setHTML(
              `<div style="padding: 12px; font-family: 'IRANSans', sans-serif; direction: rtl; min-width: 200px;">
                <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">${project.title || 'پروژه'}</h3>
                <p style="font-size: 13px; color: #666; line-height: 1.5; margin: 0;">${project.locations?.address_line || ''}</p>
              </div>`
            );

            new mapboxgl.Marker(el)
              .setLngLat([project.locations.lng, project.locations.lat])
              .setPopup(popup)
              .addTo(map.current!);
          });
        }, 12000);
      }
    });

    return () => map.current?.remove();
  }, [mapboxToken, projects]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute top-4 right-4 z-10">
        <Button variant="outline" size="icon" onClick={onClose} className="rounded-full bg-background/90 backdrop-blur-sm shadow-lg">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-lg font-semibold">در حال بارگذاری کره زمین...</p>
            </div>
          </Card>
        </div>
      )}

      {error && !useFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <Card className="p-8 max-w-md">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="text-6xl">⚠️</div>
              <h2 className="text-xl font-bold text-destructive">خطا</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={onClose} variant="outline">بستن</Button>
            </div>
          </Card>
        </div>
      )}

      {!loading && (
        <>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <Card className="p-6 bg-gradient-to-br from-background/98 to-background/95 backdrop-blur-lg border-2 border-primary/40 shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                  <p className="text-center text-xl font-bold text-foreground">
                    {useFallback ? 'نمای جایگزین OpenStreetMap فعال شد' : animationStatus}
                  </p>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                </div>
                <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>استان قم</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span>{projects.length} پروژه</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {useFallback
                    ? 'Tiles Mapbox در دسترس نیست. از نقشه متن‌باز OSM استفاده می‌کنیم.'
                    : currentZoom < 8 ? 'نمای ماهواره‌ای' : 'نمای نقشه با تمام جزئیات'}
                </p>
              </div>
            </Card>
          </div>

          {useFallback ? (
            <div className="absolute inset-0">
              <LeafletFallbackMap onLocationSelect={() => {}} />
            </div>
          ) : (
            <div ref={mapContainer} className="absolute inset-0" />
          )}
        </>
      )}
    </div>
  );
}

