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
  User
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

export default function PersonnelAccountingModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [hrEmployeeId, setHrEmployeeId] = useState<string | null>(null);
  const [workRecords, setWorkRecords] = useState<StaffWorkRecord[]>([]);
  const [summary, setSummary] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalOvertime: 0,
    totalReceived: 0,
    totalSpent: 0,
    balance: 0,
  });

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
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('خطا در دریافت اطلاعات کاربر');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkRecords = async (userId: string, phone: string) => {
    try {
      // Get work records where staff_user_id matches OR phone number matches
      // First, get all daily reports
      const { data: reports, error: reportsError } = await supabase
        .from('daily_reports')
        .select('id, report_date')
        .order('report_date', { ascending: false });

      if (reportsError) throw reportsError;

      const reportMap = new Map<string, string>();
      reports?.forEach(r => reportMap.set(r.id, r.report_date));

      // Get staff records linked to this user
      const { data: staffRecords, error: staffError } = await supabase
        .from('daily_report_staff')
        .select('*')
        .eq('staff_user_id', userId)
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;

      // Add report_date to each record
      const recordsWithDates = (staffRecords || []).map(record => ({
        ...record,
        report_date: reportMap.get(record.daily_report_id),
      }));

      setWorkRecords(recordsWithDates);

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

      setSummary({
        totalPresent,
        totalAbsent,
        totalOvertime,
        totalReceived,
        totalSpent,
        balance: totalReceived - totalSpent,
      });
    } catch (error) {
      console.error('Error fetching work records:', error);
      toast.error('خطا در دریافت کارکرد');
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
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>کل دریافتی</span>
              </div>
              <span className="font-bold text-green-600">{formatCurrency(summary.totalReceived)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span>کل پرداختی</span>
              </div>
              <span className="font-bold text-red-600">{formatCurrency(summary.totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary/30">
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
