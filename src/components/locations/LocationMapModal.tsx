import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, X } from 'lucide-react';

interface LocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export const LocationMapModal = ({
  isOpen,
  onClose,
  onLocationSelect,
  initialLat = 34.6416,
  initialLng = 50.8746,
}: LocationMapModalProps) => {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLat(String(initialLat));
      setLng(String(initialLng));
    }
  }, [isOpen, initialLat, initialLng]);

  const handleConfirm = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      onLocationSelect(latNum, lngNum);
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            انتخاب موقعیت (نقشه موقتا غیرفعال است)
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            به دلیل مشکلات بارگذاری، نقشه موقتا غیرفعال شده است. لطفا مختصات را به صورت دستی وارد کنید.
          </div>

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
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                <X className="w-4 h-4 ml-2" />
                انصراف
              </Button>
              <Button onClick={handleConfirm}>
                <MapPin className="w-4 h-4 ml-2" />
                تایید موقعیت
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
