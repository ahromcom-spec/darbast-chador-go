import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, X, ZoomIn, Download, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaItem {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  url?: string;
}

interface MediaGalleryProps {
  media: MediaItem[];
  showUploadButtons?: boolean;
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingMedia?: boolean;
  emptyMessage?: string;
  className?: string;
  bucket?: string;
  layout?: 'grid' | 'slider';
}

// Helper function to check if media is video
const isMediaVideo = (media: MediaItem): boolean => {
  return media.file_type === 'video' || 
         media.file_type?.includes('video') || 
         media.mime_type?.includes('video') ||
         media.file_path?.toLowerCase().endsWith('.mp4') ||
         media.file_path?.toLowerCase().endsWith('.webm') ||
         media.file_path?.toLowerCase().endsWith('.mov') ||
         media.file_path?.toLowerCase().endsWith('.avi');
};

// Helper function to get video MIME type
const getVideoMimeType = (media: MediaItem): string => {
  if (media.mime_type) return media.mime_type;
  const path = media.file_path?.toLowerCase() || '';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.avi')) return 'video/x-msvideo';
  return 'video/mp4';
};

// Video Player component with proper controls and error handling
const VideoPlayer = ({ 
  src, 
  className, 
  onError, 
  thumbnail, 
  showControls = true,
  autoPlay = false,
  muted = false,
  loop = false 
}: { 
  src: string; 
  className?: string; 
  onError?: () => void;
  thumbnail?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
          setHasError(true);
        });
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoaded(true);
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * videoRef.current.duration;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen().catch(err => {
          console.error('Fullscreen error:', err);
        });
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasError) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-black/10 p-4", className)}>
        <Play className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">خطا در بارگذاری ویدیو</p>
        <a 
          href={src} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-primary hover:underline mt-2 flex items-center gap-1"
        >
          <Download className="h-3 w-3" />
          دانلود فایل
        </a>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative bg-black group", className)}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => isPlaying && setShowOverlay(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
        muted={isMuted}
        loop={loop}
        autoPlay={autoPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => {
          console.error('Video load error:', src);
          setHasError(true);
          onError?.();
        }}
      >
        مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
      </video>

      {/* Video Controls Overlay */}
      {showControls && (
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            showOverlay || !isPlaying ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Play/Pause Button Center */}
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center"
          >
            {!isPlaying && (
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground shadow-lg hover:scale-110 transition-transform">
                <Play className="h-8 w-8 ml-1" fill="currentColor" />
              </div>
            )}
          </button>

          {/* Video Badge */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Play className="h-3 w-3" fill="currentColor" />
            ویدیو
          </div>

          {/* Bottom Controls */}
          {isLoaded && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              {/* Progress Bar */}
              <div 
                className="h-1.5 bg-white/30 rounded-full cursor-pointer mb-2 overflow-hidden"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePlayPause}
                    className="p-1 text-white hover:text-primary transition-colors"
                  >
                    {isPlaying ? (
                      <div className="flex gap-0.5">
                        <div className="w-1 h-4 bg-white rounded" />
                        <div className="w-1 h-4 bg-white rounded" />
                      </div>
                    ) : (
                      <Play className="h-4 w-4" fill="currentColor" />
                    )}
                  </button>

                  <button 
                    onClick={toggleMute}
                    className="p-1 text-white hover:text-primary transition-colors"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>

                  <span className="text-xs text-white/80">
                    {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
                  </span>
                </div>

                <button 
                  onClick={handleFullscreen}
                  className="p-1 text-white hover:text-primary transition-colors"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Media Gallery Component
export const MediaGallery = ({
  media,
  showUploadButtons = false,
  onImageUpload,
  onVideoUpload,
  uploadingMedia = false,
  emptyMessage = "هنوز تصویر یا ویدیویی ثبت نشده است",
  className,
  bucket = 'project-media',
  layout = 'grid'
}: MediaGalleryProps) => {
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreenMedia, setFullscreenMedia] = useState<MediaItem | null>(null);

  // Fetch signed URLs for all media
  useEffect(() => {
    const fetchUrls = async () => {
      if (!media || media.length === 0) {
        setLoading(false);
        return;
      }

      const urls: Record<string, string> = {};
      
      for (const item of media) {
        try {
          // If URL is already provided, use it
          if (item.url) {
            urls[item.id] = item.url;
            continue;
          }

          // Try to get signed URL first (works better for videos)
          const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(item.file_path, 3600); // 1 hour validity
          
          if (signedData?.signedUrl && !signedError) {
            urls[item.id] = signedData.signedUrl;
          } else {
            // Fallback to public URL
            const { data } = supabase.storage.from(bucket).getPublicUrl(item.file_path);
            urls[item.id] = data.publicUrl;
          }
        } catch (err) {
          console.error('Error getting URL for', item.file_path, err);
          // Fallback to public URL
          const { data } = supabase.storage.from(bucket).getPublicUrl(item.file_path);
          urls[item.id] = data.publicUrl;
        }
      }
      
      setMediaUrls(urls);
      setLoading(false);
    };
    
    fetchUrls();
  }, [media, bucket]);

  const getMediaUrl = (item: MediaItem) => {
    return item.url || mediaUrls[item.id] || '';
  };

  if (loading) {
    return (
      <div className={cn("flex justify-center p-4", className)}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!media || media.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg", className)}>
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {emptyMessage}
      </div>
    );
  }

  // Grid Layout
  if (layout === 'grid') {
    return (
      <>
        <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", className)}>
          {media.map((item) => {
            const url = getMediaUrl(item);
            const isVideo = isMediaVideo(item);
            
            return (
              <div 
                key={item.id} 
                className="relative aspect-video rounded-lg overflow-hidden border bg-black/5 group cursor-pointer"
                onClick={() => setFullscreenMedia(item)}
              >
                {isVideo ? (
                  <VideoPlayer
                    src={url}
                    className="w-full h-full"
                    showControls={false}
                    muted
                  />
                ) : (
                  <>
                    <img
                      src={url}
                      alt="تصویر"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Fullscreen Modal */}
        <Dialog open={!!fullscreenMedia} onOpenChange={() => setFullscreenMedia(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>نمایش مدیا</DialogTitle>
            </DialogHeader>
            <div className="relative bg-black min-h-[300px] flex items-center justify-center">
              <button
                onClick={() => setFullscreenMedia(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              {fullscreenMedia && isMediaVideo(fullscreenMedia) ? (
                <VideoPlayer
                  src={getMediaUrl(fullscreenMedia)}
                  className="w-full max-h-[80vh]"
                  showControls
                  autoPlay
                />
              ) : fullscreenMedia && (
                <img
                  src={getMediaUrl(fullscreenMedia)}
                  alt="تصویر بزرگ"
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Slider Layout
  const currentMedia = media[currentIndex];
  const isCurrentVideo = isMediaVideo(currentMedia);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs text-muted-foreground flex items-center gap-2">
        <ImageIcon className="h-3 w-3" />
        تصاویر و ویدیوها ({media.length})
      </Label>
      
      <div className="relative bg-black/5 rounded-lg overflow-hidden">
        {isCurrentVideo ? (
          <VideoPlayer
            src={getMediaUrl(currentMedia)}
            className="w-full max-h-64"
            showControls
          />
        ) : (
          <img
            src={getMediaUrl(currentMedia)}
            alt={`تصویر ${currentIndex + 1}`}
            className="w-full max-h-64 object-contain cursor-pointer"
            onClick={() => setFullscreenMedia(currentMedia)}
          />
        )}
        
        {media.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80"
              onClick={() => setCurrentIndex(i => (i + 1) % media.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80"
              onClick={() => setCurrentIndex(i => (i - 1 + media.length) % media.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-xs">
              {currentIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {media.map((item, idx) => {
            const isVideo = isMediaVideo(item);
            return (
              <button
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all",
                  idx === currentIndex 
                    ? "border-primary ring-2 ring-primary/30" 
                    : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                {isVideo ? (
                  <div className="w-full h-full bg-black/20 flex items-center justify-center">
                    <Play className="h-4 w-4 text-primary" fill="currentColor" />
                  </div>
                ) : (
                  <img
                    src={getMediaUrl(item)}
                    alt={`تصویر ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Fullscreen Modal */}
      <Dialog open={!!fullscreenMedia} onOpenChange={() => setFullscreenMedia(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>نمایش مدیا</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black min-h-[300px] flex items-center justify-center">
            <button
              onClick={() => setFullscreenMedia(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            {fullscreenMedia && isMediaVideo(fullscreenMedia) ? (
              <VideoPlayer
                src={getMediaUrl(fullscreenMedia)}
                className="w-full max-h-[80vh]"
                showControls
                autoPlay
              />
            ) : fullscreenMedia && (
              <img
                src={getMediaUrl(fullscreenMedia)}
                alt="تصویر بزرگ"
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Standalone hook for fetching media with URLs
export const useMediaWithUrls = (orderId: string, bucket: string = 'project-media') => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedia = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('project_media')
          .select('id, file_path, file_type, mime_type')
          .eq('project_id', orderId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;

        // Fetch URLs for all media
        const mediaWithUrls: MediaItem[] = [];
        for (const item of data || []) {
          try {
            const { data: signedData, error: signedError } = await supabase.storage
              .from(bucket)
              .createSignedUrl(item.file_path, 3600);
            
            if (signedData?.signedUrl && !signedError) {
              mediaWithUrls.push({ ...item, url: signedData.signedUrl });
            } else {
              const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(item.file_path);
              mediaWithUrls.push({ ...item, url: publicData.publicUrl });
            }
          } catch {
            const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(item.file_path);
            mediaWithUrls.push({ ...item, url: publicData.publicUrl });
          }
        }
        
        setMedia(mediaWithUrls);
      } catch (err) {
        console.error('Error fetching media:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMedia();
  }, [orderId, bucket]);

  return { media, loading };
};

export default MediaGallery;
