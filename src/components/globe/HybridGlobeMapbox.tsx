import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ArrowRight, MapPin, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapInitializer() {
  const map = useMap();
  
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

export default function HybridGlobeMapbox({ onClose }: HybridGlobeMapboxProps) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithMedia | null>(null);
  const [projectsWithMedia, setProjectsWithMedia] = useState<ProjectWithMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { projects, loading } = useProjectsHierarchy();
  const { toast } = useToast();

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
    } catch (error) {
      console.error('خطا در دریافت media:', error);
      setProjectsWithMedia(projects.map(p => ({ ...p, media: [] })));
    }
  }, [projects]);

  useEffect(() => {
    fetchProjectMedia();
  }, [fetchProjectMedia]);

  const projectsWithLocation = projectsWithMedia.filter(
    p => Number.isFinite(p.locations?.lat) && Number.isFinite(p.locations?.lng)
  );

  const defaultCenter: [number, number] = useMemo(() => {
    if (projectsWithLocation.length > 0) {
      return [projectsWithLocation[0].locations!.lat, projectsWithLocation[0].locations!.lng];
    }
    return [35.6892, 51.3890]; // تهران
  }, [projectsWithLocation]);

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

      <div className="w-full h-full">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          minZoom={5}
          maxZoom={22}
          scrollWheelZoom
          className="w-full h-full"
          style={{ height: '100vh', width: '100vw' }}
        >
          <MapInitializer />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22}
          />
          {projectsWithLocation.map(project => (
            project.locations && (
              <Marker
                key={project.id}
                position={[project.locations.lat, project.locations.lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => setSelectedProject(project),
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Vazirmatn, sans-serif', direction: 'rtl', textAlign: 'right' }}>
                    <strong>{project.title || 'پروژه'}</strong><br/>
                    <span style={{ fontSize: '12px', color: '#666' }}>{project.locations?.address_line || ''}</span>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>

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
