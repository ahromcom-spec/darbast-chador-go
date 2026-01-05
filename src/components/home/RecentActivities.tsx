import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Play, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

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
          .limit(12);

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

  const handleImageError = (id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  };

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < media.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const selectedMedia = selectedIndex !== null ? media[selectedIndex] : null;

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
      <Card className="border-2 border-blue-500/50 bg-card/30 backdrop-blur-lg shadow-lg shadow-blue-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
            <Play className="h-5 w-5" />
            فعالیت‌های اخیر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {media.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden group",
                  "transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20",
                  "border border-border/50 hover:border-blue-400/50"
                )}
              >
                {item.file_type === 'video' ? (
                  <>
                    {/* Use poster image or thumbnail for video preview on mobile */}
                    <div className="w-full h-full bg-muted relative">
                      <video
                        src={getMediaUrl(item.file_path) + '#t=0.5'}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedData={(e) => {
                          // Ensure video shows first frame
                          const video = e.target as HTMLVideoElement;
                          video.currentTime = 0.5;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-blue-500/80 flex items-center justify-center">
                          <Play className="h-5 w-5 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {imageErrors.has(item.id) ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
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
                  </>
                )}
                
                {/* Title overlay */}
                {(item.title || item.project_name) && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{item.title || item.project_name}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Media Viewer Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          {selectedMedia && (
            <div className="relative">
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

              {/* Media Content */}
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                {selectedMedia.file_type === 'video' ? (
                  <video
                    key={selectedMedia.id}
                    src={getMediaUrl(selectedMedia.file_path)}
                    className="max-w-full max-h-[80vh] object-contain"
                    controls
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    controlsList="nodownload"
                  />
                ) : (
                  <img
                    src={getMediaUrl(selectedMedia.file_path)}
                    alt={selectedMedia.title || 'تصویر'}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )}
              </div>

              {/* Title and Description */}
              {(selectedMedia.title || selectedMedia.description) && (
                <div className="p-4 bg-card">
                  {selectedMedia.title && (
                    <h3 className="text-lg font-semibold">{selectedMedia.title}</h3>
                  )}
                  {selectedMedia.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedMedia.description}</p>
                  )}
                  {selectedMedia.project_name && (
                    <p className="text-xs text-muted-foreground mt-2">پروژه: {selectedMedia.project_name}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
