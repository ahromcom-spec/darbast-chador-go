import { BellOff, MessageSquare, MessageSquareOff, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { OrderCollaboratorSms } from '@/lib/orderCollaboratorSms';
import { useToggleCollaboratorSms } from '@/hooks/useOrderCollaboratorsSms';

interface Props {
  collaborators: OrderCollaboratorSms[];
  className?: string;
}

/**
 * نام همه همکاران پذیرفته‌شده سفارش با کلید پیامک هر همکار.
 * همکارِ روشن با هر تغییر مرحله سفارش همان پیامی را می‌گیرد که مشتری می‌گیرد.
 */
export function OrderCollaboratorSmsChips({ collaborators, className }: Props) {
  const toggle = useToggleCollaboratorSms();
  if (!collaborators.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} dir="rtl" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> همکاران:
      </span>
      {collaborators.map((c) => {
        const on = c.sms_enabled && !c.sms_opted_out;
        return (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <label
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] cursor-pointer select-none transition-colors',
                  on ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                {c.sms_opted_out ? <BellOff className="h-3 w-3" /> : on ? <MessageSquare className="h-3 w-3 text-primary" /> : <MessageSquareOff className="h-3 w-3" />}
                <span className="max-w-[9rem] truncate">{c.name}</span>
                <Switch
                  checked={c.sms_enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ collaborator: c, enabled: v })}
                  className="scale-[0.65] -mx-1.5 min-h-0"
                  aria-label={`پیامک ${c.name}`}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="top" dir="rtl" className="text-xs max-w-[16rem]">
              {c.sms_opted_out
                ? `${c.name} پیامک‌ها را در حساب خودش خاموش کرده است؛ پیامی برایش نمی‌رود.`
                : c.sms_enabled
                  ? `پیامک روشن: ${c.name} با تغییر مراحل این سفارش پیام می‌گیرد.`
                  : `پیامک خاموش: ${c.name} از تغییرات این سفارش پیامی نمی‌گیرد.`}
              {c.phone ? <div className="mt-1 font-mono" dir="ltr">{c.phone}</div> : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
