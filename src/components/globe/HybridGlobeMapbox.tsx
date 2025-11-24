import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowRight, MapPin, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ProjectHierarchy = ReturnType<typeof useProjectsHierarchy>['projects'][0];

interface HierarchyMedia {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  created_at: string;
}

interface ProjectWithMedia extends ProjectHierarchy {
  media?: HierarchyMedia[];
}

interface HybridGlobeMapboxProps {
  onClose: () => void;
}

export default function HybridGlobeMapbox({ onClose }: HybridGlobeMapboxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; mimeType: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');

  const { projects, loading } = useProjectsHierarchy();
  const { toast } = useToast();

  // دریافت توکن Mapbox
  useEffect(() => {
    const cached = sessionStorage.getItem('mapbox_token');
    if (cached) {
      setMapboxToken(cached);
      return;
    }

    const tryEdgeThenEnv = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          setMapboxToken(data.token);
          sessionStorage.setItem('mapbox_token', data.token);
          return;
        }
      } catch (_) {}

      const envToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      if (envToken) {
        setMapboxToken(envToken);
        sessionStorage.setItem('mapbox_token', envToken);
      }
    };

    tryEdgeThenEnv();
  }, []);

  // دریافت media پروژه‌ها
  const fetchProjectMedia = useCallback(async () => {
    if (projects.length === 0) return;

    try {
      const projectIds = projects.map(p => p.id);
      
      const { data: phMedia } = await supabase
        .from('project_hierarchy_media')
        .select('id, hierarchy_project_id, file_path, file_type, created_at, mime_type')
        .in('hierarchy_project_id', projectIds)
        .in('file_type', ['image', 'video'])
        .order('created_at', { ascending: false });

      const mediaByProject = new Map<string, HierarchyMedia[]>();
      
      phMedia?.forEach(m => {
        const pid = m.hierarchy_project_id;
        if (!mediaByProject.has(pid)) mediaByProject.set(pid, []);
        mediaByProject.get(pid)!.push({ 
          id: m.id, 
          file_path: m.file_path, 
          file_type: m.file_type, 
          created_at: m.created_at, 
          mime_type: m.mime_type 
        });
      });

      const projectsWithMediaData: ProjectWithMedia[] = projects.map(project => {
        const list = (mediaByProject.get(project.id) || []).sort((a, b) => 
          (a.created_at > b.created_at ? -1 : 1)
        );
        return { ...project, media: list.slice(0, 2) };
      });
      
      setProjectsWithMedia(projectsWithMediaData);
      
      (window as any).openProjectVideo = (videoUrl: string) => {
        window.open(videoUrl, '_blank');
      };
    } catch (error) {
      console.error('خطا در دریافت media:', error);
      setProjectsWithMedia(projects.map(p => ({ ...p, media: [] })));
    }
  }, [projects]);

  useEffect(() => {
    fetchProjectMedia();
  }, [fetchProjectMedia]);

  // ایجاد نقشه Mapbox
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [50.8764, 34.6416], // قم
      zoom: 13,
      pitch: 45,
      bearing: -17.6,
      antialias: true
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // اضافه کردن لایه سه‌بعدی ساختمان‌ها
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']
      )?.id;

      map.current.addLayer(
        {
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#d4b896',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.8
          }
        },
        labelLayerId
      );

      setMapReady(true);
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // اضافه کردن مارکرها
  useEffect(() => {
    if (!map.current || !mapReady || loading || projectsWithMedia.length === 0) return;

    // پاک کردن مارکرهای قبلی
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const projectsWithLocation = projectsWithMedia.filter(
      p => Number.isFinite(p.locations?.lat) && Number.isFinite(p.locations?.lng)
    );

    if (projectsWithLocation.length === 0) return;

    // گروه‌بندی بر اساس موقعیت
    const locationGroups: Record<string, ProjectWithMedia[]> = {};
    projectsWithLocation.forEach(project => {
      if (!project.locations?.lat || !project.locations?.lng) return;
      const key = `${project.locations.lat.toFixed(6)}_${project.locations.lng.toFixed(6)}`;
      if (!locationGroups[key]) locationGroups[key] = [];
      locationGroups[key].push(project);
    });

    const bounds = new mapboxgl.LngLatBounds();
    let hasMarkers = false;

    Object.values(locationGroups).forEach(group => {
      const count = group.length;
      const firstProject = group[0];
      const centerLat = firstProject.locations!.lat;
      const centerLng = firstProject.locations!.lng;

      // اگر بیش از یک پروژه در این موقعیت است
      if (count > 1) {
        // نقطه مرکزی
        const centerEl = document.createElement('div');
        centerEl.className = 'center-marker';
        centerEl.style.backgroundColor = '#ef4444';
        centerEl.style.width = '20px';
        centerEl.style.height = '20px';
        centerEl.style.borderRadius = '50%';
        centerEl.style.border = '3px solid #fff';
        centerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

        new mapboxgl.Marker(centerEl)
          .setLngLat([centerLng, centerLat])
          .addTo(map.current!);

        bounds.extend([centerLng, centerLat]);
        hasMarkers = true;
      }

      group.forEach((project, index) => {
        if (!project.locations?.lat || !project.locations?.lng) return;

        let lat = centerLat;
        let lng = centerLng;

        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          const radius = 0.0015;
          lat = centerLat + radius * Math.cos(angle);
          lng = centerLng + radius * Math.sin(angle);

          // خط اتصال
          if (map.current?.getSource(`line-${project.id}`) === undefined) {
            map.current?.addSource(`line-${project.id}`, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [[lng, lat], [centerLng, centerLat]]
                }
              }
            });

            map.current?.addLayer({
              id: `line-${project.id}`,
              type: 'line',
              source: `line-${project.id}`,
              layout: {},
              paint: {
                'line-color': '#3b82f6',
                'line-width': 2,
                'line-opacity': 0.7,
                'line-dasharray': [2, 3]
              }
            });
          }
        }

        // مارکر پروژه
        const el = document.createElement('div');
        el.className = 'project-marker';
        el.style.backgroundImage = 'url(https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png)';
        el.style.width = '25px';
        el.style.height = '41px';
        el.style.backgroundSize = 'contain';
        el.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right;">
                  <strong>${project.title || 'پروژه'}</strong><br/>
                  <span style="font-size: 12px; color: #666;">${project.locations?.address_line || ''}</span>
                  ${count > 1 ? `<div style="margin-top:8px;padding:4px 8px;background:#f3f4f6;border-radius:4px;text-align:center;font-size:11px;">پروژه ${index + 1} از ${count}</div>` : ''}
                </div>
              `)
          )
          .addTo(map.current!);

        marker.getElement().addEventListener('click', () => {
          setSelectedProject(project);
        });

        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        hasMarkers = true;
      });
    });

    // تنظیم نمای نقشه
    if (hasMarkers && !bounds.isEmpty()) {
      map.current?.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    }
  }, [projectsWithMedia, mapReady, loading]);

  // مدیریت آپلود فایل
  const handleAddImage = () => {
    if (!selectedProject) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedProject) return;
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'خطا', description: 'برای آپلود باید وارد شوید', variant: 'destructive' });
        return;
      }

      const newMedia: HierarchyMedia[] = [];
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) continue;
        
        const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) continue;
        
        const filePath = `${user.id}/hierarchy/${selectedProject.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        
        setUploadProgress(Math.round((i / fileArray.length) * 100));

        const { error: uploadErr } = await supabase.storage
          .from('order-media')
          .upload(filePath, file, { contentType: file.type });
        
        if (uploadErr) continue;

        const { data: insertData, error: insertErr } = await supabase
          .from('project_hierarchy_media')
          .insert({
            hierarchy_project_id: selectedProject.id,
            file_path: filePath,
            file_type: isVideo ? 'video' : 'image',
            mime_type: file.type,
            file_size: file.size,
            user_id: user.id,
          })
          .select('id, file_path, file_type, created_at, mime_type')
          .single();

        if (!insertErr && insertData) {
          newMedia.push(insertData);
        }
      }

      if (newMedia.length > 0) {
        setProjectsWithMedia(prev => prev.map(p => p.id === selectedProject.id
          ? { ...p, media: [...newMedia, ...(p.media || [])].slice(0, 3) }
          : p
        ));
        setSelectedProject(prev => prev ? { ...prev, media: [...newMedia, ...(prev.media || [])].slice(0, 3) } : prev);
        toast({ title: 'موفق', description: `${newMedia.length} فایل آپلود شد.` });
      }
    } catch (err: any) {
      toast({ title: 'خطا', description: 'مشکل در آپلود', variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-0 z-[2000] pointer-events-none">
        <Button
          variant="default"
          size="lg"
          onClick={onClose}
          className="pointer-events-auto absolute top-6 right-6 shadow-2xl"
        >
          <ArrowRight className="h-5 w-5 ml-2" />
          بازگشت
        </Button>

        <Card className="pointer-events-auto absolute top-6 left-6 bg-card shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary">{projectsWithMedia.length}</span>
              <span className="text-sm text-muted-foreground">پروژه فعال</span>
            </div>
          </div>
        </Card>
      </div>

      <div ref={mapContainer} className="w-full h-full" />

      {selectedProject && (
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md bg-card shadow-2xl p-4 z-[2000] pointer-events-auto">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-base font-semibold">{selectedProject.title || 'پروژه'}</h3>
                <p className="text-xs text-muted-foreground mt-1">{selectedProject.locations?.address_line}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedProject(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleAddImage} disabled={uploading} className="w-full">
              {uploading ? `در حال آپلود... ${uploadProgress}%` : '+ افزودن عکس یا ویدیو'}
            </Button>
          </div>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
