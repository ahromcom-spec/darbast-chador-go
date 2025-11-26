import { useState, useEffect } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { LocationCard } from './LocationCard';
import { Button } from '@/components/ui/button';
import { Plus, MapPin } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NewLocationForm } from './NewLocationForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LocationSelectorProps {
  onLocationSelected: (locationId: string) => void;
}

export const LocationSelector = ({ onLocationSelected }: LocationSelectorProps) => {
  const { locations, loading, deleteLocation, refetch } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationProjectCounts, setLocationProjectCounts] = useState<Record<string, number>>({});

  // Auto-select first location when locations load
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  // بارگذاری تعداد پروژه‌های هر مکان
  useEffect(() => {
    const fetchProjectCounts = async () => {
      if (locations.length === 0) return;
      
      const locationIds = locations.map(loc => loc.id);
      const { data } = await supabase
        .from('projects_hierarchy')
        .select('location_id')
        .in('location_id', locationIds);
      
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(project => {
          counts[project.location_id] = (counts[project.location_id] || 0) + 1;
        });
        setLocationProjectCounts(counts);
      }
    };
    
    fetchProjectCounts();
  }, [locations]);
  const [showNewLocationDialog, setShowNewLocationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocationId(location.id);
  };

  const handleConfirm = () => {
    if (selectedLocationId) {
      onLocationSelected(selectedLocationId);
    }
  };

  const handleLocationCreated = async (locationId: string) => {
    setShowNewLocationDialog(false);
    await refetch(); // رفرش لیست آدرس‌ها
    setSelectedLocationId(locationId); // انتخاب خودکار آدرس جدید
  };

  const handleLocationUpdated = async () => {
    setShowEditDialog(false);
    setEditingLocation(null);
    await refetch();
    toast.success('آدرس با موفقیت ویرایش شد');
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (locationId: string) => {
    // بررسی وجود پروژه برای این مکان
    const projectCount = locationProjectCounts[locationId] || 0;
    if (projectCount > 0) {
      toast.error(`این آدرس دارای ${projectCount} پروژه فعال است و قابل حذف نیست`);
      return;
    }
    
    setDeletingLocationId(locationId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (deletingLocationId) {
      try {
        await deleteLocation(deletingLocationId);
        if (selectedLocationId === deletingLocationId) {
          setSelectedLocationId(null);
        }
        toast.success('آدرس با موفقیت حذف شد');
        setShowDeleteDialog(false);
        setDeletingLocationId(null);
      } catch (error) {
        toast.error('خطا در حذف آدرس');
      }
    }
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
          {locations.map((location) => {
            const projectCount = locationProjectCounts[location.id] || 0;
            const canDelete = projectCount === 0;
            
            return (
              <LocationCard
                key={location.id}
                location={location}
                selected={selectedLocationId === location.id}
                onSelect={() => handleSelectLocation(location)}
                onEdit={canDelete ? () => handleEditLocation(location) : undefined}
                onDelete={canDelete ? () => handleDeleteClick(location.id) : undefined}
                onConfirm={handleConfirm}
                projectCount={projectCount}
              />
            );
          })}
        </div>
      )}

      {/* Dialog for editing location */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش آدرس</DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <NewLocationForm 
              onSuccess={handleLocationUpdated}
              initialData={editingLocation}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Alert dialog for delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف آدرس</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این آدرس اطمینان دارید؟ این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
