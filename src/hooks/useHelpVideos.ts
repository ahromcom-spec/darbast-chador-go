import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToStorageWithProgress } from '@/lib/mediaTransfers';

export interface HelpVideo {
  id: string;
  context_key: string;
  title: string;
  description: string | null;
  video_url: string;
  storage_path: string | null;
  poster_url: string | null;
  is_active: boolean;
  sort_order: number;
  /** anchor: روی بخش مشخص | floating: هرجای صفحه با مختصات دلخواه */
  placement: 'anchor' | 'floating' | string;
  page_route: string | null;
  pos_x: number | null;
  pos_y: number | null;
  box_size: number;
  /** محل و اندازه مخصوص گوشی موبایل (اگر خالی باشد از مقادیر ویندوز استفاده می‌شود) */
  pos_x_mobile: number | null;
  pos_y_mobile: number | null;
  box_size_mobile: number | null;
  created_at: string;
  updated_at: string;
}

export interface HelpVideoInput {
  context_key: string;
  title: string;
  description?: string | null;
  video_url: string;
  storage_path?: string | null;
  poster_url?: string | null;
  is_active?: boolean;
  placement?: 'anchor' | 'floating';
  page_route?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  box_size?: number;
  pos_x_mobile?: number | null;
  pos_y_mobile?: number | null;
  box_size_mobile?: number | null;
}

const HELP_BUCKET = 'help-videos';

const resolvedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingUrlRequests = new Map<string, Promise<string>>();

/** Resolves a playable URL: storage paths become signed URLs, plain URLs pass through. */
export const resolveHelpVideoUrl = async (video: HelpVideo): Promise<string> => {
  if (!video.storage_path) return video.video_url;

  const cacheKey = `${HELP_BUCKET}/${video.storage_path}`;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const pending = pendingUrlRequests.get(cacheKey);
  if (pending) return pending;

  const request = supabase.storage
    .from(HELP_BUCKET)
    .createSignedUrl(video.storage_path, 60 * 60 * 6)
    .then(({ data, error }) => {
      if (error) throw error;
      const url = data?.signedUrl || video.video_url;
      if (url) {
        resolvedUrlCache.set(cacheKey, {
          url,
          // Refresh shortly before the six-hour signed URL expires.
          expiresAt: Date.now() + 5.5 * 60 * 60 * 1000,
        });
      }
      return url;
    })
    .finally(() => pendingUrlRequests.delete(cacheKey));

  pendingUrlRequests.set(cacheKey, request);
  return request;
};

/** Fetch a single active help video for a given context key. */
export const useHelpVideo = (contextKey: string) => {
  const [video, setVideo] = useState<HelpVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!contextKey) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('help_videos')
          .select('*')
          .eq('context_key', contextKey)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) setVideo((data as HelpVideo) || null);
      } catch (err) {
        console.error('Error loading help video:', err);
        if (!cancelled) setVideo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [contextKey]);

  return { video, loading };
};

/**
 * راهنماهای شناور یک صفحه: با مختصات دلخواه روی همان صفحه نمایش داده می‌شوند.
 */
export const useFloatingHelpVideos = (route: string) => {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedRoute, setLoadedRoute] = useState<string | null>(null);
  const currentRouteRef = useRef(route);
  currentRouteRef.current = route;

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('help_videos')
        .select('*')
        .eq('placement', 'floating')
        .eq('page_route', route)
        .eq('is_active', true);
      if (error) throw error;
      // نتیجه درخواست صفحه قبلی نباید پس از جابه‌جایی روی صفحه جدید ظاهر شود.
      if (currentRouteRef.current === route) {
        setVideos((data as HelpVideo[]) || []);
        setLoadedRoute(route);
      }
    } catch (err) {
      console.error('Error loading floating help videos:', err);
      if (currentRouteRef.current === route) {
        setVideos([]);
        setLoadedRoute(route);
      }
    } finally {
      if (currentRouteRef.current === route) setLoading(false);
    }
  }, [route]);

  useEffect(() => {
    setLoading(true);
    setLoadedRoute(null);
    load();
  }, [load]);

  const isCurrentRouteLoaded = loadedRoute === route;
  return {
    videos: isCurrentRouteLoaded ? videos : [],
    loading: loading || !isCurrentRouteLoaded,
    reload: load,
    setVideos,
  };
};

/** ذخیره محل و اندازه جدید یک راهنمای شناور (به‌صورت جداگانه برای ویندوز و موبایل) */
export const saveHelpVideoPlacement = async (
  id: string,
  pos: { pos_x: number; pos_y: number; box_size?: number },
  device: 'desktop' | 'mobile' = 'desktop'
) => {
  const payload =
    device === 'mobile'
      ? {
          pos_x_mobile: pos.pos_x,
          pos_y_mobile: pos.pos_y,
          ...(pos.box_size ? { box_size_mobile: pos.box_size } : {}),
        }
      : {
          pos_x: pos.pos_x,
          pos_y: pos.pos_y,
          ...(pos.box_size ? { box_size: pos.box_size } : {}),
        };
  const { error } = await supabase.from('help_videos').update(payload).eq('id', id);
  if (error) throw error;
};

/** Full CRUD for the admin management view. */
export const useHelpVideosAdmin = () => {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('help_videos')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setVideos((data as HelpVideo[]) || []);
    } catch (err) {
      console.error('Error loading help videos:', err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const saveVideo = useCallback(
    async (input: HelpVideoInput, id?: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        context_key: input.context_key,
        title: input.title,
        description: input.description ?? null,
        video_url: input.video_url,
        storage_path: input.storage_path ?? null,
        poster_url: input.poster_url ?? null,
        is_active: input.is_active ?? true,
        placement: input.placement ?? 'anchor',
        page_route: input.page_route ?? null,
        pos_x: input.pos_x ?? null,
        pos_y: input.pos_y ?? null,
        box_size: input.box_size ?? 56,
        pos_x_mobile: input.pos_x_mobile ?? null,
        pos_y_mobile: input.pos_y_mobile ?? null,
        box_size_mobile: input.box_size_mobile ?? null,
        created_by: userData?.user?.id ?? null,
      };

      if (id) {
        const { error } = await supabase.from('help_videos').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('help_videos')
          .upsert(payload, { onConflict: 'context_key' });
        if (error) throw error;
      }
      await fetchVideos();
    },
    [fetchVideos]
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean) => {
      const { error } = await supabase
        .from('help_videos')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      await fetchVideos();
    },
    [fetchVideos]
  );

  const deleteVideo = useCallback(
    async (video: HelpVideo) => {
      if (video.storage_path) {
        await supabase.storage.from(HELP_BUCKET).remove([video.storage_path]);
      }
      const { error } = await supabase.from('help_videos').delete().eq('id', video.id);
      if (error) throw error;
      await fetchVideos();
    },
    [fetchVideos]
  );

  const uploadVideoFile = useCallback(
    async (file: File, onProgress?: (percentage: number) => void) => {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `guides/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await uploadToStorageWithProgress({
        bucket: HELP_BUCKET,
        path,
        file,
        label: `فیلم راهنما: ${file.name}`,
        contentType: file.type || 'video/mp4',
        onProgress: (percentage) => onProgress?.(percentage),
      });
      const { data } = await supabase.storage.from(HELP_BUCKET).createSignedUrl(path, 60 * 60 * 6);
      return { storage_path: path, video_url: data?.signedUrl || '' };
    },
    []
  );

  return { videos, loading, fetchVideos, saveVideo, toggleActive, deleteVideo, uploadVideoFile };
};
