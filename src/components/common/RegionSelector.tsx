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
  value?: string;
  onChange: (provinceId: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export const RegionSelector = ({ 
  value = '', 
  onChange, 
  disabled = false,
  required = false 
}: RegionSelectorProps) => {
  const { provinces, loading } = useRegions();

  if (loading) {
    return <div className="text-sm text-muted-foreground">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="province">
        استان {required && <span className="text-destructive">*</span>}
      </Label>
      <Select 
        value={value} 
        onValueChange={onChange}
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
  );
};
