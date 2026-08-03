import { useState, useEffect, useCallback, useRef } from 'react';
import { BankCard, BankCardTransaction } from '@/hooks/useBankCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, Receipt, RefreshCw, Trash2, Pencil, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { BankCardTransactionEditDialog } from './BankCardTransactionEditDialog';
import { format } from 'date-fns-jalali';
import { supabase } from '@/integrations/supabase/client';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { isStatementTransaction, deleteStatementAllocationsForTransaction } from '@/lib/statementPaymentSync';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BankCardTransactionsProps {
  card: BankCard;
  getTransactions: (cardId: string) => Promise<BankCardTransaction[]>;
}

export function BankCardTransactions({ card, getTransactions }: BankCardTransactionsProps) {
  const [transactions, setTransactions] = useState<BankCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState(card.current_balance);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);
  const [isDeletingTransfer, setIsDeletingTransfer] = useState(false);
  const [editingTx, setEditingTx] = useState<BankCardTransaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFetchingRef = useRef(false);

  // Local font-size zoom for transactions list (persisted)
  const ZOOM_KEY = 'bankCardTxZoom';
  const ZOOM_MIN = 0.7;
  const ZOOM_MAX = 2.2;
  const ZOOM_STEP = 0.1;
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const v = parseFloat(window.localStorage.getItem(ZOOM_KEY) || '1');
    return isNaN(v) ? 1 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  });
  useEffect(() => {
    try { window.localStorage.setItem(ZOOM_KEY, String(zoom)); } catch {}
  }, [zoom]);
  const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 100) / 100));
  const zoomIn = () => setZoom(z => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom(z => clampZoom(z - ZOOM_STEP));
  const zoomReset = () => setZoom(1);

  const listRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(z => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };

    const dist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: dist(e.touches[0], e.touches[1]), startZoom: zoom };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const ratio = d / pinchRef.current.startDist;
        setZoom(clampZoom(pinchRef.current.startZoom * ratio));
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom]);

  const fetchTransactions = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const data = await getTransactions(card.id);
      
      // Data is sorted ascending (oldest → newest). Compute running balance in order.
      let runningBalance = card.initial_balance;
      for (const tx of data) {
        if (tx.transaction_type === 'deposit') {
          runningBalance += tx.amount;
        } else {
          runningBalance -= tx.amount;
        }
        tx.balance_after = runningBalance;
      }
      
      setTransactions(data);
      setCurrentBalance(runningBalance);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [card.id, card.initial_balance, getTransactions]);

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel(`bank-card-transactions-${card.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_card_transactions', filter: `bank_card_id=eq.${card.id}` }, () => {
        fetchTransactions();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bank_cards', filter: `id=eq.${card.id}` }, (payload) => {
        if (payload.new) {
          const newData = payload.new as any;
          setCurrentBalance(newData.current_balance);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_report_staff', filter: `bank_card_id=eq.${card.id}` }, () => {
        recalculateBankCardBalance(card.id).then((newBalance) => {
          if (newBalance !== null) setCurrentBalance(newBalance);
          fetchTransactions();
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [card.id, fetchTransactions]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const newBalance = await recalculateBankCardBalance(card.id);
      if (newBalance !== null) setCurrentBalance(newBalance);
      await fetchTransactions();
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDeleteTransfer = async (tx: BankCardTransaction) => {
    setIsDeletingTransfer(true);
    try {
      // برای تراکنش انتقال، فقط طرف مقابلِ همین تراکنش را حذف کن
      // (نه همه‌ی انتقال‌های قبلی بین این دو کارت)
      if (tx.reference_type === 'card_transfer' && tx.reference_id) {
        const oppositeType = tx.transaction_type === 'deposit' ? 'withdrawal' : 'deposit';
        const { data: paired } = await supabase
          .from('bank_card_transactions')
          .select('id')
          .eq('bank_card_id', tx.reference_id)
          .eq('reference_type', 'card_transfer')
          .eq('reference_id', card.id)
          .eq('transaction_type', oppositeType)
          .eq('amount', tx.amount)
          .eq('created_at', tx.created_at)
          .limit(1);

        if (paired && paired.length > 0) {
          await supabase
            .from('bank_card_transactions')
            .delete()
            .eq('id', paired[0].id);
        }
      }

      // پرداخت صورتحساب / چک: تخصیص‌های ثبت‌شده روی فاکتورها هم حذف شود
      if (isStatementTransaction(tx as any)) {
        const { data: auth } = await supabase.auth.getUser();
        await deleteStatementAllocationsForTransaction(tx as any, auth?.user?.id || null);
      }

      // حذف تراکنش انتخاب‌شده
      const { error } = await supabase
        .from('bank_card_transactions')
        .delete()
        .eq('id', tx.id);

      if (error) throw error;


      // محاسبه‌ی مجدد موجودی کارت‌های درگیر
      await recalculateBankCardBalance(card.id);
      if (tx.reference_type === 'card_transfer' && tx.reference_id) {
        await recalculateBankCardBalance(tx.reference_id);
      }

      toast({ title: 'تراکنش با موفقیت حذف شد' });
      await fetchTransactions();
    } catch (err) {
      console.error('خطا در حذف تراکنش:', err);
      toast({ title: 'خطا در حذف تراکنش', variant: 'destructive' });
    } finally {
      setIsDeletingTransfer(false);
      setDeletingTransferId(null);
    }
  };

  const getReferenceLabel = (type: string | null) => {
    switch (type) {
      case 'daily_report_staff': return 'گزارش روزانه';
      case 'order_payment': return 'پرداخت سفارش';
      case 'card_transfer': return 'انتقال بین کارت';
      case 'manual': return 'دستی';
      default: return type || '-';
    }
  };

  const deletingTx = transactions.find(t => t.id === deletingTransferId);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? transactions.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.module_name || '').toLowerCase().includes(q) ||
        getReferenceLabel(t.reference_type).toLowerCase().includes(q)
      )
    : transactions;
  const visibleTransactions = [...filtered].reverse();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deletingTransferId} onOpenChange={(open) => { if (!open) setDeletingTransferId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تراکنش</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئن هستید که می‌خواهید این تراکنش را حذف کنید؟
              {deletingTx?.reference_type === 'card_transfer' && (
                <>
                  <br />
                  این عملیات هر دو طرف تراکنش (کارت مبدأ و مقصد) را حذف خواهد کرد.
                </>
              )}
              <br />
              این عملیات قابل بازگشت نیست.
              {deletingTx && (
                <span className="block mt-2 font-bold">
                  مبلغ: {deletingTx.amount.toLocaleString('fa-IR')} تومان
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTransfer}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTx && handleDeleteTransfer(deletingTx)}
              disabled={isDeletingTransfer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTransfer ? 'در حال حذف...' : 'حذف تراکنش'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BankCardTransactionEditDialog
        open={!!editingTx}
        onOpenChange={(open) => { if (!open) setEditingTx(null); }}
        transaction={editingTx}
        onSaved={fetchTransactions}
      />


      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">موجودی فعلی</span>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            </Button>
            <span className="text-xl font-bold text-emerald-600">
              {currentBalance.toLocaleString('fa-IR')} تومان
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            compactFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در توضیحات تراکنش‌ها..."
            className="pr-10 h-10"
          />
        </div>
        <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30" title="بزرگ‌نمایی متن تراکنش‌ها (Ctrl + چرخش غلطک یا دو انگشت)">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="کوچک‌تر">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={zoomReset}
            className="text-xs font-medium min-w-[42px] tabular-nums hover:text-primary"
            title="بازنشانی"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="بزرگ‌تر">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomReset} title="بازنشانی">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="py-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">تراکنشی یافت نشد</h3>
          <p className="text-muted-foreground">هنوز تراکنشی برای این کارت ثبت نشده است.</p>
        </div>
      ) : (
        <div
          ref={listRef}
          className="divide-y rounded-lg border overflow-hidden touch-pan-y"
          style={{ zoom: zoom, ['--tx-zoom' as any]: zoom, transformOrigin: 'top right' }}
        >
          {visibleTransactions.map((tx) => (
            <div
              key={tx.id}
              className={`p-4 flex items-center gap-4 ${
                tx.transaction_type === 'deposit'
                  ? 'bg-green-50/50 dark:bg-green-950/20'
                  : 'bg-red-50/50 dark:bg-red-950/20'
              }`}
            >
              <div className="flex-shrink-0">
                {tx.transaction_type === 'deposit' ? (
                  <ArrowDownCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <ArrowUpCircle className="h-8 w-8 text-red-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold">
                    {tx.transaction_type === 'deposit' ? 'واریز' : 'برداشت'}
                  </span>
                  {tx.reference_type && (
                    <Badge variant="outline" className="text-xs">
                      {getReferenceLabel(tx.reference_type)}
                    </Badge>
                  )}
                  {tx.module_name && (
                    <Badge variant="secondary" className="text-xs">
                      {tx.module_name}
                    </Badge>
                  )}
                </div>
                {tx.description && (
                  <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap line-clamp-3 max-w-full md:max-w-2xl">{tx.description}</p>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>{format(new Date(tx.effective_time || tx.created_at), 'yyyy/MM/dd - HH:mm')}</span>
                  {tx.report_date && (
                    <span className="text-xs text-primary/70">
                      📅 تاریخ گزارش: {format(new Date(tx.display_report_time || `${tx.report_date}T00:00:00`), 'yyyy/MM/dd - HH:mm')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-left">
                  <div className={`text-lg font-bold ${tx.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.transaction_type === 'deposit' ? '+' : '-'}
                    {tx.amount.toLocaleString('fa-IR')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    مانده: {tx.balance_after.toLocaleString('fa-IR')}
                  </div>
                </div>
                {(tx.reference_type === 'manual' || tx.reference_type === 'card_transfer' || !tx.reference_type || isStatementTransaction(tx as any)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => setEditingTx(tx)}
                    title="ویرایش تراکنش"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {(tx.reference_type === 'manual' || tx.reference_type === 'card_transfer' || !tx.reference_type || isStatementTransaction(tx as any)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingTransferId(tx.id)}
                    title="حذف تراکنش"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
}
