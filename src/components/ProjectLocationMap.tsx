import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, List } from 'lucide-react';
import { toast } from 'sonner';

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
  const [address, setAddress] = useState<string>('');
  const [lat, setLat] = useState<string>('34.6416');
  const [lng, setLng] = useState<string>('50.8746');

  useEffect(() => {
    // نقشه غیرفعال است — منطق خاصی نیاز نیست
  }, []);

  const handleConfirm = () => {
    if (!onLocationSelect) return;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      toast.error('لطفا مختصات معتبر وارد کنید');
      return;
    }
    onLocationSelect({
      address: address || `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`,
      coordinates: [lngNum, latNum],
      distance: 0,
    });
    toast.success('موقعیت ثبت شد');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          موقعیت پروژه
        </CardTitle>
        <CardDescription>
          نقشه موقتا غیرفعال است. می‌توانید از لیست پروژه‌های موجود انتخاب کنید یا مختصات را دستی وارد نمایید.
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

        <div className="space-y-3">
          <label className="block text-sm">آدرس (اختیاری)</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="مثلا: قم، ..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">عرض جغرافیایی (Lat)</label>
            <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-2">طول جغرافیایی (Lng)</label>
            <Input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
        </div>

        {onLocationSelect && (
          <div className="flex justify-end">
            <Button onClick={handleConfirm}>
              <MapPin className="w-4 h-4 ml-2" />
              تایید موقعیت
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectLocationMap;

