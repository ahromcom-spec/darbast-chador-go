import { useState, useEffect, useMemo } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
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
  const { projects: allProjects } = useProjectsHierarchy();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationProjectCounts, setLocationProjectCounts] = useState<Record<string, number>>({});
  
  // مرکز استان قم و محدوده مجاز (باید با HybridGlobe همخوانی داشته باشد)
  const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };
  const MAX_DISTANCE_KM = 5;

  // محاسبه فاصله با فرمول Haversine
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // فیلتر پروژه‌های فعال و در محدوده جغرافیایی (مشابه HybridGlobe)
  const filteredProjects = useMemo(() => {
    const activeProjects = allProjects.filter(project => 
      project.locations && 
      (project.locations as any).is_active !== false
    );

    if (activeProjects.length === 0) return [];

    const userProjectLocations = activeProjects
      .filter(p => p.locations?.lat && p.locations?.lng)
      .map(p => ({
        lat: p.locations!.lat,
        lng: p.locations!.lng
      }));

    if (userProjectLocations.length === 0) {
      return activeProjects.filter(project => {
        if (!project.locations?.lat || !project.locations?.lng) return false;
        const distanceToQom = calculateDistance(
          project.locations.lat,
          project.locations.lng,
          QOM_CENTER.lat,
          QOM_CENTER.lng
        );
        return distanceToQom <= MAX_DISTANCE_KM;
      });
    }

    return activeProjects.filter(project => {
      if (!project.locations?.lat || !project.locations?.lng) return false;

      const projectLat = project.locations.lat;
      const projectLng = project.locations.lng;

      const distanceToQom = calculateDistance(
        projectLat,
        projectLng,
        QOM_CENTER.lat,
        QOM_CENTER.lng
      );
      if (distanceToQom <= MAX_DISTANCE_KM) return true;

      for (const userLoc of userProjectLocations) {
        const distanceToUserProject = calculateDistance(
          projectLat,
          projectLng,
          userLoc.lat,
          userLoc.lng
        );
        if (distanceToUserProject <= MAX_DISTANCE_KM) return true;
      }

      return false;
    });
  }, [allProjects]);

  // Auto-select first location when locations load
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  // بارگذاری تعداد پروژه‌های هر مکان (فقط پروژه‌های فیلتر شده با سفارش)
  useEffect(() => {
    const fetchProjectCounts = async () => {
      if (locations.length === 0 || filteredProjects.length === 0) return;
      
      // دریافت فقط IDs پروژه‌های فیلتر شده
      const filteredProjectIds = filteredProjects.map(p => p.id);
      
      // دریافت orders برای این پروژه‌ها
      const { data } = await supabase
        .from('projects_v3')
        .select('hierarchy_project_id')
        .in('hierarchy_project_id', filteredProjectIds)
        .not('hierarchy_project_id', 'is', null);
      
      if (data) {
        const counts: Record<string, number> = {};
        // شمارش پروژه‌های منحصر به فرد با سفارش
        const projectsWithOrders = new Set(data.map(o => o.hierarchy_project_id).filter(Boolean));
        
        // برای هر location، شمارش پروژه‌هایی که سفارش دارند
        filteredProjects.forEach(project => {
          if (projectsWithOrders.has(project.id) && project.location_id) {
            counts[project.location_id] = (counts[project.location_id] || 0) + 1;
          }
        });
        
        setLocationProjectCounts(counts);
      }
    };
    
    fetchProjectCounts();
  }, [locations, filteredProjects]);
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
          {locations
            .filter((location) => {
              const projectCount = locationProjectCounts[location.id] || 0;
              return projectCount > 0; // فقط آدرس‌هایی که حداقل یک پروژه با سفارش دارند
            })
            .map((location) => {
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
