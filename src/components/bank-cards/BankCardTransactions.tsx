import { useState, useEffect, useCallback, useRef } from 'react';
import { BankCard, BankCardTransaction } from '@/hooks/useBankCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, Receipt, RefreshCw } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { supabase } from '@/integrations/supabase/client';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { Button } from '@/components/ui/button';

interface BankCardTransactionsProps {
  card: BankCard;
  getTransactions: (cardId: string) => Promise<BankCardTransaction[]>;
}

export function BankCardTransactions({ card, getTransactions }: BankCardTransactionsProps) {
  const [transactions, setTransactions] = useState<BankCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState(card.current_balance);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchTransactions = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const data = await getTransactions(card.id);
      setTransactions(data);
      
      // Also fetch the latest balance
      const { data: cardData } = await supabase
        .from('bank_cards')
        .select('current_balance')
        .eq('id', card.id)
        .single();
      
      if (cardData) {
        setCurrentBalance(cardData.current_balance);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [card.id, getTransactions]);

  // Setup realtime subscription
  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel(`bank-card-transactions-${card.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_card_transactions',
          filter: `bank_card_id=eq.${card.id}`
        },
        () => {
          fetchTransactions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bank_cards',
          filter: `id=eq.${card.id}`
        },
        (payload) => {
          if (payload.new) {
            const newData = payload.new as any;
            setCurrentBalance(newData.current_balance);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_staff',
          filter: `bank_card_id=eq.${card.id}`
        },
        () => {
          // Recalculate and refetch when daily report staff changes
          recalculateBankCardBalance(card.id).then((newBalance) => {
            if (newBalance !== null) {
              setCurrentBalance(newBalance);
            }
            fetchTransactions();
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [card.id, fetchTransactions]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const newBalance = await recalculateBankCardBalance(card.id);
      if (newBalance !== null) {
        setCurrentBalance(newBalance);
      }
      await fetchTransactions();
    } finally {
      setIsRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const getReferenceLabel = (type: string | null) => {
    switch (type) {
      case 'daily_report_staff':
        return 'گزارش روزانه';
      case 'order_payment':
        return 'پرداخت سفارش';
      case 'manual':
        return 'دستی';
      default:
        return type || '-';
    }
  };

  return (
    <div className="space-y-4">
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
          <p className="text-muted-foreground">
            هنوز تراکنشی برای این کارت ثبت نشده است.
          </p>
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
                  <p className="text-sm text-muted-foreground truncate">
                    {tx.description}
                  </p>
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

              <div className="text-left">
                <div
                  className={`text-lg font-bold ${
                    tx.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {tx.transaction_type === 'deposit' ? '+' : '-'}
                  {tx.amount.toLocaleString('fa-IR')}
                </div>
                <div className="text-xs text-muted-foreground">
                  مانده: {tx.balance_after.toLocaleString('fa-IR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
