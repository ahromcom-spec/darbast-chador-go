import { useState, useEffect } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Info } from 'lucide-react';
import { locationSchema } from '@/lib/validations';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InteractiveLocationMap } from './InteractiveLocationMap';

interface NewLocationFormProps {
  onSuccess: (locationId: string) => void;
  initialData?: Location;
}

export const NewLocationForm = ({ onSuccess, initialData }: NewLocationFormProps) => {
  const { createLocation, updateLocation } = useLocations();
  const { provinces } = useProvinces();
  const { districts, fetchDistrictsByProvince } = useDistricts();
  const { toast } = useToast();
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    province_id: initialData?.province_id || '',
    district_id: initialData?.district_id || '',
    address_line: initialData?.address_line || '',
    lat: initialData?.lat || 0,
    lng: initialData?.lng || 0
  });

  const [hasMapPin, setHasMapPin] = useState(!!initialData?.lat && !!initialData?.lng);
  const [isInitialized, setIsInitialized] = useState(false);

  // شناسایی استان قم
  const qomProvince = provinces.find(p => p.code === '10');
  const isQomSelected = formData.province_id === qomProvince?.id;
  const isOtherProvinceSelected = formData.province_id && !isQomSelected;

  // تنظیم پیش‌فرض استان قم و شهر قم
  useEffect(() => {
    if (initialData?.province_id) {
      // برای ویرایش، استان و شهرستان موجود را بارگذاری کن
      fetchDistrictsByProvince(initialData.province_id);
      setIsInitialized(true);
    } else if (!isInitialized && provinces.length > 0 && qomProvince) {
      setFormData(prev => ({ ...prev, province_id: qomProvince.id }));
      fetchDistrictsByProvince(qomProvince.id);
      setIsInitialized(true);
    }
  }, [provinces, qomProvince, isInitialized, fetchDistrictsByProvince, initialData]);

  // تنظیم پیش‌فرض شهر قم
  useEffect(() => {
    if (isQomSelected && districts.length > 0 && !formData.district_id) {
      const qomCity = districts.find(d => d.name === 'شهر قم' || d.name === 'قم');
      if (qomCity) {
        setFormData(prev => ({ ...prev, district_id: qomCity.id }));
      }
    }
  }, [districts, isQomSelected, formData.district_id]);

  const handleProvinceChange = (provinceId: string) => {
    setFormData({ ...formData, province_id: provinceId, district_id: '' });
    
    // فقط برای قم، شهرستان‌ها را بارگذاری کن
    if (provinceId === qomProvince?.id) {
      fetchDistrictsByProvince(provinceId);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({ ...formData, lat, lng });
    setHasMapPin(true);
    toast({
      title: 'نقطه روی نقشه انتخاب شد',
      description: 'موقعیت دقیق پروژه ثبت شد'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // بررسی انتخاب استان قم
    if (!isQomSelected) {
      toast({
        title: 'محدودیت خدمات',
        description: 'در حال حاضر فقط امکان ثبت آدرس در استان قم وجود دارد',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Validate input data
      const validatedData = locationSchema.parse(formData);
      
      if (isEditMode && initialData) {
        // Update existing location
        await updateLocation(initialData.id, {
          title: validatedData.title,
          province_id: validatedData.province_id,
          district_id: validatedData.district_id,
          address_line: validatedData.address_line,
          lat: validatedData.lat,
          lng: validatedData.lng
        });
        
        toast({
          title: 'موفق',
          description: 'آدرس با موفقیت ویرایش شد'
        });
        onSuccess(initialData.id);
      } else {
        // Create new location
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
      }
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
          description: isEditMode ? 'خطا در ویرایش آدرس' : 'خطا در ثبت آدرس',
          variant: 'destructive'
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isOtherProvinceSelected && (
        <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
          <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-800 dark:text-orange-300">
            خدمات اهرم به زودی به استان شما خواهد رسید
          </AlertDescription>
        </Alert>
      )}
      
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>انتخاب موقعیت روی نقشه</Label>
          {hasMapPin && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              موقعیت انتخاب شد
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          روی نقشه کلیک کنید یا با نشانگر را بکشید تا موقعیت دقیق را انتخاب کنید
        </p>
        <InteractiveLocationMap
          onLocationSelect={handleLocationSelect}
          initialLat={formData.lat}
          initialLng={formData.lng}
          provinceCode={provinces.find(p => p.id === formData.province_id)?.code}
          districtId={formData.district_id}
        />
      </div>

      <Button type="submit" className="w-full" disabled={!isQomSelected}>
        {isEditMode ? 'ذخیره تغییرات' : 'ثبت و تایید آدرس'}
      </Button>
    </form>
  );
};
