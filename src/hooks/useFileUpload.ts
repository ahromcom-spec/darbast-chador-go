import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { compressImages } from '@/lib/imageOptimizer';
import { normalizeMediaContentType, uploadToStorageWithProgress } from '@/lib/mediaTransfers';
import { prepareOrderVideo } from '@/lib/orderVideoProcessor';


interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface UseFileUploadOptions {
  bucket: string;
  onComplete?: () => void;
}

export function useFileUpload({ bucket, onComplete }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const cancelledRef = useRef(false);
  const { toast } = useToast();

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const uploadWithProgress = useCallback(async (
    file: File,
    filePath: string
  ): Promise<UploadResult> => {
    return new Promise((resolve) => {
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const uploadUrl = publicUrl.replace(`/object/public/${bucket}/`, `/object/${bucket}/`);
      
      // Get session for auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          resolve({ success: false, error: 'Not authenticated' });
          return;
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setProgress({
              loaded: event.loaded,
              total: event.total,
              percentage
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, filePath });
          } else {
            resolve({ success: false, error: `Upload failed: ${xhr.status}` });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ success: false, error: 'Network error' });
        });

        xhr.addEventListener('abort', () => {
          resolve({ success: false, error: 'Upload cancelled' });
        });

        // Use Supabase storage upload endpoint
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });
    });
  }, [bucket]);

  const uploadFiles = useCallback(async (
    files: FileList | File[],
    fileType: 'image' | 'video',
    projectId: string,
    userId: string
  ): Promise<{ successCount: number; errorCount: number }> => {
    setIsUploading(true);
    setProgress({ loaded: 0, total: 0, percentage: 0 });
    cancelledRef.current = false;

    let successCount = 0;
    let errorCount = 0;
    let fileArray = Array.from(files);

    // بهینه‌سازی تصاویر قبل از آپلود (حجم کمتر، آپلود سریع‌تر)
    if (fileType === 'image') {
      fileArray = await compressImages(fileArray);
    }

    // محاسبه کل حجم فایل‌ها
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    let uploadedSize = 0;


    for (let i = 0; i < fileArray.length; i++) {
      if (cancelledRef.current) {
        toast({
          title: "لغو شد",
          description: `آپلود لغو شد. ${successCount} ${fileType === 'image' ? 'عکس' : 'ویدیو'} آپلود شده`,
        });
        break;
      }

      let file = fileArray[i];
      if (fileType === 'video') {
        try {
          file = await prepareOrderVideo(file, (_stage, percent) => {
            setProgress({ loaded: 0, total: 0, percentage: Math.round((i + percent / 100 * 0.7) / fileArray.length * 100) });
          });
        } catch (error) {
          errorCount++;
          toast({ title: 'فیلم ذخیره نشد', description: error instanceof Error ? error.message : 'تبدیل فیلم انجام نشد', variant: 'destructive' });
          continue;
        }
        if (cancelledRef.current) break;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;


      try {
        // آپلود با پیشرفت واقعی؛ فیلم‌های بزرگ تکه‌تکه و قابل ادامه
        const result: UploadResult = await uploadToStorageWithProgress({
          bucket,
          path: filePath,
          file,
          label: file.name,
          onProgress: (_pct, loaded) => {
            const totalProgress = uploadedSize + loaded;
            setProgress({
              loaded: totalProgress,
              total: totalSize,
              percentage: fileType === 'video'
                ? Math.min(Math.round((i + 0.7 + loaded / file.size * 0.3) / fileArray.length * 100), 99)
                : Math.min(Math.round((totalProgress / totalSize) * 100), 99),
            });
          },
        })
          .then(() => ({ success: true, filePath }))
          .catch((e: any) => {
            const m = String(e?.message || '');
            return {
              success: false,
              error: /413|too large|exceed/i.test(m)
                ? 'حجم فایل بیش از حد مجاز است'
                : 'اتصال اینترنت قطع شد؛ لطفاً دوباره تلاش کنید',
            };
          });

        if (result.success) {
          // ثبت در دیتابیس
          const { error: dbError } = await supabase
            .from('project_media')
            .insert({
              project_id: projectId,
              file_path: filePath,
              file_type: fileType,
              file_size: file.size,
              mime_type: normalizeMediaContentType(file) || file.type,
              user_id: userId
            });

          if (dbError) throw dbError;
          successCount++;
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        console.error('Error uploading file:', file.name, err);
        errorCount++;
        // نمایش پیام خطای واقعی برای فایل اول
        if (errorCount === 1) {
          const msg = err?.message || String(err) || 'خطای نامشخص';
          toast({
            title: "خطا در آپلود",
            description: msg.slice(0, 200),
            variant: "destructive",
          });
        }
      }

      uploadedSize += file.size;
    }

    // تکمیل پیشرفت
    if (!cancelledRef.current) {
      setProgress({ loaded: totalSize, total: totalSize, percentage: 100 });

      if (successCount > 0) {
        toast({
          title: "✓ موفق",
          description: `${successCount} ${fileType === 'image' ? 'عکس' : 'ویدیو'} با موفقیت آپلود شد${errorCount > 0 ? ` (${errorCount} فایل با خطا مواجه شد)` : ''}`,
        });
        onComplete?.();
      }
    }

    setTimeout(() => {
      setIsUploading(false);
      setProgress({ loaded: 0, total: 0, percentage: 0 });
      cancelledRef.current = false;
    }, 500);

    return { successCount, errorCount };
  }, [bucket, toast, onComplete]);

  return {
    isUploading,
    progress,
    uploadFiles,
    cancelUpload
  };
}
