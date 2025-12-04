import { useState, useEffect } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Info, Loader2 } from 'lucide-react';
import { locationSchema } from '@/lib/validations';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InteractiveLocationMap } from './InteractiveLocationMap';

// محاسبه فاصله بین دو نقطه (بر حسب متر)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // شعاع زمین به متر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface NewLocationFormProps {
  onSuccess: (locationId: string) => void;
  initialData?: Location;
}

export const NewLocationForm = ({ onSuccess, initialData }: NewLocationFormProps) => {
  const { createLocation, updateLocation, locations } = useLocations();
  const { provinces } = useProvinces();
  const { districts, fetchDistrictsByProvince } = useDistricts();
  const { toast } = useToast();
  const isEditMode = !!initialData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    console.log('📍 Location selected from map:', { lat, lng, types: { lat: typeof lat, lng: typeof lng } });
    setFormData(prev => ({ ...prev, lat, lng }));
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

    setIsSubmitting(true);

    try {
      // Debug: نمایش داده‌های فرم قبل از validation
      console.log('📍 Form data before validation:', formData);
      
      // Validate input data
      const validatedData = locationSchema.parse(formData);
      
      console.log('✅ Validated data:', validatedData);
      
      // بررسی آدرس تکراری (فقط برای ثبت جدید)
      if (!isEditMode && validatedData.lat && validatedData.lng) {
        const duplicateLocation = locations.find(loc => {
          if (!loc.lat || !loc.lng) return false;
          const distance = calculateDistance(validatedData.lat, validatedData.lng, loc.lat, loc.lng);
          return distance < 50; // فاصله کمتر از 50 متر
        });
        
        if (duplicateLocation) {
          toast({
            title: 'آدرس موجود است',
            description: `این موقعیت قبلاً با عنوان "${duplicateLocation.title || duplicateLocation.address_line}" ثبت شده است. می‌توانید از همان آدرس استفاده کنید.`,
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      if (isEditMode && initialData) {
        // Update existing location - convert empty district_id to null
        await updateLocation(initialData.id, {
          title: validatedData.title || undefined,
          province_id: validatedData.province_id,
          district_id: validatedData.district_id && validatedData.district_id.length > 0 ? validatedData.district_id : undefined,
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
        // Create new location - convert empty district_id to null
        const location = await createLocation({
          title: validatedData.title || undefined,
          province_id: validatedData.province_id,
          district_id: validatedData.district_id && validatedData.district_id.length > 0 ? validatedData.district_id : undefined,
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
      console.error('❌ Error submitting location:', error);
      
      if (error instanceof z.ZodError) {
        console.error('📋 Validation errors:', error.errors);
        toast({
          title: 'خطای اعتبارسنجی',
          description: error.errors[0]?.message || 'داده‌های وارد شده معتبر نیستند',
          variant: 'destructive'
        });
      } else {
        console.error('💥 Database error:', error);
        toast({
          title: 'خطا',
          description: isEditMode ? 'خطا در ویرایش آدرس' : 'خطا در ثبت آدرس',
          variant: 'destructive'
        });
      }
    } finally {
      setIsSubmitting(false);
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

      <Button type="submit" className="w-full" disabled={!isQomSelected || isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            در حال بررسی...
          </>
        ) : (
          isEditMode ? 'ذخیره تغییرات' : 'ثبت و تایید آدرس'
        )}
      </Button>
    </form>
  );
};
