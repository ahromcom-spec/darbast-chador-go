import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CentralizedVideoPlayerProps {
  src: string;
  filePath?: string; // Path in storage for fetching signed URL
  bucket?: string;
  className?: string;
  onError?: () => void;
  thumbnail?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

// Centralized Video Player component with proper error handling and signed URLs
export const CentralizedVideoPlayer = ({
  src: initialSrc,
  filePath,
  bucket = 'project-media',
  className,
  onError,
  thumbnail,
  showControls = true,
  autoPlay = false,
  muted = false,
  loop = false
}: CentralizedVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(initialSrc);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Fetch signed URL if filePath is provided
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!filePath) {
        setSrc(initialSrc);
        return;
      }
      
      try {
        setIsLoading(true);
        setHasError(false);
        
        // Get signed URL (valid for 1 hour)
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600);
        
        if (error) {
          console.error('Error getting signed URL:', error);
          // Fallback to public URL
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          setSrc(publicData.publicUrl);
        } else if (data?.signedUrl) {
          setSrc(data.signedUrl);
        }
      } catch (err) {
        console.error('Error in fetchSignedUrl:', err);
        // Fallback to provided src
        setSrc(initialSrc);
      }
    };
    
    fetchSignedUrl();
  }, [filePath, bucket, initialSrc, retryCount]);

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
    if (videoRef.current && videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoaded(true);
      setIsLoading(false);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setIsLoaded(true);
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

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
  }, []);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Video load error:', src, e);
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [src, onError]);

  if (hasError) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-black/10 p-4 rounded-lg", className)}>
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground text-center mb-3">خطا در بارگذاری ویدیو</p>
        <div className="flex gap-2">
          <button 
            onClick={handleRetry}
            className="flex items-center gap-1 text-xs text-primary hover:underline px-3 py-2 bg-primary/10 rounded-full"
          >
            <RefreshCw className="h-3 w-3" />
            تلاش مجدد
          </button>
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-muted-foreground hover:underline flex items-center gap-1 px-3 py-2 bg-muted rounded-full"
          >
            <Download className="h-3 w-3" />
            دانلود فایل
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative bg-black group", className)}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => isPlaying && setShowOverlay(false)}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <span className="text-xs text-white/80">در حال بارگذاری ویدیو...</span>
          </div>
        </div>
      )}

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
        onCanPlay={handleCanPlay}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onError={handleError}
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
            disabled={isLoading}
          >
            {!isPlaying && !isLoading && (
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

          {/* Duration Badge - Always visible when loaded */}
          {isLoaded && duration > 0 && (
            <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium z-[5]">
              {formatTime(duration)}
            </div>
          )}

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
                      <Pause className="h-4 w-4" fill="currentColor" />
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

                <div className="flex items-center gap-2">
                  <a 
                    href={src} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-white hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button 
                    onClick={handleFullscreen}
                    className="p-1 text-white hover:text-primary transition-colors"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Hook to get signed URL for media
export const useSignedUrl = (filePath: string | undefined, bucket = 'project-media') => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!filePath) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600); // 1 hour

        if (signedError) {
          // Fallback to public URL
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          setUrl(publicData.publicUrl);
        } else if (data?.signedUrl) {
          setUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setError(err as Error);
        // Fallback to public URL
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        setUrl(publicData.publicUrl);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [filePath, bucket]);

  return { url, loading, error };
};

export default CentralizedVideoPlayer;
