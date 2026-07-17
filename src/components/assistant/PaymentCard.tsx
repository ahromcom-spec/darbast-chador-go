import { useState } from 'react';
import { CreditCard, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalizedNumber } from '@/lib/numberParsing';

export interface ParsedPaymentCard {
  statement_id?: string;
  order_id?: string;
  statement_number?: number;
  total?: number;
  paid?: number;
  remaining?: number;
  address?: string;
  title?: string;
}

interface Props { data: ParsedPaymentCard }

const fmt = (n: number) => Math.round(Math.max(n || 0, 0)).toLocaleString('fa-IR') + ' تومان';

export const PaymentCard = ({ data }: Props) => {
  const [open, setOpen] = useState(false);
  const remaining = Math.max(Math.round(data.remaining || 0), 0);
  const [amount, setAmount] = useState(String(remaining));
  const [loading, setLoading] = useState(false);

  const startPayment = async () => {
    const value = Math.round(parseLocalizedNumber(amount));
    if (!value || value <= 0) {
      toast.error('لطفاً مبلغ معتبری وارد کنید');
      return;
    }
    try {
      setLoading(true);
      const body: any = { amount: value };
      if (data.statement_id) body.statement_id = data.statement_id;
      else if (data.order_id) body.order_id = data.order_id;
      else throw new Error('شناسه صورتحساب یا سفارش موجود نیست');

      const { data: res, error } = await supabase.functions.invoke('zarinpal-payment', { body });
      if (error) throw error;
      if (res?.payment_url) {
        window.location.href = res.payment_url;
      } else {
        throw new Error(res?.error || 'دریافت لینک پرداخت با خطا مواجه شد');
      }
    } catch (err: any) {
      console.error('Assistant payment error:', err);
      toast.error(err?.message || 'خطا در اتصال به درگاه پرداخت');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-3 space-y-3" dir="rtl">
      <div className="flex items-center gap-2 text-orange-700 font-bold text-sm">
        <Wallet className="w-4 h-4" />
        <span>{data.title || (data.statement_number ? `صورتحساب شماره ${data.statement_number}` : 'صورتحساب شما')}</span>
      </div>

      {data.address && (
        <div className="text-xs text-orange-800/80 leading-6">📍 {data.address}</div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/70 border border-orange-100 p-2">
          <div className="text-[10px] text-orange-700/80">مبلغ کل</div>
          <div className="text-xs font-bold text-orange-900">{fmt(data.total || 0)}</div>
        </div>
        <div className="rounded-lg bg-white/70 border border-orange-100 p-2">
          <div className="text-[10px] text-green-700/80">پرداخت‌شده</div>
          <div className="text-xs font-bold text-green-700">{fmt(data.paid || 0)}</div>
        </div>
        <div className="rounded-lg bg-white/70 border border-orange-100 p-2">
          <div className="text-[10px] text-red-700/80">مانده</div>
          <div className="text-xs font-bold text-red-700">{fmt(remaining)}</div>
        </div>
      </div>

      <Button
        onClick={() => { setAmount(String(remaining)); setOpen(true); }}
        disabled={remaining <= 0}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
      >
        <CreditCard className="w-4 h-4 ml-2" />
        {remaining > 0 ? 'پرداخت آنلاین' : 'تسویه شده'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>پرداخت صورتحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              مبلغ مانده: <span className="font-bold text-red-600">{fmt(remaining)}</span>
            </div>
            <div>
              <Label htmlFor="pay-amount">مبلغ پرداخت (تومان)</Label>
              <Input
                id="pay-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مبلغ"
                className="text-left ltr:text-left"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>انصراف</Button>
            <Button onClick={startPayment} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CreditCard className="w-4 h-4 ml-2" />}
              انتقال به درگاه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export function parsePaymentCards(content: string): { cleanText: string; cards: ParsedPaymentCard[] } {
  const re = /<<AHROM_PAYMENT_CARD>>([\s\S]*?)<<END_PAYMENT>>/g;
  const cards: ParsedPaymentCard[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try { cards.push(JSON.parse(m[1].trim())); } catch { /* skip */ }
  }
  const cleanText = content.replace(re, '').trim();
  return { cleanText, cards };
}

export function parsePaymentCard(content: string): { cleanText: string; card: ParsedPaymentCard | null } {
  const { cleanText, cards } = parsePaymentCards(content);
  return { cleanText, card: cards[0] || null };
}
