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
  moduleKey?: string; // Used to auto-create report if dailyReportId is null (mobile recovery)
  onReportCreated?: (reportId: string) => void; // Callback when a report is auto-created
}

export function OrderRowMediaUpload({
  dailyReportId,
  dailyReportOrderId,
  orderId,
  reportDate,
  readOnly = false,
  rowIndex,
  showAllUsers = false,
  moduleKey,
  onReportCreated,
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

    const hasValidOrderRowId = dailyReportOrderId && isValidUuid(dailyReportOrderId);
    const hasValidOrderId = orderId && isValidUuid(orderId);

    try {
      let allMedia: any[] = [];

      // Query 1: media linked to this specific order row
      if (hasValidOrderRowId) {
        let q1 = supabase
          .from('daily_report_order_media')
          .select('id, file_path, file_type')
          .eq('daily_report_id', dailyReportId)
          .eq('report_date', reportDate)
          .eq('daily_report_order_id', dailyReportOrderId!);
        if (!showAllUsers) q1 = q1.eq('user_id', user.id);
        const { data: d1 } = await q1.order('created_at', { ascending: true });
        if (d1) allMedia.push(...d1);
      }

      // Query 2: orphaned media (daily_report_order_id IS NULL) matching by row_index
      {
        let q2 = supabase
          .from('daily_report_order_media')
          .select('id, file_path, file_type')
          .eq('daily_report_id', dailyReportId)
          .eq('report_date', reportDate)
          .is('daily_report_order_id', null)
          .eq('row_index', rowIndex);
        if (!showAllUsers) q2 = q2.eq('user_id', user.id);
        const { data: d2 } = await q2.order('created_at', { ascending: true });
        if (d2) allMedia.push(...d2);
      }

      // Query 3: also fetch by row_index (even if linked) to catch re-linked media
      {
        let q3 = supabase
          .from('daily_report_order_media')
          .select('id, file_path, file_type')
          .eq('daily_report_id', dailyReportId)
          .eq('report_date', reportDate)
          .eq('row_index', rowIndex);
        if (!showAllUsers) q3 = q3.eq('user_id', user.id);
        const { data: d3 } = await q3.order('created_at', { ascending: true });
        if (d3) allMedia.push(...d3);
      }

      // Query 4: if no order row ID, also try by order_id
      if (!hasValidOrderRowId && hasValidOrderId) {
        let q4 = supabase
          .from('daily_report_order_media')
          .select('id, file_path, file_type')
          .eq('daily_report_id', dailyReportId)
          .eq('report_date', reportDate)
          .eq('order_id', orderId!);
        if (!showAllUsers) q4 = q4.eq('user_id', user.id);
        const { data: d4 } = await q4.order('created_at', { ascending: true });
        if (d4) allMedia.push(...d4);
      }

      // Deduplicate by id
      const seenIds = new Set<string>();
      const data = allMedia.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });
      

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
  }, [dailyReportId, dailyReportOrderId, orderId, reportDate, user, showAllUsers, rowIndex]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Realtime subscription: sync media changes from other users instantly
  useEffect(() => {
    if (!dailyReportId || !showAllUsers) return;

    const channel = supabase
      .channel(`media-row-${dailyReportId}-${rowIndex}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_order_media',
          filter: `daily_report_id=eq.${dailyReportId}`,
        },
        (payload: any) => {
          // Only react to changes from other users
          if (payload.new?.user_id === user?.id || payload.old?.user_id === user?.id) {
            // For DELETE events, payload.new is empty, check old
            if (payload.eventType === 'DELETE' && payload.old?.user_id === user?.id) return;
            if (payload.eventType !== 'DELETE' && payload.new?.user_id === user?.id) return;
          }
          // Only react if row_index matches
          const relevantRowIndex = payload.new?.row_index ?? payload.old?.row_index;
          if (relevantRowIndex !== null && relevantRowIndex !== undefined && relevantRowIndex !== rowIndex) return;
          
          // Refetch media for this row
          fetchMedia();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dailyReportId, rowIndex, showAllUsers, user?.id, fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    // If dailyReportId is null, try to auto-create/find the report (handles mobile state loss)
    let effectiveReportId = dailyReportId;
    if (!effectiveReportId) {
      if (!moduleKey) {
        toast({
          title: 'ابتدا گزارش را ذخیره کنید',
          description: 'برای افزودن رسانه، ابتدا گزارش را یک بار ذخیره کنید.',
          variant: 'destructive',
        });
        return;
      }

      try {
        // Try to find existing report first
        const { data: existingReport } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('report_date', reportDate)
          .eq('created_by', user.id)
          .eq('module_key', moduleKey)
          .maybeSingle();

        if (existingReport?.id) {
          effectiveReportId = existingReport.id;
        } else {
          // Create new report
          const { data: newReport, error: createError } = await supabase
            .from('daily_reports')
            .insert({ report_date: reportDate, created_by: user.id, module_key: moduleKey })
            .select('id')
            .single();

          if (createError) {
            if (createError.code === '23505') {
              const { data: retry } = await supabase
                .from('daily_reports')
                .select('id')
                .eq('report_date', reportDate)
                .eq('created_by', user.id)
                .eq('module_key', moduleKey)
                .single();
              if (retry?.id) effectiveReportId = retry.id;
              else throw createError;
            } else {
              throw createError;
            }
          } else {
            effectiveReportId = newReport.id;
          }
        }

        // Notify parent about the created report
        if (effectiveReportId && onReportCreated) {
          onReportCreated(effectiveReportId);
        }
      } catch (err) {
        console.error('Auto-create report error:', err);
        toast({
          title: 'خطا در ایجاد گزارش',
          description: 'لطفاً دوباره تلاش کنید.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!effectiveReportId) return;

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

        const { data: insertedMedia, error: dbError } = await supabase
          .from('daily_report_order_media')
          .insert({
            daily_report_id: effectiveReportId,
            daily_report_order_id: validOrderRowId,
            order_id: validOrderId,
            user_id: user.id,
            file_path: storagePath,
            file_type: type,
            file_size: file.size,
            mime_type: file.type,
            report_date: reportDate,
            row_index: rowIndex,
          })
          .select('id, file_path, file_type')
          .single();

        if (dbError) {
          console.error('DB error:', dbError);
          toast({ title: `خطا در ثبت رسانه: ${dbError.message}`, variant: 'destructive' });
          continue;
        }

        // Add to local state immediately so it shows up even for unsaved rows
        if (insertedMedia) {
          const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
          setMedia(prev => [...prev, {
            id: insertedMedia.id,
            file_path: insertedMedia.file_path,
            file_type: insertedMedia.file_type as 'image' | 'video',
            publicUrl: urlData.publicUrl,
          }]);
        }

        // If order is selected and valid UUID, also insert into project_media with report date
        if (validOrderId) {
          await syncMediaToProject(storagePath, type, file.size, file.type, validOrderId, reportDate);
        }
      }

      toast({ title: 'آپلود شد ✅' });
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
          <label
            className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}
            title="افزودن عکس"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e, 'image')}
              disabled={uploading}
            />
          </label>
          <label
            className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-purple-600 hover:bg-purple-50 cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}
            title="افزودن فیلم"
          >
            <Film className="h-4 w-4" />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/3gpp,video/webm,video/quicktime,video/*"
              className="hidden"
              onChange={(e) => handleUpload(e, 'video')}
              disabled={uploading}
            />
          </label>
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
        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
          {media.slice(0, 4).map((item, idx) => (
            <div key={item.id} className="relative group cursor-pointer" onClick={() => setPreviewIndex(idx)}>
              {item.file_type === 'image' ? (
                <img
                  src={item.publicUrl}
                  alt=""
                  className="w-24 h-24 rounded object-cover border"
                />
              ) : (
                <div className="relative w-24 h-24 rounded border overflow-hidden bg-purple-50">
                  <video
                    src={item.publicUrl}
                    muted
                    playsInline
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {!readOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeMedia(item); }}
                  className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {media.length > 4 && (
            <div
              className="w-24 h-24 rounded bg-muted border flex items-center justify-center text-sm text-muted-foreground cursor-pointer"
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
