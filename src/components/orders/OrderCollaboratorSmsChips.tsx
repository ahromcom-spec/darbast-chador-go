import { BellOff, MessageSquare, MessageSquareOff, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { OrderCollaboratorSms } from '@/lib/orderCollaboratorSms';
import { useToggleCollaboratorSms } from '@/hooks/useOrderCollaboratorsSms';

interface Props {
  collaborators: OrderCollaboratorSms[];
  className?: string;
}

/**
 * نام همه همکاران پذیرفته‌شده سفارش، هر کدام با کلید جداگانه «ارسال پیامک / لغو ارسال».
 * همکارِ روشن با هر تغییر مرحله سفارش همان پیامی را می‌گیرد که مشتری می‌گیرد.
 */
export function OrderCollaboratorSmsChips({ collaborators, className }: Props) {
  const toggle = useToggleCollaboratorSms();
  if (!collaborators.length) return null;
  return (
    <div
      className={cn('rounded-lg border border-border bg-muted/30 p-2 space-y-1.5', className)}
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Users className="h-4 w-4 text-primary" />
        همکاران این سفارش ({collaborators.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {collaborators.map((c) => {
          const on = c.sms_enabled && !c.sms_opted_out;
          return (
            <div
              key={c.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs',
                on ? 'border-primary/40 bg-primary/5' : 'border-border bg-background',
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                {c.sms_opted_out ? (
                  <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : on ? (
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <MessageSquareOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground break-words">{c.name}</span>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} dir="ltr" className="font-mono text-[11px] text-muted-foreground hover:text-primary">
                    {c.phone}
                  </a>
                ) : null}
              </div>
              <label className="inline-flex cursor-pointer select-none items-center gap-1.5">
                <span className={cn('text-[11px]', on ? 'text-primary' : 'text-muted-foreground')}>
                  {c.sms_opted_out ? 'پیامک را خودش خاموش کرده' : c.sms_enabled ? 'ارسال پیامک' : 'لغو ارسال'}
                </span>
                <Switch
                  checked={c.sms_enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ collaborator: c, enabled: v })}
                  aria-label={`ارسال پیامک به ${c.name}`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

