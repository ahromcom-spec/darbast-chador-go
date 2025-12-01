import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Trash2, Edit, Loader2 } from 'lucide-react';
import { Location } from '@/hooks/useLocations';
import { useState } from 'react';

interface LocationCardProps {
  location: Location;
  onSelect?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onConfirm?: () => void;
  selected?: boolean;
  projectCount?: number;
}

export const LocationCard = ({ location, onSelect, onDelete, onEdit, onConfirm, selected, projectCount }: LocationCardProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    if (onConfirm) {
      setIsConfirming(true);
      onConfirm();
    }
  };

  return (
    <Card 
      className={`transition-all ${
        selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div 
            className="flex items-start gap-3 flex-1 cursor-pointer"
            onClick={onSelect}
          >
            <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {location.title && (
                  <h3 className="font-semibold">{location.title}</h3>
                )}
                {projectCount !== undefined && projectCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {projectCount} پروژه
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{location.address_line}</p>
              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                {location.provinces && <span>{location.provinces.name}</span>}
                {location.districts && <span>• {location.districts.name}</span>}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 flex-shrink-0">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">اصلاح</span>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="gap-2 hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">حذف</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* دکمه تایید داخل کارت - فقط برای مکان انتخاب شده */}
        {selected && onConfirm && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button 
              onClick={handleConfirm} 
              size="lg" 
              disabled={isConfirming}
              className={`w-full transition-colors ${
                isConfirming 
                  ? 'bg-orange-500 hover:bg-orange-500 text-white' 
                  : 'hover:bg-orange-600 active:bg-orange-500'
              }`}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  در حال بارگذاری...
                </>
              ) : (
                'تایید و ادامه'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
