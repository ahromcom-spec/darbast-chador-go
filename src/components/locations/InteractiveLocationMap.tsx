import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';

interface InteractiveLocationMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  provinceCode?: string; // kept for compatibility
}

export function InteractiveLocationMap({
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: InteractiveLocationMapProps) {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  useEffect(() => {
    setLat(String(initialLat));
    setLng(String(initialLng));
  }, [initialLat, initialLng]);

  const handleConfirm = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      onLocationSelect(latNum, lngNum);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          انتخاب موقعیت
        </CardTitle>
        <CardDescription>
          نقشه موقتا غیرفعال است. لطفا مختصات را به صورت دستی وارد کنید.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">عرض جغرافیایی (Lat)</label>
            <Input
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="مثلا 34.6416"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">طول جغرافیایی (Lng)</label>
            <Input
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="مثلا 50.8746"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            مقداردهی اولیه: {initialLat.toFixed(4)}, {initialLng.toFixed(4)}
          </div>
          <Button onClick={handleConfirm}>
            <MapPin className="w-4 h-4 ml-2" />
            تایید موقعیت
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

