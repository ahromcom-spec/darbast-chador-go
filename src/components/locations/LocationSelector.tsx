import { useState } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { LocationCard } from './LocationCard';
import { Button } from '@/components/ui/button';
import { Plus, MapPin } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NewLocationForm } from './NewLocationForm';

interface LocationSelectorProps {
  onLocationSelected: (locationId: string) => void;
}

export const LocationSelector = ({ onLocationSelected }: LocationSelectorProps) => {
  const { locations, loading, deleteLocation, refetch } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showNewLocationDialog, setShowNewLocationDialog] = useState(false);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocationId(location.id);
  };

  const handleConfirm = () => {
    if (selectedLocationId) {
      onLocationSelected(selectedLocationId);
    }
  };

  const handleLocationCreated = (locationId: string) => {
    setShowNewLocationDialog(false);
    // لیست آدرس‌ها به صورت خودکار از طریق Realtime به‌روز می‌شود
    setSelectedLocationId(locationId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">انتخاب یا ثبت آدرس پروژه</h2>
        <Dialog open={showNewLocationDialog} onOpenChange={setShowNewLocationDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 ml-2" />
              آدرس جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ثبت آدرس جدید</DialogTitle>
            </DialogHeader>
            <NewLocationForm onSuccess={handleLocationCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">هنوز آدرسی ثبت نشده است</p>
          <Button onClick={() => setShowNewLocationDialog(true)}>
            <Plus className="w-4 h-4 ml-2" />
            ثبت اولین آدرس
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              selected={selectedLocationId === location.id}
              onSelect={() => handleSelectLocation(location)}
              onDelete={() => deleteLocation(location.id)}
            />
          ))}
        </div>
      )}

      {selectedLocationId && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleConfirm} size="lg">
            تایید و ادامه
          </Button>
        </div>
      )}
    </div>
  );
};
