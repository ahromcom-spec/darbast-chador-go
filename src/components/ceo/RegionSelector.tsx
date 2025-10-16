import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegions } from '@/hooks/useRegions';

interface RegionSelectorProps {
  value?: string;
  onChange: (regionId: string) => void;
  error?: string;
}

export const RegionSelector = ({ value, onChange, error }: RegionSelectorProps) => {
  const { provinces, loading } = useRegions();

  return (
    <div className="space-y-2">
      <Label>استان *</Label>
      <Select value={value} onValueChange={onChange}>
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
      {error && !value && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
