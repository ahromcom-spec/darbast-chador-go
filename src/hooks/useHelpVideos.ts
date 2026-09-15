import { useCallback, useEffect, useState } from 'react';
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
}

const HELP_BUCKET = 'help-videos';

/** Resolves a playable URL: storage paths become signed URLs, plain URLs pass through. */
export const resolveHelpVideoUrl = async (video: HelpVideo): Promise<string> => {
  if (video.storage_path) {
    const { data } = await supabase.storage
      .from(HELP_BUCKET)
      .createSignedUrl(video.storage_path, 60 * 60 * 6);
    if (data?.signedUrl) return data.signedUrl;
  }
  return video.video_url;
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
