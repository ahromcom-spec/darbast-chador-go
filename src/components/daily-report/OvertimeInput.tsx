import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatOvertime, parseOvertimeInput } from '@/lib/overtimeUtils';

interface OvertimeInputProps {
  /** ساعت اعشاری (مثبت = اضافه‌کاری، منفی = کم‌کاری) */
  value: number;
  onChange: (hours: number) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * ورودی اضافه‌کاری/کم‌کاری با پشتیبانی ساعت و دقیقه: 1:30 یا -0:30
 */
export function OvertimeInput({ value, onChange, className, disabled }: OvertimeInputProps) {
  const [text, setText] = useState(() => (Number(value) ? formatOvertime(value) : ''));

  useEffect(() => {
    // هنگام تغییر مقدار از بیرون، متن را همگام کن (به‌جز وقتی کاربر در حال تایپ همان مقدار است)
    const parsed = parseOvertimeInput(text);
    if (parsed !== (Number(value) || 0)) {
      setText(Number(value) ? formatOvertime(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const hours = parseOvertimeInput(raw);
    if (Math.abs(hours) > 15) {
      toast.error('اضافه‌کاری یا کم‌کاری نمی‌تواند بیشتر از ۱۵ ساعت باشد');
      return;
    }
    onChange(hours);
  };

  const isNegative = (Number(value) || 0) < 0;

  return (
    <div className="relative min-w-[115px]">
      <Input
        type="text"
        inputMode="text"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          commit(raw);
        }}
        onBlur={() => {
          const hours = parseOvertimeInput(text);
          setText(hours ? formatOvertime(hours) : '');
        }}
        className={`pl-10 text-left tabular-nums text-sm ${isNegative ? 'text-destructive' : ''} ${className || ''}`}
        dir="ltr"
        placeholder="-00:00"
        title="ساعت:دقیقه — برای کم‌کاری منفی بگذارید"
      />
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
        {isNegative ? 'کم‌کاری' : 'ساعت'}
      </span>
    </div>
  );
}
