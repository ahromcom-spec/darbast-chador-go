import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { Upload, Film, Clock, X, Download, AlertCircle, RefreshCw, Calendar, Image as ImageIcon, CalendarClock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPersianDate, getIranToday } from '@/lib/dateUtils';
import { compressImages } from '@/lib/imageOptimizer';
import { buildMediaFingerprint, findDuplicateProjectMedia, mediaDedupeKey } from '@/lib/mediaFingerprint';

interface MediaFile {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  thumbnail_path?: string;
  created_at: string;
  media_date?: string | null;
  user_id?: string | null;
  file_size?: number | null;
  content_hash?: string | null;
  duration_seconds?: number | null;
}

/** تاریخ مؤثر هر رسانه: تاریخ تنظیم‌شده، در غیر این صورت تاریخ بارگذاری */
const effectiveDate = (m: MediaFile): string =>
  (m.media_date && String(m.media_date).slice(0, 10)) || (m.created_at || '').split('T')[0];

// حذف رسانه‌های تکراری (همان فایل که از چند ماژول/چند نفر ثبت شده) — قدیمی‌ترین نگه داشته می‌شود
const dedupeMedia = (items: MediaFile[]): MediaFile[] => {
  const byKey = new Map<string, MediaFile>();
  const sorted = [...items].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  for (const item of sorted) {
    const key = mediaDedupeKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  const keep = new Set(Array.from(byKey.values()).map((m) => m.id));
  return items.filter((m) => keep.has(m.id));
};

interface MediaGroup {
  date: string;
  persianDate: string;
  items: MediaFile[];
}

const groupMediaByDate = (mediaFiles: MediaFile[]): MediaGroup[] => {
  const groups: Record<string, MediaFile[]> = {};

  mediaFiles.forEach((media) => {
    const date = effectiveDate(media);
    if (!groups[date]) groups[date] = [];
    groups[date].push(media);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      persianDate: formatPersianDate(new Date(`${date}T12:00:00`), { dateFormat: 'd MMMM yyyy' }),
      items: items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    }));
};

// کامپوننت ویدیو با نمایش مدت زمان
function VideoWithDuration({
  url,
  onError,
}: {
  url: string;
  mimeType?: string;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number>(0);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const attemptPlay = async (video: HTMLVideoElement) => {
    try {
      video.muted = true;
      await video.play();
    } catch (e) {
      // Autoplay blocked by browser
    }
  };

  if (!url) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black/10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        key={url}
        src={url}
        controls
        playsInline
        autoPlay
        muted
        loop
        preload="auto"
        className="w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={(e) => attemptPlay(e.currentTarget)}
        onLoadedData={(e) => attemptPlay(e.currentTarget)}
        onError={onError}
      />

      {duration > 0 && (
        <div className="absolute bottom-12 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium pointer-events-none z-10">
          {formatTime(duration)}
        </div>
      )}
    </div>
  );
}

/** انتخاب/ویرایش تاریخ یک رسانه یا یک روز کامل */
function MediaDateEditor({
  value,
  onSave,
  label = 'تغییر تاریخ',
  compact = false,
}: {
  value: string;
  onSave: (date: string) => Promise<void> | void;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(`${value}T12:00:00`);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(`${value}T12:00:00`);
  }, [value]);

  const save = async () => {
    setSaving(true);
    try {
      const d = new Date(draft);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await onSave(iso);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={compact ? 'secondary' : 'outline'}
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-7 w-7 shadow' : 'gap-1 h-7 text-xs'}
          title={label}
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarClock className={compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
          {!compact && label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-muted-foreground">این عکس/فیلم مربوط به چه روزی است؟</p>
        <PersianDatePicker value={draft} onChange={setDraft} timeMode="none" placeholder="انتخاب تاریخ" />
        <Button size="sm" className="w-full" onClick={save} disabled={saving}>
          {saving ? 'در حال ذخیره...' : 'ذخیره تاریخ'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface OrderMediaSectionProps {
  orderId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  /** فقط رسانه‌هایی که خود کاربر بارگذاری کرده قابل حذف باشد */
  deleteOwnOnly?: boolean;
  /** امکان تنظیم/ویرایش تاریخ رسانه‌ها */
  canEditDate?: boolean;
  /** نمایش نام بارگذارنده زیر هر رسانه */
  showUploader?: boolean;
  onMediaChange?: () => void;
}

export function OrderMediaSection({
  orderId,
  canUpload = false,
  canDelete = false,
  deleteOwnOnly = false,
  canEditDate,
  showUploader = false,
  onMediaChange,
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  // تاریخی که رسانه‌های جدید با آن ثبت می‌شوند (پیش‌فرض: امروز)
  const [uploadDate, setUploadDate] = useState<string>(() => getIranToday());
  const uploadDateRef = useRef(uploadDate);
  uploadDateRef.current = uploadDate;

  const allowDateEdit = canEditDate ?? canUpload;

  useEffect(() => {
    fetchMedia();
  }, [orderId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (mediaFiles.length > 0) {
      fetchUrls();
      if (showUploader) fetchUploaderNames();
    }
  }, [mediaFiles]);

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type, thumbnail_path, created_at, media_date, user_id, file_size, content_hash, duration_seconds')
        .eq('project_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMediaFiles(dedupeMedia((data || []) as MediaFile[]));
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUploaderNames = async () => {
    const ids = Array.from(new Set(mediaFiles.map((m) => m.user_id).filter(Boolean))) as string[];
    if (ids.length === 0) return;
    const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
    const map: Record<string, string> = {};
    (data || []).forEach((p: any) => {
      map[p.user_id] = p.full_name || 'نامشخص';
    });
    setUploaderNames(map);
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

  // آپلود با XMLHttpRequest برای progress واقعی
  const uploadFileWithProgress = async (
    file: File,
    filePath: string,
    accessToken: string,
    onProgress: (loaded: number, total: number) => void
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      });

      xhr.addEventListener('load', () => resolve(xhr.status >= 200 && xhr.status < 300));
      xhr.addEventListener('error', () => resolve(false));
      xhr.addEventListener('abort', () => resolve(false));

      xhr.open('POST', `${supabaseUrl}/storage/v1/object/project-media/${filePath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const mediaDate = uploadDateRef.current || getIranToday();
    setUploadingImages(true);
    setImageUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !session.access_token) {
        toast({ title: 'خطا', description: 'لطفاً وارد سیستم شوید', variant: 'destructive' });
        return;
      }

      const user = session.user;
      const fileArray = await compressImages(Array.from(files));
      const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      const progressMap: Record<number, number> = {};

      const CONCURRENT_UPLOADS = 3;
      let successCount = 0;
      let duplicateCount = 0;

      const uploadFile = async (file: File, index: number): Promise<boolean> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${index}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const fp = await buildMediaFingerprint(file, 'image');
        const dup = await findDuplicateProjectMedia(orderId, {
          contentHash: fp.contentHash,
          durationSeconds: fp.durationSeconds,
          fileSize: file.size,
          fileType: 'image',
          mediaDate,
        });
        if (dup) {
          duplicateCount++;
          progressMap[index] = file.size;
          return false;
        }

        const success = await uploadFileWithProgress(file, filePath, session.access_token, (loaded) => {
          progressMap[index] = loaded;
          const totalLoaded = Object.values(progressMap).reduce((a, b) => a + b, 0);
          setImageUploadProgress(Math.min((totalLoaded / totalSize) * 100, 99));
        });

        if (success) {
          const { error: dbError } = await supabase.from('project_media').insert({
            project_id: orderId,
            file_path: filePath,
            file_type: 'image',
            file_size: file.size,
            mime_type: file.type,
            user_id: user.id,
            content_hash: fp.contentHash,
            duration_seconds: fp.durationSeconds,
            media_date: mediaDate,
          });
          if (!dbError) return true;
        }
        return false;
      };

      for (let i = 0; i < fileArray.length; i += CONCURRENT_UPLOADS) {
        const batch = fileArray.slice(i, i + CONCURRENT_UPLOADS);
        const results = await Promise.all(batch.map((file, idx) => uploadFile(file, i + idx)));
        successCount += results.filter(Boolean).length;
      }

      if (duplicateCount > 0) {
        toast({ title: 'تکراری', description: `${duplicateCount} عکس تکراری بود و ثبت نشد` });
      }

      setImageUploadProgress(100);

      if (successCount > 0) {
        toast({
          title: '✓ موفق',
          description: `${successCount} عکس برای تاریخ ${formatPersianDate(new Date(`${mediaDate}T12:00:00`), { dateFormat: 'd MMMM yyyy' })} ثبت شد`,
        });
        await fetchMedia();
        onMediaChange?.();
      }
    } catch (error: any) {
      toast({ title: 'خطا', description: error.message || 'خطا در آپلود عکس‌ها', variant: 'destructive' });
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

    const mediaDate = uploadDateRef.current || getIranToday();
    setUploadingVideos(true);
    setVideoUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !session.access_token) {
        toast({ title: 'خطا', description: 'لطفاً وارد سیستم شوید', variant: 'destructive' });
        return;
      }

      const user = session.user;
      const fileArray = Array.from(files);
      const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      const progressMap: Record<number, number> = {};

      const CONCURRENT_UPLOADS = 2;
      let successCount = 0;
      let duplicateCount = 0;

      const uploadVideo = async (file: File, index: number): Promise<boolean> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${index}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // تشخیص فیلم تکراری: محتوای یکسان، یا مدت‌زمان و حجم یکسان در همان تاریخ
        const fp = await buildMediaFingerprint(file, 'video');
        const dup = await findDuplicateProjectMedia(orderId, {
          contentHash: fp.contentHash,
          durationSeconds: fp.durationSeconds,
          fileSize: file.size,
          fileType: 'video',
          mediaDate,
        });
        if (dup) {
          duplicateCount++;
          progressMap[index] = file.size;
          return false;
        }

        const success = await uploadFileWithProgress(file, filePath, session.access_token, (loaded) => {
          progressMap[index] = loaded;
          const totalLoaded = Object.values(progressMap).reduce((a, b) => a + b, 0);
          setVideoUploadProgress(Math.min((totalLoaded / totalSize) * 100, 99));
        });

        if (success) {
          const { error: dbError } = await supabase.from('project_media').insert({
            project_id: orderId,
            file_path: filePath,
            file_type: 'video',
            file_size: file.size,
            mime_type: file.type,
            user_id: user.id,
            content_hash: fp.contentHash,
            duration_seconds: fp.durationSeconds,
            media_date: mediaDate,
          });
          if (!dbError) return true;
        }
        return false;
      };

      for (let i = 0; i < fileArray.length; i += CONCURRENT_UPLOADS) {
        const batch = fileArray.slice(i, i + CONCURRENT_UPLOADS);
        const results = await Promise.all(batch.map((file, idx) => uploadVideo(file, i + idx)));
        successCount += results.filter(Boolean).length;
      }

      if (duplicateCount > 0) {
        toast({ title: 'تکراری', description: `${duplicateCount} فیلم تکراری بود و ثبت نشد` });
      }

      setVideoUploadProgress(100);

      if (successCount > 0) {
        toast({
          title: '✓ موفق',
          description: `${successCount} فیلم برای تاریخ ${formatPersianDate(new Date(`${mediaDate}T12:00:00`), { dateFormat: 'd MMMM yyyy' })} ثبت شد`,
        });
        await fetchMedia();
        onMediaChange?.();
      }
    } catch (error: any) {
      toast({ title: 'خطا', description: error.message || 'خطا در آپلود ویدیوها', variant: 'destructive' });
    } finally {
      setTimeout(() => {
        setUploadingVideos(false);
        setVideoUploadProgress(0);
      }, 500);
      e.target.value = '';
    }
  };

  const updateMediaDate = async (ids: string[], date: string) => {
    const { error } = await supabase.from('project_media').update({ media_date: date }).in('id', ids);
    if (error) {
      toast({ title: 'خطا', description: 'تغییر تاریخ انجام نشد', variant: 'destructive' });
      return;
    }
    setMediaFiles((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, media_date: date } : m)));
    toast({
      title: '✓ ثبت شد',
      description: `تاریخ ${ids.length > 1 ? `${ids.length} رسانه` : 'رسانه'} به ${formatPersianDate(new Date(`${date}T12:00:00`), { dateFormat: 'd MMMM yyyy' })} تغییر یافت`,
    });
    onMediaChange?.();
  };

  const handleDeleteMedia = async (mediaId: string, mediaPath: string) => {
    if (!confirm('آیا از حذف این رسانه اطمینان دارید؟')) return;

    setDeletingMediaId(mediaId);
    try {
      await supabase.storage.from('project-media').remove([mediaPath]);

      const { error: dbError } = await supabase.from('project_media').delete().eq('id', mediaId);
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
  const handleVideoError = (mediaId: string) => setVideoErrors((prev) => ({ ...prev, [mediaId]: true }));
  const handleRetryVideo = (mediaId: string) => {
    setVideoErrors((prev) => ({ ...prev, [mediaId]: false }));
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

  const images = mediaFiles.filter((m) => m.file_type === 'image');
  const videos = mediaFiles.filter((m) => m.file_type === 'video');
  const groups = useMemo(() => groupMediaByDate(mediaFiles), [mediaFiles]);

  const canDeleteItem = (media: MediaFile) => {
    if (!canDelete) return false;
    if (deleteOwnOnly) return !!currentUserId && media.user_id === currentUserId;
    return true;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-5 w-5" />
              عکس‌ها و فیلم‌های سفارش
              <span className="text-xs font-normal text-muted-foreground">
                ({images.length} عکس، {videos.length} فیلم)
              </span>
            </CardTitle>

            {canUpload && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => document.getElementById(`image-upload-${orderId}`)?.click()}
                  disabled={uploadingImages}
                >
                  {uploadingImages ? <Clock className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  افزودن عکس
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => document.getElementById(`video-upload-${orderId}`)?.click()}
                  disabled={uploadingVideos}
                >
                  {uploadingVideos ? <Clock className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                  افزودن فیلم
                </Button>
              </div>
            )}
          </div>

          {/* انتخاب تاریخ رسانه‌های جدید */}
          {canUpload && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                این عکس/فیلم مربوط به چه روزی است؟
              </span>
              <div className="min-w-[190px]">
                <PersianDatePicker
                  value={`${uploadDate}T12:00:00`}
                  onChange={(v) => {
                    const d = new Date(v);
                    setUploadDate(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    );
                  }}
                  timeMode="none"
                  placeholder="انتخاب تاریخ"
                />
              </div>
              {uploadDate !== getIranToday() && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setUploadDate(getIranToday())}>
                  امروز
                </Button>
              )}
            </div>
          )}

          {(uploadingImages || uploadingVideos) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {uploadingImages ? 'در حال آپلود عکس...' : 'در حال آپلود فیلم...'}
                </span>
                <span className="font-medium text-primary">
                  {Math.round(uploadingImages ? imageUploadProgress : videoUploadProgress)}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${uploadingImages ? imageUploadProgress : videoUploadProgress}%`,
                    transition: 'width 0.3s cubic-bezier(0.0, 0.0, 0.2, 1)',
                  }}
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {canUpload && (
            <>
              <input
                id={`image-upload-${orderId}`}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploadingImages}
              />
              <input
                id={`video-upload-${orderId}`}
                type="file"
                accept="video/mp4,video/webm,video/mov,video/avi,video/quicktime,video/*"
                multiple
                className="hidden"
                onChange={handleVideoUpload}
                disabled={uploadingVideos}
              />
            </>
          )}

          {mediaFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">هنوز عکس یا فیلمی اضافه نشده است</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group, groupIndex) => {
                const groupImages = group.items.filter((m) => m.file_type === 'image');
                const groupVideos = group.items.filter((m) => m.file_type === 'video');

                return (
                  <div key={group.date}>
                    {/* عنوان تاریخ */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{group.persianDate}</span>
                      <span className="text-xs text-muted-foreground">
                        ({groupImages.length > 0 && `${groupImages.length} عکس`}
                        {groupImages.length > 0 && groupVideos.length > 0 && ' و '}
                        {groupVideos.length > 0 && `${groupVideos.length} فیلم`})
                      </span>
                      {allowDateEdit && (
                        <MediaDateEditor
                          value={group.date}
                          label="تغییر تاریخ این روز"
                          onSave={(d) => updateMediaDate(group.items.map((i) => i.id), d)}
                        />
                      )}
                    </div>

                    {/* عکس‌ها */}
                    {groupImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                        {groupImages.map((media) => (
                          <div
                            key={media.id}
                            className="relative rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                          >
                            <div className="aspect-square" onClick={() => setSelectedImage(getMediaUrl(media.id))}>
                              <img
                                src={getMediaUrl(media.id)}
                                alt="تصویر سفارش"
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>

                            <div className="absolute top-2 left-2 flex gap-1 z-10">
                              {canDeleteItem(media) && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7 shadow"
                                  aria-label="حذف عکس"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMedia(media.id, media.file_path);
                                  }}
                                  disabled={deletingMediaId === media.id}
                                >
                                  {deletingMediaId === media.id ? (
                                    <Clock className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                              {allowDateEdit && (
                                <MediaDateEditor
                                  compact
                                  value={effectiveDate(media)}
                                  label="تغییر تاریخ این عکس"
                                  onSave={(d) => updateMediaDate([media.id], d)}
                                />
                              )}
                            </div>

                            {showUploader && (
                              <div className="p-2 bg-muted/50 text-xs text-muted-foreground border-t flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">{uploaderNames[media.user_id || ''] || 'نامشخص'}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* فیلم‌ها */}
                    {groupVideos.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupVideos.map((media) => {
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
                                      <Button size="sm" variant="outline" onClick={() => handleRetryVideo(media.id)}>
                                        <RefreshCw className="h-4 w-4 ml-1" />
                                        تلاش مجدد
                                      </Button>
                                      <Button size="sm" variant="secondary" onClick={() => handleDownloadVideo(url, fileName)}>
                                        <Download className="h-4 w-4 ml-1" />
                                        دانلود فایل
                                      </Button>
                                    </div>
                                  </div>
                                ) : url ? (
                                  <VideoWithDuration url={url} mimeType={media.mime_type} onError={() => handleVideoError(media.id)} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                  </div>
                                )}
                              </div>

                              <div className="absolute top-2 left-2 flex gap-1 z-10">
                                {canDeleteItem(media) && !hasError && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-7 w-7 shadow-lg"
                                    aria-label="حذف فیلم"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMedia(media.id, media.file_path);
                                    }}
                                    disabled={deletingMediaId === media.id}
                                  >
                                    {deletingMediaId === media.id ? (
                                      <Clock className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                {allowDateEdit && (
                                  <MediaDateEditor
                                    compact
                                    value={effectiveDate(media)}
                                    label="تغییر تاریخ این فیلم"
                                    onSave={(d) => updateMediaDate([media.id], d)}
                                  />
                                )}
                              </div>

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

                              {showUploader && (
                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{uploaderNames[media.user_id || ''] || 'نامشخص'}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {groupIndex < groups.length - 1 && (
                      <div className="mt-5 border-t border-dashed border-muted-foreground/30" />
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
              <img src={selectedImage} alt="عکس بزرگ پروژه" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
