import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LocationMapModal } from '@/components/locations/LocationMapModal';
import StaticLocationMap from '@/components/locations/StaticLocationMap';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Edit, Check, Save, Lock } from 'lucide-react';

interface OrderLocationEditorProps {
  orderId: string;
  locationLat: number;
  locationLng: number;
  address: string;
  detailedAddress?: string;
  orderStatus: string;
  locationConfirmedByCustomer?: boolean;
  locationConfirmedAt?: string;
  isManager?: boolean;
  onLocationUpdated?: () => void;
}

export function OrderLocationEditor({
  orderId,
  locationLat,
  locationLng,
  address,
  detailedAddress,
  orderStatus,
  locationConfirmedByCustomer = false,
  locationConfirmedAt,
  isManager = false,
  onLocationUpdated
}: OrderLocationEditorProps) {
  const [showLocationEditModal, setShowLocationEditModal] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();

  // منطق: مدیران همیشه می‌توانند ویرایش کنند
  // مشتری فقط تا قبل از تایید توسط مدیر (status === 'pending') و تا وقتی خودش تایید نکرده، می‌تواند ویرایش کند
  const isOrderApproved = orderStatus !== 'draft' && orderStatus !== 'pending';
  const canCustomerEdit = !isOrderApproved && !locationConfirmedByCustomer;
  const canEdit = isManager || canCustomerEdit;

  // آیا مشتری می‌تواند موقعیت را تایید کند؟ فقط قبل از تایید مدیر و اگر هنوز تایید نکرده باشد
  const canCustomerConfirm = !isManager && !isOrderApproved && !locationConfirmedByCustomer;

  // ذخیره موقعیت جدید
  const handleSaveLocation = async () => {
    if (!pendingLocation) return;

    setIsUpdatingLocation(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          location_lat: pendingLocation.lat,
          location_lng: pendingLocation.lng,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موقعیت ذخیره شد',
        description: 'موقعیت سفارش با موفقیت بروزرسانی شد.',
      });

      setPendingLocation(null);
      onLocationUpdated?.();
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره موقعیت',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // تایید موقعیت توسط مشتری
  const handleConfirmLocation = async () => {
    setIsConfirmingLocation(true);
    try {
      // اگر موقعیت در انتظار ذخیره هست، اول آن را ذخیره کنیم
      const updateData: any = {
        location_confirmed_by_customer: true,
        location_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (pendingLocation) {
        updateData.location_lat = pendingLocation.lat;
        updateData.location_lng = pendingLocation.lng;
      }

      const { error } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موقعیت تایید شد',
        description: 'موقعیت پروژه توسط شما تایید شد و قفل گردید.',
      });

      setPendingLocation(null);
      onLocationUpdated?.();
    } catch (error: any) {
      console.error('Error confirming location:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تایید موقعیت',
        variant: 'destructive',
      });
    } finally {
      setIsConfirmingLocation(false);
    }
  };

  // انتخاب موقعیت جدید از مودال
  const handleLocationSelect = (lat: number, lng: number) => {
    setPendingLocation({ lat, lng });
    setShowLocationEditModal(false);
  };

  // نمایش مختصات فعلی یا در انتظار
  const displayLat = pendingLocation?.lat ?? locationLat;
  const displayLng = pendingLocation?.lng ?? locationLng;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            موقعیت پروژه بر روی نقشه
            {locationConfirmedByCustomer && (
              <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100 dark:bg-green-900/30">
                <Lock className="h-3 w-3" />
                تایید شده
              </Badge>
            )}
            {pendingLocation && (
              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30">
                تغییرات ذخیره نشده
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLocationEditModal(true)}
                disabled={isUpdatingLocation || isConfirmingLocation}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                {pendingLocation ? 'تغییر موقعیت' : 'ویرایش موقعیت'}
              </Button>
            )}
            {pendingLocation && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveLocation}
                disabled={isUpdatingLocation || isConfirmingLocation}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isUpdatingLocation ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            )}
            {canCustomerConfirm && (
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmLocation}
                disabled={isUpdatingLocation || isConfirmingLocation}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                {isConfirmingLocation ? 'در حال تایید...' : 'تایید موقعیت'}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] rounded-lg overflow-hidden border-2 border-border">
          <StaticLocationMap
            lat={displayLat}
            lng={displayLng}
            address={address}
            detailedAddress={detailedAddress}
          />
        </div>
        {pendingLocation && (
          <p className="text-sm text-amber-600 mt-2 text-center">
            تغییرات نمایش داده شده ذخیره نشده است. برای ثبت تغییرات کلید «ذخیره» را بزنید.
          </p>
        )}
      </CardContent>

      {/* Location Edit Modal */}
      <LocationMapModal
        isOpen={showLocationEditModal}
        onClose={() => setShowLocationEditModal(false)}
        onLocationSelect={handleLocationSelect}
        initialLat={displayLat}
        initialLng={displayLng}
      />
    </Card>
  );
}
