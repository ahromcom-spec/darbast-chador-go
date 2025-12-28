import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Plus, Trash2, CalendarDays, Image as ImageIcon, Loader2 } from 'lucide-react';
import { MediaUploader } from './MediaUploader';
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

interface Dimension {
  length: string;
  width: string;
  height: string;
}

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
  const [dimensions, setDimensions] = useState<Dimension[]>([{ length: '', width: '', height: '' }]);
  const [requestedDate, setRequestedDate] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Progress tracking state
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Optimized parallel file upload with progress tracking
  const uploadMedia = useCallback(async (orderId: string, files: File[], onProgress: (uploaded: number, total: number) => void) => {
    if (files.length === 0) return;
    
    let uploadedCount = 0;
    const total = files.length;
    
    // Process files in parallel (max 3 concurrent uploads)
    const CONCURRENT_LIMIT = 3;
    const results: { success: boolean; fileName: string; error?: string }[] = [];
    
    const uploadSingleFile = async (file: File): Promise<{ success: boolean; fileName: string; error?: string }> => {
      const isVideo = file.type.startsWith('video/') || 
                     file.name.toLowerCase().endsWith('.mp4') ||
                     file.name.toLowerCase().endsWith('.mov') ||
                     file.name.toLowerCase().endsWith('.webm') ||
                     file.name.toLowerCase().endsWith('.avi');
      const fileType = isVideo ? 'video' : 'image';
      const fileExt = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const storagePath = `${user!.id}/${orderId}/${safeFileName}`;

      // Determine correct content type
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
          console.error('Upload error for', file.name, ':', uploadError);
          return { success: false, fileName: file.name, error: uploadError.message };
        }

        const { error: dbError } = await supabase.from('project_media').insert({
          project_id: orderId,
          user_id: user!.id,
          file_path: storagePath,
          file_type: fileType,
          file_size: file.size,
          mime_type: contentType
        });

        if (dbError) {
          console.error('DB error saving media:', dbError);
          return { success: false, fileName: file.name, error: dbError.message };
        }
        
        uploadedCount++;
        onProgress(uploadedCount, total);
        return { success: true, fileName: file.name };
      } catch (error: any) {
        console.error('Unexpected error uploading', file.name, ':', error);
        return { success: false, fileName: file.name, error: error?.message };
      }
    };

    // Process in batches for parallel upload
    for (let i = 0; i < files.length; i += CONCURRENT_LIMIT) {
      const batch = files.slice(i, i + CONCURRENT_LIMIT);
      const batchResults = await Promise.all(batch.map(uploadSingleFile));
      results.push(...batchResults);
    }

    // Show result
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (successCount > 0 && failCount === 0) {
      toast({
        title: '✅ آپلود موفق',
        description: `${successCount} فایل با موفقیت آپلود شد`
      });
    } else if (failCount > 0 && successCount > 0) {
      toast({
        title: '⚠️ آپلود ناقص',
        description: `${successCount} فایل آپلود شد، ${failCount} فایل با خطا مواجه شد`,
        variant: 'destructive'
      });
    } else if (failCount > 0 && successCount === 0) {
      toast({
        title: '❌ خطا در آپلود',
        description: `هیچ فایلی آپلود نشد. ${results[0]?.error || 'خطای نامشخص'}`,
        variant: 'destructive'
      });
    }
  }, [user, toast]);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'خطا', description: 'لطفاً وارد حساب کاربری شوید', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setProgress(0);
    setProgressStep('در حال آماده‌سازی...');
    
    try {
      // Step 1: Get customer ID (5%)
      setProgressStep('دریافت اطلاعات کاربر...');
      setProgress(5);
      
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customer) {
        throw new Error('مشتری یافت نشد');
      }

      // Step 2: Build notes (10%)
      setProgressStep('آماده‌سازی اطلاعات سفارش...');
      setProgress(10);
      
      const notes = JSON.stringify({
        is_expert_pricing_request: true,
        description: description,
        dimensions: dimensions.filter(d => d.length || d.width || d.height),
        requested_date: requestedDate || null,
        service_type: serviceTypeName || 'داربست فلزی'
      });

      // Step 3: Create order (30%)
      setProgressStep('ثبت سفارش در سیستم...');
      setProgress(20);
      
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

      setProgress(30);

      const orderData = createdOrder as any;
      const orderId = Array.isArray(orderData) ? orderData[0]?.id : orderData?.id;
      const orderCode = Array.isArray(orderData) ? orderData[0]?.code : orderData?.code;

      if (!orderId) {
        throw new Error('خطا در ایجاد سفارش');
      }

      // Step 4: Upload media files (30% - 90%)
      if (uploadedFiles.length > 0) {
        setProgressStep(`آپلود ${uploadedFiles.length} فایل...`);
        
        await uploadMedia(orderId, uploadedFiles, (uploaded, total) => {
          const mediaProgress = 30 + Math.round((uploaded / total) * 60);
          setProgress(mediaProgress);
          setProgressStep(`آپلود فایل ${uploaded} از ${total}...`);
        });
      } else {
        setProgress(90);
      }

      // Step 5: Send SMS (95%)
      setProgressStep('ارسال پیامک...');
      setProgress(95);
      
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
      setDimensions([{ length: '', width: '', height: '' }]);
      setRequestedDate('');
      setUploadedFiles([]);
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

          {/* Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>ابعاد کار (متر)</Label>
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

          {/* Media Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              عکس و فیلم از محل کار
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

          {/* Progress Bar - Show during submission */}
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
            disabled={loading} 
            className="w-full"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت... ({progress}%)
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
