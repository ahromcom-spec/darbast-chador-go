import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Calculator, TrendingUp, TrendingDown, Search, User, Calendar, DollarSign, Clock, FileText, Wallet, Download } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { Separator } from '@/components/ui/separator';
import html2pdf from 'html2pdf.js';

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
  // Basic counts
  totalDaysWorked: number;
  totalAbsentDays: number;
  totalOvertime: number;
  // Financial flows
  totalReceived: number;
  totalSpent: number;
  // Calculated salary
  estimatedSalary: number;
  overtimePay: number;
  totalWorkAndBenefits: number;
  // Balance calculations
  remainingBalanceFromPreviousMonth: number;
  extraReceivedPreviousMonth: number;
  totalWorkAmount: number;
  benefits: number;
  deductions: number;
  remainingBalanceThisMonth: number;
  extraReceivedThisMonth: number;
  netBalance: number;
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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
    // Basic counts
    const totalDaysWorked = records.filter(r => r.work_status === 'حاضر').length;
    const totalAbsentDays = records.filter(r => r.work_status === 'غایب').length;
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);
    
    // Financial flows
    const totalReceived = records.reduce((sum, r) => sum + (r.amount_received || 0), 0);
    const totalSpent = records.reduce((sum, r) => sum + (r.amount_spent || 0), 0);
    
    // Calculated salary
    const estimatedSalary = totalDaysWorked * settings.base_daily_salary;
    const overtimePay = totalOvertime * settings.base_daily_salary * settings.overtime_rate_fraction;
    const totalWorkAndBenefits = estimatedSalary + overtimePay;
    
    // Balance calculations (simplified - can be extended later for multi-month tracking)
    const totalWorkAmount = totalWorkAndBenefits;
    const benefits = 0; // Can be extended later
    const deductions = 0; // Can be extended later
    const remainingBalanceFromPreviousMonth = 0; // Can be extended later
    const extraReceivedPreviousMonth = 0; // Can be extended later
    
    // Net calculation: What company owes vs what employee received
    // Positive = Employee is owed money (company should pay)
    // Negative = Employee received more than earned (excess)
    const netBalance = totalWorkAndBenefits - totalReceived + totalSpent;
    
    // Determine remaining balance or extra received
    const remainingBalanceThisMonth = netBalance > 0 ? netBalance : 0;
    const extraReceivedThisMonth = netBalance < 0 ? Math.abs(netBalance) : 0;

    setSummary({
      totalDaysWorked,
      totalAbsentDays,
      totalOvertime,
      totalReceived,
      totalSpent,
      estimatedSalary,
      overtimePay,
      totalWorkAndBenefits,
      remainingBalanceFromPreviousMonth,
      extraReceivedPreviousMonth,
      totalWorkAmount,
      benefits,
      deductions,
      remainingBalanceThisMonth,
      extraReceivedThisMonth,
      netBalance
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

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fa-IR') + ' تومان';
  };

  const handleGeneratePdf = async () => {
    if (!reportRef.current || !summary || !salarySettings) {
      toast.error('لطفاً ابتدا جستجو کنید');
      return;
    }

    setGeneratingPdf(true);
    try {
      const dateRangeStr = startDate && endDate 
        ? `${format(startDate, 'yyyy/MM/dd')} تا ${format(endDate, 'yyyy/MM/dd')}`
        : '';
      
      const filename = `حساب-${selectedStaffName}-${dateRangeStr}.pdf`;
      
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const 
        }
      };

      await html2pdf().set(opt).from(reportRef.current).save();
      toast.success('فایل PDF با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('خطا در تولید PDF');
    } finally {
      setGeneratingPdf(false);
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
                  <p className="text-xl font-bold">{formatCurrency(summary.totalReceived)}</p>
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
                  <p className="text-xl font-bold">{formatCurrency(summary.totalSpent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
                  <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                    <TableHead className="text-right whitespace-nowrap font-bold">ردیف</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">تاریخ</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">کارکرد</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">اضافه‌کاری</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">مبلغ دریافتی</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">توضیحات دریافت</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">مبلغ خرج‌کرد</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">توضیحات خرج</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">یادداشت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow key={record.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                      <TableCell className="text-center font-medium">{(index + 1).toLocaleString('fa-IR')}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatPersianDate(record.report_date)}</TableCell>
                      <TableCell>
                        <Badge variant={record.work_status === 'حاضر' ? 'default' : 'secondary'}>
                          {record.work_status === 'حاضر' ? '۱ روز کارکرد' : 'غایب'}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.overtime_hours > 0 ? `${record.overtime_hours} ساعت` : '—'}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {record.amount_received > 0 ? formatCurrency(record.amount_received) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.receiving_notes || '—'}</TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {record.amount_spent > 0 ? formatCurrency(record.amount_spent) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.spending_notes || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-amber-200/50 dark:bg-amber-900/50 font-bold">
                    <TableCell colSpan={2} className="text-right">جمع کل:</TableCell>
                    <TableCell>{summary?.totalDaysWorked.toLocaleString('fa-IR')} روز</TableCell>
                    <TableCell>{summary?.totalOvertime.toLocaleString('fa-IR')} ساعت</TableCell>
                    <TableCell className="text-green-600">{formatCurrency(summary?.totalReceived || 0)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-red-600">{formatCurrency(summary?.totalSpent || 0)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Salary Calculation Summary - PDF Style */}
      {summary && salarySettings && salarySettings.base_daily_salary > 0 && (
        <div ref={reportRef}>
          <Card className="border-2 border-amber-500/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <FileText className="h-5 w-5 text-amber-700" />
                  </div>
                  <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                    حسابکتاب روزمزدی {selectedStaffName}
                  </CardTitle>
                </div>
                <Button
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  دانلود PDF
                </Button>
              </div>
              {startDate && endDate && (
                <p className="text-sm text-muted-foreground mt-2">
                  بازه زمانی: {format(startDate, 'yyyy/MM/dd')} تا {format(endDate, 'yyyy/MM/dd')}
                </p>
              )}
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Right Column - Summary Table */}
              <div className="space-y-4">
                <div className="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3">
                  <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-3 text-center">
                    حقوق روزمزدی: {formatCurrency(salarySettings.base_daily_salary)}
                  </h4>
                </div>
                
                <Table>
                  <TableBody>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">جمع کارکرد</TableCell>
                      <TableCell className="text-left font-bold">{summary.totalDaysWorked.toLocaleString('fa-IR')} روز</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">جمع اضافه‌کاری</TableCell>
                      <TableCell className="text-left font-bold">{summary.totalOvertime.toLocaleString('fa-IR')} ساعت</TableCell>
                    </TableRow>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">جمع دریافتی این ماه</TableCell>
                      <TableCell className="text-left font-bold text-green-600">{formatCurrency(summary.totalReceived)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">جمع خرج‌کرد این ماه</TableCell>
                      <TableCell className="text-left font-bold text-red-600">{formatCurrency(summary.totalSpent)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">کارکرد و مزایای این ماه</TableCell>
                      <TableCell className="text-left font-bold">{formatCurrency(summary.totalWorkAndBenefits)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">الباقی حساب مانده از ماه قبل</TableCell>
                      <TableCell className="text-left">{formatCurrency(summary.remainingBalanceFromPreviousMonth)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">دریافتی اضافی در ماه قبل</TableCell>
                      <TableCell className="text-left">{formatCurrency(summary.extraReceivedPreviousMonth)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {/* Left Column - Final Calculation */}
              <div className="space-y-4">
                <Table>
                  <TableBody>
                    <TableRow className="bg-amber-200/50">
                      <TableCell className="font-bold text-right">جمع کارکرد کل</TableCell>
                      <TableCell className="text-left font-bold">{formatCurrency(summary.totalWorkAmount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">حقوق پایه ({summary.totalDaysWorked} روز × {salarySettings.base_daily_salary.toLocaleString('fa-IR')})</TableCell>
                      <TableCell className="text-left">{formatCurrency(summary.estimatedSalary)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">اضافه‌کاری ({summary.totalOvertime} ساعت)</TableCell>
                      <TableCell className="text-left">{formatCurrency(summary.overtimePay)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">مزایا</TableCell>
                      <TableCell className="text-left">{formatCurrency(summary.benefits)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-amber-100/50">
                      <TableCell className="font-medium text-right">کسورات</TableCell>
                      <TableCell className="text-left text-red-600">{formatCurrency(summary.deductions)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <Separator className="bg-amber-400" />
                
                {/* Final Balance - Highlighted */}
                <div className="space-y-3">
                  {summary.remainingBalanceThisMonth > 0 ? (
                    <div className="bg-sky-500 text-white rounded-lg p-4 text-center">
                      <p className="text-sm opacity-90">الباقی کل حساب از این ماه:</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.remainingBalanceThisMonth)}</p>
                      <p className="text-xs opacity-75 mt-1">(شرکت بدهکار به نیرو)</p>
                    </div>
                  ) : summary.extraReceivedThisMonth > 0 ? (
                    <div className="bg-amber-400 text-amber-900 rounded-lg p-4 text-center">
                      <p className="text-sm opacity-90">دریافتی اضافی در این ماه:</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.extraReceivedThisMonth)}</p>
                      <p className="text-xs opacity-75 mt-1">(نیرو بیشتر از حق خود دریافت کرده)</p>
                    </div>
                  ) : (
                    <div className="bg-green-500 text-white rounded-lg p-4 text-center">
                      <p className="text-sm opacity-90">تسویه کامل</p>
                      <p className="text-2xl font-bold">۰ تومان</p>
                      <p className="text-xs opacity-75 mt-1">(حساب‌ها تسویه شده)</p>
                    </div>
                  )}
                </div>
                
                {/* Summary Box */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-amber-300 shadow-lg">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مجموع حقوق:</span>
                      <span className="font-bold">{formatCurrency(summary.estimatedSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">+ اضافه‌کاری:</span>
                      <span className="font-bold">{formatCurrency(summary.overtimePay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">- دریافتی‌ها:</span>
                      <span className="font-bold text-green-600">{formatCurrency(summary.totalReceived)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">+ خرج‌کرد:</span>
                      <span className="font-bold text-red-600">{formatCurrency(summary.totalSpent)}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-amber-200">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">مانده حساب:</span>
                        <span className={`font-bold text-lg ${summary.netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {summary.netBalance >= 0 ? '' : '-'}{formatCurrency(Math.abs(summary.netBalance))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Warning if no salary settings */}
      {summary && salarySettings && salarySettings.base_daily_salary === 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
              <Wallet className="h-5 w-5" />
              <p>برای مشاهده حسابکتاب کامل، لطفاً ابتدا در تب «تنظیمات حقوق» حقوق روزانه این نیرو را تنظیم کنید.</p>
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
