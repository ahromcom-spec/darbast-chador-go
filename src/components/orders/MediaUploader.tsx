import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Film, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  id: string;
}

interface MediaUploaderProps {
  onFilesChange?: (files: File[]) => void;
  maxImages?: number;
  maxVideos?: number;
  maxImageSize?: number; // in MB
  maxVideoSize?: number; // in MB
  maxVideoDuration?: number; // in seconds
}

export function MediaUploader({
  onFilesChange,
  maxImages = 4,
  maxVideos = 2,
  maxImageSize = 10,
  maxVideoSize = 150,
  maxVideoDuration = 180, // 3 minutes
}: MediaUploaderProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<MediaFile[]>([]);

  const validateImage = (file: File): boolean => {
    const maxSizeBytes = maxImageSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: 'خطا',
        description: `حجم عکس نباید بیشتر از ${maxImageSize} مگابایت باشد`,
        variant: 'destructive'
      });
      return false;
    }
    return true;
  };

  const validateVideo = async (file: File): Promise<boolean> => {
    const maxSizeBytes = maxVideoSize * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      toast({
        title: 'خطا',
        description: `حجم ویدیو نباید بیشتر از ${maxVideoSize} مگابایت باشد`,
        variant: 'destructive'
      });
      return false;
    }

    // Check video duration
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > maxVideoDuration) {
          toast({
            title: 'خطا',
            description: `مدت زمان ویدیو نباید بیشتر از ${maxVideoDuration / 60} دقیقه باشد`,
            variant: 'destructive'
          });
          resolve(false);
        } else {
          resolve(true);
        }
      };

      video.onerror = () => {
        toast({
          title: 'خطا',
          description: 'خطا در بارگذاری ویدیو',
          variant: 'destructive'
        });
        resolve(false);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const currentImages = files.filter(f => f.type === 'image').length;
    const currentVideos = files.filter(f => f.type === 'video').length;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check count limits
      if (type === 'image' && currentImages + i >= maxImages) {
        toast({
          title: 'محدودیت تعداد',
          description: `حداکثر ${maxImages} عکس می‌توانید آپلود کنید`,
          variant: 'destructive'
        });
        break;
      }
      
      if (type === 'video' && currentVideos + i >= maxVideos) {
        toast({
          title: 'محدودیت تعداد',
          description: `حداکثر ${maxVideos} ویدیو می‌توانید آپلود کنید`,
          variant: 'destructive'
        });
        break;
      }

      // Validate file
      let isValid = false;
      if (type === 'image') {
        isValid = validateImage(file);
      } else {
        isValid = await validateVideo(file);
      }

      if (!isValid) continue;

      // Create preview
      const preview = URL.createObjectURL(file);
      const newFile: MediaFile = {
        file,
        preview,
        type,
        id: Math.random().toString(36).substring(7)
      };

      setFiles(prev => {
        const updated = [...prev, newFile];
        onFilesChange?.(updated.map(f => f.file));
        return updated;
      });
    }

    // Reset input
    event.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      onFilesChange?.(updated.map(f => f.file));
      return updated;
    });
  };

  const imageCount = files.filter(f => f.type === 'image').length;
  const videoCount = files.filter(f => f.type === 'video').length;

  return (
    <Card className="shadow-2xl bg-card/20 backdrop-blur-md border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          تصاویر و ویدیوهای پروژه
        </CardTitle>
        <CardDescription>
          حداکثر {maxImages} عکس (هر کدام {maxImageSize}MB) و {maxVideos} ویدیو (هر کدام {maxVideoSize}MB و {maxVideoDuration / 60} دقیقه)
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
              >
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
                    src={file.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('video-upload')?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                افزودن ویدیو
              </Button>
            )}
          </div>
          <input
            id="video-upload"
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'video')}
          />
          
          {files.filter(f => f.type === 'video').length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.filter(f => f.type === 'video').map((file) => (
                <div key={file.id} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
                  <video
                    src={file.preview}
                    className="w-full h-full object-cover"
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                    {(file.file.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {files.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <FileWarning className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              هنوز فایلی آپلود نشده است
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
