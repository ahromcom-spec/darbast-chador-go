import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRegions } from '@/hooks/useRegions';

interface RegionSelectorProps {
  value?: {
    province?: string;
    district?: string;
    city?: string;
  };
  onChange: (value: { province?: string; district?: string; city?: string }) => void;
  disabled?: boolean;
  required?: boolean;
}

export const RegionSelector = ({ 
  value = {}, 
  onChange, 
  disabled = false,
  required = false 
}: RegionSelectorProps) => {
  const { provinces, loading, getCitiesByProvince, getDistrictsByCity } = useRegions();
  const [selectedProvince, setSelectedProvince] = useState(value.province || '');
  const [selectedDistrict, setSelectedDistrict] = useState(value.district || '');
  const [selectedCity, setSelectedCity] = useState(value.city || '');
  const [districts, setDistricts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    if (value.province !== selectedProvince || 
        value.district !== selectedDistrict || 
        value.city !== selectedCity) {
      setSelectedProvince(value.province || '');
      setSelectedDistrict(value.district || '');
      setSelectedCity(value.city || '');
    }
  }, [value]);

  useEffect(() => {
    if (selectedProvince) {
      loadDistricts(selectedProvince);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      loadCities(selectedDistrict);
    }
  }, [selectedDistrict]);

  const loadDistricts = async (provinceId: string) => {
    const districtList = await getDistrictsByCity(provinceId);
    setDistricts(districtList);
  };

  const loadCities = async (districtId: string) => {
    const cityList = await getCitiesByProvince(districtId);
    setCities(cityList);
  };

  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvince(provinceId);
    setSelectedDistrict('');
    setSelectedCity('');
    setDistricts([]);
    setCities([]);
    onChange({ 
      province: provinceId, 
      district: '', 
      city: '' 
    });
  };

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedCity('');
    setCities([]);
    onChange({ 
      province: selectedProvince, 
      district: districtId, 
      city: '' 
    });
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    onChange({ 
      province: selectedProvince, 
      district: selectedDistrict, 
      city: cityId 
    });
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Province Selection */}
      <div className="space-y-2">
        <Label htmlFor="province">
          استان {required && <span className="text-destructive">*</span>}
        </Label>
        <Select 
          value={selectedProvince} 
          onValueChange={handleProvinceChange}
          disabled={disabled}
        >
          <SelectTrigger id="province">
            <SelectValue placeholder="استان را انتخاب کنید" />
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

      {/* District Selection */}
      {selectedProvince && districts.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="district">
            شهرستان / منطقه {required && <span className="text-destructive">*</span>}
          </Label>
          <Select 
            value={selectedDistrict} 
            onValueChange={handleDistrictChange}
            disabled={disabled}
          >
            <SelectTrigger id="district">
              <SelectValue placeholder="شهرستان را انتخاب کنید" />
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
      )}

      {/* City Selection - Only show if district has multiple cities */}
      {selectedDistrict && cities.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="city">
            شهر / منطقه {required && <span className="text-destructive">*</span>}
          </Label>
          <Select 
            value={selectedCity} 
            onValueChange={handleCityChange}
            disabled={disabled}
          >
            <SelectTrigger id="city">
              <SelectValue placeholder="شهر را انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
