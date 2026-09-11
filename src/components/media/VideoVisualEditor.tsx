import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Wand2,
  Loader2,
  Download,
  RotateCcw,
  RotateCw,
  Check,
  AlertCircle,
  Crop,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoVisualEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  onSave?: (editedVideoBlob: Blob) => void;
}

type ProcessingStatus = 'idle' | 'loading-ffmpeg' | 'processing' | 'complete' | 'error';

type SizePresetKey = 'original' | '16:9' | '9:16' | '1:1' | '4:5';

const SIZE_PRESETS: Record<SizePresetKey, { label: string; w?: number; h?: number }> = {
  original: { label: 'اندازه اصلی' },
  '16:9': { label: 'افقی ۱۶:۹', w: 1280, h: 720 },
  '9:16': { label: 'عمودی ۹:۱۶', w: 720, h: 1280 },
  '1:1': { label: 'مربع ۱:۱', w: 720, h: 720 },
  '4:5': { label: 'اینستاگرام ۴:۵', w: 864, h: 1080 },
};

type FilterPresetKey = 'none' | 'warm' | 'cool' | 'bw' | 'vivid' | 'vintage';

const FILTER_PRESETS: Record<FilterPresetKey, { label: string; filter?: string }> = {
  none: { label: 'بدون افکت' },
  vivid: { label: 'زنده و شارپ', filter: 'eq=saturation=1.45:contrast=1.15,unsharp=5:5:0.8' },
  warm: { label: 'گرم', filter: 'colorbalance=rs=0.12:gs=0.02:bs=-0.10,eq=saturation=1.15' },
  cool: { label: 'سرد', filter: 'colorbalance=rs=-0.10:gs=0.0:bs=0.14,eq=saturation=1.05' },
  bw: { label: 'سیاه و سفید', filter: 'hue=s=0,eq=contrast=1.2' },
  vintage: { label: 'قدیمی', filter: 'curves=vintage,eq=saturation=0.85' },
};

const VideoVisualEditor: React.FC<VideoVisualEditorProps> = ({
  open,
  onOpenChange,
  videoUrl,
  onSave,
}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<any>(null);
  const ffmpegLoadPromiseRef = useRef<Promise<boolean> | null>(null);

  const [sizePreset, setSizePreset] = useState<SizePresetKey>('original');
  const [filterPreset, setFilterPreset] = useState<FilterPresetKey>('none');
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [zoom, setZoom] = useState(100); // 100 - 200
  const [brightness, setBrightness] = useState(0); // -50 .. 50  => -0.5 .. 0.5
  const [contrast, setContrast] = useState(100); // 50 .. 200 => 0.5 .. 2
  const [saturation, setSaturation] = useState(100);
  const [speed, setSpeed] = useState(100); // 50 .. 200
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');

  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [logMessage, setLogMessage] = useState('');

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded) return true;
    if (ffmpegLoadPromiseRef.current) return ffmpegLoadPromiseRef.current;

    const promise = (async () => {
      setStatus('loading-ffmpeg');
      setLogMessage('در حال بارگذاری ابزار پردازش...');
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const [{ default: coreJsUrlRaw }, { default: coreWasmUrlRaw }] = await Promise.all([
          import('@ffmpeg/core?url'),
          import('@ffmpeg/core/wasm?url'),
        ]);
        const coreURL = new URL(coreJsUrlRaw, window.location.origin).toString();
        const wasmURL = new URL(coreWasmUrlRaw, window.location.origin).toString();

        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        ffmpeg.on('log', ({ message }: { message: string }) => setLogMessage(message));
        ffmpeg.on('progress', ({ progress: p }: { progress: number }) =>
          setProgress(Math.min(100, Math.round(p * 100))),
        );

        await Promise.race([
          ffmpeg.load({ coreURL, wasmURL }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000)),
        ]);

        setFfmpegLoaded(true);
        setStatus('idle');
        setLogMessage('');
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setStatus('error');
        setLogMessage(
          msg === 'timeout'
            ? 'بارگذاری ابزار پردازش بیش از حد طول کشید. اینترنت را بررسی کنید و دوباره تلاش کنید.'
            : `خطا در بارگذاری ابزار پردازش: ${msg}`,
        );
        return false;
      } finally {
        ffmpegLoadPromiseRef.current = null;
      }
    })();

    ffmpegLoadPromiseRef.current = promise;
    return promise;
  }, [ffmpegLoaded]);

  useEffect(() => {
    if (open && !ffmpegLoaded) loadFFmpeg();
  }, [open, ffmpegLoaded, loadFFmpeg]);

  useEffect(() => {
    return () => {
      if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
    };
  }, [editedVideoUrl]);

  // Live CSS preview of the visual changes
  const previewStyle: React.CSSProperties = {
    filter: [
      `brightness(${1 + brightness / 100})`,
      `contrast(${contrast / 100})`,
      `saturate(${filterPreset === 'bw' ? 0 : saturation / 100})`,
      filterPreset === 'vintage' ? 'sepia(0.35)' : '',
    ]
      .filter(Boolean)
      .join(' '),
    transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
  };

  const buildVideoFilters = (): string[] => {
    const chain: string[] = [];

    if (rotation === 90) chain.push('transpose=1');
    else if (rotation === 180) chain.push('transpose=1,transpose=1');
    else if (rotation === 270) chain.push('transpose=2');

    if (zoom > 100) {
      const f = (zoom / 100).toFixed(3);
      chain.push(`scale=iw*${f}:ih*${f}`);
      chain.push('crop=iw/' + f + ':ih/' + f);
    }

    const preset = SIZE_PRESETS[sizePreset];
    if (preset.w && preset.h) {
      // Fill target frame, crop overflow (no black bars)
      chain.push(
        `scale=${preset.w}:${preset.h}:force_original_aspect_ratio=increase`,
        `crop=${preset.w}:${preset.h}`,
      );
    }

    const eqParts: string[] = [];
    if (brightness !== 0) eqParts.push(`brightness=${(brightness / 100).toFixed(2)}`);
    if (contrast !== 100) eqParts.push(`contrast=${(contrast / 100).toFixed(2)}`);
    if (saturation !== 100) eqParts.push(`saturation=${(saturation / 100).toFixed(2)}`);
    if (eqParts.length) chain.push(`eq=${eqParts.join(':')}`);

    const presetFilter = FILTER_PRESETS[filterPreset].filter;
    if (presetFilter) chain.push(presetFilter);

    if (speed !== 100) chain.push(`setpts=${(100 / speed).toFixed(4)}*PTS`);

    // Even dimensions required by h264
    chain.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');

    return chain;
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

      setLogMessage('در حال دریافت ویدیو...');
      const videoData = await fetchFile(videoUrl);
      await ffmpeg.writeFile('input.mp4', videoData);

      const command: string[] = [];
      const start = parseFloat(trimStart);
      const end = parseFloat(trimEnd);
      if (!Number.isNaN(start) && start > 0) command.push('-ss', String(start));
      command.push('-i', 'input.mp4');
      if (!Number.isNaN(end) && end > 0 && (Number.isNaN(start) ? true : end > start)) {
        const dur = Number.isNaN(start) ? end : end - start;
        command.push('-t', String(dur));
      }

      const vf = buildVideoFilters().join(',');
      command.push('-vf', vf);

      if (speed !== 100) {
        const tempo = (speed / 100).toFixed(4);
        command.push('-filter:a', `atempo=${tempo}`);
      } else {
        command.push('-c:a', 'aac');
      }

      command.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '24',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4',
      );

      setLogMessage('در حال پردازش تصویر ویدیو...');
      await ffmpeg.exec(command);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });

      if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
      setEditedVideoUrl(URL.createObjectURL(blob));
      setEditedBlob(blob);
      setStatus('complete');
      setLogMessage('پردازش با موفقیت انجام شد');
      toast({ title: 'موفق', description: 'ویدیو با موفقیت پردازش شد' });

      try {
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output.mp4');
      } catch {
        /* ignore */
      }
    } catch (error: any) {
      console.error('Error processing video:', error);
      setStatus('error');
      setLogMessage(`خطا: ${error?.message || 'خطا در پردازش ویدیو'}`);
      toast({ title: 'خطا', description: 'خطا در پردازش ویدیو', variant: 'destructive' });
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
    setSizePreset('original');
    setFilterPreset('none');
    setRotation(0);
    setZoom(100);
    setBrightness(0);
    setContrast(100);
    setSaturation(100);
    setSpeed(100);
    setTrimStart('');
    setTrimEnd('');
    if (editedVideoUrl) URL.revokeObjectURL(editedVideoUrl);
    setEditedVideoUrl(null);
    setEditedBlob(null);
    setStatus('idle');
    setProgress(0);
    setLogMessage('');
  };

  const isProcessing = status === 'loading-ffmpeg' || status === 'processing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            ویرایش اندازه و افکت ویدیو
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Live preview */}
          <div className="space-y-2">
            <Label>پیش‌نمایش زنده</Label>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                src={videoUrl}
                className="max-w-full max-h-full object-contain"
                style={previewStyle}
                controls
                muted
                loop
                playsInline
              />
            </div>
            <p className="text-xs text-muted-foreground">
              پیش‌نمایش تقریبی است؛ نتیجه نهایی پس از پردازش ساخته می‌شود.
            </p>
          </div>

          {/* Size presets */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Crop className="h-4 w-4" />
              اندازه و قالب ویدیو
            </Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SIZE_PRESETS) as SizePresetKey[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={sizePreset === key ? 'default' : 'outline'}
                  disabled={isProcessing}
                  onClick={() => setSizePreset(key)}
                >
                  {SIZE_PRESETS[key].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Effects presets */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              افکت آماده
            </Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_PRESETS) as FilterPresetKey[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={filterPreset === key ? 'default' : 'outline'}
                  disabled={isProcessing}
                  onClick={() => setFilterPreset(key)}
                >
                  {FILTER_PRESETS[key].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Rotation + zoom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>چرخش تصویر</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => setRotation((r) => (r + 270) % 360)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Badge variant="outline">{rotation}°</Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>بزرگ‌نمایی (برش)</Label>
                <Badge variant="outline">{zoom}%</Badge>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={100}
                max={200}
                step={5}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Manual adjustments */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">روشنایی</Label>
                <Badge variant="outline">{brightness}</Badge>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={([v]) => setBrightness(v)}
                min={-50}
                max={50}
                step={5}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">کنتراست</Label>
                <Badge variant="outline">{contrast}%</Badge>
              </div>
              <Slider
                value={[contrast]}
                onValueChange={([v]) => setContrast(v)}
                min={50}
                max={200}
                step={5}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">اشباع رنگ</Label>
                <Badge variant="outline">{saturation}%</Badge>
              </div>
              <Slider
                value={[saturation]}
                onValueChange={([v]) => setSaturation(v)}
                min={0}
                max={200}
                step={5}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">سرعت پخش</Label>
                <Badge variant="outline">{speed}%</Badge>
              </div>
              <Slider
                value={[speed]}
                onValueChange={([v]) => setSpeed(v)}
                min={50}
                max={200}
                step={5}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Trim */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">شروع از ثانیه</Label>
              <Input
                inputMode="decimal"
                placeholder="مثلاً 2"
                value={trimStart}
                onChange={(e) => setTrimStart(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">پایان در ثانیه</Label>
              <Input
                inputMode="decimal"
                placeholder="مثلاً 15"
                value={trimEnd}
                onChange={(e) => setTrimEnd(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          {isProcessing && (
            <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {status === 'loading-ffmpeg'
                    ? 'در حال بارگذاری ابزار پردازش...'
                    : 'در حال پردازش ویدیو...'}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {logMessage && (
                <p className="text-xs text-muted-foreground font-mono truncate">{logMessage}</p>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{logMessage || 'خطا در پردازش ویدیو'}</span>
            </div>
          )}

          {status === 'complete' && editedVideoUrl && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                ویدیو ویرایش شده
              </Label>
              <div
                className={cn(
                  'relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-green-500/30 flex items-center justify-center',
                )}
              >
                <video
                  src={editedVideoUrl}
                  className="max-w-full max-h-full object-contain"
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
            <Button onClick={processVideo} disabled={isProcessing} className="gap-2">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              اعمال و پردازش
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

export default VideoVisualEditor;
