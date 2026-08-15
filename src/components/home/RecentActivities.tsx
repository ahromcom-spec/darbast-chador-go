import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Play, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, X, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ahromWatermark from '@/assets/ahrom-watermark-new.png';

interface ApprovedMedia {
  id: string;
  file_path: string;
  file_type: string;
  title: string | null;
  description: string | null;
  project_name: string | null;
  approved_at: string | null;
}

// Infinite Scroll Gallery Component
interface InfiniteScrollGalleryProps {
  media: ApprovedMedia[];
  imageErrors: Set<string>;
  isVideoFile: (item: ApprovedMedia) => boolean;
  getMediaUrl: (filePath: string) => string;
  handleImageError: (id: string) => void;
  onSelectItem: (index: number) => void;
}

const InfiniteScrollGallery: React.FC<InfiniteScrollGalleryProps> = ({
  media,
  imageErrors,
  isVideoFile,
  getMediaUrl,
  handleImageError,
  onSelectItem,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [displayData, setDisplayData] = useState<{ item: ApprovedMedia; originalIndex: number }[]>([]);
  
  // Initialize with 3 copies of data for seamless scrolling
  useEffect(() => {
    if (media.length === 0) return;
    const initialData = [
      ...media.map((item, index) => ({ item, originalIndex: index })),
      ...media.map((item, index) => ({ item, originalIndex: index })),
      ...media.map((item, index) => ({ item, originalIndex: index })),
    ];
    setDisplayData(initialData);
  }, [media]);

  // Handle infinite scroll - append more data when near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || media.length === 0) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // When user scrolls past 70%, add more items
    if (scrollPercentage > 0.7) {
      setDisplayData(prev => [
        ...prev,
        ...media.map((item, index) => ({ item, originalIndex: index })),
      ]);
    }
  }, [media]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="max-h-[70vh] overflow-y-scroll scrollbar-hide"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="grid grid-cols-3 gap-0">
        {displayData.map((data, displayIndex) => (
          <button
            key={`${data.item.id}-${displayIndex}`}
            onClick={() => onSelectItem(data.originalIndex)}
            className={cn(
              "relative aspect-[3/4] overflow-hidden group",
              "transition-opacity duration-200 hover:opacity-90"
            )}
          >
            {isVideoFile(data.item) ? (
              <div className="w-full h-full bg-muted relative">
                <video
                  src={getMediaUrl(data.item.file_path)}
                  className="w-full h-full object-cover"
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="metadata"
                  disableRemotePlayback
                  onLoadedData={(e) => {
                    const video = e.target as HTMLVideoElement;
                    video.muted = true;
                    video.play().catch(() => {});
                  }}
                />

                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500/80 flex items-center justify-center">
                  <Play className="h-2.5 w-2.5 text-white fill-white" />
                </div>
                <img
                  src={ahromWatermark}
                  alt=""
                  className="absolute bottom-1 left-1 w-12 h-12 object-contain opacity-85 pointer-events-none"
                />
              </div>
            ) : (
              <div className="w-full h-full bg-muted">
                {imageErrors.has(data.item.id) ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                ) : (
                  <img
                    src={getMediaUrl(data.item.file_path)}
                    alt={data.item.title || 'تصویر پروژه'}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(data.item.id)}
                    loading="lazy"
                  />
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const RecentActivities: React.FC = () => {
  const [media, setMedia] = useState<ApprovedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  // Swipe handling refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    const fetchApprovedMedia = async () => {
      try {
        const { data, error } = await supabase
          .from('approved_media')
          .select('id, file_path, file_type, title, description, project_name, approved_at')
          .eq('status', 'approved')
          .eq('is_visible', true)
          .order('display_order', { ascending: true })
          .order('approved_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setMedia(data || []);
      } catch (error) {
        console.error('Error fetching approved media:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedMedia();
  }, []);

  const getMediaUrl = (filePath: string) => {
    if (filePath.startsWith('http')) return filePath;
    const { data } = supabase.storage.from('project-media').getPublicUrl(filePath);
    return data?.publicUrl || filePath;
  };

  // Determine if a file is a video based on extension or file_type
  const isVideoFile = (item: ApprovedMedia) => {
    if (item.file_type === 'video') return true;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => item.file_path.toLowerCase().endsWith(ext));
  };

  const handleImageError = (id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  };

  const handlePrev = useCallback(() => {
    if (selectedIndex !== null && media.length > 0) {
      // چرخش بی‌نهایت - اگر اول بود به آخر برود
      setSelectedIndex(selectedIndex === 0 ? media.length - 1 : selectedIndex - 1);
    }
  }, [selectedIndex, media.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && media.length > 0) {
      // چرخش بی‌نهایت - اگر آخر بود به اول برود
      setSelectedIndex(selectedIndex === media.length - 1 ? 0 : selectedIndex + 1);
    }
  }, [selectedIndex, media.length]);

  // Touch event handlers for swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left = next (in RTL)
      handlePrev();
    }
    if (isRightSwipe) {
      // Swipe right = prev (in RTL)
      handleNext();
    }
  }, [handlePrev, handleNext]);

  const selectedMedia = selectedIndex !== null ? media[selectedIndex] : null;
  
  // Show 2 rows × 3 items in preview
  const previewMedia = media.slice(0, 6);

  if (loading) {
    return (
      <Card className="border-2 border-blue-500/50 bg-card/30 backdrop-blur-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
            <Play className="h-5 w-5" />
            فعالیت‌های اخیر اهرم
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  if (media.length === 0) {
    return (
      <Card className="border-2 border-blue-500/50 bg-card/30 backdrop-blur-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
            <Play className="h-5 w-5" />
            فعالیت‌های اخیر اهرم
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">هنوز رسانه‌ای تایید نشده است</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Preview Card - Click to open gallery */}
      <Card 
        className="border-2 border-blue-500/50 bg-card/30 backdrop-blur-lg shadow-lg shadow-blue-500/10 cursor-pointer hover:border-blue-400/70 transition-colors"
        onClick={() => setShowGallery(true)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
            <Play className="h-5 w-5" />
            فعالیت‌های اخیر اهرم
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="grid grid-cols-3 gap-0 overflow-hidden rounded-lg">
            {previewMedia.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative aspect-[3/4] overflow-hidden"
                )}
              >
                {isVideoFile(item) ? (
                  <div className="w-full h-full bg-muted relative">
                    <video
                      src={getMediaUrl(item.file_path)}
                      className="w-full h-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                      preload="metadata"
                      disableRemotePlayback
                      onLoadedData={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.muted = true;
                        video.play().catch(() => {});
                      }}
                    />

                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500/80 flex items-center justify-center">
                      <Play className="h-2 w-2 text-white fill-white" />
                    </div>
                    <img
                      src={ahromWatermark}
                      alt=""
                      className="absolute bottom-1 left-1 w-10 h-10 object-contain opacity-85 pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted">
                    {imageErrors.has(item.id) ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    ) : (
                      <img
                        src={getMediaUrl(item.file_path)}
                        alt={item.title || 'تصویر پروژه'}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(item.id)}
                        loading="lazy"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>

        {/* View more hint - glowing to indicate the card is clickable */}
        <div className="px-4 pb-3 pt-0">
          <div className="flex items-center justify-center gap-1.5 text-sm text-blue-500 animate-pulse">
            <ChevronLeft className="h-4 w-4" />
            <span className="font-medium">مشاهده فعالیت‌های بیشتر</span>
          </div>
        </div>
      </Card>

      {/* Full Gallery Dialog with Infinite Scroll */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
              <Play className="h-5 w-5" />
              فعالیت‌های اخیر اهرم
            </h2>
          </div>
          <InfiniteScrollGallery
            media={media}
            imageErrors={imageErrors}
            isVideoFile={isVideoFile}
            getMediaUrl={getMediaUrl}
            handleImageError={handleImageError}
            onSelectItem={(index) => {
              setSelectedIndex(index);
              setShowGallery(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Media Viewer Dialog with Swipe Support */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          {selectedMedia && (
            <div 
              className="relative"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/70"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="h-5 w-5 text-white" />
              </Button>

              {/* Back to gallery button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 left-2 z-20 bg-black/50 hover:bg-black/70 text-white text-xs"
                onClick={() => {
                  setSelectedIndex(null);
                  setShowGallery(true);
                }}
              >
                <Grid3X3 className="h-4 w-4 ml-1" />
                گالری
              </Button>

              {/* Navigation Buttons - همیشه نمایش داده شوند برای چرخش بی‌نهایت */}
              {media.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </Button>
              )}
              {media.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </Button>
              )}

              {/* Media Content */}
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                {isVideoFile(selectedMedia) ? (
                  <div
                    ref={videoWrapperRef}
                    className={cn(
                      "relative flex items-center justify-center bg-black",
                      isVideoFullscreen ? "w-screen h-screen" : "max-w-full max-h-[80vh]"
                    )}
                  >
                    <video
                      key={selectedMedia.id}
                      src={getMediaUrl(selectedMedia.file_path)}
                      className={cn(
                        "object-contain",
                        isVideoFullscreen ? "w-full h-full" : "max-w-full max-h-[80vh]"
                      )}
                      controls
                      autoPlay
                      playsInline
                      webkit-playsinline="true"
                      controlsList="nodownload noremoteplayback noplaybackrate nofullscreen"
                      disablePictureInPicture
                      disableRemotePlayback
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    {/* Custom fullscreen toggle (keeps logo/title overlays visible) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-black/50 hover:bg-black/70"
                      onClick={toggleVideoFullscreen}
                    >
                      {isVideoFullscreen ? (
                        <Minimize2 className="h-5 w-5 text-white" />
                      ) : (
                        <Maximize2 className="h-5 w-5 text-white" />
                      )}
                    </Button>
                    <img
                      src={ahromWatermark}
                      alt=""
                      className="absolute bottom-12 left-3 w-12 h-12 object-contain opacity-85 pointer-events-none z-20"
                    />
                    {/* Title overlay on video */}
                    {(selectedMedia.title || selectedMedia.description) && (
                      <div className="absolute bottom-14 right-3 text-right pointer-events-none z-20">
                        {selectedMedia.title && (
                          <p className="text-white text-sm font-medium drop-shadow-lg bg-black/40 px-2 py-0.5 rounded">
                            {selectedMedia.title}
                          </p>
                        )}
                        {selectedMedia.description && (
                          <p className="text-white/80 text-xs drop-shadow-lg bg-black/40 px-2 py-0.5 rounded mt-1">
                            {selectedMedia.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative max-w-full max-h-[80vh]">
                    <img
                      src={getMediaUrl(selectedMedia.file_path)}
                      alt={selectedMedia.title || 'تصویر'}
                      className="max-w-full max-h-[80vh] object-contain"
                    />
                    {/* Title overlay on image */}
                    {(selectedMedia.title || selectedMedia.description) && (
                      <div className="absolute bottom-3 right-3 text-right pointer-events-none">
                        {selectedMedia.title && (
                          <p className="text-white text-sm font-medium drop-shadow-lg bg-black/40 px-2 py-0.5 rounded">
                            {selectedMedia.title}
                          </p>
                        )}
                        {selectedMedia.description && (
                          <p className="text-white/80 text-xs drop-shadow-lg bg-black/40 px-2 py-0.5 rounded mt-1">
                            {selectedMedia.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
