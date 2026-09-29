import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { AlarmClock, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StageOption { key: string; label: string }
interface Scheduled { id: string; target_stage: string; target_label: string | null; run_at: string; state: string; last_error: string | null }

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' });

export function ScheduledStageChange({ orderId, orderCode, stages }: { orderId: string; orderCode: string; stages: StageOption[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Scheduled[]>([]);
  const [stage, setStage] = useState('');
  const [runAt, setRunAt] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('scheduled_stage_changes')
      .select('id,target_stage,target_label,run_at,state,last_error')
      .eq('order_id', orderId)
      .in('state', ['pending', 'running', 'failed'])
      .order('run_at');
    setItems(data || []);
  };

  useEffect(() => { load(); }, [orderId]);

  const save = async () => {
    if (!stage || !runAt) {
      toast({ variant: 'destructive', title: 'مرحله و زمان را انتخاب کنید' });
      return;
    }
    if (new Date(runAt).getTime() <= Date.now()) {
      toast({ variant: 'destructive', title: 'زمان باید در آینده باشد' });
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('scheduled_stage_changes').insert({
      order_id: orderId,
      target_stage: stage,
      target_label: stages.find((s) => s.key === stage)?.label,
      run_at: new Date(runAt).toISOString(),
      notify_customer: notify,
      created_by: auth?.user?.id,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'خطا در زمان‌بندی', description: error.message });
      return;
    }
    toast({ title: '⏰ زمان‌بندی ثبت شد', description: `سفارش ${orderCode} در ${fmt(runAt)} خودکار تغییر مرحله می‌دهد.` });
    setStage(''); setRunAt('');
    load();
  };

  const cancel = async (id: string) => {
    await (supabase as any).from('scheduled_stage_changes').update({ state: 'cancelled' }).eq('id', id);
    load();
  };

  const pending = items.filter((i) => i.state === 'pending');

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0" onClick={() => setOpen(true)} title="زمان‌بندی تغییر مرحله">
        <AlarmClock className="h-4 w-4" />
        {pending.length > 0 && <span className="text-xs">{pending.length}</span>}
      </Button>
      {pending.length > 0 && (
        <span className="text-xs text-primary hidden sm:inline whitespace-nowrap">
          {pending[0].target_label}: {fmt(pending[0].run_at)}
        </span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>زمان‌بندی تغییر مرحله سفارش {orderCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>مرحله مقصد</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue placeholder="انتخاب مرحله" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>تاریخ و ساعت اجرا</Label>
              <PersianDatePicker value={runAt} onChange={setRunAt} timeMode="full" />
            </div>
            <div className="flex items-center justify-between">
              <Label>ارسال پیام به مشتری</Label>
              <Switch checked={notify} onCheckedChange={setNotify} />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>ثبت زمان‌بندی</Button>

            {items.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">زمان‌بندی‌های این سفارش</p>
                {items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{i.target_label || i.target_stage}</div>
                      <div className="text-xs text-muted-foreground">{fmt(i.run_at)}</div>
                      {i.state === 'failed' && <div className="text-xs text-destructive">ناموفق: {i.last_error}</div>}
                    </div>
                    {i.state !== 'running' && (
                      <Button size="icon" variant="ghost" onClick={() => cancel(i.id)} title="لغو">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">تغییر مرحله حداکثر تا ۵ دقیقه بعد از زمان تعیین‌شده انجام می‌شود.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
