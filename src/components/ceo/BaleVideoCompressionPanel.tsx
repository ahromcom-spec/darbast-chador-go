import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileVideo, RefreshCw, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { shrinkVideoForBale, BALE_MAX_BYTES } from '@/lib/videoShrink';

interface Job {
  id: string;
  source_url: string;
  source_bucket: string | null;
  source_path: string | null;
  phone: string | null;
  text_body: string | null;
  order_id: string | null;
  order_code: string | null;
  status: string;
  attempts: number;
  source_size: number | null;
  output_size: number | null;
  output_path: string | null;
  error: string | null;
  created_at: string;
}

const mb = (n?: number | null) => (n ? `${Math.round(n / 1048576)} مگابایت` : '—');

const STATUS_LABEL: Record<string, string> = {
  pending: 'در صف کاهش حجم',
  processing: 'در حال پردازش',
  done: 'کم‌حجم شد و ارسال شد',
  failed: 'ناموفق',
};

export const BaleVideoCompressionPanel: React.FC = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [auto, setAuto] = useState(true);
  const runningRef = useRef(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('media_compression_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    setJobs((data || []) as Job[]);
  }, []);

  const processJob = useCallback(
    async (job: Job) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setBusy(true);
      setStage('آماده‌سازی فیلم');
      setPercent(1);
      try {
        await (supabase as any)
          .from('media_compression_jobs')
          .update({ status: 'processing', attempts: (job.attempts || 0) + 1, error: null })
          .eq('id', job.id);

        // دریافت فیلم اصلی
        let url = job.source_url;
        if (job.source_bucket && job.source_path) {
          const { data: signed } = await supabase.storage
            .from(job.source_bucket)
            .createSignedUrl(job.source_path, 60 * 60);
          if (signed?.signedUrl) url = signed.signedUrl;
        }
        setStage('دریافت فیلم اصلی');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`دریافت فیلم ناموفق (${res.status})`);
        const original = await res.blob();

        const result = await shrinkVideoForBale(
          original,
          ({ stage: s, percent: p }) => {
            setStage(s);
            setPercent(p);
          },
          BALE_MAX_BYTES,
        );

        // ذخیره نسخه کم‌حجم‌شده
        const bucket = job.source_bucket || 'project-media';
        const base = (job.source_path || 'video.mp4').split('/').pop() || 'video.mp4';
        const outPath = `bale-compressed/${job.id}-${base.replace(/\.[^.]+$/, '')}.mp4`;
        setStage('بارگذاری نسخه کم‌حجم');
        setPercent(96);
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(outPath, result.blob, { contentType: 'video/mp4', upsert: true });
        if (upErr) throw new Error(`بارگذاری ناموفق: ${upErr.message}`);

        const { data: outSigned } = await supabase.storage
          .from(bucket)
          .createSignedUrl(outPath, 60 * 60 * 6);

        // ارسال مجدد برای مشتری
        setStage('ارسال مجدد برای مشتری در بله');
        setPercent(98);
        const { data: sent, error: sendErr } = await supabase.functions.invoke('send-bale-message', {
          body: {
            phone: job.phone || undefined,
            text: job.text_body || undefined,
            media: outSigned?.signedUrl ? [{ url: outSigned.signedUrl, type: 'video' }] : [],
            orderId: job.order_id || undefined,
            orderCode: job.order_code || undefined,
            force: true,
          },
        });
        if (sendErr) throw new Error(sendErr.message);
        const ok = (sent as any)?.mediaSent > 0;

        await (supabase as any)
          .from('media_compression_jobs')
          .update({
            status: ok ? 'done' : 'failed',
            output_bucket: bucket,
            output_path: outPath,
            output_size: result.blob.size,
            error: ok ? result.note : `${result.note} — ارسال ناموفق بود`,
          })
          .eq('id', job.id);

        toast({
          title: ok ? 'فیلم کم‌حجم شد و ارسال شد' : 'کاهش حجم انجام شد ولی ارسال ناموفق بود',
          description: result.note,
          variant: ok ? 'default' : 'destructive',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await (supabase as any)
          .from('media_compression_jobs')
          .update({ status: 'failed', error: msg.slice(0, 500) })
          .eq('id', job.id);
        toast({ title: 'کاهش حجم فیلم ناموفق بود', description: msg, variant: 'destructive' });
      } finally {
        runningRef.current = false;
        setBusy(false);
        setStage('');
        setPercent(0);
        load();
      }
    },
    [load, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  // پردازش خودکار صف
  useEffect(() => {
    if (!auto) return;
    const tick = async () => {
      if (runningRef.current) return;
      const { data } = await (supabase as any)
        .from('media_compression_jobs')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(1);
      const job = (data || [])[0] as Job | undefined;
      if (job) await processJob(job);
      else load();
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [auto, processJob, load]);

  const pending = jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <FileVideo className="h-4 w-4 text-primary" />
          کاهش خودکار حجم فیلم‌های سنگین
          {pending > 0 && <Badge variant="secondary">{pending} فیلم در صف</Badge>}
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 me-1" /> به‌روزرسانی
            </Button>
            <Button size="sm" variant={auto ? 'default' : 'outline'} onClick={() => setAuto((v) => !v)}>
              {auto ? 'پردازش خودکار روشن' : 'پردازش خودکار خاموش'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-6">
          فیلم‌های سنگین‌تر از ۴۵ مگابایت به‌صورت خودکار اول با کیفیت پایین‌تر ساخته می‌شوند و اگر باز هم
          حجمشان زیاد بود، از انتهای فیلم کم می‌شود تا به حد مجاز برسد و بعد برای مشتری فرستاده شوند. این
          پردازش وقتی این صفحه باز است انجام می‌شود.
        </p>

        {busy && (
          <div className="space-y-1 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {stage}
            </div>
            <Progress value={percent} className="h-1.5" />
          </div>
        )}

        {jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">فعلاً فیلم سنگینی در صف نیست.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs"
              >
                <Badge
                  variant={
                    job.status === 'done'
                      ? 'default'
                      : job.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {STATUS_LABEL[job.status] || job.status}
                </Badge>
                <span className="font-medium">{job.order_code || '—'}</span>
                <span className="text-muted-foreground">{job.phone || '—'}</span>
                <span className="text-muted-foreground">
                  {mb(job.source_size)} ← {mb(job.output_size)}
                </span>
                {job.error && (
                  <span className="text-muted-foreground max-w-full truncate">{job.error}</span>
                )}
                {(job.status === 'pending' || job.status === 'failed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ms-auto h-7"
                    disabled={busy}
                    onClick={() => processJob(job)}
                  >
                    <Play className="h-3 w-3 me-1" /> پردازش و ارسال
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BaleVideoCompressionPanel;
