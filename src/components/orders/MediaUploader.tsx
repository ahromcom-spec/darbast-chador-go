import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Film, FileWarning, Loader2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// NOTE: This component previously only stored files locally and showed a blob preview.
// Root cause of user issue: videos with unsupported codecs showed a preview error and nothing was uploaded.
// Fix: implement real upload to Cloud storage (bucket: order-media) with status UI and graceful preview fallback.

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
}

interface MediaUploaderProps {
  onFilesChange?: (files: File[]) => void;
  maxImages?: number;
  maxVideos?: number;
  maxImageSize?: number; // in MB
  maxVideoSize?: number; // in MB
  maxVideoDuration?: number; // in seconds (kept for description only)
}

export function MediaUploader({
  onFilesChange,
  maxImages = 4,
  maxVideos = 2,
  maxImageSize = 10,
  maxVideoSize = 50,
  maxVideoDuration = 600, // 10 minutes
}: MediaUploaderProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);

  // Utilities
  const setFilePartial = (id: string, patch: Partial<MediaFile>) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
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

  // Upload to storage
  const uploadToStorage = async (media: MediaFile) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        toast({ title: 'خطا', description: 'برای آپلود باید وارد شوید.', variant: 'destructive' });
        setFilePartial(media.id, { status: 'error' });
        return;
      }

      setFilePartial(media.id, { status: 'uploading' });

      const extFromName = media.file.name.split('.').pop() || '';
      const ext = extFromName ? `.${extFromName}` : '';
      const safeName = media.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}${ext ? '' : ''}`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-media')
        .upload(storagePath, media.file, { contentType: media.file.type, upsert: false });

      if (uploadError) {
        setFilePartial(media.id, { status: 'error' });
        toast({ title: 'خطا در آپلود', description: uploadError.message, variant: 'destructive' });
        return;
      }

      const { data: publicData } = supabase.storage.from('order-media').getPublicUrl(storagePath);
      setFilePartial(media.id, { status: 'done', storagePath, remoteUrl: publicData.publicUrl });
    } catch (e: any) {
      setFilePartial(media.id, { status: 'error' });
      toast({ title: 'خطا در آپلود', description: e?.message || 'مشکلی پیش آمد.', variant: 'destructive' });
    }
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

      // Validate
      const isValid = type === 'image' ? validateImage(file) : validateVideo(file);
      if (!isValid) continue;

      const preview = URL.createObjectURL(file);
      newMedia.push({
        id: Math.random().toString(36).slice(2),
        file,
        preview,
        type,
        status: 'pending',
      });
    }

    if (newMedia.length) {
      setFiles(prev => {
        const updated = [...prev, ...newMedia];
        onFilesChange?.(updated.map(f => f.file));
        return updated;
      });

      // Start uploads (sequential to avoid rate spikes)
      for (const m of newMedia) {
        toast({ title: 'در حال آپلود', description: `${m.type === 'video' ? 'ویدیو' : 'عکس'} شما در حال آپلود است...` });
        await uploadToStorage(m);
      }
    }

    // Reset input
    event.target.value = '';
  };

  const removeFile = async (id: string) => {
    const target = files.find(f => f.id === id);
    if (target?.storagePath) {
      // Try deleting from storage if it was uploaded
      await supabase.storage.from('order-media').remove([target.storagePath]).catch(() => {});
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
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('image-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                افزودن عکس
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

                  {/* Status badge */}
                  <div className="absolute left-1 bottom-1 text-xs rounded px-2 py-0.5 bg-black/60 text-white">
                    {file.status === 'uploading' && 'در حال آپلود'}
                    {file.status === 'done' && 'آپلود شد'}
                    {file.status === 'error' && 'خطا'}
                    {!file.status || file.status === 'pending' ? 'در صف آپلود' : null}
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
                  {/* Video preview if possible; gracefully degrade */}
                  {!file.previewError ? (
                    <video
                      src={file.remoteUrl || file.preview}
                      className="w-full h-full object-cover"
                      controls
                      onError={() => setFilePartial(file.id, { previewError: true })}
                    />
                  ) : (
                    <div className="w-full h-full grid place-content-center text-center p-4">
                      <div className="text-sm text-muted-foreground">پیش‌نمایش این فرمت در مرورگر شما پشتیبانی نمی‌شود.</div>
                      {file.remoteUrl && (
                        <a href={file.remoteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-primary underline">
                          <LinkIcon className="w-4 h-4" /> دانلود/مشاهده ویدیو
                        </a>
                      )}
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute left-2 bottom-2 text-xs rounded px-2 py-1 bg-black/70 text-white">
                    {(file.file.size / (1024 * 1024)).toFixed(1)} MB •
                    {file.status === 'uploading' ? (
                      <span className="inline-flex items-center gap-1 ml-1"><Loader2 className="w-3 h-3 animate-spin" /> در حال آپلود</span>
                    ) : file.status === 'done' ? (
                      <span className="ml-1">آپلود شد</span>
                    ) : file.status === 'error' ? (
                      <span className="ml-1">خطا</span>
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
