import { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number | null;
  title: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface WalletSummary {
  totalIncome: number;
  totalExpense: number;
  totalPayments: number;
  totalDebt: number;
  balance: number;
}

export function UserWallet() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [summary, setSummary] = useState<WalletSummary>({
    totalIncome: 0,
    totalExpense: 0,
    totalPayments: 0,
    totalDebt: 0,
    balance: 0,
  });

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch transactions
      const { data: txs, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(txs || []);

      // Calculate summary
      let totalIncome = 0;
      let totalExpense = 0;
      let totalPayments = 0;
      let totalDebt = 0;

      (txs || []).forEach(tx => {
        if (tx.transaction_type === 'income' || tx.transaction_type === 'salary') {
          totalIncome += Math.abs(tx.amount);
        } else if (tx.transaction_type === 'expense') {
          totalExpense += Math.abs(tx.amount);
        } else if (tx.transaction_type === 'payment') {
          totalPayments += Math.abs(tx.amount);
        } else if (tx.transaction_type === 'invoice_debt') {
          totalDebt += Math.abs(tx.amount);
        }
      });

      const balance = txs?.length ? (txs[0].balance_after || 0) : 0;

      setSummary({
        totalIncome,
        totalExpense,
        totalPayments,
        totalDebt,
        balance,
      });
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(Math.abs(amount)) + ' ریال';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd HH:mm', { locale: faIR });
    } catch {
      return dateStr;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
      case 'salary':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'expense':
      case 'invoice_debt':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'payment':
        return <Wallet className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'income':
        return <Badge variant="default" className="bg-green-100 text-green-800">دریافتی</Badge>;
      case 'salary':
        return <Badge variant="default" className="bg-green-100 text-green-800">حقوق</Badge>;
      case 'expense':
        return <Badge variant="destructive">پرداختی</Badge>;
      case 'payment':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">پرداخت فاکتور</Badge>;
      case 'invoice_debt':
        return <Badge variant="destructive">بدهی</Badge>;
      case 'adjustment':
        return <Badge variant="secondary">تعدیل</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-purple-500/30">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          <span className="mr-2 text-muted-foreground">در حال بارگذاری کیف پول...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-500/30 shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Wallet className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    کیف پول
                    <Badge 
                      variant={summary.balance >= 0 ? 'default' : 'destructive'}
                      className={summary.balance >= 0 ? 'bg-green-100 text-green-800' : ''}
                    >
                      {formatCurrency(summary.balance)}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    مشاهده تراکنش‌ها و موجودی حساب
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="group-hover:bg-accent">
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">کل دریافتی</span>
                </div>
                <div className="font-bold text-green-600">{formatCurrency(summary.totalIncome)}</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-muted-foreground">کل پرداختی</span>
                </div>
                <div className="font-bold text-red-600">{formatCurrency(summary.totalExpense)}</div>
              </div>
            </div>

            {/* Balance */}
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold">مانده حساب</span>
                </div>
                <span className={`font-bold text-xl ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.balance >= 0 ? '+' : '-'}{formatCurrency(summary.balance)}
                </span>
              </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                آخرین تراکنش‌ها
                {transactions.length > 0 && (
                  <Badge variant="secondary" className="mr-2">{transactions.length}</Badge>
                )}
              </h4>

              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>هنوز تراکنشی ثبت نشده است</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-background">
                          {getTransactionIcon(tx.transaction_type)}
                        </div>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {tx.title}
                            {getTransactionBadge(tx.transaction_type)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(tx.created_at)}</span>
                          </div>
                          {tx.description && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                              {tx.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`font-bold ${getTransactionColor(tx.transaction_type, tx.amount)}`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
