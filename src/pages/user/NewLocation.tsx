import { useNavigate, useLocation } from 'react-router-dom';
import { NewLocationForm } from '@/components/locations/NewLocationForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight } from 'lucide-react';

export default function NewLocation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get initial lat/lng if coming from map
  const initialLat = location.state?.lat;
  const initialLng = location.state?.lng;

  const handleSuccess = (locationId: string) => {
    // Navigate to service selection with location ID
    navigate('/user/select-service', {
      state: { locationId }
    });
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
              <CardTitle>ثبت آدرس پروژه</CardTitle>
            </div>
            <CardDescription>
              لطفاً اطلاعات آدرس پروژه خود را وارد کنید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewLocationForm 
              onSuccess={handleSuccess}
              initialData={initialLat && initialLng ? {
                lat: initialLat,
                lng: initialLng,
                title: '',
                province_id: '',
                district_id: '',
                address_line: '',
                id: '',
                user_id: '',
                created_at: '',
                is_active: true
              } : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
