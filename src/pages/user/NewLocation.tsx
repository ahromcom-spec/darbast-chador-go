import { useNavigate, useLocation } from 'react-router-dom';
import { NewLocationForm } from '@/components/locations/NewLocationForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function NewLocation() {
  const navigate = useNavigate();
  const location = useLocation();

  // Service type name from service selection flow (if any)
  const serviceTypeName =
    location.state?.serviceSelection?.serviceName ||
    location.state?.serviceName ||
    undefined;

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

  const handleSuccess = async (locationId: string, distanceFromCenter?: number) => {
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

    // حالت مهمان: اطلاعات از localStorage (guestLocation) خوانده می‌شود
    // و بدون نیاز به دیتابیس به صفحه انتخاب خدمات می‌رویم تا کاربر بتواند
    // ادامه فرآیند ثبت سفارش را به‌صورت مهمان طی کند.
    if (locationId.startsWith('guest-')) {
      try {
        const guest = JSON.parse(localStorage.getItem('guestLocation') || 'null');
        navigate('/user/select-service', {
          state: {
            locationId,
            locationData: guest ? {
              id: guest.id,
              lat: guest.lat,
              lng: guest.lng,
              address_line: guest.address_line,
              title: guest.title,
              province_id: guest.province_id,
              district_id: guest.district_id,
              province_name: guest.province_name,
              district_name: guest.district_name,
            } : null,
            distanceFromCenter: distanceFromCenter ?? guest?.distanceFromCenter,
            isGuest: true,
          },
        });
      } catch {
        navigate('/user/select-service', { state: { locationId, distanceFromCenter, isGuest: true } });
      }
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

      // Navigate to service selection with full location data including distance
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
          },
          distanceFromCenter
        }
      });
    } catch (error) {
      console.error('Error fetching location:', error);
      // Fallback: navigate with just locationId
      navigate('/user/select-service', {
        state: { locationId, distanceFromCenter }
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
              serviceTypeName={serviceTypeName}
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
