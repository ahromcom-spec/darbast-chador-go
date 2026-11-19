import { cn } from '@/lib/utils';
import { formatBadgeCount } from '@/lib/moduleActivity';

const toPersianDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

interface ActivityBadgeProps {
  count: number | null | undefined;
  /** corner: گوشه بالا-راست کارت (مثل نشان برنامه‌های اندروید)؛ inline: کنار نام تب */
  variant?: 'corner' | 'inline';
  className?: string;
  title?: string;
}

/** نشان عددی رویدادهای مشاهده‌نشده */
export function ActivityBadge({ count, variant = 'inline', className, title }: ActivityBadgeProps) {
  const text = formatBadgeCount(count);
  if (!text) return null;
  const label = `${toPersianDigits(text)} رویداد مشاهده‌نشده`;
  return (
    <span
      role="status"
      aria-label={label}
      title={title || label}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-destructive font-bold leading-none text-destructive-foreground tabular-nums shadow-md',
        'animate-in zoom-in-50 duration-300',
        variant === 'corner'
          ? 'pointer-events-none absolute -right-2 -top-2 z-20 h-6 min-w-6 px-1.5 text-[11px] ring-2 ring-background'
          : 'ms-1.5 h-5 min-w-5 px-1.5 text-[10px] ring-1 ring-background/60',
        className,
      )}
    >
      {toPersianDigits(text)}
    </span>
  );
}
