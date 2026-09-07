import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { Image as ImageIcon, Play, Loader2 } from 'lucide-react';

interface MediaRow {
  id: string;
  file_path: string;
  file_type: string;
}

interface OrderMediaPreviewProps {
  orderId: string;
  /** تعداد رسانه‌ای که در ابتدا نمایش داده می‌شود */
  pageSize?: number;
}

/**
 * نمایش سبک و تدریجی عکس‌ها و ویدیوهای یک سفارش
 * ویدیوها فقط با کلیک بارگذاری می‌شوند (preload=none) تا مصرف پهنای باند کم بماند.
 */
export function OrderMediaPreview({ orderId, pageSize = 6 }: OrderMediaPreviewProps) {
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(pageSize);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('project_media')
        .select('id, file_path, file_type')
        .eq('project_id', orderId)
        .in('file_type', ['image', 'video'])
        .order('created_at', { ascending: false })
        .limit(60);
      if (!cancelled) {
        setMedia((data as any[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const urlOf = (p: string) => supabase.storage.from('project-media').getPublicUrl(p).data.publicUrl;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        در حال بارگذاری رسانه‌ها...
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" />
        عکس یا فیلمی برای این سفارش ثبت نشده است
      </div>
    );
  }

  const shown = media.slice(0, visible);
  const images = media.filter((m) => m.file_type === 'image').map((m) => urlOf(m.file_path));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {shown.map((m) => {
          const url = urlOf(m.file_path);
          if (m.file_type === 'video') {
            return (
              <div
                key={m.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border/60"
              >
                {playing[m.id] ? (
                  <video
                    src={url}
                    controls
                    autoPlay
                    playsInline
                    preload="none"
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaying((p) => ({ ...p, [m.id]: true }));
                    }}
                    className="w-full h-full flex items-center justify-center bg-foreground/80 text-background"
                    aria-label="پخش فیلم"
                  >
                    <Play className="h-6 w-6" />
                  </button>
                )}
              </div>
            );
          }
          return (
            <button
              key={m.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomUrl(url);
              }}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border/60"
            >
              <img
                src={url}
                alt="تصویر سفارش"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>

      {visible < media.length && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setVisible((v) => v + pageSize);
          }}
        >
          نمایش رسانه‌های بیشتر ({media.length - visible})
        </Button>
      )}

      <ImageZoomModal
        imageUrl={zoomUrl || ''}
        images={images}
        isOpen={!!zoomUrl}
        onClose={() => setZoomUrl(null)}
      />
    </div>
  );
}
