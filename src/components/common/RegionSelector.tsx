import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { regionsData } from '@/lib/staffContractorData';

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
  const [selectedProvince, setSelectedProvince] = useState(value.province || '');
  const [selectedDistrict, setSelectedDistrict] = useState(value.district || '');
  const [selectedCity, setSelectedCity] = useState(value.city || '');

  const currentProvince = regionsData.find(p => p.code === selectedProvince);
  const currentDistrict = currentProvince?.districts.find(d => d.name === selectedDistrict);

  useEffect(() => {
    if (value.province !== selectedProvince || 
        value.district !== selectedDistrict || 
        value.city !== selectedCity) {
      setSelectedProvince(value.province || '');
      setSelectedDistrict(value.district || '');
      setSelectedCity(value.city || '');
    }
  }, [value]);

  const handleProvinceChange = (provinceCode: string) => {
    setSelectedProvince(provinceCode);
    setSelectedDistrict('');
    setSelectedCity('');
    onChange({ 
      province: provinceCode, 
      district: '', 
      city: '' 
    });
  };

  const handleDistrictChange = (districtName: string) => {
    setSelectedDistrict(districtName);
    setSelectedCity('');
    onChange({ 
      province: selectedProvince, 
      district: districtName, 
      city: '' 
    });
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    onChange({ 
      province: selectedProvince, 
      district: selectedDistrict, 
      city: cityName 
    });
  };

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
            {regionsData.map((province) => (
              <SelectItem key={province.code} value={province.code}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District Selection */}
      {selectedProvince && currentProvince && (
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
              {currentProvince.districts.map((district) => (
                <SelectItem key={district.name} value={district.name}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* City Selection - Only show if district has multiple cities */}
      {selectedDistrict && currentDistrict && currentDistrict.cities.length > 1 && (
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
              {currentDistrict.cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
