import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  onSuccess: (locationId: string, distanceFromCenter?: number) => void;
  initialData?: Location;
  serviceTypeName?: string;
}

export const NewLocationForm = ({ onSuccess, initialData, serviceTypeName }: NewLocationFormProps) => {
  const { user } = useAuth();
  const { createLocation, updateLocation, locations } = useLocations();
  const { provinces } = useProvinces();
  const { districts, fetchDistrictsByProvince } = useDistricts();
  const { toast } = useToast();
  const isEditMode = !!initialData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // استفاده از undefined برای lat/lng وقتی آدرس جدید می‌سازیم
  // تا مارکر پیش‌فرض روی نقشه نمایش داده نشود
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    province_id: initialData?.province_id || '',
    district_id: initialData?.district_id || '',
    address_line: initialData?.address_line || '',
    lat: initialData?.lat ?? 0,
    lng: initialData?.lng ?? 0
  });

  // آیا lat/lng معتبر است (برای تعیین نمایش مارکر اولیه)
  const hasValidInitialCoords = !!(initialData?.lat && initialData?.lng && initialData.lat !== 0 && initialData.lng !== 0);

  const [hasMapPin, setHasMapPin] = useState(!!initialData?.lat && !!initialData?.lng);
  const [isInitialized, setIsInitialized] = useState(false);
  const [distanceFromCenter, setDistanceFromCenter] = useState<number | null>(null);

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

  const handleLocationSelect = (lat: number, lng: number, distance?: number) => {
    console.log('📍 Location selected from map:', { lat, lng, distance, types: { lat: typeof lat, lng: typeof lng } });
    setFormData(prev => ({ ...prev, lat, lng }));
    setHasMapPin(true);
    if (distance !== undefined) {
      setDistanceFromCenter(distance);
    }
    toast({
      title: 'نقطه روی نقشه انتخاب شد',
      description: distance ? `فاصله از مرکز استان: ${distance.toFixed(1)} کیلومتر` : 'موقعیت دقیق پروژه ثبت شد'
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

    // انتخاب موقعیت روی نقشه اختیاری است (کاربر می‌تواند بعداً آن را ثبت کند)


    setIsSubmitting(true);

    try {
      // Debug: نمایش داده‌های فرم قبل از validation
      console.log('📍 Form data before validation:', formData);
      
      // Validate input data
      const validatedData = locationSchema.parse(formData);
      
      console.log('✅ Validated data:', validatedData);
      
      // بررسی آدرس تکراری فقط اگر متن آدرس دقیقاً یکسان باشد
      if (!isEditMode && user) {
        const duplicateLocation = locations.find(loc => 
          loc.address_line.trim() === validatedData.address_line.trim()
        );
        
        if (duplicateLocation) {
          toast({
            title: 'آدرس تکراری',
            description: 'این آدرس قبلاً ثبت شده است. لطفاً آدرس متفاوتی وارد کنید.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // حالت مهمان: بدون ذخیره در دیتابیس، اطلاعات را به‌صورت محلی نگه می‌داریم
      if (!user && !isEditMode) {
        const tempId = `guest-${Date.now()}`;
        const provinceName = provinces.find(p => p.id === validatedData.province_id)?.name || '';
        const districtName = validatedData.district_id
          ? districts.find(d => d.id === validatedData.district_id)?.name || ''
          : '';
        const guestLoc = {
          id: tempId,
          title: validatedData.title || '',
          province_id: validatedData.province_id,
          district_id: validatedData.district_id && validatedData.district_id.length > 0 ? validatedData.district_id : null,
          province_name: provinceName,
          district_name: districtName,
          address_line: validatedData.address_line,
          lat: validatedData.lat,
          lng: validatedData.lng,
          distanceFromCenter: distanceFromCenter ?? null,
        };
        localStorage.setItem('guestLocation', JSON.stringify(guestLoc));
        toast({
          title: 'آدرس ثبت شد',
          description: 'لطفاً ادامه فرم سفارش را تکمیل کنید'
        });
        onSuccess(tempId, distanceFromCenter || undefined);
        return;
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
        onSuccess(initialData.id, distanceFromCenter || undefined);
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
        onSuccess(location.id, distanceFromCenter || undefined);
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
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {isOtherProvinceSelected && (
        <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900 py-2">
          <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-800 dark:text-orange-300 text-xs sm:text-sm">
            {serviceTypeName
              ? `متأسفانه خدمات ${serviceTypeName} در حال حاضر در استان شما فعال نیست. به زودی راه‌اندازی خواهد شد.`
              : 'خدمات اهرم به زودی به استان شما خواهد رسید'}
          </AlertDescription>
        </Alert>
      )}

      {!hasMapPin && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 py-2">
          <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
            انتخاب موقعیت روی نقشه اختیاری است؛ می‌توانید بعداً موقعیت پروژه را ثبت کنید تا سفارش روی نقشه کره زمین نمایش داده شود.
          </AlertDescription>
        </Alert>
      )}


      <div className="space-y-1">
        <Label htmlFor="title" className="text-xs sm:text-sm">عنوان آدرس (اختیاری)</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="مثلاً: دفتر مرکزی، کارگاه شمال"
          className="h-9 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="province" className="text-xs sm:text-sm">استان *</Label>
          <Select value={formData.province_id} onValueChange={handleProvinceChange}>
            <SelectTrigger className="h-9 text-sm">
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

        <div className="space-y-1">
          <Label htmlFor="district" className="text-xs sm:text-sm">شهرستان</Label>
          <Select
            value={formData.district_id}
            onValueChange={(value) => setFormData({ ...formData, district_id: value })}
            disabled={!formData.province_id}
          >
            <SelectTrigger className="h-9 text-sm">
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

      <div className="space-y-1">
        <Label htmlFor="address" className="text-xs sm:text-sm">آدرس دقیق *</Label>
        <Input
          id="address"
          value={formData.address_line}
          onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
          placeholder="خیابان، کوچه، پلاک..."
          required
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs sm:text-sm">انتخاب موقعیت روی نقشه</Label>
          {hasMapPin && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              موقعیت انتخاب شد
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          روی نقشه کلیک کنید یا نشانگر را بکشید تا موقعیت دقیق را انتخاب کنید
        </p>
        <div className="[&_.h-\[500px\]]:h-[280px] sm:[&_.h-\[500px\]]:h-[320px]">
          <InteractiveLocationMap
            onLocationSelect={handleLocationSelect}
            initialLat={hasValidInitialCoords ? formData.lat : undefined}
            initialLng={hasValidInitialCoords ? formData.lng : undefined}
            provinceCode={provinces.find(p => p.id === formData.province_id)?.code}
            districtId={formData.district_id}
          />
        </div>
      </div>

      <Button type="submit" className="w-full h-10 text-sm" disabled={!isQomSelected || !hasMapPin || isSubmitting}>
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
