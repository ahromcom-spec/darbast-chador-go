import { useState, useEffect } from 'react';
import { BankCard, BankCardTransaction } from '@/hooks/useBankCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, Receipt } from 'lucide-react';
import { format } from 'date-fns-jalali';

interface BankCardTransactionsProps {
  card: BankCard;
  getTransactions: (cardId: string) => Promise<BankCardTransaction[]>;
}

export function BankCardTransactions({ card, getTransactions }: BankCardTransactionsProps) {
  const [transactions, setTransactions] = useState<BankCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await getTransactions(card.id);
      setTransactions(data);
      setLoading(false);
    };
    fetch();
  }, [card.id, getTransactions]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <Receipt className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-2">تراکنشی یافت نشد</h3>
        <p className="text-muted-foreground">
          هنوز تراکنشی برای این کارت ثبت نشده است.
        </p>
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
          <span className="text-xl font-bold text-emerald-600">
            {card.current_balance.toLocaleString('fa-IR')} تومان
          </span>
        </div>
      </div>

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
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">
                  {tx.transaction_type === 'deposit' ? 'واریز' : 'برداشت'}
                </span>
                {tx.reference_type && (
                  <Badge variant="outline" className="text-xs">
                    {getReferenceLabel(tx.reference_type)}
                  </Badge>
                )}
              </div>
              {tx.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {tx.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(tx.created_at), 'yyyy/MM/dd - HH:mm')}
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
    </div>
  );
}
