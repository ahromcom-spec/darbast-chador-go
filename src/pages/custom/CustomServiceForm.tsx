import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { MediaUploader } from '@/components/orders/MediaUploader';
import { OrderForOthers, RecipientData } from '@/components/orders/OrderForOthers';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { createProjectV3Schema } from '@/lib/rpcValidation';
import { sanitizeHtml } from '@/lib/security';
import { notifyManagers, sendPushNotification } from '@/lib/notifications';
import { reportActivity } from '@/lib/activityReporter';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { compressImages, isImageFile } from '@/lib/imageOptimizer';

import { ArrowRight, Plus, Trash2, MapPin, Package, ClipboardList, Info } from 'lucide-react';

interface DimensionRow {
  id: string;
  length: string;
  width: string;
  height: string;
}

const newRow = (): DimensionRow => ({
  id: Math.random().toString(36).slice(2),
  length: '',
  width: '',
  height: '',
});

const toNumber = (value: string): number | null => {
  if (!value || !value.trim()) return null;
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed as number) ? (parsed as number) : null;
};

export default function CustomServiceForm() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId, loading: customerLoading } = useCustomer();

  const state = (routerLocation.state || {}) as Record<string, any>;

  const hierarchyProjectId: string | null = state.hierarchyProjectId ?? null;
  const provinceId: string | null = state.provinceId ?? null;
  const districtId: string | null = state.districtId ?? null;
  const subcategoryId: string | null = state.subcategoryId ?? null;
  const address: string = state.locationAddress || '';
  const provinceName: string = state.provinceName || '';
  const districtName: string = state.districtName || '';
  const lat: number | null = state.lat ?? null;
  const lng: number | null = state.lng ?? null;

  const [serviceTypeManual, setServiceTypeManual] = useState('');
  const [subcategoryManual, setSubcategoryManual] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [dimensions, setDimensions] = useState<DimensionRow[]>([newRow()]);
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [materials, setMaterials] = useState('');
  const [executionDateTime, setExecutionDateTime] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [recipientData, setRecipientData] = useState<RecipientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');


  const addRow = () => setDimensions((prev) => [...prev, newRow()]);
  const removeRow = (id: string) =>
    setDimensions((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== id) : prev));
  const updateRow = (id: string, field: keyof DimensionRow, value: string) =>
    setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));

  const extractVideoThumbnail = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          blob ? resolve(blob) : reject(new Error('thumb failed'));
        }, 'image/jpeg', 0.7);
      };
      video.onerror = () => reject(new Error('cannot load video'));
      video.src = URL.createObjectURL(file);
    });

  const uploadMediaFiles = async (projectId: string, files: File[]): Promise<number> => {
    if (!user) return 0;

    // فشرده‌سازی تصاویر قبل از آپلود (آپلود بسیار سریع‌تر و مطمئن‌تر)
    const images = files.filter((f) => isImageFile(f));
    const others = files.filter((f) => !isImageFile(f));
    setUploadStatus(images.length > 0 ? 'در حال بهینه‌سازی عکس‌ها...' : 'در حال آپلود فایل‌ها...');
    const optimizedImages = await compressImages(images);
    const allFiles = [...optimizedImages, ...others];

    let done = 0;
    const total = allFiles.length;
    setUploadStatus(`در حال آپلود ${total} فایل...`);

    const uploadOne = async (file: File) => {
      const isVideo = file.type?.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('project-media')
        .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      let thumbnailPath: string | null = null;
      if (isVideo) {
        try {
          const blob = await extractVideoThumbnail(file);
          const thumbPath = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}_thumb.jpg`;
          const { error: thumbErr } = await supabase.storage
            .from('project-media')
            .upload(thumbPath, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
          if (!thumbErr) thumbnailPath = thumbPath;
        } catch {
          /* ignore thumbnail failures */
        }
      }

      const fp = await buildMediaFingerprint(file, isVideo ? 'video' : 'image');
      const dup = await findDuplicateProjectMedia(projectId, {
        contentHash: fp.contentHash,
        durationSeconds: fp.durationSeconds,
        fileSize: file.size,
        fileType: isVideo ? 'video' : 'image',
      });
      if (dup) return;

      const { error: dbError } = await supabase.from('project_media').insert({
        project_id: projectId,
        user_id: user.id,
        file_path: filePath,
        file_type: isVideo ? 'video' : 'image',
        file_size: file.size,
        mime_type: file.type,
        thumbnail_path: thumbnailPath,
        content_hash: fp.contentHash,
        duration_seconds: fp.durationSeconds,
      });
      if (dbError) throw dbError;
    };

    // آپلود موازی با حداکثر ۳ فایل همزمان
    const CONCURRENCY = 3;
    let index = 0;
    let success = 0;
    const failures: string[] = [];

    const worker = async () => {
      while (index < allFiles.length) {
        const current = allFiles[index++];
        try {
          await uploadOne(current);
          success++;
        } catch (err: any) {
          console.error('Media upload failed:', current.name, err);
          failures.push(err?.message || current.name);
        }
        done++;
        setUploadStatus(`در حال آپلود فایل ${done} از ${total}...`);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allFiles.length) }, worker));
    setUploadStatus('');

    if (failures.length > 0) {
      toast({
        title: 'برخی فایل‌ها آپلود نشد',
        description: `${failures.length} فایل آپلود نشد. می‌توانید از داخل سفارش دوباره آپلود کنید.`,
        variant: 'destructive',
      });
    }

    return success;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: 'ورود لازم است', description: 'برای ثبت سفارش ابتدا وارد حساب شوید', variant: 'destructive' });
      navigate('/auth/register');
      return;
    }

    if (!customerId || !subcategoryId || !provinceId || !address) {
      toast({
        title: 'اطلاعات ناقص',
        description: 'اطلاعات آدرس یا خدمات یافت نشد. لطفاً دوباره از ابتدا انتخاب کنید.',
        variant: 'destructive',
      });
      return;
    }

    if (!activityDescription.trim()) {
      toast({
        title: 'تکمیل فرم',
        description: 'شرح فعالیت خدمات را وارد کنید',
        variant: 'destructive',
      });
      return;
    }


    setLoading(true);
    try {
      const sanitizedAddress = sanitizeHtml(address);
      const dimensionRows = dimensions
        .map((d) => ({ length: toNumber(d.length), width: toNumber(d.width), height: toNumber(d.height) }))
        .filter((d) => d.length !== null || d.width !== null || d.height !== null);

      // نوع خدمات: اگر کاربر دستی وارد نکرده باشد، از لیست کشویی صفحه نخست استفاده می‌شود
      const effectiveServiceType = serviceTypeManual.trim() || (state.serviceName || '').trim();
      const effectiveSubcategory = subcategoryManual.trim() || (state.subcategoryName || '').trim();

      const detailLines = [
        activityDescription.trim() ? `شرح خدمات: ${activityDescription.trim()}` : '',
        siteDescription.trim() ? `محل خدمات: ${siteDescription.trim()}` : '',
        materials.trim() ? `مصالح، ابزار و اجناس: ${materials.trim()}` : '',
        quantity.trim() ? `تعداد: ${quantity.trim()}` : '',
        weight.trim() ? `وزن: ${weight.trim()} کیلوگرم` : '',
      ].filter(Boolean).join('\n');

      const notes = {
        service_type: 'custom',
        is_custom_service: true,
        custom_service_type: sanitizeHtml(effectiveServiceType),
        custom_subcategory: sanitizeHtml(effectiveSubcategory),
        activity_description: sanitizeHtml(activityDescription),
        site_description: sanitizeHtml(siteDescription),
        description: sanitizeHtml(activityDescription),
        service_details: sanitizeHtml(detailLines),
        dimensions: dimensionRows,
        quantity: toNumber(quantity),
        weight: toNumber(weight),
        materials: sanitizeHtml(materials),
        installationDateTime: executionDateTime || null,
        awaiting_manual_pricing: true,
        customerName: user?.user_metadata?.full_name || '',
        phoneNumber: user?.user_metadata?.phone_number || user?.phone || '',
      };


      const validated = createProjectV3Schema.parse({
        _customer_id: customerId,
        _province_id: provinceId,
        _district_id: districtId || null,
        _subcategory_id: subcategoryId,
        _hierarchy_project_id: hierarchyProjectId || null,
        _address: sanitizedAddress,
        _detailed_address: sanitizedAddress,
        _location_lat: lat ?? null,
        _location_lng: lng ?? null,
        _notes: JSON.stringify(notes),
      });

      const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', validated as any);
      if (createError) throw createError;
      const createdProject = (createdRows as any[])?.[0];
      if (!createdProject) throw new Error('خطا در ایجاد سفارش');

      // ثبت سفارش برای شخص دیگر
      if (recipientData) {
        try {
          await supabase.from('order_transfer_requests').insert({
            order_id: createdProject.id,
            from_user_id: user.id,
            to_phone_number: recipientData.phoneNumber,
            to_user_id: recipientData.userId,
            status: recipientData.isRegistered ? 'pending_recipient' : 'pending_registration',
          });

          if (recipientData.isRegistered && recipientData.userId) {
            await supabase.rpc('auto_complete_order_transfer' as any, {
              p_order_id: createdProject.id,
              p_recipient_user_id: recipientData.userId,
              p_recipient_phone: recipientData.phoneNumber,
            });

            const senderName = user?.user_metadata?.full_name || 'یک کاربر';
            await supabase.rpc('send_notification', {
              _user_id: recipientData.userId,
              _title: '📦 سفارش جدید برای شما ثبت شد',
              _body: `${senderName} یک سفارش خدمات سفارشی با کد ${createdProject.code} برای شما ثبت کرده است.`,
              _link: `/user/orders/${createdProject.id}`,
              _type: 'success',
            });

            try {
              await sendPushNotification({
                user_id: recipientData.userId,
                title: '📦 سفارش جدید برای شما ثبت شد',
                body: `${senderName} یک سفارش خدمات سفارشی با کد ${createdProject.code} برای شما ثبت کرده است.`,
                link: `/user/orders/${createdProject.id}`,
              });
            } catch {
              /* push optional */
            }
          }
        } catch (transferErr) {
          console.error('Transfer creation error:', transferErr);
        }
      }

      toast({
        title: 'ثبت شد',
        description: `سفارش خدمات سفارشی با کد ${createdProject.code} ثبت شد و در انتظار قیمت‌گذاری و تایید مدیریت است.`,
      });

      // آپلود عکس‌ها و ویدیوها قبل از انتقال به صفحه سفارش انجام می‌شود
      // (در غیر این صورت با ترک صفحه، آپلود ناتمام می‌ماند و روی سفارش ثبت نمی‌شود)
      if (mediaFiles.length > 0) {
        const uploaded = await uploadMediaFiles(createdProject.id, mediaFiles);
        if (uploaded > 0) {
          toast({ title: '✓ رسانه‌ها ثبت شد', description: `${uploaded} فایل روی سفارش ثبت شد` });
        }
      }


      notifyManagers({
        order_code: createdProject.code,
        order_id: createdProject.id,
        customer_name: user?.user_metadata?.full_name || '',
        customer_phone: user?.user_metadata?.phone_number || user?.phone || '',
        customer_user_id: user?.id,
        service_type: `خدمات سفارشی - ${effectiveServiceType}`,
      }).catch((err) => console.error('Notify managers error:', err));

      reportActivity({
        eventType: 'order_created',
        entityTable: 'projects_v3',
        entityId: createdProject.id,
        title: `ثبت سفارش خدمات سفارشی با کد ${createdProject.code}`,
      }).catch(() => {});


      const mediaUploadQuery = mediaFiles.length > 0 ? '?mediaUpload=1' : '';
      navigate(`/user/orders/${createdProject.id}${mediaUploadQuery}`);
    } catch (error: any) {
      console.error('Custom service order error:', error);
      toast({
        title: 'خطا در ثبت سفارش',
        description: error?.message || 'خطای نامشخص در ثبت سفارش',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (customerLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-5">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت
        </Button>

        <Card className="shadow-xl border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <CardTitle>فرم ثبت سفارش خدمات سفارشی</CardTitle>
            </div>
            <CardDescription>
              خدماتی که در لیست خدمات ما نیست را در این فرم به‌صورت دستی ثبت کنید تا کارشناسان قیمت فی و قیمت کل را برای شما اعلام کنند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div>
                <div className="font-semibold">آدرس پروژه</div>
                <div className="text-muted-foreground">
                  {[provinceName, districtName].filter(Boolean).join(' - ')}
                  {address ? ` ${address}` : ''}
                </div>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                پس از ثبت، مدیریت قیمت فی و قیمت کل را ثبت و سفارش را تایید می‌کند؛ سپس امکان پرداخت از صفحه سفارش فعال می‌شود.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="text-base">نوع خدمات درخواستی</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>نوع خدمات (دستی)</Label>
              <Input
                value={serviceTypeManual}
                onChange={(e) => setServiceTypeManual(e.target.value)}
                placeholder={state.serviceName || 'مثلاً: نصب سازه فلزی سبک'}
              />
              <p className="text-xs text-muted-foreground">
                در صورت خالی بودن، «{state.serviceName || 'خدمات سفارشی'}» از لیست انتخابی صفحه نخست ثبت می‌شود.
              </p>
            </div>
            <div className="space-y-1">
              <Label>زیرشاخه خدمات (دستی)</Label>
              <Input
                value={subcategoryManual}
                onChange={(e) => setSubcategoryManual(e.target.value)}
                placeholder={state.subcategoryName || 'مثلاً: اجرا به همراه اجناس'}
              />
            </div>

          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <OrderForOthers onRecipientSelected={setRecipientData} disabled={loading} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">شرح خدمات و محل اجرا</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>شرح فعالیت خدمات *</Label>
              <Textarea
                value={activityDescription}
                onChange={(e) => setActivityDescription(e.target.value)}
                placeholder="توضیح دقیق خدماتی که نیاز دارید..."
                className="min-h-[110px]"
              />
            </div>
            <div className="space-y-1">
              <Label>شرح محل خدمات</Label>
              <Textarea
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                placeholder="محل اجرای خدمات، شرایط دسترسی و..."
                className="min-h-[90px]"
              />
            </div>
            <div className="space-y-1">
              <Label>نام مصالح، ابزار و اجناس</Label>
              <Textarea
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="مصالح، ابزار یا اجناس مورد نیاز را بنویسید..."
                className="min-h-[90px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="text-base">ابعاد، تعداد و وزن</CardTitle>
            <CardDescription>ابعاد به متر وارد شود (اختیاری)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensions.map((row, index) => (
              <div key={row.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">ابعاد {index + 1}</span>
                  {dimensions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">طول (متر)</Label>
                    <Input
                      value={row.length}
                      onChange={(e) => updateRow(row.id, 'length', e.target.value)}
                      placeholder="طول"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">عرض (متر)</Label>
                    <Input
                      value={row.width}
                      onChange={(e) => updateRow(row.id, 'width', e.target.value)}
                      placeholder="عرض"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ارتفاع (متر)</Label>
                    <Input
                      value={row.height}
                      onChange={(e) => updateRow(row.id, 'height', e.target.value)}
                      placeholder="ارتفاع"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={addRow}>
              <Plus className="w-4 h-4 ml-2" />
              افزودن ابعاد دیگر
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>تعداد</Label>
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="مثلاً: 12"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <Label>وزن ایتم (کیلوگرم)</Label>
                <Input
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="مثلاً: 250"
                  inputMode="decimal"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle className="text-base">تاریخ درخواست اجرا</CardTitle>
          </CardHeader>
          <CardContent>
            <PersianDatePicker value={executionDateTime} onChange={setExecutionDateTime} showTime />
          </CardContent>
        </Card>


        <MediaUploader
          onFilesChange={setMediaFiles}
          maxImages={10}
          maxVideos={10}
          maxImageSize={10}
          maxVideoSize={70}
          maxVideoDuration={180}
          disableAutoUpload={true}
        />

        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-12 text-base ${recipientData ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {loading ? (uploadStatus || 'در حال ثبت سفارش...') : 'ثبت سفارش خدمات سفارشی'}
        </Button>
      </form>
    </div>
  );
}
