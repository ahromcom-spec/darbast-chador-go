import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Film, Clock, X, Play, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaFile {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  thumbnail_path?: string;
  created_at: string;
}

interface OrderMediaSectionProps {
  orderId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  onMediaChange?: () => void;
}

export function OrderMediaSection({ 
  orderId, 
  canUpload = false, 
  canDelete = false,
  onMediaChange 
}: OrderMediaSectionProps) {
  const { toast } = useToast();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchMedia();
  }, [orderId]);

  useEffect(() => {
    if (mediaFiles.length > 0) {
      fetchUrls();
    }
  }, [mediaFiles]);

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type, thumbnail_path, created_at')
        .eq('project_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMediaFiles(data || []);
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUrls = async () => {
    const urls: Record<string, string> = {};
    for (const item of mediaFiles) {
      try {
        const { data: signedData, error } = await supabase.storage
          .from('project-media')
          .createSignedUrl(item.file_path, 3600);

        if (signedData?.signedUrl && !error) {
          urls[item.id] = signedData.signedUrl;
        } else {
          const { data } = supabase.storage.from('project-media').getPublicUrl(item.file_path);
          urls[item.id] = data.publicUrl;
        }
      } catch (err) {
        console.error('Error getting URL for', item.file_path, err);
        const { data } = supabase.storage.from('project-media').getPublicUrl(item.file_path);
        urls[item.id] = data.publicUrl;
      }
    }
    setMediaUrls(urls);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setImageUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "خطا", description: "لطفاً وارد سیستم شوید", variant: "destructive" });
        return;
      }

      let successCount = 0;
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('project-media')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase
            .from('project_media')
            .insert({
              project_id: orderId,
              file_path: filePath,
              file_type: 'image',
              file_size: file.size,
              mime_type: file.type,
              user_id: user.id
            });

          if (dbError) throw dbError;
          successCount++;
        } catch (err) {
          console.error('Error uploading file:', file.name, err);
        }

        const linearProgress = ((i + 1) / totalFiles) * 100;
        const easedProgress = 100 * (1 - Math.pow(1 - linearProgress / 100, 0.5));
        setImageUploadProgress(Math.min(easedProgress, 95));
      }

      setImageUploadProgress(100);

      if (successCount > 0) {
        toast({ title: "✓ موفق", description: `${successCount} عکس با موفقیت آپلود شد` });
        await fetchMedia();
        onMediaChange?.();
      }
    } catch (error: any) {
      toast({ title: "خطا", description: error.message || "خطا در آپلود عکس‌ها", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setUploadingImages(false);
        setImageUploadProgress(0);
      }, 500);
      e.target.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingVideos(true);
    setVideoUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "خطا", description: "لطفاً وارد سیستم شوید", variant: "destructive" });
        return;
      }

      let successCount = 0;
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('project-media')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase
            .from('project_media')
            .insert({
              project_id: orderId,
              file_path: filePath,
              file_type: 'video',
              file_size: file.size,
              mime_type: file.type,
              user_id: user.id
            });

          if (dbError) throw dbError;
          successCount++;
        } catch (err) {
          console.error('Error uploading file:', file.name, err);
        }

        const linearProgress = ((i + 1) / totalFiles) * 100;
        const easedProgress = 100 * (1 - Math.pow(1 - linearProgress / 100, 0.5));
        setVideoUploadProgress(Math.min(easedProgress, 95));
      }

      setVideoUploadProgress(100);

      if (successCount > 0) {
        toast({ title: "✓ موفق", description: `${successCount} ویدیو با موفقیت آپلود شد` });
        await fetchMedia();
        onMediaChange?.();
      }
    } catch (error: any) {
      toast({ title: "خطا", description: error.message || "خطا در آپلود ویدیوها", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setUploadingVideos(false);
        setVideoUploadProgress(0);
      }, 500);
      e.target.value = '';
    }
  };

  const handleDeleteMedia = async (mediaId: string, mediaPath: string) => {
    if (!confirm('آیا از حذف این رسانه اطمینان دارید؟')) return;

    setDeletingMediaId(mediaId);
    try {
      await supabase.storage.from('project-media').remove([mediaPath]);
      
      const { error: dbError } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaId);

      if (dbError) throw dbError;

      toast({ title: '✓ موفق', description: 'رسانه با موفقیت حذف شد' });
      await fetchMedia();
      onMediaChange?.();
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در حذف رسانه', variant: 'destructive' });
    } finally {
      setDeletingMediaId(null);
    }
  };

  const getMediaUrl = (mediaId: string) => mediaUrls[mediaId] || '';

  const handleVideoError = (mediaId: string) => {
    setVideoErrors(prev => ({ ...prev, [mediaId]: true }));
  };

  const handleRetryVideo = (mediaId: string) => {
    setVideoErrors(prev => ({ ...prev, [mediaId]: false }));
    fetchUrls();
  };

  const handleDownloadVideo = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast({ title: 'موفق', description: 'دانلود ویدیو شروع شد' });
    } catch (error) {
      toast({ title: 'خطا', description: 'خطا در دانلود ویدیو', variant: 'destructive' });
    }
  };

  const images = mediaFiles.filter(m => m.file_type === 'image');
  const videos = mediaFiles.filter(m => m.file_type === 'video');

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {/* بخش عکس‌ها */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5" />
              تصاویر پروژه ({images.length})
            </CardTitle>
            {canUpload && (
              <Button
                variant="default"
                onClick={() => document.getElementById(`image-upload-${orderId}`)?.click()}
                disabled={uploadingImages}
                className="gap-2"
                size="sm"
              >
                {uploadingImages ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    در حال آپلود عکس...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    افزودن عکس
                  </>
                )}
              </Button>
            )}
          </div>
          {uploadingImages && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">در حال آپلود عکس...</span>
                <span className="font-medium text-primary">{Math.round(imageUploadProgress)}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ 
                    width: `${imageUploadProgress}%`,
                    transition: 'width 0.3s cubic-bezier(0.0, 0.0, 0.2, 1)'
                  }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {canUpload && (
            <input
              id={`image-upload-${orderId}`}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploadingImages}
            />
          )}

          {images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">هنوز عکسی اضافه نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((media) => (
                <div
                  key={media.id}
                  className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                  onClick={() => setSelectedImage(getMediaUrl(media.id))}
                >
                  <img
                    src={getMediaUrl(media.id)}
                    alt="تصویر سفارش"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMedia(media.id, media.file_path);
                      }}
                      disabled={deletingMediaId === media.id}
                    >
                      {deletingMediaId === media.id ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* بخش ویدیوها */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-5 w-5" />
              ویدیوهای پروژه ({videos.length})
            </CardTitle>
            {canUpload && (
              <Button
                variant="default"
                onClick={() => document.getElementById(`video-upload-${orderId}`)?.click()}
                disabled={uploadingVideos}
                className="gap-2"
                size="sm"
              >
                {uploadingVideos ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    در حال آپلود ویدیو...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    افزودن ویدیو
                  </>
                )}
              </Button>
            )}
          </div>
          {uploadingVideos && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">در حال آپلود ویدیو...</span>
                <span className="font-medium text-primary">{Math.round(videoUploadProgress)}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ 
                    width: `${videoUploadProgress}%`,
                    transition: 'width 0.3s cubic-bezier(0.0, 0.0, 0.2, 1)'
                  }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {canUpload && (
            <input
              id={`video-upload-${orderId}`}
              type="file"
              accept="video/mp4,video/webm,video/mov,video/avi,video/quicktime,video/*"
              multiple
              className="hidden"
              onChange={handleVideoUpload}
              disabled={uploadingVideos}
            />
          )}

          {videos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">هنوز ویدیویی اضافه نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((media) => {
                const url = getMediaUrl(media.id);
                const hasError = videoErrors[media.id];
                const fileName = media.file_path.split('/').pop() || 'video.mp4';
                
                return (
                  <div key={media.id} className="relative group">
                    <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                      {hasError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-4">
                          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                          <p className="text-sm text-muted-foreground mb-3">خطا در بارگذاری ویدیو</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryVideo(media.id)}
                            >
                              <RefreshCw className="h-4 w-4 ml-1" />
                              تلاش مجدد
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadVideo(url, fileName)}
                            >
                              <Download className="h-4 w-4 ml-1" />
                              دانلود فایل
                            </Button>
                          </div>
                        </div>
                      ) : url ? (
                        <video
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                          onError={() => handleVideoError(media.id)}
                        >
                          <source src={url} type={media.mime_type || 'video/mp4'} />
                          مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
                        </video>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>

                    {canDelete && !hasError && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMedia(media.id, media.file_path);
                        }}
                        disabled={deletingMediaId === media.id}
                      >
                        {deletingMediaId === media.id ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* دکمه دانلود */}
                    {!hasError && url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadVideo(url, fileName);
                        }}
                      >
                        <Download className="h-4 w-4 ml-1" />
                        دانلود
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ نمایش تصویر */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-7xl w-full p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>عکس پروژه</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="عکس بزرگ پروژه"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}