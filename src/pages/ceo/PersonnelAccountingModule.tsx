import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Calculator, 
  Calendar, 
  Clock, 
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  User,
  Banknote,
  Send,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

interface StaffWorkRecord {
  id: string;
  daily_report_id: string;
  staff_name: string | null;
  staff_user_id: string | null;
  work_status: string;
  overtime_hours: number | null;
  amount_received: number | null;
  amount_spent: number | null;
  receiving_notes: string | null;
  spending_notes: string | null;
  notes: string | null;
  is_cash_box: boolean | null;
  created_at: string;
  report_date?: string;
}

interface DailyReport {
  id: string;
  report_date: string;
}

interface SalarySetting {
  base_daily_salary: number;
  overtime_rate_fraction: number;
}

export default function PersonnelAccountingModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [hrEmployeeId, setHrEmployeeId] = useState<string | null>(null);
  const [workRecords, setWorkRecords] = useState<StaffWorkRecord[]>([]);
  const [salarySetting, setSalarySetting] = useState<SalarySetting | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalOvertime: 0,
    totalReceived: 0,
    totalSpent: 0,
    balance: 0,
    salaryEarnings: 0,
    overtimeEarnings: 0,
    totalEarnings: 0,
  });
  const [balanceSynced, setBalanceSynced] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number, full_name')
        .eq('user_id', user.id)
        .single();

      if (!profile?.phone_number) {
        setLoading(false);
        return;
      }

      setUserPhone(profile.phone_number);
      setUserName(profile.full_name);

      // Check if user is linked to hr_employees
      const { data: hrEmployee } = await supabase
        .from('hr_employees')
        .select('id, full_name')
        .eq('user_id', user.id)
        .single();

      if (hrEmployee) {
        setHrEmployeeId(hrEmployee.id);
        setUserName(hrEmployee.full_name);
      }

      // Fetch work records for this user
      await fetchWorkRecords(user.id, profile.phone_number);
      
      // Fetch wallet data
      await fetchWalletData(user.id);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('خطا در دریافت اطلاعات کاربر');
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletData = async (userId: string) => {
    try {
      // Fetch recent wallet transactions for salary/staff_audit
      const { data: txs, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .in('reference_type', ['staff_audit', 'daily_report_staff'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setWalletTransactions(txs || []);

      // Wallet balance: prefer balance_after if available, otherwise compute by summing amounts
      const { data: lastTx } = await supabase
        .from('wallet_transactions')
        .select('balance_after')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestBalanceAfter = lastTx?.balance_after ?? null;

      let computedBalance = 0;
      if (latestBalanceAfter === null) {
        const { data: amountRows } = await supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('user_id', userId)
          .limit(1000);

        computedBalance = (amountRows || []).reduce((sum, row) => sum + (row.amount || 0), 0);
      }

      setWalletBalance(latestBalanceAfter ?? computedBalance);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  };

  const fetchWorkRecords = async (userId: string, phone: string) => {
    try {
      // Get work records where staff_user_id matches OR phone/name matches
      // First, get all daily reports
      const { data: reports, error: reportsError } = await supabase
        .from('daily_reports')
        .select('id, report_date')
        .order('report_date', { ascending: false });

      if (reportsError) throw reportsError;

      const reportMap = new Map<string, string>();
      reports?.forEach(r => reportMap.set(r.id, r.report_date));

      // Get staff records linked to this user by staff_user_id
      const { data: staffRecordsByUserId, error: staffError1 } = await supabase
        .from('daily_report_staff')
        .select('*')
        .eq('staff_user_id', userId)
        .order('created_at', { ascending: false });

      if (staffError1) throw staffError1;

      // Also search by phone number in staff_name (for records without staff_user_id)
      // Extract just the phone digits for matching
      const phoneDigits = phone.replace(/\D/g, '');
      const lastFourDigits = phoneDigits.slice(-4);
      
      // Get user's full name for name-based matching
      let userFullName = userName || '';
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
        const { data: nameRecords, error: staffError2 } = await supabase
          .from('daily_report_staff')
          .select('*')
          .is('staff_user_id', null) // Only records without user_id
          .order('created_at', { ascending: false });

        if (!staffError2 && nameRecords) {
          // Filter records where staff_name contains phone number or user's name
          staffRecordsByName = nameRecords.filter(record => {
            const staffName = (record.staff_name || '').toLowerCase();
            // Match by phone number (full or last 4 digits)
            if (phoneDigits && (staffName.includes(phoneDigits) || staffName.includes(lastFourDigits))) {
              return true;
            }
            // Match by user's full name
            if (userFullName) {
              const nameParts = userFullName.toLowerCase().split(' ');
              // If staff_name contains all parts of the user's name
              return nameParts.every(part => staffName.includes(part));
            }
            return false;
          });
        }
      }

      // Combine and deduplicate records by id
      const allRecords = [...(staffRecordsByUserId || [])];
      const existingIds = new Set(allRecords.map(r => r.id));
      staffRecordsByName.forEach(record => {
        if (!existingIds.has(record.id)) {
          allRecords.push(record);
          existingIds.add(record.id);
        }
      });

      // Add report_date to each record
      const recordsWithDates = allRecords.map(record => ({
        ...record,
        report_date: reportMap.get(record.daily_report_id),
      }));

      // Sort by report_date descending
      recordsWithDates.sort((a, b) => {
        const dateA = a.report_date || '';
        const dateB = b.report_date || '';
        return dateB.localeCompare(dateA);
      });

      setWorkRecords(recordsWithDates);

      // Fetch salary settings for this user - try multiple matching strategies
      // 1. First try exact phone match
      let salaryData = null;
      
      const { data: salaryByPhone } = await supabase
        .from('staff_salary_settings')
        .select('base_daily_salary, overtime_rate_fraction, staff_code, staff_name')
        .eq('staff_code', phone)
        .maybeSingle();
      
      if (salaryByPhone) {
        salaryData = salaryByPhone;
      } else {
        // 2. Try with normalized phone (remove leading 0)
        const normalizedPhone = phone.startsWith('0') ? phone.substring(1) : phone;
        const { data: salaryByNormalized } = await supabase
          .from('staff_salary_settings')
          .select('base_daily_salary, overtime_rate_fraction, staff_code, staff_name')
          .or(`staff_code.eq.${normalizedPhone},staff_code.eq.0${normalizedPhone}`)
          .maybeSingle();
        
        if (salaryByNormalized) {
          salaryData = salaryByNormalized;
        } else {
          // 3. Try by staff name from HR
          const { data: hrEmployee } = await supabase
            .from('hr_employees')
            .select('full_name')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (hrEmployee?.full_name) {
            const { data: salaryByName } = await supabase
              .from('staff_salary_settings')
              .select('base_daily_salary, overtime_rate_fraction, staff_code, staff_name')
              .eq('staff_name', hrEmployee.full_name)
              .maybeSingle();
            
            if (salaryByName) {
              salaryData = salaryByName;
            }
          }
        }
      }

      console.log('Salary settings lookup:', { phone, salaryData });
      
      const userSalarySetting = salaryData ? {
        base_daily_salary: salaryData.base_daily_salary,
        overtime_rate_fraction: salaryData.overtime_rate_fraction
      } : null;
      setSalarySetting(userSalarySetting);

      // Calculate summary
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalOvertime = 0;
      let totalReceived = 0;
      let totalSpent = 0;

      recordsWithDates.forEach(record => {
        if (record.work_status === 'حاضر') totalPresent++;
        if (record.work_status === 'غایب') totalAbsent++;
        totalOvertime += record.overtime_hours || 0;
        totalReceived += record.amount_received || 0;
        totalSpent += record.amount_spent || 0;
      });

      // Calculate salary earnings
      let salaryEarnings = 0;
      let overtimeEarnings = 0;

      if (userSalarySetting) {
        const dailySalary = userSalarySetting.base_daily_salary;
        const overtimeFraction = userSalarySetting.overtime_rate_fraction;
        const overtimeDenominator = overtimeFraction > 0 ? Math.round(1 / overtimeFraction) : 6;
        const hourlyOvertime = dailySalary / overtimeDenominator;

        salaryEarnings = totalPresent * dailySalary;
        overtimeEarnings = Math.round(totalOvertime * hourlyOvertime);
      }

      const totalEarnings = salaryEarnings + overtimeEarnings;

      // مانده حساب نقدی (پرداختی - دریافتی)
      // دریافتی = منفی (پول گرفته از شرکت = بدهی به شرکت)
      // پرداختی = مثبت (خرج کرده برای شرکت = طلب از شرکت)
      // مانده = پرداختی - دریافتی (اگر بیشتر خرج کرده، مثبت = طلب دارد)
      const cashBalance = totalSpent - totalReceived;
      
      // مانده نهایی = جمع کارکرد حقوق + مانده حساب نقدی
      const finalBalance = totalEarnings > 0 
        ? totalEarnings + cashBalance 
        : cashBalance;
      
      setSummary({
        totalPresent,
        totalAbsent,
        totalOvertime,
        totalReceived,
        totalSpent,
        balance: cashBalance,
        salaryEarnings,
        overtimeEarnings,
        totalEarnings,
      });

      // Note: Auto-sync removed to prevent constant refreshes
      // Balance syncing is now done only when user explicitly requests it
    } catch (error) {
      console.error('Error fetching work records:', error);
      toast.error('خطا در دریافت کارکرد');
    }
  };

  // Auto sync balance to wallet - updates or creates personnel accounting record
  const autoSyncBalanceToWallet = async (
    userId: string, 
    finalBalance: number, 
    totalPresent: number, 
    totalReceived: number, 
    totalSpent: number,
    totalEarnings: number
  ) => {
    try {
      // پرداختی - دریافتی (پرداختی مثبت، دریافتی منفی)
      const cashBalance = totalSpent - totalReceived;
      
      // Get existing personnel_accounting transaction (any date)
      const { data: existingSync } = await supabase
        .from('wallet_transactions')
        .select('id, amount, balance_after')
        .eq('user_id', userId)
        .eq('reference_type', 'personnel_accounting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Skip if already synced with same amount
      if (existingSync && existingSync.amount === finalBalance) {
        setBalanceSynced(true);
        setWalletBalance(existingSync.balance_after);
        return;
      }

      const title = finalBalance >= 0 
        ? 'حساب کارکرد نیرو - طلب از شرکت' 
        : 'حساب کارکرد نیرو - بدهی به شرکت';
      
      const description = totalEarnings > 0
        ? `جمع کارکرد حقوق: ${new Intl.NumberFormat('fa-IR').format(totalEarnings)} + مانده نقدی: ${new Intl.NumberFormat('fa-IR').format(cashBalance)} = ${new Intl.NumberFormat('fa-IR').format(finalBalance)} ریال`
        : `${totalPresent} روز حضور | دریافتی: ${new Intl.NumberFormat('fa-IR').format(totalReceived)} | پرداختی: ${new Intl.NumberFormat('fa-IR').format(totalSpent)} ریال`;

      if (existingSync) {
        // Update existing record with new balance
        const balanceDifference = finalBalance - existingSync.amount;
        const newBalance = existingSync.balance_after + balanceDifference;

        const { error: updateError } = await supabase
          .from('wallet_transactions')
          .update({
            transaction_type: finalBalance >= 0 ? 'income' : 'expense',
            amount: finalBalance,
            balance_after: newBalance,
            title: title,
            description: description,
            created_at: new Date().toISOString(),
          })
          .eq('id', existingSync.id);

        if (updateError) throw updateError;

        setBalanceSynced(true);
        setWalletBalance(newBalance);
        console.log('Updated personnel accounting in wallet:', finalBalance, '(salary:', totalEarnings, '+ cash:', cashBalance, ')');
      } else {
        // Create new record - get current wallet balance first
        const { data: lastTx } = await supabase
          .from('wallet_transactions')
          .select('balance_after')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentWalletBalance = lastTx?.balance_after || 0;
        const newBalance = currentWalletBalance + finalBalance;

        const { error: txError } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: userId,
            transaction_type: finalBalance >= 0 ? 'income' : 'expense',
            amount: finalBalance,
            balance_after: newBalance,
            title: title,
            description: description,
            reference_type: 'personnel_accounting',
          });

        if (txError) throw txError;

        setBalanceSynced(true);
        setWalletBalance(newBalance);
        console.log('Created personnel accounting in wallet:', finalBalance, '(salary:', totalEarnings, '+ cash:', cashBalance, ')');
      }
    } catch (error) {
      console.error('Error auto-syncing to wallet:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd', { locale: faIR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">در حال بارگذاری...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              className="shrink-0"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">حسابکتاب و کارکرد</h1>
              <p className="text-sm text-muted-foreground">
                {userName || 'کاربر'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* User Info Card */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">{userName || 'کاربر'}</h2>
                <p className="text-sm text-muted-foreground" dir="ltr">
                  {userPhone}
                </p>
              </div>
              <Badge variant={hrEmployeeId ? 'default' : 'secondary'}>
                {hrEmployeeId ? 'نیروی اهرم' : 'کاربر عادی'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Work Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.totalPresent}</div>
              <div className="text-sm text-muted-foreground">روز حضور</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{summary.totalAbsent}</div>
              <div className="text-sm text-muted-foreground">روز غیبت</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalOvertime}</div>
              <div className="text-sm text-muted-foreground">ساعت اضافه‌کاری</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{workRecords.length}</div>
              <div className="text-sm text-muted-foreground">کل ثبت‌ها</div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              خلاصه مالی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span>کل دریافتی</span>
              </div>
              <span className="font-bold text-red-600">{formatCurrency(summary.totalReceived)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>خرج کرده در کار</span>
              </div>
              <span className="font-bold text-green-600">{formatCurrency(summary.totalSpent)}</span>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <span className="font-semibold">مانده حساب</span>
                </div>
                <div className="text-left">
                  <span className={`font-bold text-lg ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {summary.balance >= 0 ? 'طلب از شرکت' : 'بدهی به شرکت'}
                  </div>
                </div>
              </div>
              
              {/* Auto Sync Status */}
              {workRecords.length > 0 && balanceSynced && (
                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">مانده حساب به کیف پول شما ارسال شد</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Salary Earnings Summary */}
        <Card className="border-2 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              کارکرد حقوق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {salarySetting ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    <span>حقوق روزهای حضور ({summary.totalPresent} روز)</span>
                  </div>
                  <span className="font-bold text-amber-600">{formatCurrency(summary.salaryEarnings)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span>اضافه‌کاری ({summary.totalOvertime} ساعت)</span>
                  </div>
                  <span className="font-bold text-blue-600">{formatCurrency(summary.overtimeEarnings)}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-amber-600" />
                    <span className="font-semibold">جمع کارکرد حقوق</span>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-xl text-amber-600">
                      {formatCurrency(summary.totalEarnings)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-lg">
                  <p>حقوق روزانه: {new Intl.NumberFormat('fa-IR').format(salarySetting.base_daily_salary)} تومان</p>
                  <p>ضریب اضافه‌کاری: ۱/{Math.round(1 / salarySetting.overtime_rate_fraction)}</p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>تنظیمات حقوق برای شما ثبت نشده است</p>
                <p className="text-sm mt-2">برای محاسبه کارکرد، مدیر باید تنظیمات حقوق شما را ثبت کند</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Balance Card - جمع کارکرد حقوق + مانده حساب */}
        <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600" />
              موجودی کیف پول
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total Balance = Salary Earnings + Cash Balance */}
            {(() => {
              // مانده نهایی کیف پول = جمع کارکرد حقوق + مانده حساب نقدی
              const totalWallet = summary.totalEarnings + summary.balance;
              return (
                <div className="flex items-center justify-between p-5 rounded-lg bg-background/80 border-2 border-purple-300 dark:border-purple-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-500/20">
                      <Calculator className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">مانده حساب شما</p>
                      <p className={`font-bold text-2xl ${totalWallet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalWallet >= 0 ? '+' : ''}{formatCurrency(totalWallet)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={totalWallet >= 0 ? 'default' : 'destructive'}
                    className={totalWallet >= 0 ? 'bg-green-100 text-green-800' : ''}
                  >
                    {totalWallet >= 0 ? 'طلبکار' : 'بدهکار'}
                  </Badge>
                </div>
              );
            })()}

            {/* Recent Wallet Transactions - دریافتی منفی، پرداختی مثبت */}
            {walletTransactions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">آخرین تراکنش‌های حقوقی</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {walletTransactions.slice(0, 5).map((tx: any) => {
                    // دریافتی = منفی (پول گرفته از شرکت)
                    // پرداختی = مثبت (خرج کرده برای شرکت)
                    const isReceived = tx.title?.includes('دریافتی');
                    const isSpent = tx.title?.includes('پرداختی');
                    const displayAmount = isReceived ? -Math.abs(tx.amount) : (isSpent ? Math.abs(tx.amount) : tx.amount);
                    
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="font-medium text-sm">{tx.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                        <span className={`font-bold ${displayAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {displayAmount >= 0 ? '+' : ''}{formatCurrency(displayAmount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Records List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              سوابق کارکرد روزانه
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هنوز سابقه‌ای ثبت نشده است</p>
                {!hrEmployeeId && (
                  <p className="text-sm mt-2">
                    برای مشاهده کارکرد، باید در منابع انسانی ثبت شوید
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {workRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 rounded-lg border bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatDate(record.report_date)}</span>
                      </div>
                      <Badge variant={record.work_status === 'حاضر' ? 'default' : 'destructive'}>
                        {record.work_status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {record.overtime_hours && record.overtime_hours > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>اضافه‌کاری: {record.overtime_hours} ساعت</span>
                        </div>
                      )}
                      {record.amount_received && record.amount_received > 0 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <TrendingUp className="h-4 w-4" />
                          <span>دریافت: {formatCurrency(record.amount_received)}</span>
                        </div>
                      )}
                      {record.amount_spent && record.amount_spent > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <TrendingDown className="h-4 w-4" />
                          <span>پرداخت: {formatCurrency(record.amount_spent)}</span>
                        </div>
                      )}
                    </div>

                    {(record.notes || record.receiving_notes || record.spending_notes) && (
                      <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                        {record.notes && <p>یادداشت: {record.notes}</p>}
                        {record.receiving_notes && <p>دریافت: {record.receiving_notes}</p>}
                        {record.spending_notes && <p>پرداخت: {record.spending_notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
