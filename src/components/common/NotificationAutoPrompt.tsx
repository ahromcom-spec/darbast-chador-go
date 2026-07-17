import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOneSignal } from '@/hooks/useOneSignal';
import { toast } from 'sonner';

const DISMISS_KEY = 'notification_prompt_dismissed_at';
const DISMISS_DAYS = 3;

export function NotificationAutoPrompt() {
  const { isSupported, isSubscribed, permission, loading, subscribe } = useOneSignal();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    if (isSubscribed) return;
    if (permission === 'denied' || permission === 'granted') return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [isSupported, isSubscribed, permission]);

  const handleEnable = async () => {
    try {
      const ok = await subscribe();
      if (ok) {
        toast.success('اعلان‌ها فعال شد ✅');
        setVisible(false);
      } else {
        toast.error('فعال‌سازی انجام نشد. لطفاً اجازه مرورگر را بررسی کنید.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'خطا در فعال‌سازی اعلان');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm z-[100] bg-card border border-border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5"
      dir="rtl"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 left-2 p-1 rounded-md hover:bg-muted text-muted-foreground"
        aria-label="بستن"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-2 rounded-full bg-primary/10 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">فعال‌سازی اعلان‌ها</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            برای دریافت سریع تماس‌ها، وضعیت سفارش‌ها و رویدادهای مهم، اعلان‌های مرورگر را فعال کنید.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} disabled={loading}>
              <Bell className="h-3.5 w-3.5 ml-1" />
              {loading ? 'در حال فعال‌سازی...' : 'فعال‌سازی'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              بعداً
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
