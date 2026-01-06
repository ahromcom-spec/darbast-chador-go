import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Volume2, 
  VolumeX, 
  Music, 
  Upload, 
  Loader2, 
  Play, 
  Pause,
  Download,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoAudioEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  onSave?: (editedVideoBlob: Blob) => void;
}

type ProcessingStatus = 'idle' | 'loading-ffmpeg' | 'processing' | 'complete' | 'error';

const VideoAudioEditor: React.FC<VideoAudioEditorProps> = ({
  open,
  onOpenChange,
  videoUrl,
  onSave
}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<any>(null);
  const ffmpegLoadPromiseRef = useRef<Promise<boolean> | null>(null);

  const [originalVolume, setOriginalVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(80);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [logMessage, setLogMessage] = useState('');

  // Load FFmpeg on mount - using single-threaded core for maximum browser compatibility
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded) return true;

    // Prevent multiple concurrent loads (can cause "stuck" overlays)
    if (ffmpegLoadPromiseRef.current) return ffmpegLoadPromiseRef.current;

    const promise = (async () => {
      setStatus('loading-ffmpeg');
      setLogMessage('در حال بارگذاری ابزار پردازش...');

      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');

        // Load core assets from installed package (bundled by Vite, no CDN)
        const [{ default: coreJsUrlRaw }, { default: coreWasmUrlRaw }] = await Promise.all([
          import('@ffmpeg/core?url'),
          import('@ffmpeg/core/wasm?url'),
        ]);

        const coreURL = new URL(coreJsUrlRaw, window.location.origin).toString();
        const wasmURL = new URL(coreWasmUrlRaw, window.location.origin).toString();

        console.log('[FFmpeg] assets', { coreURL, wasmURL });

        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('log', ({ message }: { message: string }) => {
          setLogMessage(message);
          console.log('[FFmpeg]', message);
        });

        ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
          setProgress(Math.round(p * 100));
        });

        // If loading hangs (mobile/network), fail gracefully so the dialog doesn't get "stuck"
        const LOAD_TIMEOUT_MS = 25000;
        await Promise.race([
          ffmpeg.load({ coreURL, wasmURL }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS),
          ),
        ]);

        setFfmpegLoaded(true);
        setStatus('idle');
        setLogMessage('');
        return true;
      } catch (error) {
        console.error('Error loading FFmpeg:', error);
        const msg = error instanceof Error ? error.message : String(error);
        const friendly = msg === 'timeout'
          ? 'بارگذاری ابزار پردازش بیش از حد طول کشید. اینترنت/فیلترشکن را بررسی کنید و دوباره تلاش کنید.'
          : `خطا در بارگذاری ابزار پردازش (FFmpeg): ${msg}`;

        setStatus('error');
        setLogMessage(friendly);
        toast({
          title: 'خطا',
          description: 'امکان بارگذاری ابزار پردازش ویدیو وجود ندارد.',
          variant: 'destructive',
        });
        return false;
      } finally {
        ffmpegLoadPromiseRef.current = null;
      }
    })();

    ffmpegLoadPromiseRef.current = promise;
    return promise;
  }, [ffmpegLoaded, toast]);

  useEffect(() => {
    if (open && !ffmpegLoaded) {
      loadFFmpeg();
    }
  }, [open, ffmpegLoaded, loadFFmpeg]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (musicUrl) URL.revokeObjectURL(musicUrl);
      if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
    };
  }, [musicUrl, editedVideoUrl]);

  const handleMusicSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'خطا',
          description: 'لطفاً یک فایل صوتی انتخاب کنید',
          variant: 'destructive'
        });
        return;
      }
      
      if (musicUrl) URL.revokeObjectURL(musicUrl);
      
      setMusicFile(file);
      setMusicUrl(URL.createObjectURL(file));
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const processVideo = async () => {
    if (!ffmpegRef.current || !ffmpegLoaded) {
      const loaded = await loadFFmpeg();
      if (!loaded) return;
    }

    setStatus('processing');
    setProgress(0);
    setLogMessage('در حال آماده‌سازی ویدیو...');

    try {
      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = await import('@ffmpeg/util');

      // Fetch and write original video
      setLogMessage('در حال دانلود ویدیو...');
      const videoData = await fetchFile(videoUrl);
      await ffmpeg.writeFile('input.mp4', videoData);

      const originalVolumeValue = originalVolume / 100;
      const musicVolumeValue = musicVolume / 100;

      let command: string[] = [];
      let musicInputName: string | null = null;

      if (musicFile) {
        // User wants to add background music
        setLogMessage('در حال بارگذاری موسیقی...');

        const ext = musicFile.name.split('.').pop()?.toLowerCase();
        const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : 'mp3';
        musicInputName = `music.${safeExt}`;

        // IMPORTANT: pass File directly (more reliable than blob URL fetching on some mobiles)
        const musicData = await fetchFile(musicFile);
        await ffmpeg.writeFile(musicInputName, musicData);

        if (originalVolume === 0) {
          // Mute original and add music only
          command = [
            '-i', 'input.mp4',
            '-i', musicInputName,
            '-filter_complex',
            `[1:a]volume=${musicVolumeValue}[music];[music]apad[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4',
          ];
        } else {
          // Mix original audio with music
          command = [
            '-i', 'input.mp4',
            '-i', musicInputName,
            '-filter_complex',
            `[0:a]volume=${originalVolumeValue}[orig];[1:a]volume=${musicVolumeValue}[music];[orig][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            'output.mp4',
          ];
        }
      } else {
        // Just adjust original audio volume
        if (originalVolume === 0) {
          // Mute completely
          command = ['-i', 'input.mp4', '-an', '-c:v', 'copy', 'output.mp4'];
        } else {
          // Adjust volume
          command = [
            '-i', 'input.mp4',
            '-filter:a', `volume=${originalVolumeValue}`,
            '-c:v', 'copy',
            '-c:a', 'aac',
            'output.mp4',
          ];
        }
      }

      setLogMessage('در حال پردازش...');
      await ffmpeg.exec(command);

      // Read the output
      setLogMessage('در حال آماده‌سازی خروجی...');
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      
      if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
      
      const url = URL.createObjectURL(blob);
      setEditedVideoUrl(url);
      setEditedBlob(blob);
      setStatus('complete');
      setLogMessage('پردازش با موفقیت انجام شد');
      
      toast({
        title: 'موفق',
        description: 'ویدیو با موفقیت پردازش شد'
      });
      
      // Cleanup temp files
      try {
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output.mp4');
        if (musicInputName) await ffmpeg.deleteFile(musicInputName);
      } catch (e) {
        // Ignore cleanup errors
      }
      
    } catch (error: any) {
      console.error('Error processing video:', error);
      setStatus('error');
      setLogMessage(`خطا: ${error.message || 'خطا در پردازش ویدیو'}`);
      toast({
        title: 'خطا',
        description: 'خطا در پردازش ویدیو',
        variant: 'destructive'
      });
    }
  };

  const handleSave = () => {
    if (editedBlob && onSave) {
      onSave(editedBlob);
      onOpenChange(false);
    }
  };

  const handleDownload = () => {
    if (!editedVideoUrl) return;
    
    const a = document.createElement('a');
    a.href = editedVideoUrl;
    a.download = `edited-video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetEditor = () => {
    setOriginalVolume(100);
    setMusicVolume(80);
    setMusicFile(null);
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(null);
    if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
    setEditedVideoUrl(null);
    setEditedBlob(null);
    setStatus('idle');
    setProgress(0);
    setLogMessage('');
    
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const isProcessing = status === 'loading-ffmpeg' || status === 'processing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            ویرایش صدای ویدیو
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Video Preview */}
          <div className="space-y-2">
            <Label>ویدیو اصلی</Label>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                playsInline
                onEnded={() => setIsPlaying(false)}
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-2 left-2"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Original Audio Volume */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                {originalVolume === 0 ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                صدای اصلی ویدیو
              </Label>
              <Badge variant="outline">{originalVolume}%</Badge>
            </div>
            <Slider
              value={[originalVolume]}
              onValueChange={([v]) => setOriginalVolume(v)}
              max={100}
              step={5}
              disabled={isProcessing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              برای حذف کامل صدای اصلی، مقدار را روی صفر قرار دهید
            </p>
          </div>

          {/* Background Music Section */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                افزودن موسیقی پس‌زمینه
              </Label>
              {musicFile && (
                <Badge className="gap-1">
                  <Check className="h-3 w-3" />
                  {musicFile.name.length > 20 
                    ? `${musicFile.name.slice(0, 20)}...` 
                    : musicFile.name}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleMusicSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => audioInputRef.current?.click()}
                disabled={isProcessing}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                انتخاب فایل صوتی
              </Button>
              {musicFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setMusicFile(null);
                    if (musicUrl) URL.revokeObjectURL(musicUrl);
                    setMusicUrl(null);
                    if (audioInputRef.current) audioInputRef.current.value = '';
                  }}
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {musicFile && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">صدای موسیقی</Label>
                  <Badge variant="outline">{musicVolume}%</Badge>
                </div>
                <Slider
                  value={[musicVolume]}
                  onValueChange={([v]) => setMusicVolume(v)}
                  max={150}
                  step={5}
                  disabled={isProcessing}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Processing Status */}
          {(status === 'loading-ffmpeg' || status === 'processing') && (
            <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{status === 'loading-ffmpeg' ? 'در حال بارگذاری ابزار پردازش...' : 'در حال پردازش ویدیو...'}</span>
              </div>
              <Progress value={progress} className="h-2" />
              {logMessage && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {logMessage}
                </p>
              )}
            </div>
          )}

          {/* Error Status */}
          {status === 'error' && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{logMessage || 'خطا در پردازش ویدیو'}</span>
            </div>
          )}

          {/* Edited Video Preview */}
          {status === 'complete' && editedVideoUrl && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                ویدیو ویرایش شده
              </Label>
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border-2 border-green-500/30">
                <video
                  ref={previewVideoRef}
                  src={editedVideoUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              resetEditor();
              onOpenChange(false);
            }}
          >
            بستن
          </Button>

          <Button variant="outline" onClick={resetEditor} disabled={isProcessing}>
            <RotateCcw className="h-4 w-4 ml-2" />
            بازنشانی
          </Button>

          {status !== 'complete' && (
            <Button
              onClick={processVideo}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              پردازش ویدیو
            </Button>
          )}

          {status === 'complete' && (
            <>
              <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                دانلود
              </Button>
              {onSave && (
                <Button onClick={handleSave} className="gap-2">
                  <Check className="h-4 w-4" />
                  ذخیره و جایگزینی
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoAudioEditor;
