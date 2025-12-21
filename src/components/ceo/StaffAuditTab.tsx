import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Calculator, TrendingUp, TrendingDown, Minus, Search, User, Calendar, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns-jalali';

interface StaffAuditRecord {
  id: string;
  report_date: string;
  work_status: string;
  overtime_hours: number;
  amount_received: number;
  receiving_notes: string;
  amount_spent: number;
  spending_notes: string;
  notes: string;
}

interface SalarySettings {
  base_daily_salary: number;
  overtime_rate_fraction: number;
}

interface AuditSummary {
  totalDaysWorked: number;
  totalOvertime: number;
  totalReceived: number;
  totalSpent: number;
  totalBalance: number;
  estimatedSalary: number;
  overtimePay: number;
}

export function StaffAuditTab() {
  const [selectedStaffCode, setSelectedStaffCode] = useState<string>('');
  const [selectedStaffName, setSelectedStaffName] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<StaffAuditRecord[]>([]);
  const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);

  const fetchSalarySettings = async (staffCode: string) => {
    const { data, error } = await supabase
      .from('staff_salary_settings')
      .select('base_daily_salary, overtime_rate_fraction')
      .eq('staff_code', staffCode)
      .maybeSingle();

    if (!error && data) {
      setSalarySettings(data);
    } else {
      // Default values
      setSalarySettings({
        base_daily_salary: 0,
        overtime_rate_fraction: 0.167 // 1/6
      });
    }
  };

  const calculateSummary = (records: StaffAuditRecord[], settings: SalarySettings) => {
    const totalDaysWorked = records.filter(r => r.work_status === 'حاضر').length;
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);
    const totalReceived = records.reduce((sum, r) => sum + (r.amount_received || 0), 0);
    const totalSpent = records.reduce((sum, r) => sum + (r.amount_spent || 0), 0);
    
    const estimatedSalary = totalDaysWorked * settings.base_daily_salary;
    const overtimePay = totalOvertime * settings.base_daily_salary * settings.overtime_rate_fraction;
    const totalBalance = totalReceived - totalSpent;

    setSummary({
      totalDaysWorked,
      totalOvertime,
      totalReceived,
      totalSpent,
      totalBalance,
      estimatedSalary,
      overtimePay
    });
  };

  const handleSearch = async () => {
    if (!selectedStaffCode || !startDate || !endDate) {
      toast.error('لطفاً نیرو و بازه تاریخی را انتخاب کنید');
      return;
    }

    setLoading(true);
    try {
      // Fetch salary settings
      await fetchSalarySettings(selectedStaffCode);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Fetch all daily reports in date range
      const { data: reports, error: reportsError } = await supabase
        .from('daily_reports')
        .select('id, report_date')
        .gte('report_date', startStr)
        .lte('report_date', endStr)
        .order('report_date', { ascending: true });

      if (reportsError) throw reportsError;

      if (!reports || reports.length === 0) {
        setRecords([]);
        setSummary(null);
        toast.info('گزارشی برای این بازه زمانی یافت نشد');
        return;
      }

      const reportIds = reports.map(r => r.id);

      // Fetch staff records for selected staff
      const { data: staffRecords, error: staffError } = await supabase
        .from('daily_report_staff')
        .select('*')
        .in('daily_report_id', reportIds)
        .ilike('staff_name', `%${selectedStaffCode}%`);

      if (staffError) throw staffError;

      // Map records with report dates
      const mappedRecords: StaffAuditRecord[] = (staffRecords || []).map(sr => {
        const report = reports.find(r => r.id === sr.daily_report_id);
        return {
          id: sr.id,
          report_date: report?.report_date || '',
          work_status: sr.work_status,
          overtime_hours: sr.overtime_hours || 0,
          amount_received: sr.amount_received || 0,
          receiving_notes: sr.receiving_notes || '',
          amount_spent: sr.amount_spent || 0,
          spending_notes: sr.spending_notes || '',
          notes: sr.notes || ''
        };
      }).sort((a, b) => a.report_date.localeCompare(b.report_date));

      setRecords(mappedRecords);

      // Calculate summary
      if (salarySettings) {
        calculateSummary(mappedRecords, salarySettings);
      }
    } catch (error) {
      console.error('Error fetching audit data:', error);
      toast.error('خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (records.length > 0 && salarySettings) {
      calculateSummary(records, salarySettings);
    }
  }, [salarySettings]);

  const formatPersianDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE d MMMM yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <Card className="border-2 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Calculator className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">جستجوی حسابرسی نیروها</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>انتخاب نیرو</Label>
              <StaffSearchSelect
                value={selectedStaffCode}
                onValueChange={(code, name) => {
                  setSelectedStaffCode(code);
                  setSelectedStaffName(name || '');
                }}
                placeholder="نیرو را انتخاب کنید"
              />
            </div>
            <div className="space-y-2">
              <Label>از تاریخ</Label>
              <PersianDatePicker
                value={startDate?.toISOString() || ''}
                onChange={(date) => date && setStartDate(new Date(date))}
                timeMode="none"
              />
            </div>
            <div className="space-y-2">
              <Label>تا تاریخ</Label>
              <PersianDatePicker
                value={endDate?.toISOString() || ''}
                onChange={(date) => date && setEndDate(new Date(date))}
                timeMode="none"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={loading || !selectedStaffCode || !startDate || !endDate}
                className="gap-2 w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                جستجو
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/20">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">روزهای کاری</p>
                  <p className="text-xl font-bold">{summary.totalDaysWorked} روز</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">اضافه‌کاری</p>
                  <p className="text-xl font-bold">{summary.totalOvertime} ساعت</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/20">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">کل دریافتی</p>
                  <p className="text-xl font-bold">{summary.totalReceived.toLocaleString('fa-IR')} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/20">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">کل خرج‌کرد</p>
                  <p className="text-xl font-bold">{summary.totalSpent.toLocaleString('fa-IR')} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Summary */}
      {summary && (
        <Card className={`border-2 ${summary.totalBalance >= 0 ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10' : 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'}`}>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DollarSign className={`h-8 w-8 ${summary.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">تراز مالی نیرو</p>
                  <p className={`text-2xl font-bold ${summary.totalBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {summary.totalBalance >= 0 ? '+' : ''}{summary.totalBalance.toLocaleString('fa-IR')} تومان
                  </p>
                </div>
              </div>

              {salarySettings && salarySettings.base_daily_salary > 0 && (
                <div className="text-left space-y-1">
                  <p className="text-sm text-muted-foreground">
                    حقوق پایه تخمینی: {summary.estimatedSalary.toLocaleString('fa-IR')} تومان
                  </p>
                  <p className="text-sm text-muted-foreground">
                    اضافه‌کاری: {summary.overtimePay.toLocaleString('fa-IR')} تومان
                  </p>
                  <p className="font-semibold">
                    جمع کل: {(summary.estimatedSalary + summary.overtimePay).toLocaleString('fa-IR')} تومان
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              جزئیات روزانه - {selectedStaffName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-purple-100 dark:bg-purple-900/30">
                    <TableHead className="text-right whitespace-nowrap">تاریخ</TableHead>
                    <TableHead className="text-right whitespace-nowrap">وضعیت</TableHead>
                    <TableHead className="text-right whitespace-nowrap">اضافه‌کاری</TableHead>
                    <TableHead className="text-right whitespace-nowrap">مبلغ دریافتی</TableHead>
                    <TableHead className="text-right whitespace-nowrap">توضیحات دریافت</TableHead>
                    <TableHead className="text-right whitespace-nowrap">مبلغ خرج‌کرد</TableHead>
                    <TableHead className="text-right whitespace-nowrap">توضیحات خرج</TableHead>
                    <TableHead className="text-right whitespace-nowrap">یادداشت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">{formatPersianDate(record.report_date)}</TableCell>
                      <TableCell>
                        <Badge variant={record.work_status === 'حاضر' ? 'default' : 'secondary'}>
                          {record.work_status === 'حاضر' ? 'کارکرده' : 'غایب'}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.overtime_hours} ساعت</TableCell>
                      <TableCell className="text-green-600">{record.amount_received.toLocaleString('fa-IR')}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.receiving_notes || '—'}</TableCell>
                      <TableCell className="text-red-600">{record.amount_spent.toLocaleString('fa-IR')}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.spending_notes || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 && !loading && selectedStaffCode && startDate && endDate && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>رکوردی برای نمایش یافت نشد</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
