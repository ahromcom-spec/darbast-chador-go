import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegions, Region } from '@/hooks/useRegions';

interface RegionSelectorProps {
  value?: string;
  onChange: (regionId: string) => void;
  error?: string;
}

export const RegionSelector = ({ value, onChange, error }: RegionSelectorProps) => {
  const { provinces, loading, getCitiesByProvince, getDistrictsByCity } = useRegions();
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const handleProvinceChange = async (provinceId: string) => {
    setSelectedProvince(provinceId);
    setSelectedCity('');
    setCities([]);
    setDistricts([]);
    onChange('');

    if (provinceId) {
      setLoadingCities(true);
      const fetchedCities = await getCitiesByProvince(provinceId);
      setCities(fetchedCities);
      setLoadingCities(false);
    }
  };

  const handleCityChange = async (cityId: string) => {
    setSelectedCity(cityId);
    setDistricts([]);
    
    if (cityId) {
      setLoadingDistricts(true);
      const fetchedDistricts = await getDistrictsByCity(cityId);
      setLoadingDistricts(false);
      
      if (fetchedDistricts.length > 0) {
        setDistricts(fetchedDistricts);
        onChange(''); // Wait for district selection
      } else {
        onChange(cityId); // No districts, use city as final selection
      }
    } else {
      onChange('');
    }
  };

  const handleDistrictChange = (districtId: string) => {
    onChange(districtId);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>استان *</Label>
        <Select value={selectedProvince} onValueChange={handleProvinceChange}>
          <SelectTrigger className={error && !value ? 'border-destructive' : ''}>
            <SelectValue placeholder="استان را انتخاب کنید..." />
          </SelectTrigger>
          <SelectContent>
            {loading ? (
              <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
            ) : (
              provinces.map((province) => (
                <SelectItem key={province.id} value={province.id}>
                  {province.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedProvince && (
        <div>
          <Label>شهر *</Label>
          <Select value={selectedCity} onValueChange={handleCityChange}>
            <SelectTrigger className={error && !value ? 'border-destructive' : ''}>
              <SelectValue placeholder="شهر را انتخاب کنید..." />
            </SelectTrigger>
            <SelectContent>
              {loadingCities ? (
                <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
              ) : cities.length === 0 ? (
                <SelectItem value="none" disabled>شهری یافت نشد</SelectItem>
              ) : (
                cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedCity && districts.length > 0 && (
        <div>
          <Label>منطقه (اختیاری)</Label>
          <Select value={value} onValueChange={handleDistrictChange}>
            <SelectTrigger>
              <SelectValue placeholder="منطقه را انتخاب کنید..." />
            </SelectTrigger>
            <SelectContent>
              {loadingDistricts ? (
                <SelectItem value="loading" disabled>در حال بارگذاری...</SelectItem>
              ) : (
                districts.map((district) => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && !value && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
