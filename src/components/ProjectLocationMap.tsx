import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, List } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ProjectLocationMapProps {
  onLocationSelect?: (location: {
    address: string;
    coordinates: [number, number];
    distance: number;
  }) => void;
  existingProjects?: Array<{
    id: string;
    code: string;
    address: string;
    serviceName: string;
  }>;
  onProjectSelect?: (projectId: string) => void;
}

const ProjectLocationMap: React.FC<ProjectLocationMapProps> = ({
  onLocationSelect,
  existingProjects = [],
  onProjectSelect,
}) => {
  const defaultPosition: [number, number] = [35.6892, 51.3890]; // تهران

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          موقعیت پروژه
        </CardTitle>
        <CardDescription>
          روی نقشه کلیک کنید یا از لیست پروژه‌های موجود انتخاب نمایید
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {existingProjects.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <List className="w-4 h-4" />
              پروژه‌های موجود
            </div>
            <div className="rounded-md border divide-y">
              {existingProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">
                    <div className="font-medium">{p.code} - {p.serviceName}</div>
                    <div className="text-muted-foreground">{p.address}</div>
                  </div>
                  {onProjectSelect && (
                    <Button size="sm" variant="outline" onClick={() => onProjectSelect(p.id)}>
                      انتخاب
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-[400px] w-full rounded-lg overflow-hidden border">
          <MapContainer
            center={defaultPosition}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={defaultPosition}>
              <Popup>تهران، ایران</Popup>
            </Marker>
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectLocationMap;

