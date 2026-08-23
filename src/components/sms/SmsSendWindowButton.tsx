import { useEffect, useState } from 'react';
import { Clock, AlarmClockOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getSmsSendWindow,
  fetchSmsSendWindow,
  saveSmsSendWindow,
  formatSmsWindowLabel,
  type SmsSendWindow,
} from '@/lib/smsSendWindow';

const pad2 = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

/** انتخابگر ساعت ۲۴ ساعته (ساعت و دقیقه جداگانه) */
function TimePicker24({
  value,
  disabled,
  onChange,
  idPrefix,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  idPrefix: string;
}) {
  const [h = '09', m = '00'] = (value || '09:00').split(':');
  const base =
    'h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50';
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <select
        id={`${idPrefix}-hour`}
        className={base}
        disabled={disabled}
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
      >
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>{hh}</option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        id={`${idPrefix}-minute`}
        className={base}
        disabled={disabled}
        value={MINUTES.includes(m) ? m : '00'}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>{mm}</option>
        ))}
      </select>
    </div>
  );
}

interface SmsSendWindowButtonProps {
  /** نمایش فشرده (فقط آیکون) در کنار کلید خاموش/روشن پیامک */
  compact?: boolean;
  className?: string;
}

export function SmsSendWindowButton({ compact = true, className }: SmsSendWindowButtonProps) {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState<SmsSendWindow>(() => getSmsSendWindow());
  const [draft, setDraft] = useState<SmsSendWindow>(win);

  useEffect(() => {
    const handler = () => setWin(getSmsSendWindow());
    window.addEventListener('sms-send-window-changed', handler);
    return () => window.removeEventListener('sms-send-window-changed', handler);
  }, []);

  useEffect(() => {
    fetchSmsSendWindow().then(setWin).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      fetchSmsSendWindow().then((w) => {
        setWin(w);
        setDraft(w);
      }).catch(() => setDraft(getSmsSendWindow()));
    }
  }, [open]);

  const save = async () => {
    const { win: saved, error } = await saveSmsSendWindow(draft);
    if (error) {
      toast.error('ذخیره بازه زمانی ارسال پیامک انجام نشد');
      return;
    }
    setWin(saved);
    setOpen(false);
    toast.success(
      saved.enabled
        ? `پیامک‌ها فقط بین ساعت ${saved.start} تا ${saved.end} (به وقت تهران) به مشتری ارسال می‌شوند`
        : 'محدودیت زمانی ارسال پیامک غیرفعال شد'
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={(e) => e.stopPropagation()}
          className={`gap-1.5 ${
            win.enabled
              ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
              : ''
          } ${className || ''}`}
          title={
            win.enabled
              ? `بازه ارسال پیامک: ${formatSmsWindowLabel(win)}`
              : 'تعیین بازه زمانی ارسال پیامک به مشتری'
          }
        >
          {win.enabled ? <Clock className="h-3.5 w-3.5" /> : <AlarmClockOff className="h-3.5 w-3.5" />}
          <span className="text-xs font-medium whitespace-nowrap">
            {win.enabled ? `بازه ارسال: ${formatSmsWindowLabel(win)}` : 'بازه ارسال پیامک'}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>بازه زمانی ارسال پیامک به مشتری</DialogTitle>
          <DialogDescription>
            اگر خارج از این بازه سفارشی را تایید یا مرحله‌اش را تغییر دهید، پیامک ارسال نمی‌شود و
            به‌صورت خودکار در اولین لحظه بازه مجاز (به وقت ایران) برای مشتری ارسال خواهد شد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="sms-window-enabled" className="cursor-pointer text-sm font-medium">
              فعال بودن محدودیت زمانی
            </Label>
            <Switch
              id="sms-window-enabled"
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">از ساعت (۲۴ ساعته)</Label>
              <TimePicker24
                idPrefix="sms-window-start"
                value={draft.start}
                disabled={!draft.enabled}
                onChange={(v) => setDraft((d) => ({ ...d, start: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تا ساعت (۲۴ ساعته)</Label>
              <TimePicker24
                idPrefix="sms-window-end"
                value={draft.end}
                disabled={!draft.enabled}
                onChange={(v) => setDraft((d) => ({ ...d, end: v }))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            نمونه: با تنظیم ۰۹:۰۰ تا ۲۱:۰۰، پیامکی که ساعت ۲ بامداد ایجاد شود، ساعت ۹ صبح برای مشتری
            ارسال می‌شود. تمام ساعت‌ها به وقت تهران است.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
          <Button onClick={save}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SmsSendWindowButton;
