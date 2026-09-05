import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Plus, Trash2, CalendarDays, Image as ImageIcon, Save, Clock, MapPin, Edit } from 'lucide-react';
import { MediaUploader } from './MediaUploader';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { LocationMapModal } from '@/components/locations/LocationMapModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EXPERT_RENTAL_ITEMS: Record<string, { label: string }> = {
  cross_screw: { label: 'پیچ تنظیم صلیبی یک متری' },
  bowl_screw: { label: 'پیچ تنظیم کاسه‌ای 70 سانتی' },
};

interface EditExpertPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderData: {
    address: string;
    detailed_address?: string;
    notes?: any;
    subcategory?: {
      name: string;
      service_type: {
        name: string;
      };
    };
    location_lat?: number | null;
    location_lng?: number | null;
    hierarchy_project_id?: string | null;
  };
  onSuccess: () => void;
}

interface Dimension {
  length: string;
  width: string;
  height: string;
}

export const EditExpertPricingDialog = ({
  open,
  onOpenChange,
  orderId,
  orderData,
  onSuccess
}: EditExpertPricingDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState<Dimension[]>([{ length: '', width: '', height: '' }]);
  const [requestedDate, setRequestedDate] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Rental item state
  const [selectedItem1, setSelectedItem1] = useState('');
  const [quantity1, setQuantity1] = useState('');
  const [selectedItem2, setSelectedItem2] = useState('');
  const [quantity2, setQuantity2] = useState('');
  const [isRentalOrder, setIsRentalOrder] = useState(false);

  // Address editing state
  const [address, setAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  // Parse notes and load existing data
  useEffect(() => {
    if (open) {
      // Initialize address field (single field)
      const baseAddress = (orderData?.address || '').trim();
      const extraAddress = (orderData?.detailed_address || '').trim();
      const combinedAddress = baseAddress && extraAddress && extraAddress !== baseAddress
        ? `${baseAddress}، ${extraAddress}`
        : (baseAddress || extraAddress);

      setAddress(combinedAddress);
      setLocationLat(orderData?.location_lat || null);
      setLocationLng(orderData?.location_lng || null);

      if (orderData?.notes) {
        let notes = orderData.notes;
        try {
          if (typeof notes === 'string') notes = JSON.parse(notes);
          if (typeof notes === 'string') notes = JSON.parse(notes);
        } catch (e) {
          console.error('Error parsing notes:', e);
        }

        if (notes) {
          setDescription(notes.description || '');
          
          // Check if this is a rental order with item_type
          if (notes.item_type) {
            setIsRentalOrder(true);
            // Find key by label
            const key1 = Object.entries(EXPERT_RENTAL_ITEMS).find(([_, v]) => v.label === notes.item_type)?.[0] || '';
            setSelectedItem1(key1);
            setQuantity1(notes.quantity?.toString() || '');
            if (notes.item_type_2) {
              const key2 = Object.entries(EXPERT_RENTAL_ITEMS).find(([_, v]) => v.label === notes.item_type_2)?.[0] || '';
              setSelectedItem2(key2);
              setQuantity2(notes.quantity_2?.toString() || '');
            }
          } else {
            setIsRentalOrder(false);
          }

          if (notes.dimensions && notes.dimensions.length > 0) {
            setDimensions(notes.dimensions.map((d: any) => ({
              length: d.length?.toString() || '',
              width: d.width?.toString() || '',
              height: d.height?.toString() || ''
            })));
          }
          
          if (notes.requested_date) {
            setRequestedDate(notes.requested_date);
          }
        }
      }
    }
  }, [open, orderData]);

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

  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files);
  };

  const uploadMedia = async (files: File[]) => {
    if (!user) return;
    
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || 
                     file.name.toLowerCase().endsWith('.mp4') ||
                     file.name.toLowerCase().endsWith('.mov') ||
                     file.name.toLowerCase().endsWith('.webm') ||
                     file.name.toLowerCase().endsWith('.avi');
      const fileType = isVideo ? 'video' : 'image';
      const fileExt = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const storagePath = `${user.id}/${orderId}/${safeFileName}`;

      let contentType = file.type;
      if (!contentType || contentType === 'application/octet-stream') {
        const extMap: Record<string, string> = {
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'webm': 'video/webm',
          'avi': 'video/x-msvideo',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'webp': 'image/webp'
        };
        contentType = extMap[fileExt] || (isVideo ? 'video/mp4' : 'image/jpeg');
      }

      try {
        const { error: uploadError } = await supabase.storage
          .from('project-media')
          .upload(storagePath, file, {
            contentType: contentType,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const fp = await buildMediaFingerprint(file, fileType === 'video' ? 'video' : 'image');
        const dup = await findDuplicateProjectMedia(orderId, {
          contentHash: fp.contentHash,
          durationSeconds: fp.durationSeconds,
          fileSize: file.size,
          fileType,
        });
        if (dup) continue;

        await supabase.from('project_media').insert({
          project_id: orderId,
          user_id: user.id,
          file_path: storagePath,
          file_type: fileType,
          file_size: file.size,
          mime_type: contentType,
          content_hash: fp.contentHash,
          duration_seconds: fp.durationSeconds,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'خطا', description: 'لطفاً وارد حساب کاربری شوید', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Get existing notes
      let existingNotes: any = {};
      try {
        let notes = orderData.notes;
        if (typeof notes === 'string') notes = JSON.parse(notes);
        if (typeof notes === 'string') notes = JSON.parse(notes);
        existingNotes = notes || {};
      } catch (e) {
        console.error('Error parsing existing notes:', e);
      }

      // Build updated notes object
      const updatedNotes: any = {
        ...existingNotes,
        is_expert_pricing_request: true,
        description: description,
        dimensions: dimensions.filter(d => d.length || d.width || d.height),
        requested_date: requestedDate || null
      };

      // Add rental item data if applicable
      if (isRentalOrder) {
        updatedNotes.item_type = selectedItem1 ? EXPERT_RENTAL_ITEMS[selectedItem1]?.label : null;
        updatedNotes.quantity = selectedItem1 ? parseInt(quantity1) || null : null;
        updatedNotes.item_type_2 = selectedItem2 ? EXPERT_RENTAL_ITEMS[selectedItem2]?.label : null;
        updatedNotes.quantity_2 = selectedItem2 ? parseInt(quantity2) || null : null;
      }

      // Build update data with address
      const updateData: any = {
        notes: JSON.stringify(updatedNotes),
        updated_at: new Date().toISOString(),
        // IMPORTANT: Only ONE address field is stored; detailed_address is cleared
        address: address,
        detailed_address: null,
      };

      // Update location if changed
      if (locationLat !== null && locationLng !== null) {
        updateData.location_lat = locationLat;
        updateData.location_lng = locationLng;
      }

      // Update order
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        throw updateError;
      }

      // Sync location to hierarchy for globe map
      if (locationLat !== null && locationLng !== null) {
        await syncHierarchyLocation(locationLat, locationLng);
      }

      // Upload new media files if any
      if (uploadedFiles.length > 0) {
        await uploadMedia(uploadedFiles);
        toast({
          title: '✅ فایل‌ها آپلود شد',
          description: `${uploadedFiles.length} فایل جدید آپلود شد`
        });
      }

      toast({
        title: '✅ سفارش ویرایش شد',
        description: 'تغییرات با موفقیت ذخیره شد'
      });

      onOpenChange(false);
      onSuccess();

    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ویرایش سفارش',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const serviceTypeName = orderData?.subcategory?.service_type?.name || 'داربست فلزی';

  // Handle location selection from map modal
  const handleLocationSelect = (lat: number, lng: number) => {
    setLocationLat(lat);
    setLocationLng(lng);
    setShowLocationModal(false);
  };

  // Sync location to hierarchy (for globe map)
  const syncHierarchyLocation = async (lat: number, lng: number) => {
    const hierarchyProjectId = orderData?.hierarchy_project_id;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            ویرایش درخواست قیمت‌گذاری کارشناسی
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              نوع خدمات: <span className="font-medium text-foreground">{serviceTypeName}</span>
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

          {/* Rental Items - shown for rental expert pricing orders */}
          {isRentalOrder && (
            <div className="space-y-4 p-4 border rounded-lg bg-background">
              <Label className="font-medium">اقلام کرایه</Label>
              
              {/* Item 1 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">نوع کالا</Label>
                  <Select value={selectedItem1} onValueChange={setSelectedItem1}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب کالا" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100000]">
                      {Object.entries(EXPERT_RENTAL_ITEMS).map(([key, item]) => (
                        <SelectItem key={key} value={key}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">تعداد</Label>
                  <Input
                    type="number"
                    placeholder="تعداد"
                    value={quantity1}
                    onChange={(e) => setQuantity1(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              {/* Item 2 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">نوع کالای دوم (اختیاری)</Label>
                  <Select value={selectedItem2} onValueChange={setSelectedItem2}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب کالا" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100000]">
                      <SelectItem value="none">بدون کالای دوم</SelectItem>
                      {Object.entries(EXPERT_RENTAL_ITEMS)
                        .filter(([key]) => key !== selectedItem1)
                        .map(([key, item]) => (
                          <SelectItem key={key} value={key}>{item.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedItem2 && selectedItem2 !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">تعداد</Label>
                    <Input
                      type="number"
                      placeholder="تعداد"
                      value={quantity2}
                      onChange={(e) => setQuantity2(e.target.value)}
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dimensions - shown for non-rental orders */}
          {!isRentalOrder && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>ابعاد درخواستی (متر)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDimension}>
                <Plus className="h-4 w-4 ml-1" />
                افزودن ابعاد
              </Button>
            </div>
            
            {dimensions.map((dim, index) => (
              <div key={index} className="flex gap-2 items-center">
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
            ))}
          </div>
          )}

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

          {/* Media Upload - For new files only */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              افزودن عکس و فیلم جدید
            </Label>
            <MediaUploader 
              onFilesChange={handleFilesChange} 
              disableAutoUpload={true} 
              maxImages={6} 
              maxVideos={5}
              maxVideoSize={100}
            />
            <p className="text-xs text-muted-foreground">
              ویدیو: حداکثر 100 مگابایت - تصویر: حداکثر 10 مگابایت
            </p>
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                ذخیره تغییرات
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Location Map Modal */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelect={handleLocationSelect}
        initialLat={locationLat || orderData?.location_lat || 35.6892}
        initialLng={locationLng || orderData?.location_lng || 51.389}
      />
    </Dialog>
  );
};
