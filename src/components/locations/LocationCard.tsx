import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Trash2 } from 'lucide-react';
import { Location } from '@/hooks/useLocations';

interface LocationCardProps {
  location: Location;
  onSelect?: () => void;
  onDelete?: () => void;
  selected?: boolean;
}

export const LocationCard = ({ location, onSelect, onDelete, selected }: LocationCardProps) => {
  return (
    <Card 
      className={`cursor-pointer transition-all ${
        selected ? 'ring-2 ring-primary' : 'hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1">
              {location.title && (
                <h3 className="font-semibold mb-1">{location.title}</h3>
              )}
              <p className="text-sm text-muted-foreground">{location.address_line}</p>
              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                {location.provinces && <span>{location.provinces.name}</span>}
                {location.districts && <span>• {location.districts.name}</span>}
              </div>
            </div>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex-shrink-0"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
