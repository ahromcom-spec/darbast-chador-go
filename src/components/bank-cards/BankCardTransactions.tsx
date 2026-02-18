import { useState, useEffect, useCallback, useRef } from 'react';
import { BankCard, BankCardTransaction } from '@/hooks/useBankCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { supabase } from '@/integrations/supabase/client';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { Button } from '@/components/ui/button';
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
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchTransactions = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const data = await getTransactions(card.id);
      
      // Recalculate balance_after client-side based on sorted order
      const ascending = [...data].reverse();
      let runningBalance = card.initial_balance;
      for (const tx of ascending) {
        if (tx.transaction_type === 'deposit') {
          runningBalance += tx.amount;
        } else {
          runningBalance -= tx.amount;
        }
        tx.balance_after = runningBalance;
      }
      
      setTransactions(ascending.reverse());
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
      // حذف تراکنش متناظر از کارت دیگر
      if (tx.reference_id) {
        await supabase
          .from('bank_card_transactions')
          .delete()
          .eq('bank_card_id', tx.reference_id)
          .eq('reference_type', 'card_transfer')
          .eq('reference_id', card.id);
      }

      // حذف تراکنش خود کارت فعلی
      const { error } = await supabase
        .from('bank_card_transactions')
        .delete()
        .eq('id', tx.id);

      if (error) throw error;

      toast({ title: 'تراکنش انتقال با موفقیت حذف شد' });
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
            <AlertDialogTitle>حذف تراکنش انتقال</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئن هستید که می‌خواهید این تراکنش انتقال را حذف کنید؟
              <br />
              این عملیات هر دو طرف تراکنش (کارت مبدأ و مقصد) را حذف خواهد کرد و قابل بازگشت نیست.
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

      {transactions.length === 0 ? (
        <div className="py-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">تراکنشی یافت نشد</h3>
          <p className="text-muted-foreground">هنوز تراکنشی برای این کارت ثبت نشده است.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {transactions.map((tx) => (
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
                  <p className="text-sm text-muted-foreground truncate">{tx.description}</p>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>{format(new Date(tx.created_at), 'yyyy/MM/dd - HH:mm')}</span>
                  {tx.report_date && (
                    <span className="text-xs text-primary/70">
                      📅 تاریخ گزارش: {format(new Date(tx.report_date + 'T00:00:00'), 'yyyy/MM/dd')}
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
                {tx.reference_type === 'card_transfer' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingTransferId(tx.id)}
                    title="حذف تراکنش انتقال"
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
