import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { ContactPickerButton } from '@/components/common/ContactPickerButton';
import { ArrowLeftRight, CheckCircle, Loader2, Search, UserPlus, Wallet, XCircle } from 'lucide-react';
import { collaboratorTargets, type TreeOrderInput } from '@/lib/customerProjectsTree';

export type BulkActionMode = 'transfer' | 'collaborate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BulkActionMode;
  /** عنوان دامنه، مثل «آدرس انبار» یا «۲ پروژه انتخاب‌شده» */
  scopeLabel: string;
  orders: TreeOrderInput[];
  archivedCount: number;
  ownerPhone: string;
  onDone?: () => void;
}

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

const normalizePhone = (phone: string) => {
  let cleaned = phone
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (cleaned.startsWith('98')) cleaned = '0' + cleaned.slice(2);
  if (!cleaned.startsWith('0') && cleaned.length === 10) cleaned = '0' + cleaned;
  return cleaned;
};

export function BulkProjectActionDialog({ open, onOpenChange, mode, scopeLabel, orders, archivedCount, ownerPhone, onDone }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [canManageOrder, setCanManageOrder] = useState(false);
  const debounced = useDebounce(phone, 500);
  const isTransfer = mode === 'transfer';

  useEffect(() => {
    if (open) {
      setPhone('');
      setTarget(null);
      setNotFound(false);
      setCanViewFinancials(true);
      setCanManageOrder(false);
    }
  }, [open]);

  const lookup = useCallback(async (p: string) => {
    setSearching(true);
    setTarget(null);
    setNotFound(false);
    try {
      const { data, error } = await supabase.rpc('lookup_profile_by_phone' as any, { _phone: p }).maybeSingle();
      if (error) throw error;
      const prof = data as { user_id: string; full_name: string | null; phone_number: string | null } | null;
      if (prof) setTarget({ id: prof.user_id, name: prof.full_name || 'بدون نام', phone: prof.phone_number || p });
      else setNotFound(true);
    } catch (e) {
      console.error(e);
      toast({ title: 'خطا', description: 'خطا در جستجوی شماره', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, [toast]);

  useEffect(() => {
    const p = normalizePhone(debounced);
    if (p.length === 11 && p.startsWith('09')) lookup(p);
    else {
      setTarget(null);
      setNotFound(false);
    }
  }, [debounced, lookup]);

  const formatted = normalizePhone(phone);
  const validPhone = formatted.length === 11 && formatted.startsWith('09');
  const sameAsOwner = !!target && normalizePhone(ownerPhone) === normalizePhone(target.phone);

  const submitTransfer = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('manager_transfer_orders_to_customer' as any, {
        p_order_ids: orders.map((o) => o.id),
        p_phone: target.phone,
      });
      if (error) throw error;
      const moved = Number((data as any)?.moved || 0);
      toast({
        title: '✓ انتقال انجام شد',
        description: `${fa(moved)} سفارش از ${scopeLabel} به ${target.name} منتقل شد؛ آدرس و پروژه‌ها نزد مشتری مقصد به همین شکل ساخته شد.`,
      });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انتقال با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCollaborator = async () => {
    if (!user || !validPhone) return;
    const invitePhone = target?.phone || formatted;
    setSubmitting(true);
    try {
      const ids = orders.map((o) => o.id);
      const { data: existing, error: exErr } = await supabase
        .from('order_collaborators')
        .select('order_id, invitee_phone_number, status')
        .in('order_id', ids)
        .eq('invitee_phone_number', invitePhone);
      if (exErr) throw exErr;
      const ownerPhones = new Map(ids.map((id) => [id, normalizePhone(ownerPhone)]));
      const plan = collaboratorTargets(ids, invitePhone, (existing || []) as any, ownerPhones);
      if (plan.add.length === 0) {
        toast({
          title: 'تغییری لازم نبود',
          description: plan.owner.length ? 'این شماره صاحب همین سفارش‌هاست.' : 'این شماره از قبل همکار همه این سفارش‌هاست.',
        });
        setSubmitting(false);
        return;
      }
      const now = new Date().toISOString();
      const rows = plan.add.map((orderId) => ({
        order_id: orderId,
        inviter_user_id: user.id,
        invitee_user_id: target?.id || null,
        invitee_phone_number: invitePhone,
        status: target ? 'manager_approved' : 'pending_registration',
        manager_approved_by: user.id,
        manager_approved_at: now,
        can_view_financials: canViewFinancials,
        can_manage_order: canManageOrder,
      }));
      const { error } = await supabase.from('order_collaborators').insert(rows as any);
      if (error) throw error;
      const skipped = plan.alreadyCollaborator.length;
      toast({
        title: '✓ همکار اضافه شد',
        description:
          `${target?.name || invitePhone} برای ${fa(plan.add.length)} سفارش از ${scopeLabel} دعوت شد` +
          (skipped ? `؛ ${fa(skipped)} سفارش از قبل همین همکار را داشت.` : '.') +
          (target ? ' پس از پذیرش ایشان فعال می‌شود.' : ' تا ثبت‌نام این شماره در انتظار می‌ماند.'),
      });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'افزودن همکار با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const disabled =
    submitting || orders.length === 0 || (isTransfer ? !target || sameAsOwner : !validPhone || sameAsOwner);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTransfer ? <ArrowLeftRight className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {isTransfer ? 'انتقال به مشتری دیگر' : 'افزودن همکار'}
          </DialogTitle>
          <DialogDescription>
            {scopeLabel} — {fa(orders.length)} سفارش فعال
            {archivedCount > 0 && `؛ ${fa(archivedCount)} سفارش بایگانی‌شده تغییری نمی‌کند`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1">
            {orders.map((o) => (
              <span key={o.id} className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">{o.code}</span>
            ))}
          </div>

          <div className="space-y-2">
            <Label>{isTransfer ? 'شماره موبایل مشتری مقصد' : 'شماره موبایل همکار'}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" dir="ltr" className="pr-10 text-left" />
              </div>
              <ContactPickerButton onContactSelected={(p) => setPhone(p)} />
            </div>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> در حال جستجو...
            </div>
          )}

          {target && (
            <Card className={sameAsOwner ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {sameAsOwner ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                  {target.name}
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">{target.phone}</p>
                {sameAsOwner && <p className="text-xs text-destructive">این شماره صاحب فعلی همین سفارش‌هاست.</p>}
              </CardContent>
            </Card>
          )}

          {notFound && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-4 flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-destructive" />
                {isTransfer
                  ? 'این شماره در سایت ثبت‌نام نکرده است؛ انتقال فقط به مشتری ثبت‌نام‌شده ممکن است.'
                  : 'این شماره هنوز ثبت‌نام نکرده؛ دعوت تا ثبت‌نام ایشان در انتظار می‌ماند.'}
              </CardContent>
            </Card>
          )}

          {isTransfer ? (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <Wallet className="h-4 w-4 text-primary mt-0.5" />
              <span>
                سفارش‌ها با همان آدرس و دسته‌بندی پروژه به مشتری مقصد می‌روند و مبالغ و پرداخت‌هایشان در صورتحساب‌های هر دو مشتری دوباره حساب می‌شود.
              </span>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={canViewFinancials} onCheckedChange={(v) => setCanViewFinancials(!!v)} />
                مشاهده مبالغ و صورتحساب
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={canManageOrder} onCheckedChange={(v) => setCanManageOrder(!!v)} />
                اجازه مدیریت سفارش
              </label>
            </div>
          )}

          <Button onClick={isTransfer ? submitTransfer : submitCollaborator} disabled={disabled} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isTransfer ? <ArrowLeftRight className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isTransfer ? `تایید و انتقال ${fa(orders.length)} سفارش` : `افزودن همکار به ${fa(orders.length)} سفارش`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
