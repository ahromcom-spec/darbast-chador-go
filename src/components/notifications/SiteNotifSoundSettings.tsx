import { useRef, useState } from 'react';
import { Settings2, Play, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { loadPrefs, savePrefs, saveCustomSound, SiteNotifPrefs } from '@/lib/siteNotifPrefs';
import { playSiteNotifSound } from './SiteNotificationSound';

const Row = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-sm">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default function SiteNotifSoundSettings() {
  const [prefs, setPrefs] = useState<SiteNotifPrefs>(loadPrefs);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<SiteNotifPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('audio/')) return toast.error('لطفاً یک فایل صوتی انتخاب کنید');
    if (f.size > 15 * 1024 * 1024) return toast.error('حداکثر حجم فایل ۱۵ مگابایت است');
    await saveCustomSound(f);
    update({ customSoundName: f.name });
    toast.success('آهنگ اعلان تغییر کرد');
    setTimeout(playSiteNotifSound, 200);
  };

  return (
    <Dialog onOpenChange={(o) => o && setPrefs(loadPrefs())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Settings2 className="h-4 w-4" />
          تنظیمات صدا و اعلان
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تنظیمات صدا و اعلان این ماژول</DialogTitle>
        </DialogHeader>

        <section className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">صدای اعلان</p>
          <p className="text-xs text-muted-foreground">
            {prefs.customSoundName ? `آهنگ انتخابی: ${prefs.customSoundName}` : 'صدای پیش‌فرض سایت'}
          </p>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> انتخاب آهنگ از کامپیوتر
            </Button>
            <Button size="sm" variant="outline" onClick={playSiteNotifSound}>
              <Play className="h-4 w-4" /> پخش آزمایشی
            </Button>
            {prefs.customSoundName && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await saveCustomSound(null);
                  update({ customSoundName: null });
                }}
              >
                <Trash2 className="h-4 w-4" /> صدای پیش‌فرض
              </Button>
            )}
          </div>
          <div className="pt-2">
            <span className="text-xs text-muted-foreground">بلندی صدا: {Math.round(prefs.volume * 100)}٪</span>
            <Slider value={[prefs.volume * 100]} max={100} step={5} onValueChange={([v]) => update({ volume: v / 100 })} />
          </div>
        </section>

        <section className="rounded-xl border p-3">
          <p className="text-sm font-semibold">میهمان</p>
          <Row label="اعلان برای ورود یا اقدام میهمان" checked={prefs.guestNotify} onChange={(v) => update({ guestNotify: v })} />
          <Row label="پخش صدا برای میهمان" checked={prefs.guestSound} onChange={(v) => update({ guestSound: v })} />
        </section>

        <section className="rounded-xl border p-3">
          <p className="text-sm font-semibold">مدیریت سایت</p>
          <Row label="اعلان برای ورود یا اقدام مدیریت" checked={prefs.adminNotify} onChange={(v) => update({ adminNotify: v })} />
          <Row label="پخش صدا برای اقدامات مدیریت" checked={prefs.adminSound} onChange={(v) => update({ adminSound: v })} />
          <Row label="پخش صدا برای تغییر مرحله توسط مدیریت" checked={prefs.adminStageSound} onChange={(v) => update({ adminStageSound: v })} />
        </section>
        <p className="text-xs text-muted-foreground">این تنظیمات روی همین دستگاه ذخیره می‌شود.</p>
      </DialogContent>
    </Dialog>
  );
}
