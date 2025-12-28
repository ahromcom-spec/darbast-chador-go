import { useState, useId, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Film, FileWarning, Loader2, Link as LinkIcon, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CentralizedVideoPlayer } from '@/components/media/CentralizedVideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// NOTE: فایل‌های سفارش در bucket 'project-media' ذخیره می‌شوند
// توضیح: تمام مدیا‌ی سفارشات در این bucket آپلود می‌شود
const MEDIA_BUCKET = 'project-media';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  id: string;
  // Upload state
  status?: 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
  storagePath?: string; // <userId>/<filename>
  remoteUrl?: string; // public URL after upload
  previewError?: boolean; // when browser can't play the format
  uploadProgress?: number; // 0-100
  thumbnail?: string; // For videos: extracted frame from middle
  xhr?: XMLHttpRequest; // For cancellation
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
  
  // Unique IDs for file inputs to prevent conflicts when multiple uploaders exist
  const uniqueId = useId();
  const imageInputId = `image-upload-${uniqueId}`;
  const videoInputId = `video-upload-${uniqueId}`;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  // Cancel upload function
  const cancelUpload = useCallback((id: string) => {
    const target = files.find(f => f.id === id);
    if (target?.xhr) {
      target.xhr.abort();
    }
    setFilePartial(id, { status: 'cancelled', uploadProgress: 0, xhr: undefined });
    toast({ title: 'لغو شد', description: 'آپلود فایل لغو شد' });
  }, [files, toast]);

  // Upload to storage with REAL progress tracking using XMLHttpRequest
  const uploadToStorage = async (media: MediaFile): Promise<void> => {
    return new Promise(async (resolve) => {
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
          resolve();
          return;
        }

        const user = auth.user;
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({ 
            title: 'خطا در احراز هویت', 
            description: 'لطفاً دوباره وارد سیستم شوید.', 
            variant: 'destructive' 
          });
          setFilePartial(media.id, { status: 'error' });
          resolve();
          return;
        }

        const extFromName = media.file.name.split('.').pop() || '';
        const safeName = media.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
        const storagePath = `${user.id}/${fileName}`;

        console.log('در حال آپلود فایل با XHR:', { fileName, storagePath, fileSize: media.file.size, fileType: media.file.type });

        const xhr = new XMLHttpRequest();
        
        // Save XHR reference for cancellation
        setFilePartial(media.id, { status: 'uploading', uploadProgress: 0, xhr });

        // Real progress tracking
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setFilePartial(media.id, { uploadProgress: percentage });
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('آپلود موفق');
            
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
              }
            }
            
            setFilePartial(media.id, { 
              status: 'done', 
              storagePath, 
              remoteUrl: publicData.publicUrl, 
              uploadProgress: 100,
              xhr: undefined 
            });
            
            toast({ title: 'موفق', description: 'فایل با موفقیت آپلود شد' });
          } else {
            console.error('خطای آپلود:', xhr.status, xhr.statusText);
            setFilePartial(media.id, { status: 'error', uploadProgress: 0, xhr: undefined });
            
            let errorMessage = 'خطا در آپلود فایل';
            if (xhr.status === 413) {
              errorMessage = 'حجم فایل بیش از حد مجاز است';
            } else if (xhr.status === 401 || xhr.status === 403) {
              errorMessage = 'شما اجازه آپلود فایل را ندارید';
            }
            
            toast({ title: 'خطا در آپلود', description: errorMessage, variant: 'destructive' });
          }
          resolve();
        });

        xhr.addEventListener('error', () => {
          console.error('خطای شبکه در آپلود');
          setFilePartial(media.id, { status: 'error', uploadProgress: 0, xhr: undefined });
          toast({ title: 'خطای شبکه', description: 'مشکلی در اتصال به سرور پیش آمد', variant: 'destructive' });
          resolve();
        });

        xhr.addEventListener('abort', () => {
          console.log('آپلود لغو شد');
          setFilePartial(media.id, { status: 'cancelled', uploadProgress: 0, xhr: undefined });
          resolve();
        });

        // Use Supabase storage upload endpoint directly
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        xhr.open('POST', `${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(media.file);

      } catch (e: any) {
        console.error('خطای غیرمنتظره در آپلود:', e);
        setFilePartial(media.id, { status: 'error', uploadProgress: 0, xhr: undefined });
        toast({ 
          title: 'خطای غیرمنتظره', 
          description: e?.message || 'مشکلی در آپلود فایل پیش آمد', 
          variant: 'destructive' 
        });
        resolve();
      }
    });
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

      // Validate size only
      const isValid = type === 'image' ? validateImage(file) : validateVideo(file);
      if (!isValid) continue;

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
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                افزودن عکس
              </Button>
            )}
          </div>
          <input
            ref={imageInputRef}
            id={imageInputId}
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
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelUpload(file.id)}
                        className="mt-2"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        لغو آپلود
                      </Button>
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
              <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                افزودن ویدیو
              </Button>
            )}
          </div>
          <input
            ref={videoInputRef}
            id={videoInputId}
            type="file"
            accept="video/mp4,video/webm,video/mov,video/avi,video/quicktime,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'video')}
          />

          {files.filter(f => f.type === 'video').length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.filter(f => f.type === 'video').map((file) => (
                <div key={file.id} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
                  {/* Video preview / player */}
                  {!file.previewError ? (
                    <CentralizedVideoPlayer
                      src={file.remoteUrl || file.preview}
                      thumbnail={file.thumbnail}
                      className="w-full h-full"
                      showControls
                      onError={() => setFilePartial(file.id, { previewError: true })}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex flex-col items-center justify-center gap-3 p-4">
                      <Film className="w-16 h-16 text-white/70" />
                      <span className="text-white/80 text-sm font-medium">ویدیو</span>
                      <div className="text-white/60 text-xs text-center truncate w-full">
                        {file.file.name}
                      </div>
                      <Button type="button" variant="secondary" size="sm" asChild>
                        <a href={file.remoteUrl || file.preview} target="_blank" rel="noopener noreferrer">
                          <LinkIcon className="w-4 h-4 ml-2" />
                          باز کردن ویدیو
                        </a>
                      </Button>
                      <p className="text-[11px] leading-relaxed text-white/60 text-center">
                        اگر ویدیو در اینجا پخش نمی‌شود، معمولاً به‌خاطر فرمت/کُدِک است؛ از دکمه بالا برای باز کردن یا دانلود استفاده کنید.
                      </p>
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
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelUpload(file.id)}
                        className="mt-2"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        لغو آپلود
                      </Button>
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
