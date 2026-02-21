import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Film, X, Loader2, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const MEDIA_BUCKET = 'project-media';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (val: unknown): val is string => typeof val === 'string' && UUID_REGEX.test(val);

interface MediaItem {
  id: string;
  file_path: string;
  file_type: 'image' | 'video';
  publicUrl?: string;
}

interface OrderRowMediaUploadProps {
  dailyReportId: string | null;
  dailyReportOrderId?: string;
  orderId?: string;
  reportDate: string; // YYYY-MM-DD
  readOnly?: boolean;
  rowIndex: number;
  showAllUsers?: boolean; // In aggregated/overview mode, show media from all users
}

export function OrderRowMediaUpload({
  dailyReportId,
  dailyReportOrderId,
  orderId,
  reportDate,
  readOnly = false,
  rowIndex,
  showAllUsers = false,
}: OrderRowMediaUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing media for this row
  const fetchMedia = useCallback(async () => {
    if (!dailyReportId || !user) return;

    try {
      let query = supabase
        .from('daily_report_order_media')
        .select('id, file_path, file_type')
        .eq('daily_report_id', dailyReportId)
        .eq('report_date', reportDate);

      // In aggregated/overview mode, show media from all users
      if (!showAllUsers) {
        query = query.eq('user_id', user.id);
      }

      if (dailyReportOrderId && isValidUuid(dailyReportOrderId)) {
        query = query.eq('daily_report_order_id', dailyReportOrderId);
      }
      if (orderId && isValidUuid(orderId)) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;

      if (data && data.length > 0) {
        // Get public URLs
        const items: MediaItem[] = data.map((m: any) => {
          const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(m.file_path);
          return {
            id: m.id,
            file_path: m.file_path,
            file_type: m.file_type,
            publicUrl: urlData.publicUrl,
          };
        });
        setMedia(items);
      } else {
        setMedia([]);
      }
    } catch (err) {
      console.error('Error fetching row media:', err);
    }
  }, [dailyReportId, dailyReportOrderId, orderId, reportDate, user, showAllUsers]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    if (!dailyReportId) {
      toast({
        title: 'ابتدا گزارش را ذخیره کنید',
        description: 'برای افزودن رسانه، ابتدا گزارش را یک بار ذخیره کنید.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: totalFiles, fileName: file.name });
        const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
          toast({
            title: 'حجم فایل زیاد',
            description: `حداکثر حجم ${type === 'image' ? '10' : '50'} مگابایت`,
            variant: 'destructive',
          });
          continue;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
        const storagePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(storagePath, file, { 
            upsert: true,
            contentType: file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
          });

        if (uploadError) {
          console.error('Upload error:', uploadError, 'MIME:', file.type, 'Size:', file.size);
          toast({ title: `خطا در آپلود: ${uploadError.message}`, variant: 'destructive' });
          continue;
        }

        // Insert record in daily_report_order_media
        // Only pass dailyReportOrderId if it's a valid UUID (saved row); skip for unsaved rows
        const validOrderRowId = isValidUuid(dailyReportOrderId) ? dailyReportOrderId : null;
        const validOrderId = isValidUuid(orderId) ? orderId : null;

        const { error: dbError } = await supabase
          .from('daily_report_order_media')
          .insert({
            daily_report_id: dailyReportId,
            daily_report_order_id: validOrderRowId,
            order_id: validOrderId,
            user_id: user.id,
            file_path: storagePath,
            file_type: type,
            file_size: file.size,
            mime_type: file.type,
            report_date: reportDate,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          toast({ title: `خطا در ثبت رسانه: ${dbError.message}`, variant: 'destructive' });
          continue;
        }

        // If order is selected and valid UUID, also insert into project_media with report date
        if (validOrderId) {
          await syncMediaToProject(storagePath, type, file.size, file.type, validOrderId, reportDate);
        }
      }

      toast({ title: 'آپلود شد ✅' });
      fetchMedia();
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'خطا', variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, fileName: '' });
      e.target.value = '';
    }
  };

  const syncMediaToProject = async (
    filePath: string,
    fileType: string,
    fileSize: number,
    mimeType: string,
    projectId: string,
    date: string
  ) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('project_media').insert({
        project_id: projectId,
        user_id: user.id,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
        mime_type: mimeType,
        created_at: `${date}T12:00:00+03:30`,
      });
      if (error) {
        console.error('Sync to project_media error:', error);
        // Don't show toast - this is a secondary sync, not critical
      }
    } catch (err) {
      console.error('syncMediaToProject error:', err);
    }
  };

  const removeMedia = async (item: MediaItem) => {
    try {
      await supabase.from('daily_report_order_media').delete().eq('id', item.id);
      // Don't delete from storage as it may be linked to project_media
      setMedia(prev => prev.filter(m => m.id !== item.id));
    } catch (err) {
      console.error('Remove error:', err);
    }
  };

  const imageCount = media.filter(m => m.file_type === 'image').length;
  const videoCount = media.filter(m => m.file_type === 'video').length;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[80px]">
      {/* Upload buttons */}
      {!readOnly && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-blue-600 hover:bg-blue-50"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            title="افزودن عکس"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-purple-600 hover:bg-purple-50"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading}
            title="افزودن فیلم"
          >
            <Film className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, 'image')}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e, 'video')}
          />
        </div>
      )}

      {/* Upload progress indicator */}
      {uploading && uploadProgress.total > 0 && (
        <div className="w-full max-w-[120px] flex flex-col items-center gap-0.5">
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            {uploadProgress.current} / {uploadProgress.total} در حال آپلود...
          </span>
        </div>
      )}


      {(imageCount > 0 || videoCount > 0) && (
        <div className="flex items-center gap-1 text-[10px]">
          {imageCount > 0 && (
            <span className="flex items-center gap-0.5 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              <ImageIcon className="h-2.5 w-2.5" />
              {imageCount}
            </span>
          )}
          {videoCount > 0 && (
            <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
              <Film className="h-2.5 w-2.5" />
              {videoCount}
            </span>
          )}
        </div>
      )}

      {/* Thumbnails */}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[120px]">
          {media.slice(0, 4).map((item, idx) => (
            <div key={item.id} className="relative group cursor-pointer" onClick={() => setPreviewIndex(idx)}>
              {item.file_type === 'image' ? (
                <img
                  src={item.publicUrl}
                  alt=""
                  className="w-8 h-8 rounded object-cover border"
                />
              ) : (
                <div className="relative w-8 h-8 rounded border overflow-hidden bg-purple-50">
                  <video
                    src={item.publicUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      video.currentTime = 0.5;
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Film className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}
              {!readOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeMedia(item); }}
                  className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2 w-2" />
                </button>
              )}
            </div>
          ))}
          {media.length > 4 && (
            <div
              className="w-8 h-8 rounded bg-muted border flex items-center justify-center text-[10px] text-muted-foreground cursor-pointer"
              onClick={() => setPreviewIndex(4)}
            >
              +{media.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Media Preview Dialog */}
      <Dialog open={previewIndex !== null} onOpenChange={(open) => { if (!open) setPreviewIndex(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-4 flex flex-col items-center justify-center">
          {previewIndex !== null && media[previewIndex] && (
            <>
              {media[previewIndex].file_type === 'image' ? (
                <img
                  src={media[previewIndex].publicUrl}
                  alt=""
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
              ) : (
                <video
                  src={media[previewIndex].publicUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[75vh] rounded"
                />
              )}
              {media.length > 1 && (
                <div className="flex items-center gap-4 mt-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={previewIndex <= 0}
                    onClick={() => setPreviewIndex(prev => prev !== null ? prev - 1 : null)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {previewIndex + 1} / {media.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={previewIndex >= media.length - 1}
                    onClick={() => setPreviewIndex(prev => prev !== null ? prev + 1 : null)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
