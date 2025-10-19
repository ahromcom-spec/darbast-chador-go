import { useState } from 'react';
import { useLocations } from '@/hooks/useLocations';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MapPin } from 'lucide-react';
import { locationSchema } from '@/lib/validations';
import { z } from 'zod';

interface NewLocationFormProps {
  onSuccess: (locationId: string) => void;
}

export const NewLocationForm = ({ onSuccess }: NewLocationFormProps) => {
  const { createLocation } = useLocations();
  const { provinces } = useProvinces();
  const { districts, fetchDistrictsByProvince } = useDistricts();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    province_id: '',
    district_id: '',
    address_line: '',
    lat: 0,
    lng: 0
  });

  const [hasMapPin, setHasMapPin] = useState(false);

  const handleProvinceChange = (provinceId: string) => {
    setFormData({ ...formData, province_id: provinceId, district_id: '' });
    fetchDistrictsByProvince(provinceId);
  };

  const handleMapPinClick = () => {
    // TODO: Open map modal to select coordinates
    // For now, setting dummy coordinates
    setFormData({ ...formData, lat: 35.6892, lng: 51.3890 });
    setHasMapPin(true);
    toast({
      title: 'نقطه روی نقشه انتخاب شد',
      description: 'موقعیت دقیق پروژه ثبت شد'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMapPin) {
      toast({
        title: 'خطا',
        description: 'لطفاً موقعیت دقیق را روی نقشه انتخاب کنید',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Validate input data
      const validatedData = locationSchema.parse(formData);
      
      // Create location with validated data
      const location = await createLocation({
        title: validatedData.title,
        province_id: validatedData.province_id,
        district_id: validatedData.district_id,
        address_line: validatedData.address_line,
        lat: validatedData.lat,
        lng: validatedData.lng
      });
      
      toast({
        title: 'موفق',
        description: 'آدرس با موفقیت ثبت شد'
      });
      onSuccess(location.id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'خطای اعتبارسنجی',
          description: error.errors[0]?.message || 'داده‌های وارد شده معتبر نیستند',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'خطا',
          description: 'خطا در ثبت آدرس',
          variant: 'destructive'
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">عنوان آدرس (اختیاری)</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="مثلاً: دفتر مرکزی، کارگاه شمال"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="province">استان *</Label>
          <Select value={formData.province_id} onValueChange={handleProvinceChange}>
            <SelectTrigger>
              <SelectValue placeholder="انتخاب استان" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((province) => (
                <SelectItem key={province.id} value={province.id}>
                  {province.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="district">شهرستان</Label>
          <Select 
            value={formData.district_id} 
            onValueChange={(value) => setFormData({ ...formData, district_id: value })}
            disabled={!formData.province_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="انتخاب شهرستان" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="address">آدرس دقیق *</Label>
        <Input
          id="address"
          value={formData.address_line}
          onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
          placeholder="خیابان، کوچه، پلاک..."
          required
        />
      </div>

      <div>
        <Label>موقعیت روی نقشه *</Label>
        <Button
          type="button"
          variant={hasMapPin ? 'default' : 'outline'}
          className="w-full"
          onClick={handleMapPinClick}
        >
          <MapPin className="w-4 h-4 ml-2" />
          {hasMapPin ? 'موقعیت انتخاب شده' : 'انتخاب موقعیت روی نقشه'}
        </Button>
      </div>

      <Button type="submit" className="w-full" disabled={!hasMapPin}>
        ثبت آدرس
      </Button>
    </form>
  );
};
