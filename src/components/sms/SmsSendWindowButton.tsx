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
  setSmsSendWindow,
  formatSmsWindowLabel,
  type SmsSendWindow,
} from '@/lib/smsSendWindow';

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
    if (open) setDraft(getSmsSendWindow());
  }, [open]);

  const save = () => {
    const saved = setSmsSendWindow(draft);
    setWin(saved);
    setOpen(false);
    toast.success(
      saved.enabled
        ? `پیامک‌ها فقط بین ساعت ${saved.start} تا ${saved.end} به مشتری ارسال می‌شوند`
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
              <Label htmlFor="sms-window-start" className="text-xs">از ساعت</Label>
              <Input
                id="sms-window-start"
                type="time"
                dir="ltr"
                value={draft.start}
                disabled={!draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-window-end" className="text-xs">تا ساعت</Label>
              <Input
                id="sms-window-end"
                type="time"
                dir="ltr"
                value={draft.end}
                disabled={!draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            نمونه: با تنظیم ۰۹:۰۰ تا ۲۱:۰۰، پیامکی که ساعت ۲ بامداد ایجاد شود، ساعت ۹ صبح برای مشتری
            ارسال می‌شود.
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
