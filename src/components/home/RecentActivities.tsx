import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Play, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, X, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ahromWatermark from '@/assets/ahrom-watermark.png';

interface ApprovedMedia {
  id: string;
  file_path: string;
  file_type: string;
  title: string | null;
  description: string | null;
  project_name: string | null;
  approved_at: string | null;
}

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
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < media.length - 1) {
      setSelectedIndex(selectedIndex + 1);
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
  
  // Show only first 4 items (1 row) in preview
  const previewMedia = media.slice(0, 4);

  if (loading) {
    return (
      <Card className="border-2 border-blue-500/50 bg-card/30 backdrop-blur-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
            <Play className="h-5 w-5" />
            فعالیت‌های اخیر
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
            فعالیت‌های اخیر
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
            فعالیت‌های اخیر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {previewMedia.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden",
                  "border border-border/50"
                )}
              >
                {isVideoFile(item) ? (
                  <div className="w-full h-full bg-muted relative">
                    <video
                      src={getMediaUrl(item.file_path) + '#t=0.5'}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedData={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.currentTime = 0.5;
                      }}
                    />
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500/80 flex items-center justify-center">
                      <Play className="h-2 w-2 text-white fill-white" />
                    </div>
                    <img
                      src={ahromWatermark}
                      alt=""
                      className="absolute bottom-1 left-1 w-4 h-4 object-contain opacity-35 pointer-events-none"
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
      </Card>

      {/* Full Gallery Dialog */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
              <Play className="h-5 w-5" />
              فعالیت‌های اخیر ({media.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {media.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedIndex(index);
                  setShowGallery(false);
                }}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden group",
                  "transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20",
                  "border border-border/50 hover:border-blue-400/50"
                )}
              >
                {isVideoFile(item) ? (
                  <div className="w-full h-full bg-muted relative">
                    <video
                      src={getMediaUrl(item.file_path) + '#t=0.5'}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedData={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.currentTime = 0.5;
                      }}
                    />
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500/80 flex items-center justify-center">
                      <Play className="h-2.5 w-2.5 text-white fill-white" />
                    </div>
                    <img
                      src={ahromWatermark}
                      alt=""
                      className="absolute bottom-1 left-1 w-5 h-5 object-contain opacity-35 pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted">
                    {imageErrors.has(item.id) ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
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
              </button>
            ))}
          </div>
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

              {/* Navigation Buttons */}
              {selectedIndex !== null && selectedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </Button>
              )}
              {selectedIndex !== null && selectedIndex < media.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </Button>
              )}

              {/* Media counter */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                {(selectedIndex ?? 0) + 1} / {media.length}
              </div>

              {/* Media Content */}
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                {isVideoFile(selectedMedia) ? (
                  <div className="relative max-w-full max-h-[80vh]">
                    <video
                      key={selectedMedia.id}
                      src={getMediaUrl(selectedMedia.file_path)}
                      className="max-w-full max-h-[80vh] object-contain"
                      controls
                      autoPlay
                      playsInline
                      webkit-playsinline="true"
                      controlsList="nodownload noremoteplayback noplaybackrate"
                      disablePictureInPicture
                      disableRemotePlayback
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <img
                      src={ahromWatermark}
                      alt=""
                      className="absolute bottom-12 left-3 w-5 h-5 object-contain opacity-35 pointer-events-none"
                    />
                    {/* Title overlay on video */}
                    {(selectedMedia.title || selectedMedia.description) && (
                      <div className="absolute bottom-14 right-3 text-right pointer-events-none">
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
