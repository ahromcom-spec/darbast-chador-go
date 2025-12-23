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
  Clock,
  Receipt,
  CreditCard
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
  salaryEarnings: number;
  cashBalance: number;
  // Customer order-related
  orderTotal: number;
  orderPaid: number;
  orderDebt: number;
}

export function UserWallet() {
  const { user, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [summary, setSummary] = useState<WalletSummary>({
    totalIncome: 0,
    totalExpense: 0,
    totalPayments: 0,
    totalDebt: 0,
    balance: 0,
    salaryEarnings: 0,
    cashBalance: 0,
    orderTotal: 0,
    orderPaid: 0,
    orderDebt: 0,
  });

  useEffect(() => {
    if (user?.id && !dataFetched) {
      fetchWalletData();
    }
  }, [user?.id, dataFetched]);

  const fetchWalletData = async () => {
    if (!user?.id) return;

    try {
      setDataLoading(true);

      // Get user profile for phone lookup
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number, full_name')
        .eq('user_id', user.id)
        .single();

      // Fetch transactions for display
      const { data: txs, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(txs || []);

      // Calculate salary earnings from daily reports (same logic as PersonnelAccountingModule)
      let salaryEarnings = 0;
      let cashBalance = 0;

      if (profile?.phone_number) {
        const { workRecordsSummary, salarySettings } = await calculateSalaryFromReports(user.id, profile.phone_number, profile.full_name);
        
        if (salarySettings) {
          const dailySalary = salarySettings.base_daily_salary;
          const overtimeFraction = salarySettings.overtime_rate_fraction;
          const overtimeDenominator = overtimeFraction > 0 ? Math.round(1 / overtimeFraction) : 6;
          const hourlyOvertime = dailySalary / overtimeDenominator;

          const salaryFromDays = workRecordsSummary.totalPresent * dailySalary;
          const overtimeFromHours = Math.round(workRecordsSummary.totalOvertime * hourlyOvertime);
          salaryEarnings = salaryFromDays + overtimeFromHours;
        }

        // Cash balance: پرداختی - دریافتی (positive if user spent more = company owes user)
        cashBalance = workRecordsSummary.totalSpent - workRecordsSummary.totalReceived;
      }

      // Calculate customer order debt
      let orderTotal = 0;
      let orderPaid = 0;
      let orderDebt = 0;

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customer) {
        const { data: orders } = await supabase
          .from('projects_v3')
          .select('payment_amount, payment_confirmed_at, notes, total_paid')
          .eq('customer_id', customer.id);

        if (orders) {
          orders.forEach(order => {
            const totalAmount = order.payment_amount || 0;
            orderTotal += totalAmount;
            
            if (order.payment_confirmed_at) {
              // Fully paid order
              orderPaid += totalAmount;
            } else {
              // Check for advance payment from total_paid or notes
              let advancePayment = order.total_paid || 0;
              if (!advancePayment && order.notes) {
                try {
                  const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
                  advancePayment = notesData?.advance_payment || 0;
                } catch {
                  advancePayment = 0;
                }
              }
              orderPaid += advancePayment;
            }
          });
          orderDebt = orderTotal - orderPaid;
        }
      }

      // Final balance = salary earnings + cash balance - order debt
      const finalBalance = salaryEarnings + cashBalance - orderDebt;

      setSummary({
        totalIncome: 0,
        totalExpense: 0,
        totalPayments: 0,
        totalDebt: orderDebt,
        balance: finalBalance,
        salaryEarnings,
        cashBalance,
        orderTotal,
        orderPaid,
        orderDebt,
      });
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setDataLoading(false);
      setDataFetched(true);
    }
  };

  // Calculate salary from daily reports (same as PersonnelAccountingModule)
  const calculateSalaryFromReports = async (userId: string, phone: string, fullName: string | null) => {
    let workRecordsSummary = {
      totalPresent: 0,
      totalAbsent: 0,
      totalOvertime: 0,
      totalReceived: 0,
      totalSpent: 0,
    };
    let salarySettings: { base_daily_salary: number; overtime_rate_fraction: number } | null = null;

    try {
      // Get staff records linked to this user by staff_user_id
      const { data: staffRecordsByUserId } = await supabase
        .from('daily_report_staff')
        .select('*')
        .eq('staff_user_id', userId);

      // Also search by phone number in staff_name (for records without staff_user_id)
      const phoneDigits = phone.replace(/\D/g, '');
      const lastFourDigits = phoneDigits.slice(-4);
      
      let userFullName = fullName || '';
      if (!userFullName) {
        const { data: hrEmployee } = await supabase
          .from('hr_employees')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle();
        userFullName = hrEmployee?.full_name || '';
      }

      // Search for records where staff_name contains the phone number or user's name
      let staffRecordsByName: any[] = [];
      if (phoneDigits || userFullName) {
        const { data: nameRecords } = await supabase
          .from('daily_report_staff')
          .select('*')
          .is('staff_user_id', null);

        if (nameRecords) {
          staffRecordsByName = nameRecords.filter(record => {
            const staffName = (record.staff_name || '').toLowerCase();
            if (phoneDigits && (staffName.includes(phoneDigits) || staffName.includes(lastFourDigits))) {
              return true;
            }
            if (userFullName) {
              const nameParts = userFullName.toLowerCase().split(' ');
              return nameParts.every(part => staffName.includes(part));
            }
            return false;
          });
        }
      }

      // Combine and deduplicate records
      const allRecords = [...(staffRecordsByUserId || [])];
      const existingIds = new Set(allRecords.map(r => r.id));
      staffRecordsByName.forEach(record => {
        if (!existingIds.has(record.id)) {
          allRecords.push(record);
          existingIds.add(record.id);
        }
      });

      // Calculate summary from records
      allRecords.forEach(record => {
        if (record.work_status === 'حاضر') workRecordsSummary.totalPresent++;
        if (record.work_status === 'غایب') workRecordsSummary.totalAbsent++;
        workRecordsSummary.totalOvertime += record.overtime_hours || 0;
        workRecordsSummary.totalReceived += record.amount_received || 0;
        workRecordsSummary.totalSpent += record.amount_spent || 0;
      });

      // Fetch salary settings - try multiple matching strategies
      const { data: salaryByPhone } = await supabase
        .from('staff_salary_settings')
        .select('base_daily_salary, overtime_rate_fraction')
        .eq('staff_code', phone)
        .maybeSingle();

      if (salaryByPhone) {
        salarySettings = salaryByPhone;
      } else {
        const normalizedPhone = phone.startsWith('0') ? phone.substring(1) : phone;
        const { data: salaryByNormalized } = await supabase
          .from('staff_salary_settings')
          .select('base_daily_salary, overtime_rate_fraction')
          .or(`staff_code.eq.${normalizedPhone},staff_code.eq.0${normalizedPhone}`)
          .maybeSingle();

        if (salaryByNormalized) {
          salarySettings = salaryByNormalized;
        } else if (userFullName) {
          const { data: salaryByName } = await supabase
            .from('staff_salary_settings')
            .select('base_daily_salary, overtime_rate_fraction')
            .eq('staff_name', userFullName)
            .maybeSingle();

          if (salaryByName) {
            salarySettings = salaryByName;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating salary from reports:', error);
    }

    return { workRecordsSummary, salarySettings };
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

  if (authLoading || dataLoading) {
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
                    {summary.balance >= 0 ? 'مانده حساب' : 'بدهی به شرکت'}
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
              {/* Staff salary section - only show if user has salary data */}
              {(summary.salaryEarnings > 0 || summary.cashBalance !== 0) && (
                <>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">جمع کارکرد حقوق</span>
                    </div>
                    <div className="font-bold text-green-600">{formatCurrency(summary.salaryEarnings)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-muted-foreground">مانده نقدی</span>
                    </div>
                    <div className={`font-bold ${summary.cashBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.cashBalance >= 0 ? '+' : ''}{formatCurrency(summary.cashBalance)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {summary.cashBalance >= 0 ? 'طلب از شرکت' : 'بدهی به شرکت'}
                    </div>
                  </div>
                </>
              )}
              
              {/* Customer order debt section - only show if user has orders */}
              {summary.orderTotal > 0 && (
                <>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">جمع سفارشات</span>
                    </div>
                    <div className="font-bold text-blue-600">{formatCurrency(summary.orderTotal)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">پرداخت شده</span>
                    </div>
                    <div className="font-bold text-green-600">{formatCurrency(summary.orderPaid)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-muted-foreground">بدهی سفارشات به شرکت</span>
                    </div>
                    <div className="font-bold text-red-600 text-lg">{formatCurrency(summary.orderDebt)}</div>
                  </div>
                </>
              )}
            </div>

            {/* Balance */}
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-purple-600" />
                  <div>
                    <span className="font-semibold">مانده حساب شما</span>
                    {summary.balance >= 0 && (
                      <Badge variant="secondary" className="mr-2 bg-green-100 text-green-800">طلبکار</Badge>
                    )}
                  </div>
                </div>
                <span className={`font-bold text-xl ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 text-left">
                جمع کارکرد حقوق + مانده نقدی
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
