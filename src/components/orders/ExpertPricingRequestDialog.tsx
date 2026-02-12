import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Plus, Trash2, CalendarDays, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { MediaUploader, UploadedMediaInfo } from './MediaUploader';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { useNavigate } from 'react-router-dom';
import { sendOrderSms, buildOrderSmsAddress } from '@/lib/orderSms';

interface ExpertPricingRequestDialogProps {
  subcategoryId: string;
  provinceId: string;
  districtId?: string;
  address: string;
  detailedAddress?: string;
  locationLat?: number;
  locationLng?: number;
  serviceTypeName?: string;
  hierarchyProjectId?: string;
}

const EXPERT_RENTAL_ITEMS: Record<string, { label: string; price: number }> = {
  cross_screw: {
    label: 'پیچ تنظیم صلیبی یک متری',
    price: 80000,
  },
  bowl_screw: {
    label: 'پیچ تنظیم کاسه‌ای 70 سانتی',
    price: 60000,
  },
};

export const ExpertPricingRequestDialog = ({
  subcategoryId,
  provinceId,
  districtId,
  address,
  detailedAddress,
  locationLat,
  locationLng,
  serviceTypeName,
  hierarchyProjectId
}: ExpertPricingRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedItem1, setSelectedItem1] = useState('');
  const [quantity1, setQuantity1] = useState(1);
  const [selectedItem2, setSelectedItem2] = useState('');
  const [quantity2, setQuantity2] = useState(1);
  const [requestedDate, setRequestedDate] = useState('');
  
  // Track uploaded media files (already uploaded to storage by MediaUploader)
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaInfo[]>([]);
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [pendingFilesCount, setPendingFilesCount] = useState(0);
  
  // Progress tracking state for order submission
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const availableItemsForSecond = Object.entries(EXPERT_RENTAL_ITEMS).filter(
    ([key]) => key !== selectedItem1
  );

  // Called when MediaUploader finishes uploading files
  // Only update state if we have new uploads - don't reset to empty array
  const handleMediaUploaded = useCallback((mediaList: UploadedMediaInfo[]) => {
    console.log('handleMediaUploaded called with:', mediaList.length, 'files', mediaList);
    // Always update - MediaUploader now handles deduplication
    setUploadedMedia(mediaList);
  }, []);

  // Called when upload status changes in MediaUploader
  const handleUploadStatusChange = useCallback((isUploading: boolean, pendingCount: number) => {
    setIsMediaUploading(isUploading);
    setPendingFilesCount(pendingCount);
  }, []);

  // Can submit only when no files are being uploaded
  const canSubmit = !isMediaUploading && pendingFilesCount === 0;

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'خطا', description: 'لطفاً وارد حساب کاربری شوید', variant: 'destructive' });
      return;
    }

    if (!canSubmit) {
      toast({ 
        title: 'در حال آپلود', 
        description: 'لطفاً صبر کنید تا آپلود فایل‌ها کامل شود', 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    setProgressStep('در حال آماده‌سازی...');
    
    try {
      // Step 1: Get customer ID (10%)
      setProgressStep('دریافت اطلاعات کاربر...');
      setProgress(10);
      
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customer) {
        throw new Error('مشتری یافت نشد');
      }

      // Step 2: Build notes (20%)
      setProgressStep('آماده‌سازی اطلاعات سفارش...');
      setProgress(20);
      
      const notes = JSON.stringify({
        is_expert_pricing_request: true,
        description: description,
        item_type: selectedItem1 ? EXPERT_RENTAL_ITEMS[selectedItem1]?.label : null,
        quantity: selectedItem1 ? quantity1 : null,
        item_type_2: selectedItem2 ? EXPERT_RENTAL_ITEMS[selectedItem2]?.label : null,
        quantity_2: selectedItem2 ? quantity2 : null,
        requested_date: requestedDate || null,
        service_type: serviceTypeName || 'داربست فلزی'
      });

      // Step 3: Create order (50%)
      setProgressStep('ثبت سفارش در سیستم...');
      setProgress(40);
      
      const { data: createdOrder, error: createError } = await supabase.rpc('create_project_v3', {
        _customer_id: customer.id,
        _province_id: provinceId,
        _district_id: districtId || null,
        _subcategory_id: subcategoryId,
        _hierarchy_project_id: hierarchyProjectId || null,
        _address: address,
        _detailed_address: detailedAddress || null,
        _notes: JSON.parse(notes)
      });

      if (createError) {
        throw createError;
      }

      setProgress(50);

      const orderData = createdOrder as any;
      const orderId = Array.isArray(orderData) ? orderData[0]?.id : orderData?.id;
      const orderCode = Array.isArray(orderData) ? orderData[0]?.code : orderData?.code;

      if (!orderId) {
        throw new Error('خطا در ایجاد سفارش');
      }

      // Step 4: Link already-uploaded media to this order (60%-80%)
      if (uploadedMedia.length > 0) {
        setProgressStep(`پیوند ${uploadedMedia.length} فایل به سفارش...`);
        setProgress(60);
        
        console.log('Linking media to order:', {
          orderId,
          userId: user.id,
          mediaCount: uploadedMedia.length,
          mediaPaths: uploadedMedia.map(m => m.storagePath)
        });
        
        // Insert project_media records for already-uploaded files
        const mediaRecords = uploadedMedia.map(media => ({
          project_id: orderId,
          user_id: user.id,
          file_path: media.storagePath,
          file_type: media.fileType,
          file_size: media.fileSize,
          mime_type: media.mimeType
        }));

        const { data: insertedMedia, error: mediaError } = await supabase
          .from('project_media')
          .insert(mediaRecords)
          .select();

        if (mediaError) {
          console.error('Error linking media to order:', mediaError);
          toast({
            title: 'هشدار',
            description: `فایل‌ها آپلود شدند اما پیوند به سفارش با خطا مواجه شد: ${mediaError.message}`,
            variant: 'destructive',
          });
        } else {
          console.log('Media linked successfully:', insertedMedia);
        }
        
        setProgress(80);
      } else {
        console.log('No media to link to order');
        setProgress(80);
      }

      // Step 5: Send SMS (90%)
      setProgressStep('ارسال پیامک...');
      setProgress(90);
      
      const customerPhone = user?.user_metadata?.phone_number || user?.phone;
      if (customerPhone && orderCode) {
        sendOrderSms(customerPhone, orderCode, 'submitted', {
          orderId: orderId,
          serviceType: serviceTypeName || 'درخواست قیمت‌گذاری کارشناس',
          address: buildOrderSmsAddress(address, detailedAddress)
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      // Complete (100%)
      setProgress(100);
      setProgressStep('سفارش با موفقیت ثبت شد!');

      toast({
        title: '✅ درخواست ثبت شد',
        description: `سفارش با کد ${orderCode} ثبت شد. کارشناسان قیمت‌گذاری را انجام خواهند داد.`
      });

      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));

      setOpen(false);
      // Reset form
      setDescription('');
      setSelectedItem1('');
      setQuantity1(1);
      setSelectedItem2('');
      setQuantity2(1);
      setRequestedDate('');
      setUploadedMedia([]);
      setProgress(0);
      setProgressStep('');

      // Navigate to order detail
      navigate(`/user/orders/${orderId}`);

    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ثبت درخواست',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressStep('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
          <Calculator className="h-4 w-4" />
          درخواست قیمت‌گذاری توسط کارشناس
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            درخواست قیمت‌گذاری توسط کارشناسان
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Info - Always show */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              نوع خدمات: <span className="font-medium text-foreground">{serviceTypeName || 'داربست فلزی'}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              آدرس: <span className="font-medium text-foreground">{address}{detailedAddress ? ` - ${detailedAddress}` : ''}</span>
            </p>
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

          {/* Item Selection */}
          <div className="space-y-3">
            <Label>انتخاب اقلام مورد نظر</Label>
            
            {/* First item */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">نوع جنس داربست فلزی</Label>
              <div className="flex gap-2 items-center">
                <Select value={selectedItem1} onValueChange={(val) => {
                  setSelectedItem1(val);
                  if (selectedItem2 === val) {
                    setSelectedItem2('');
                    setQuantity2(1);
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPERT_RENTAL_ITEMS).map(([key, item]) => (
                      <SelectItem key={key} value={key}>
                        {item.label} - {item.price.toLocaleString('fa-IR')} تومان
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedItem1 && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                    setSelectedItem1('');
                    setQuantity1(1);
                    setSelectedItem2('');
                    setQuantity2(1);
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {selectedItem1 && (
                <div>
                  <Label className="text-sm text-muted-foreground">تعداد (حداکثر 600)</Label>
                  <Input type="number" min={1} max={600} value={quantity1} onChange={(e) => setQuantity1(parseInt(e.target.value) || 1)} />
                </div>
              )}
            </div>

            {/* Second item */}
            {selectedItem1 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">نوع جنس داربست فلزی (دوم - اختیاری)</Label>
                <div className="flex gap-2 items-center">
                  <Select value={selectedItem2} onValueChange={setSelectedItem2}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="انتخاب کنید..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItemsForSecond.map(([key, item]) => (
                        <SelectItem key={key} value={key}>
                          {item.label} - {item.price.toLocaleString('fa-IR')} تومان
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedItem2 && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                      setSelectedItem2('');
                      setQuantity2(1);
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selectedItem2 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">تعداد آیتم دوم (حداکثر 600)</Label>
                    <Input type="number" min={1} max={600} value={quantity2} onChange={(e) => setQuantity2(parseInt(e.target.value) || 1)} />
                  </div>
                )}
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

          {/* Media Upload - Files are uploaded immediately when selected */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              عکس و فیلم از محل کار
            </Label>
            <MediaUploader 
              onMediaUploaded={handleMediaUploaded}
              onUploadStatusChange={handleUploadStatusChange}
              disableAutoUpload={false}
              maxImages={10} 
              maxVideos={10}
              maxVideoSize={100}
            />
            <p className="text-xs text-muted-foreground">
              ویدیو: حداکثر 100 مگابایت - تصویر: حداکثر 10 مگابایت
            </p>
            
            {/* Upload status indicator */}
            {isMediaUploading && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  در حال آپلود {pendingFilesCount} فایل... لطفاً صبر کنید
                </span>
              </div>
            )}
            
            {!isMediaUploading && uploadedMedia.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  {uploadedMedia.length} فایل با موفقیت آپلود شد
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar - Show during order submission */}
          {loading && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressStep}
                </span>
                <span className="font-medium text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-xs text-center text-muted-foreground">
                لطفاً صبر کنید...
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !canSubmit} 
            className="w-full"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت... ({progress}%)
              </span>
            ) : !canSubmit ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                در انتظار اتمام آپلود...
              </span>
            ) : (
              'ثبت درخواست قیمت‌گذاری'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};