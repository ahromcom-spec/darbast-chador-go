import { useState, useEffect, useMemo } from 'react';
import { useLocations, Location } from '@/hooks/useLocations';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { Button } from '@/components/ui/button';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NewLocationForm } from './NewLocationForm';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LocationSelectorProps {
  onLocationSelected: (locationId: string) => void;
}

export const LocationSelector = ({ onLocationSelected }: LocationSelectorProps) => {
  const { locations, loading, refetch } = useLocations();
  const { projects: allProjects } = useProjectsHierarchy();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationProjectCounts, setLocationProjectCounts] = useState<Record<string, number>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  
  // مرکز استان قم و محدوده مجاز
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

  // فیلتر پروژه‌های فعال و در محدوده جغرافیایی
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

  // بارگذاری تعداد پروژه‌های هر مکان
  useEffect(() => {
    const fetchProjectCounts = async () => {
      if (locations.length === 0 || filteredProjects.length === 0) return;
      
      const filteredProjectIds = filteredProjects.map(p => p.id);
      
      const { data } = await supabase
        .from('projects_v3')
        .select('hierarchy_project_id')
        .in('hierarchy_project_id', filteredProjectIds)
        .not('hierarchy_project_id', 'is', null);
      
      if (data) {
        const counts: Record<string, number> = {};
        const projectsWithOrders = new Set(data.map(o => o.hierarchy_project_id).filter(Boolean));
        
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

  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  const handleConfirm = () => {
    if (selectedLocationId) {
      setIsConfirming(true);
      onLocationSelected(selectedLocationId);
    }
  };

  const handleLocationCreated = async (locationId: string) => {
    setShowNewLocationDialog(false);
    await refetch();
    setSelectedLocationId(locationId);
    toast.success('آدرس با موفقیت ثبت شد');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
        <h2 className="text-lg font-semibold">انتخاب آدرس پروژه</h2>
      </div>

      {/* دکمه افزودن آدرس جدید */}
      <Dialog open={showNewLocationDialog} onOpenChange={setShowNewLocationDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 ml-2" />
            افزودن آدرس جدید
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ثبت آدرس جدید</DialogTitle>
          </DialogHeader>
          <NewLocationForm onSuccess={handleLocationCreated} />
        </DialogContent>
      </Dialog>

      {locations.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg bg-muted/30">
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">هنوز آدرسی ثبت نشده است</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-background/50">
          {/* لیست همه آدرس‌ها به صورت کارت */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto mb-4">
            {locations.map((location) => {
              const projectCount = locationProjectCounts[location.id] || 0;
              const isSelected = selectedLocationId === location.id;
              
              return (
                <div
                  key={location.id}
                  onClick={() => setSelectedLocationId(location.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                      : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {location.title || 'بدون عنوان'}
                        </span>
                        {projectCount > 0 && (
                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                            {projectCount} پروژه
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {location.address_line}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {location.provinces?.name}
                        {location.districts && ` • ${location.districts.name}`}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="text-primary">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* دکمه تایید - داخل کادر */}
          <Button 
            onClick={handleConfirm} 
            size="lg" 
            disabled={!selectedLocationId || isConfirming}
            className={`w-full transition-colors ${
              isConfirming 
                ? 'bg-orange-500 hover:bg-orange-500 text-white' 
                : ''
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
    </div>
  );
};
