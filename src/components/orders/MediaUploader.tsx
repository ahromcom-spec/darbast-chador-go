import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Film, FileWarning, Loader2, Link as LinkIcon, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useImageModeration } from '@/hooks/useImageModeration';

// NOTE: فایل‌های سفارش در bucket 'project-media' ذخیره می‌شوند
// توضیح: تمام مدیا‌ی سفارشات در این bucket آپلود می‌شود
const MEDIA_BUCKET = 'project-media';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  id: string;
  // Upload state
  status?: 'pending' | 'uploading' | 'done' | 'error';
  storagePath?: string; // <userId>/<filename>
  remoteUrl?: string; // public URL after upload
  previewError?: boolean; // when browser can't play the format
  uploadProgress?: number; // 0-100
  thumbnail?: string; // For videos: extracted frame from middle
}

interface MediaUploaderProps {
  projectId?: string; // Order/project ID to link media to
  onFilesChange?: (files: File[]) => void;
  maxImages?: number;
  maxVideos?: number;
  maxImageSize?: number; // in MB
  maxVideoSize?: number; // in MB
  maxVideoDuration?: number; // in seconds (kept for description only)
  disableAutoUpload?: boolean; // If true, only collect files without uploading
}

export function MediaUploader({
  projectId,
  onFilesChange,
  maxImages = 4,
  maxVideos = 2,
  maxImageSize = 10,
  maxVideoSize = 50,
  maxVideoDuration = 600, // 10 minutes
  disableAutoUpload = false,
}: MediaUploaderProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [moderating, setModerating] = useState(false);
  const { checkImage } = useImageModeration();

  // Utilities
  const setFilePartial = (id: string, patch: Partial<MediaFile> | ((prev: MediaFile) => Partial<MediaFile>)) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        const update = typeof patch === 'function' ? patch(f) : patch;
        return { ...f, ...update };
      }
      return f;
    }));
  };

  // Validation (size only)
  const validateImage = (file: File): boolean => {
    const maxSizeBytes = maxImageSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: 'خطا',
        description: `حجم عکس نباید بیشتر از ${maxImageSize} مگابایت باشد`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const validateVideo = (file: File): boolean => {
    const maxSizeBytes = maxVideoSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: 'خطا',
        description: `حجم ویدیو نباید بیشتر از ${maxVideoSize} مگابایت باشد`,
        variant: 'destructive',
      });
      return false;
    }
    // We accept all formats; preview may fail but upload will proceed.
    return true;
  };

  // Upload to storage with progress tracking
  const uploadToStorage = async (media: MediaFile) => {
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      
      if (authError || !auth?.user) {
        console.error('خطای احراز هویت:', authError);
        toast({ 
          title: 'خطا در احراز هویت', 
          description: 'لطفاً دوباره وارد سیستم شوید.', 
          variant: 'destructive' 
        });
        setFilePartial(media.id, { status: 'error' });
        return;
      }

      const user = auth.user;
      setFilePartial(media.id, { status: 'uploading', uploadProgress: 0 });

      const extFromName = media.file.name.split('.').pop() || '';
      const ext = extFromName ? `.${extFromName}` : '';
      const safeName = media.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}${ext ? '' : ''}`;
      const storagePath = `${user.id}/${fileName}`;

      console.log('در حال آپلود فایل:', { fileName, storagePath, fileSize: media.file.size, fileType: media.file.type });

      // Simulate progress with fast start, slow finish for better UX
      // Supabase client doesn't expose upload progress, so we simulate
      let progressStep = 0;
      const progressInterval = setInterval(() => {
        setFilePartial(media.id, (prev) => {
          const current = prev.uploadProgress || 0;
          progressStep++;
          
          // Fast start (0-60%): larger increments, shorter intervals
          // Slow finish (60-90%): smaller increments
          let increment: number;
          if (current < 30) {
            increment = 8; // Very fast start
          } else if (current < 60) {
            increment = 5; // Moderate speed
          } else if (current < 80) {
            increment = 2; // Slow down
          } else {
            increment = 0.5; // Very slow near end
          }
          
          return { uploadProgress: Math.min(current + increment, 90) };
        });
      }, 100); // Faster interval for smoother animation

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, media.file, {
          contentType: media.file.type, 
          upsert: false 
        });

      clearInterval(progressInterval);

      if (uploadError) {
        console.error('خطای آپلود:', uploadError);
        setFilePartial(media.id, { status: 'error', uploadProgress: 0 });
        
        let errorMessage = uploadError.message;
        
        // پیام‌های خطا را بهبود می‌دهیم
        if (uploadError.message?.includes('duplicate') || uploadError.message?.includes('already exists')) {
          errorMessage = 'این فایل قبلاً آپلود شده است. لطفاً نام فایل را تغییر دهید.';
        } else if (uploadError.message?.includes('size') || uploadError.message?.includes('large')) {
          errorMessage = 'حجم فایل بیش از حد مجاز است. حداکثر 50 مگابایت.';
        } else if (uploadError.message?.includes('type') || uploadError.message?.includes('format')) {
          errorMessage = 'فرمت فایل پشتیبانی نمی‌شود.';
        } else if (uploadError.message?.includes('permission') || uploadError.message?.includes('policy')) {
          errorMessage = 'شما اجازه آپلود فایل را ندارید. لطفاً دوباره وارد شوید.';
        }
        
        toast({ 
          title: 'خطا در آپلود', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        return;
      }

      console.log('آپلود موفق:', uploadData);

      const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
      
      // If projectId is provided, save record to project_media table
      if (projectId) {
        const { error: dbError } = await supabase
          .from('project_media')
          .insert({
            project_id: projectId,
            user_id: user.id,
            file_path: storagePath,
            file_type: media.type,
            file_size: media.file.size,
            mime_type: media.file.type,
          });
        
        if (dbError) {
          console.error('خطا در ذخیره اطلاعات مدیا:', dbError);
          // Don't fail the upload, just log the error
        } else {
          console.log('رکورد مدیا در دیتابیس ذخیره شد');
        }
      }
      
      setFilePartial(media.id, { status: 'done', storagePath, remoteUrl: publicData.publicUrl, uploadProgress: 100 });
      
      toast({ title: 'موفق', description: 'فایل با موفقیت آپلود شد', variant: 'default' });
    } catch (e: any) {
      console.error('خطای غیرمنتظره در آپلود:', e);
      setFilePartial(media.id, { status: 'error', uploadProgress: 0 });
      toast({ 
        title: 'خطای غیرمنتظره', 
        description: e?.message || 'مشکلی در آپلود فایل پیش آمد. لطفاً دوباره تلاش کنید.', 
        variant: 'destructive' 
      });
    }
  };

  // Extract thumbnail from video beginning
  const extractVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadedmetadata = () => {
        // Seek to beginning of video (0.1 seconds to ensure frame is loaded)
        video.currentTime = 0.1;
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        URL.revokeObjectURL(video.src);
        resolve(thumbnailUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Cannot load video'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const currentImages = files.filter(f => f.type === 'image').length;
    const currentVideos = files.filter(f => f.type === 'video').length;

    const newMedia: MediaFile[] = [];
    
    // For images, moderate first
    if (type === 'image') {
      setModerating(true);
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Count limits
      if (type === 'image' && currentImages + newMedia.filter(m => m.type === 'image').length >= maxImages) {
        toast({ title: 'محدودیت تعداد', description: `حداکثر ${maxImages} عکس می‌توانید آپلود کنید`, variant: 'destructive' });
        break;
      }
      if (type === 'video' && currentVideos + newMedia.filter(m => m.type === 'video').length >= maxVideos) {
        toast({ title: 'محدودیت تعداد', description: `حداکثر ${maxVideos} ویدیو می‌توانید آپلود کنید`, variant: 'destructive' });
        break;
      }

      // Validate
      const isValid = type === 'image' ? validateImage(file) : validateVideo(file);
      if (!isValid) continue;
      
      // For images, check content moderation
      if (type === 'image') {
        const result = await checkImage(file);
        if (!result.safe) {
          toast({ 
            title: 'تصویر نامناسب', 
            description: result.reason || 'این تصویر حاوی محتوای نامناسب است و قابل آپلود نیست', 
            variant: 'destructive' 
          });
          continue;
        }
      }

      const preview = URL.createObjectURL(file);
      const mediaItem: MediaFile = {
        id: Math.random().toString(36).slice(2),
        file,
        preview,
        type,
        status: 'pending',
      };
      
      // Extract thumbnail for videos
      if (type === 'video') {
        extractVideoThumbnail(file)
          .then(thumbnailUrl => {
            setFilePartial(mediaItem.id, { thumbnail: thumbnailUrl });
          })
          .catch(() => {
            // Thumbnail extraction failed, continue without it
          });
      }
      
      newMedia.push(mediaItem);
    }
    
    if (type === 'image') {
      setModerating(false);
    }

    if (newMedia.length) {
      setFiles(prev => {
        const updated = [...prev, ...newMedia];
        onFilesChange?.(updated.map(f => f.file));
        return updated;
      });

      // Start uploads (sequential to avoid rate spikes) - only if auto upload is enabled
      if (!disableAutoUpload) {
        for (const m of newMedia) {
          toast({ title: 'در حال آپلود', description: `${m.type === 'video' ? 'ویدیو' : 'عکس'} شما در حال آپلود است...` });
          await uploadToStorage(m);
        }
      } else {
        // Mark files as ready (no upload)
        for (const m of newMedia) {
          setFilePartial(m.id, { status: 'done' });
        }
      }
    }

    // Reset input
    event.target.value = '';
  };

  const removeFile = async (id: string) => {
    const target = files.find(f => f.id === id);
    if (target?.storagePath) {
      // Try deleting from storage if it was uploaded
      await supabase.storage.from(MEDIA_BUCKET).remove([target.storagePath]).catch(() => {});
    }
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      onFilesChange?.(updated.map(f => f.file));
      return updated;
    });
  };

  const imageCount = files.filter(f => f.type === 'image').length;
  const videoCount = files.filter(f => f.type === 'video').length;

  return (
    <Card className="shadow-2xl bg-white dark:bg-card border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <Upload className="w-5 h-5" />
          تصاویر و ویدیوهای پروژه
        </CardTitle>
        <CardDescription className="text-slate-700 dark:text-slate-300">
          حداکثر {maxImages} عکس (هر کدام {maxImageSize}MB) و {maxVideos} ویدیو (هر کدام {maxVideoSize}MB و {Math.round(maxVideoDuration / 60)} دقیقه)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              تصاویر ({imageCount}/{maxImages})
            </Label>
            {imageCount < maxImages && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => document.getElementById('image-upload')?.click()}
                disabled={moderating}
              >
                {moderating ? (
                  <>
                    <Shield className="w-4 h-4 mr-2 animate-pulse" />
                    بررسی محتوا...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    افزودن عکس
                  </>
                )}
              </Button>
            )}
          </div>
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'image')}
          />

          {files.filter(f => f.type === 'image').length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {files.filter(f => f.type === 'image').map((file) => (
                <div key={file.id} className="relative group aspect-square rounded-lg overflow-hidden border">
                  <img
                    src={file.remoteUrl || file.preview}
                    alt="پیش‌نمایش تصویر آپلودی"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Upload Progress Overlay */}
                  {file.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                          {Math.round(file.uploadProgress || 0)}%
                        </span>
                      </div>
                      <div className="w-4/5 bg-white/20 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all duration-150 ease-out"
                          style={{ width: `${file.uploadProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-white text-sm font-semibold">
                        در حال آپلود: {Math.round(file.uploadProgress || 0)}%
                      </span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute left-1 bottom-1 text-xs rounded px-2 py-0.5 bg-black/60 text-white">
                    {file.status === 'uploading' && `در حال آپلود (${file.uploadProgress || 0}%)`}
                    {file.status === 'done' && 'آپلود شد ✓'}
                    {file.status === 'error' && 'خطا ✗'}
                    {!file.status || file.status === 'pending' ? 'در صف' : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Film className="w-4 h-4" />
              ویدیوها ({videoCount}/{maxVideos})
            </Label>
            {videoCount < maxVideos && (
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('video-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                افزودن ویدیو
              </Button>
            )}
          </div>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'video')}
          />

          {files.filter(f => f.type === 'video').length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.filter(f => f.type === 'video').map((file) => (
                <div key={file.id} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
                  {/* Show thumbnail if available, otherwise video preview */}
                  {file.thumbnail && !file.previewError ? (
                    <div className="relative w-full h-full">
                      <img
                        src={file.thumbnail}
                        alt="پیش‌نمایش ویدیو"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Film className="w-12 h-12 text-white opacity-80" />
                      </div>
                      {/* Label showing video name */}
                      <div className="absolute top-2 left-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded truncate">
                        {file.file.name}
                      </div>
                    </div>
                  ) : !file.previewError ? (
                    <video
                      src={file.remoteUrl || file.preview}
                      className="w-full h-full object-cover"
                      controls
                      onError={() => setFilePartial(file.id, { previewError: true })}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex flex-col items-center justify-center gap-3">
                      <Film className="w-16 h-16 text-white/70" />
                      <span className="text-white/80 text-sm font-medium">ویدیو</span>
                      <div className="text-white/60 text-xs px-3 text-center truncate max-w-full">
                        {file.file.name}
                      </div>
                    </div>
                  )}

                  {/* Upload Progress Overlay for Videos */}
                  {file.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-10">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 text-white animate-spin" />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                          {Math.round(file.uploadProgress || 0)}%
                        </span>
                      </div>
                      <div className="w-4/5 bg-white/20 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all duration-150 ease-out"
                          style={{ width: `${file.uploadProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-white text-base font-semibold">
                        در حال آپلود: {Math.round(file.uploadProgress || 0)}%
                      </span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute left-2 bottom-2 text-xs rounded px-2 py-1 bg-black/70 text-white">
                    {(file.file.size / (1024 * 1024)).toFixed(1)} MB •
                    {file.status === 'uploading' ? (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> {file.uploadProgress || 0}%
                      </span>
                    ) : file.status === 'done' ? (
                      <span className="ml-1">آپلود شد ✓</span>
                    ) : file.status === 'error' ? (
                      <span className="ml-1">خطا ✗</span>
                    ) : (
                      <span className="ml-1">در صف</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {files.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <FileWarning className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-slate-700 dark:text-slate-300">هنوز فایلی آپلود نشده است</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
