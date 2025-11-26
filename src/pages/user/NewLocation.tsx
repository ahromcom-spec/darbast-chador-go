import { useNavigate, useLocation } from 'react-router-dom';
import { NewLocationForm } from '@/components/locations/NewLocationForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function NewLocation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're in edit mode
  const isEditMode = location.state?.editMode === true;
  const editInitialData = location.state?.initialData || location.state?.locationData;
  
  // Get initial lat/lng if coming from map or edit mode - ensure they are numbers
  const initialLat = editInitialData?.lat 
    ? Number(editInitialData.lat) 
    : (location.state?.lat ? Number(location.state.lat) : undefined);
  const initialLng = editInitialData?.lng 
    ? Number(editInitialData.lng) 
    : (location.state?.lng ? Number(location.state.lng) : undefined);

  console.log('🗺️ NewLocation - Mode:', isEditMode ? 'Edit' : 'Create');
  console.log('🗺️ NewLocation - Initial coordinates:', { initialLat, initialLng, editInitialData, state: location.state });

  const handleSuccess = async (locationId: string) => {
    // If coming from globe map, go back to home (which shows the globe)
    if (location.state?.fromGlobeMap) {
      navigate('/', { replace: true });
      return;
    }

    // If in edit mode, go back to projects hierarchy
    if (isEditMode) {
      navigate('/user/my-projects-hierarchy', {
        state: {
          expandLocationId: locationId
        }
      });
      return;
    }

    // Fetch location details to pass to service selection
    try {
      const { data: locationData, error } = await supabase
        .from('locations')
        .select('*, provinces(name), districts(name)')
        .eq('id', locationId)
        .single();

      if (error) throw error;

      // Navigate to service selection with full location data
      navigate('/user/select-service', {
        state: { 
          locationId,
          locationData: {
            id: locationData.id,
            lat: locationData.lat,
            lng: locationData.lng,
            address_line: locationData.address_line,
            title: locationData.title,
            province_id: locationData.province_id,
            district_id: locationData.district_id,
            province_name: locationData.provinces?.name,
            district_name: locationData.districts?.name
          }
        }
      });
    } catch (error) {
      console.error('Error fetching location:', error);
      // Fallback: navigate with just locationId
      navigate('/user/select-service', {
        state: { locationId }
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              <CardTitle>{isEditMode ? 'ویرایش آدرس پروژه' : 'ثبت آدرس پروژه'}</CardTitle>
            </div>
            <CardDescription>
              {isEditMode ? 'اطلاعات آدرس پروژه خود را ویرایش کنید' : 'لطفاً اطلاعات آدرس پروژه خود را وارد کنید'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewLocationForm 
              onSuccess={handleSuccess}
              initialData={editInitialData || (initialLat && initialLng ? {
                lat: initialLat,
                lng: initialLng,
                title: location.state?.locationData?.title || '',
                province_id: location.state?.locationData?.province_id || '',
                district_id: location.state?.locationData?.district_id || '',
                address_line: location.state?.locationData?.address || location.state?.locationData?.address_line || '',
                id: location.state?.locationData?.id || '',
                user_id: '',
                created_at: '',
                is_active: true
              } : undefined)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
