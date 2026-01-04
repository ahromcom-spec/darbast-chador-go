import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Plus, Trash2, CalendarDays, Image as ImageIcon, Loader2, Save, MapPin, Edit } from 'lucide-react';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { OrderMediaSection } from './OrderMediaSection';
import { parseOrderNotes } from './OrderDetailsView';
import { LocationMapModal } from '@/components/locations/LocationMapModal';

interface Dimension {
  length: string;
  width: string;
  height: string;
}

interface ExpertPricingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    code: string;
    address?: string;
    detailed_address?: string | null;
    notes?: any;
    subcategory?: { name?: string } | null;
    location_lat?: number | null;
    location_lng?: number | null;
    hierarchy_project_id?: string | null;
  };
  onSuccess?: () => void;
}

export const ExpertPricingEditDialog = ({
  open,
  onOpenChange,
  order,
  onSuccess
}: ExpertPricingEditDialogProps) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Parse existing notes
  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);

  // Form state
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState<Dimension[]>([{ length: '', width: '', height: '' }]);
  const [requestedDate, setRequestedDate] = useState('');

  // Address editing state (single field)
  const [address, setAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Initialize form with existing data when dialog opens
  useEffect(() => {
    if (open && parsedNotes) {
      setDescription(parsedNotes.description || '');
      setRequestedDate(parsedNotes.requested_date || '');

      // Combine (address + detailed_address) into ONE address string for display/edit
      const baseAddress = (order.address || '').trim();
      const extraAddress = (order.detailed_address || '').trim();
      const combinedAddress = baseAddress && extraAddress && extraAddress !== baseAddress
        ? `${baseAddress}، ${extraAddress}`
        : (baseAddress || extraAddress);

      setAddress(combinedAddress);
      setLocationLat(order.location_lat || null);
      setLocationLng(order.location_lng || null);

      // Parse existing dimensions
      if (parsedNotes.dimensions && Array.isArray(parsedNotes.dimensions) && parsedNotes.dimensions.length > 0) {
        setDimensions(parsedNotes.dimensions.map((d: any) => ({
          length: d.length?.toString() || '',
          width: d.width?.toString() || '',
          height: d.height?.toString() || ''
        })));
      } else {
        setDimensions([{ length: '', width: '', height: '' }]);
      }
    }
  }, [open]);

  const addDimension = () => {
    setDimensions([...dimensions, { length: '', width: '', height: '' }]);
  };

  const removeDimension = (index: number) => {
    if (dimensions.length > 1) {
      setDimensions(dimensions.filter((_, i) => i !== index));
    }
  };

  const updateDimension = (index: number, field: keyof Dimension, value: string) => {
    const updated = [...dimensions];
    updated[index][field] = value;
    setDimensions(updated);
  };

  // Calculate total area for each dimension row (length × height)
  const calculateDimensionArea = (dim: Dimension) => {
    const l = parseFloat(dim.length) || 0;
    const h = parseFloat(dim.height) || 0;
    if (l > 0 && h > 0) {
      return l * h;
    }
    return 0;
  };

  const totalArea = dimensions.reduce((sum, dim) => sum + calculateDimensionArea(dim), 0);

  // Handle location selection from map modal
  const handleLocationSelect = (lat: number, lng: number) => {
    setLocationLat(lat);
    setLocationLng(lng);
    setShowLocationModal(false);
  };

  // Sync location to hierarchy (for globe map)
  const syncHierarchyLocation = async (lat: number, lng: number) => {
    const hierarchyProjectId = order.hierarchy_project_id;
    if (!hierarchyProjectId) return;

    const { data: hierarchy, error: hierarchyError } = await supabase
      .from('projects_hierarchy')
      .select('location_id')
      .eq('id', hierarchyProjectId)
      .maybeSingle();

    if (hierarchyError) throw hierarchyError;

    const locationId = (hierarchy as any)?.location_id as string | undefined;
    if (!locationId) return;

    const { error: locationError } = await supabase
      .from('locations')
      .update({ lat, lng, address_line: address, updated_at: new Date().toISOString() })
      .eq('id', locationId);

    if (locationError) throw locationError;
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Build updated notes - preserve existing fields
      const updatedNotes = {
        ...parsedNotes,
        is_expert_pricing_request: true,
        description: description,
        dimensions: dimensions.filter(d => d.length || d.width || d.height),
        total_area: totalArea,
        requested_date: requestedDate || null,
      };

      // IMPORTANT: Only ONE address field is stored; detailed_address is cleared
      const updateData: any = {
        notes: updatedNotes,
        address: address,
        detailed_address: null,
      };

      // Update location if changed
      if (locationLat !== null && locationLng !== null) {
        updateData.location_lat = locationLat;
        updateData.location_lng = locationLng;
      }

      const { error } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      // Sync location to hierarchy for globe map
      if (locationLat !== null && locationLng !== null) {
        await syncHierarchyLocation(locationLat, locationLng);
      }

      toast({
        title: 'ذخیره شد',
        description: 'اطلاعات سفارش با موفقیت بروزرسانی شد',
      });

      onOpenChange(false);
      onSuccess?.();

    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ذخیره اطلاعات',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            ویرایش درخواست قیمت‌گذاری - کد {order.code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              نوع خدمات:{' '}
              <span className="font-medium text-foreground">
                {order.subcategory?.name || parsedNotes?.service_type || 'داربست فلزی'}
              </span>
            </p>
          </div>

          {/* Address Editing */}
          <div className="space-y-3 p-4 border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                آدرس پروژه
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowLocationModal(true)}
                className="gap-1"
              >
                <Edit className="h-3 w-3" />
                ویرایش موقعیت روی نقشه
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">آدرس پروژه</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="آدرس کامل پروژه را وارد کنید..."
              />
            </div>

            {locationLat && locationLng && (
              <p className="text-xs text-muted-foreground text-center">
                📍 موقعیت: {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>توضیحات سفارش</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات خود را درباره سفارش وارد کنید..."
              rows={3}
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>ابعاد کار (متر)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDimension}>
                <Plus className="h-4 w-4 ml-1" />
                افزودن ابعاد
              </Button>
            </div>

            {dimensions.map((dim, index) => {
              const rowArea = calculateDimensionArea(dim);
              return (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="طول"
                        value={dim.length}
                        onChange={(e) => updateDimension(index, 'length', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="عرض"
                        value={dim.width}
                        onChange={(e) => updateDimension(index, 'width', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="ارتفاع"
                        value={dim.height}
                        onChange={(e) => updateDimension(index, 'height', e.target.value)}
                      />
                    </div>
                    {dimensions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDimension(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {rowArea > 0 && (
                    <p className="text-xs text-muted-foreground text-left">
                      متراژ:{' '}
                      <span className="font-semibold text-primary">
                        {rowArea.toLocaleString('fa-IR')} متر مربع
                      </span>
                    </p>
                  )}
                </div>
              );
            })}

            {/* Total area display */}
            {totalArea > 0 && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-semibold text-primary flex items-center justify-between">
                  <span>مجموع متراژ:</span>
                  <span className="text-lg">{totalArea.toLocaleString('fa-IR')} متر مربع</span>
                </p>
              </div>
            )}
          </div>

          {/* Requested Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              تاریخ درخواست اجرا
            </Label>
            <PersianDatePicker
              value={requestedDate}
              onChange={setRequestedDate}
              placeholder="انتخاب تاریخ و زمان"
              timeMode="ampm"
            />
          </div>

          {/* Media Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              تصاویر و ویدیوهای سفارش
            </Label>
            <OrderMediaSection orderId={order.id} canDelete={true} canUpload={true} />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
              size="lg"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ذخیره...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  ذخیره تغییرات
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              انصراف
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Location Map Modal */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
        initialLat={locationLat || order.location_lat || 35.6892}
        initialLng={locationLng || order.location_lng || 51.389}
      />
    </Dialog>
  );
};