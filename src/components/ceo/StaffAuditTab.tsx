import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Calculator, TrendingUp, TrendingDown, Search, User, Calendar, DollarSign, Clock, FileText, Wallet, Download, CalendarDays, Gift, MinusCircle, CreditCard, Banknote, Send, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, setMonth as setJalaliMonth, setYear as setJalaliYear } from 'date-fns-jalali';
import { Separator } from '@/components/ui/separator';
// Persian months
const PERSIAN_MONTHS = [
  { value: 1, label: 'فروردین' },
  { value: 2, label: 'اردیبهشت' },
  { value: 3, label: 'خرداد' },
  { value: 4, label: 'تیر' },
  { value: 5, label: 'مرداد' },
  { value: 6, label: 'شهریور' },
  { value: 7, label: 'مهر' },
  { value: 8, label: 'آبان' },
  { value: 9, label: 'آذر' },
  { value: 10, label: 'دی' },
  { value: 11, label: 'بهمن' },
  { value: 12, label: 'اسفند' },
];

// Get current Persian year
const getCurrentPersianYear = (): number => {
  const now = new Date();
  const yearStr = format(now, 'yyyy');
  return parseInt(yearStr, 10);
};

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
  previous_month_balance: number;
  previous_month_extra_received: number;
  bonuses: number;
  deductions: number;
  notes: string;
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
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentPersianYear());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<StaffAuditRecord[]>([]);
  const [salarySettings, setSalarySettings] = useState<SalarySettings | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [syncingToWallet, setSyncingToWallet] = useState(false);
  const [syncedToWallet, setSyncedToWallet] = useState(false);
  
  // Financial fields for search/calculation
  const [bonuses, setBonuses] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [prevMonthBalance, setPrevMonthBalance] = useState<number>(0);
  const [prevMonthExtra, setPrevMonthExtra] = useState<number>(0);
  const [financialNotes, setFinancialNotes] = useState<string>('');

  // Generate year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => getCurrentPersianYear() - i);

  // Handle month selection - auto set start and end dates
  const handleMonthSelect = (monthValue: string) => {
    setSelectedMonth(monthValue);
    const monthNum = parseInt(monthValue, 10);
    
    // Create a date in the middle of that Persian month, then get start and end
    // We need to convert Persian month to Gregorian dates
    const now = new Date();
    const targetDate = setJalaliYear(setJalaliMonth(now, monthNum - 1), selectedYear);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    
    setStartDate(monthStart);
    setEndDate(monthEnd);
  };

  // Handle year change
  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year, 10));
    // If month is already selected, recalculate dates
    if (selectedMonth) {
      const monthNum = parseInt(selectedMonth, 10);
      const now = new Date();
      const targetDate = setJalaliYear(setJalaliMonth(now, monthNum - 1), parseInt(year, 10));
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);
      
      setStartDate(monthStart);
      setEndDate(monthEnd);
    }
  };

  const fetchSalarySettings = async (staffCode: string): Promise<SalarySettings> => {
    const { data, error } = await supabase
      .from('staff_salary_settings')
      .select('base_daily_salary, overtime_rate_fraction, previous_month_balance, previous_month_extra_received, bonuses, deductions, notes')
      .eq('staff_code', staffCode)
      .maybeSingle();

    const settings: SalarySettings = !error && data 
      ? {
          base_daily_salary: data.base_daily_salary || 0,
          overtime_rate_fraction: data.overtime_rate_fraction || 0.167,
          previous_month_balance: data.previous_month_balance || 0,
          previous_month_extra_received: data.previous_month_extra_received || 0,
          bonuses: data.bonuses || 0,
          deductions: data.deductions || 0,
          notes: data.notes || '',
        }
      : { base_daily_salary: 0, overtime_rate_fraction: 0.167, previous_month_balance: 0, previous_month_extra_received: 0, bonuses: 0, deductions: 0, notes: '' };
    
    setSalarySettings(settings);
    return settings;
  };

  const calculateSummary = (records: StaffAuditRecord[], settings: SalarySettings, localBonuses?: number, localDeductions?: number, localPrevBalance?: number, localPrevExtra?: number) => {
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
    
    // Use local values (from UI) instead of settings
    const benefits = localBonuses ?? bonuses;
    const deductionsVal = localDeductions ?? deductions;
    const remainingBalanceFromPreviousMonth = localPrevBalance ?? prevMonthBalance;
    const extraReceivedPreviousMonth = localPrevExtra ?? prevMonthExtra;
    
    // Total work and benefits includes bonuses
    const totalWorkAndBenefits = estimatedSalary + overtimePay + benefits;
    const totalWorkAmount = totalWorkAndBenefits;
    
    // Net calculation: 
    // What company owes = (work + benefits + prev balance) - (received + deductions + prev extra received)
    // Positive = Employee is owed money (company should pay)
    // Negative = Employee received more than earned (excess)
    const netBalance = (totalWorkAndBenefits + remainingBalanceFromPreviousMonth + totalSpent) 
                     - (totalReceived + deductionsVal + extraReceivedPreviousMonth);
    
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
      deductions: deductionsVal,
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
    setSyncedToWallet(false); // Reset sync status on new search
    try {
      // Fetch salary settings and wait for result
      const settings = await fetchSalarySettings(selectedStaffCode);

      // Use local date format to avoid timezone issues
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);

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

      // Calculate summary with the fetched settings directly
      if (settings) {
        calculateSummary(mappedRecords, settings);
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
      calculateSummary(records, salarySettings, bonuses, deductions, prevMonthBalance, prevMonthExtra);
    }
  }, [salarySettings, bonuses, deductions, prevMonthBalance, prevMonthExtra]);

  const formatPersianDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE d MMMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return 'تومان ' + amount.toLocaleString('fa-IR');
  };

  const handleGeneratePdf = () => {
    if (!summary || !salarySettings) {
      toast.error('لطفاً ابتدا جستجو کنید');
      return;
    }

    setGeneratingPdf(true);

    try {
      const dateRangeStr = startDate && endDate
        ? `${format(startDate, 'yyyy/MM/dd')} تا ${format(endDate, 'yyyy/MM/dd')}`
        : '';

      const rawFilename = `حساب-${selectedStaffName || selectedStaffCode}-${dateRangeStr}`;
      const safeFilenameBase = rawFilename
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^-|-$|^_+|_+$/g, '');
      const filename = `${safeFilenameBase || 'حساب-نیرو'}`;

      // Build daily records HTML - only records with meaningful data
      const recordsWithData = records.filter((r) =>
        r.work_status === 'حاضر' ||
        (r.amount_received || 0) > 0 ||
        (r.amount_spent || 0) > 0 ||
        !!r.notes ||
        !!r.receiving_notes ||
        !!r.spending_notes
      );

      const dailyRecordsHtml = recordsWithData.length > 0 ? `
        <div style="margin-top: 20px; border: 2px solid #d4a574; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
          <div style="background: linear-gradient(135deg, #f5e6d3 0%, #e8d4b8 100%); padding: 12px; border-bottom: 1px solid #d4a574;">
            <h3 style="margin: 0; color: #8b5a2b; font-size: 16px; text-align: center;">جزئیات روزانه</h3>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #f5e6d3;">
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">ردیف</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">تاریخ</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">کارکرد</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">اضافه‌کاری</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">مبلغ دریافتی</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right;">توضیحات دریافت</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">مبلغ خرج‌کرد</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right;">توضیحات خرج</th>
                <th style="padding: 8px; border: 1px solid #d4a574; text-align: right;">یادداشت</th>
              </tr>
            </thead>
            <tbody>
              ${recordsWithData.map((record, index) => `
                <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#faf5ef'};">
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: center; white-space: nowrap;">${(index + 1).toLocaleString('fa-IR')}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: right; white-space: nowrap;">${formatPersianDate(record.report_date)}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: center; white-space: nowrap;">${record.work_status === 'حاضر' ? '۱ روز' : 'غایب'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: center; white-space: nowrap;">${record.overtime_hours > 0 ? record.overtime_hours + ' ساعت' : '—'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: center; white-space: nowrap; color: ${record.amount_received > 0 ? '#16a34a' : '#666'};">${record.amount_received > 0 ? formatCurrency(record.amount_received) : '—'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: right; max-width: 160px; word-break: break-word;">${record.receiving_notes || '—'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: center; white-space: nowrap; color: ${record.amount_spent > 0 ? '#dc2626' : '#666'};">${record.amount_spent > 0 ? formatCurrency(record.amount_spent) : '—'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: right; max-width: 160px; word-break: break-word;">${record.spending_notes || '—'}</td>
                  <td style="padding: 6px; border: 1px solid #d4a574; text-align: right; max-width: 160px; word-break: break-word;">${record.notes || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f5e6d3; font-weight: bold;">
                <td colspan="2" style="padding: 8px; border: 1px solid #d4a574; text-align: right;">جمع کل:</td>
                <td style="padding: 8px; border: 1px solid #d4a574; text-align: center; white-space: nowrap;">${summary.totalDaysWorked.toLocaleString('fa-IR')} روز</td>
                <td style="padding: 8px; border: 1px solid #d4a574; text-align: center; white-space: nowrap;">${summary.totalOvertime.toLocaleString('fa-IR')} ساعت</td>
                <td style="padding: 8px; border: 1px solid #d4a574; text-align: center; white-space: nowrap; color: #16a34a;">${formatCurrency(summary.totalReceived)}</td>
                <td style="padding: 8px; border: 1px solid #d4a574;"></td>
                <td style="padding: 8px; border: 1px solid #d4a574; text-align: center; white-space: nowrap; color: #dc2626;">${formatCurrency(summary.totalSpent)}</td>
                <td colspan="2" style="padding: 8px; border: 1px solid #d4a574;"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : '';

      // Determine balance status
      let balanceHtml = '';
      if (summary.remainingBalanceThisMonth > 0) {
        balanceHtml = `
          <div style="background-color: #0ea5e9; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-top: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">الباقی کل حساب از این ماه:</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${formatCurrency(summary.remainingBalanceThisMonth)}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.75;">(شرکت بدهکار به نیرو)</p>
          </div>
        `;
      } else if (summary.extraReceivedThisMonth > 0) {
        balanceHtml = `
          <div style="background-color: #fbbf24; color: #78350f; padding: 16px; border-radius: 8px; text-align: center; margin-top: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">دریافتی اضافی در این ماه:</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${formatCurrency(summary.extraReceivedThisMonth)}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.75;">(نیرو بیشتر از حق خود دریافت کرده)</p>
          </div>
        `;
      } else {
        balanceHtml = `
          <div style="background-color: #22c55e; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-top: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">تسویه کامل</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">۰ تومان</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.75;">(حساب‌ها تسویه شده)</p>
          </div>
        `;
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="UTF-8">
          <title>${filename}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
              direction: rtl;
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
              min-height: 100vh;
            }
            .container {
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              background: linear-gradient(135deg, #f5e6d3 0%, #e8d4b8 100%);
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
              text-align: center;
              border: 2px solid #d4a574;
            }
            .header h1 {
              margin: 0 0 10px 0;
              color: #8b5a2b;
              font-size: 22px;
              font-weight: bold;
            }
            .header p {
              margin: 0;
              color: #a16207;
              font-size: 14px;
            }
            .salary-info {
              background-color: #fef3c7;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 16px;
              text-align: center;
              border: 1px solid #fcd34d;
            }
            .salary-info span {
              color: #92400e;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 14px;
            }
            .print-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
              color: white;
              border: none;
              padding: 14px 28px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              margin: 20px auto;
              box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
              transition: all 0.2s ease;
            }
            .print-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 16px rgba(22, 163, 74, 0.4);
            }
            .print-btn svg {
              width: 20px;
              height: 20px;
            }
            @media print {
              body {
                background: white !important;
              }
              .container {
                padding: 0;
              }
              .print-btn {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Print Button -->
            <button class="print-btn" onclick="window.print()">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              پرینت / ذخیره PDF
            </button>

            <!-- Header -->
            <div class="header">
              <h1>حسابکتاب روزمزدی ${selectedStaffName}</h1>
              <p>بازه زمانی: ${dateRangeStr}</p>
            </div>

            <!-- Salary Info -->
            <div class="salary-info">
              <span>حقوق روزمزدی: ${formatCurrency(salarySettings.base_daily_salary)}</span>
            </div>

            <!-- Summary Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
              <tbody>
                <tr style="background-color: #fef3c7;">
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">جمع کارکرد</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left;">${summary.totalDaysWorked.toLocaleString('fa-IR')} روز</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">جمع اضافه‌کاری</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left;">${summary.totalOvertime.toLocaleString('fa-IR')} ساعت</td>
                </tr>
                <tr style="background-color: #fef3c7;">
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">جمع دریافتی این ماه</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left; color: #16a34a;">${formatCurrency(summary.totalReceived)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">جمع خرج‌کرد این ماه</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left; color: #dc2626;">${formatCurrency(summary.totalSpent)}</td>
                </tr>
                <tr style="background-color: #fef3c7;">
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">حقوق پایه (${summary.totalDaysWorked} روز)</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left;">${formatCurrency(summary.estimatedSalary)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: 500;">اضافه‌کاری (${summary.totalOvertime} ساعت)</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left;">${formatCurrency(summary.overtimePay)}</td>
                </tr>
                <tr style="background-color: #fef3c7;">
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold;">کارکرد و مزایای این ماه</td>
                  <td style="padding: 10px; border: 1px solid #fcd34d; font-weight: bold; text-align: left;">${formatCurrency(summary.totalWorkAndBenefits)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Balance Box -->
            ${balanceHtml}

            <!-- Daily Records -->
            ${dailyRecordsHtml}

            <!-- Financial Notes -->
            ${financialNotes ? `
            <div style="margin-top: 20px; border: 2px solid #a855f7; border-radius: 8px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 12px; border-bottom: 1px solid #a855f7;">
                <h3 style="margin: 0; color: #7c3aed; font-size: 16px; text-align: center;">توضیحات</h3>
              </div>
              <div style="padding: 12px; background-color: #faf5ff;">
                <p style="margin: 0; color: #581c87; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${financialNotes}</p>
              </div>
            </div>
            ` : ''}

            <!-- Footer -->
            <div style="margin-top: 24px; padding-top: 16px; border-top: 2px dashed #d4a574; text-align: center; font-size: 12px; color: #92400e;">
              <p style="margin: 0;">تاریخ صدور: ${format(new Date(), 'yyyy/MM/dd - HH:mm')}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Open a new window and trigger print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        
        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            setGeneratingPdf(false);
          }, 500);
        };

        // Fallback if onload doesn't fire
        setTimeout(() => {
          setGeneratingPdf(false);
        }, 3000);
      } else {
        toast.error('مرورگر پنجره پاپ‌آپ را مسدود کرده است. لطفاً اجازه دهید.');
        setGeneratingPdf(false);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('خطا در تولید PDF');
      setGeneratingPdf(false);
    }
  };

  // Sync balance to staff's wallet
  const handleSyncToWallet = async () => {
    if (!summary || !salarySettings || !selectedStaffCode) {
      toast.error('لطفاً ابتدا جستجو کنید');
      return;
    }

    setSyncingToWallet(true);
    try {
      // Extract phone number from staff_code (format: "نام نیرو (شماره تلفن)")
      const phoneMatch = selectedStaffCode.match(/\((\d+)\)/);
      const phoneNumber = phoneMatch ? phoneMatch[1] : selectedStaffCode;

      // Find user by phone number
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (profileError || !profile) {
        toast.error('کاربر مرتبط با این نیرو یافت نشد');
        setSyncingToWallet(false);
        return;
      }

      // Get current wallet balance
      const { data: lastTx } = await supabase
        .from('wallet_transactions')
        .select('balance_after')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastTx?.balance_after || 0;
      
      // Calculate the balance to sync (positive = company owes staff, negative = staff owes company)
      const balanceToSync = summary.netBalance;
      const newBalance = currentBalance + balanceToSync;

      // Create date range string for reference
      const dateRangeStr = startDate && endDate
        ? `${format(startDate, 'yyyy/MM/dd')} تا ${format(endDate, 'yyyy/MM/dd')}`
        : '';

      // Create wallet transaction
      const transactionType = balanceToSync >= 0 ? 'salary' : 'expense';
      const title = balanceToSync >= 0 
        ? `طلب کارکرد ${dateRangeStr}` 
        : `بدهی کارکرد ${dateRangeStr}`;
      
      const description = `کارکرد: ${summary.totalDaysWorked} روز | اضافه‌کاری: ${summary.totalOvertime} ساعت | حقوق: ${formatCurrency(summary.estimatedSalary)} | اضافه‌کاری: ${formatCurrency(summary.overtimePay)}`;

      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: profile.user_id,
          transaction_type: transactionType,
          amount: balanceToSync,
          balance_after: newBalance,
          title: title,
          description: description,
          reference_type: 'staff_audit',
        });

      if (txError) throw txError;

      setSyncedToWallet(true);
      toast.success(`موجودی ${formatCurrency(Math.abs(balanceToSync))} به کیف پول ${profile.full_name || selectedStaffName} ${balanceToSync >= 0 ? 'اضافه' : 'کسر'} شد`);
    } catch (error) {
      console.error('Error syncing to wallet:', error);
      toast.error('خطا در ارسال به کیف پول');
    } finally {
      setSyncingToWallet(false);
    }
  };

  return (
    <div className="space-y-6">
      {generatingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-foreground shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">در حال ساخت فایل PDF...</span>
          </div>
        </div>
      )}
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
        <CardContent className="space-y-4">
          {/* Quick Month Selector */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">انتخاب سریع ماه:</span>
            </div>
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="سال" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year.toLocaleString('fa-IR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {PERSIAN_MONTHS.map((month) => (
                <Button
                  key={month.value}
                  variant={selectedMonth === month.value.toString() ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs px-2 py-1 h-7 ${selectedMonth === month.value.toString() ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                  onClick={() => handleMonthSelect(month.value.toString())}
                >
                  {month.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Date Selection */}
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
                onChange={(date) => {
                  if (date) {
                    setStartDate(new Date(date));
                    setSelectedMonth(''); // Clear month selection when manual date is picked
                  }
                }}
                timeMode="none"
              />
            </div>
            <div className="space-y-2">
              <Label>تا تاریخ</Label>
              <PersianDatePicker
                value={endDate?.toISOString() || ''}
                onChange={(date) => {
                  if (date) {
                    setEndDate(new Date(date));
                    setSelectedMonth(''); // Clear month selection when manual date is picked
                  }
                }}
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

          {/* Financial Fields */}
          <Separator className="my-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-green-600">
                <Gift className="h-4 w-4" />
                مزایا (تومان)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={bonuses === 0 ? '' : bonuses.toLocaleString('en-US')}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setBonuses(parseInt(val) || 0);
                }}
                className="border-green-200 focus:border-green-500"
                dir="ltr"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-red-600">
                <MinusCircle className="h-4 w-4" />
                کسورات (تومان)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={deductions === 0 ? '' : deductions.toLocaleString('en-US')}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setDeductions(parseInt(val) || 0);
                }}
                className="border-red-200 focus:border-red-500"
                dir="ltr"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-blue-600">
                <CreditCard className="h-4 w-4" />
                دریافتی اضافه ماه قبل (تومان)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={prevMonthExtra === 0 ? '' : prevMonthExtra.toLocaleString('en-US')}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPrevMonthExtra(parseInt(val) || 0);
                }}
                className="border-blue-200 focus:border-blue-500"
                dir="ltr"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-amber-600">
                <Banknote className="h-4 w-4" />
                الباقی حساب ماه قبل (تومان)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={prevMonthBalance === 0 ? '' : prevMonthBalance.toLocaleString('en-US')}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9-]/g, '');
                  setPrevMonthBalance(parseInt(val) || 0);
                }}
                className="border-amber-200 focus:border-amber-500"
                dir="ltr"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">مثبت = طلبکار، منفی = بدهکار</p>
            </div>
          </div>
          
          {/* Notes Textarea */}
          <div className="mt-4">
            <Label className="flex items-center gap-2 text-purple-600 mb-2">
              <FileText className="h-4 w-4" />
              توضیحات (در صورتحساب درج می‌شود)
            </Label>
            <Textarea
              value={financialNotes}
              onChange={(e) => setFinancialNotes(e.target.value)}
              placeholder="توضیحات اضافی که می‌خواهید در صورتحساب درج شود..."
              className="min-h-[80px] border-purple-200 focus:border-purple-500"
            />
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
        <>
          {/* PDF Download Button - Outside the PDF content */}
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
                <div className="flex gap-2">
                  <Button
                    onClick={handleSyncToWallet}
                    disabled={syncingToWallet || syncedToWallet}
                    className={`gap-2 ${syncedToWallet ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                  >
                    {syncingToWallet ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : syncedToWallet ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {syncedToWallet ? 'ارسال شد به کیف پول' : 'ارسال به کیف پول نیرو'}
                  </Button>
                  <Button
                    onClick={handleGeneratePdf}
                    disabled={generatingPdf}
                    className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    دانلود PDF
                  </Button>
                </div>
              </div>
              {startDate && endDate && (
                <p className="text-sm text-muted-foreground mt-2">
                  بازه زمانی: {format(startDate, 'yyyy/MM/dd')} تا {format(endDate, 'yyyy/MM/dd')}
                </p>
              )}
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Right Column - Earnings (بستانکار - چه چیزی به نیرو تعلق دارد) */}
              <div className="space-y-4">
                <div className="bg-green-100 dark:bg-green-900/40 rounded-lg p-3 border border-green-300">
                  <h4 className="font-bold text-green-900 dark:text-green-100 text-center text-lg">
                    بستانکار (حقوق نیرو)
                  </h4>
                </div>
                
                <Table className="border border-green-200 rounded-lg overflow-hidden">
                  <TableBody>
                    <TableRow className="bg-green-50/50 dark:bg-green-900/20">
                      <TableCell className="font-medium text-right">حقوق پایه ({summary.totalDaysWorked} روز × {salarySettings.base_daily_salary.toLocaleString('fa-IR')})</TableCell>
                      <TableCell className="text-left font-bold text-green-700">{formatCurrency(summary.estimatedSalary)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">اضافه‌کاری ({summary.totalOvertime} ساعت)</TableCell>
                      <TableCell className="text-left font-bold text-green-700">{formatCurrency(summary.overtimePay)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50/50 dark:bg-green-900/20">
                      <TableCell className="font-medium text-right">مزایا</TableCell>
                      <TableCell className="text-left font-bold text-green-700">{formatCurrency(summary.benefits)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">مانده از ماه قبل</TableCell>
                      <TableCell className="text-left font-bold text-green-700">{formatCurrency(summary.remainingBalanceFromPreviousMonth)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50/50 dark:bg-green-900/20">
                      <TableCell className="font-medium text-right">خرج‌کرد بر سر کار</TableCell>
                      <TableCell className="text-left font-bold text-green-700">{formatCurrency(summary.totalSpent)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-green-200 dark:bg-green-800 border-t-2 border-green-400">
                      <TableCell className="font-bold text-right text-lg">جمع بستانکار:</TableCell>
                      <TableCell className="text-left font-bold text-lg text-green-800 dark:text-green-200">
                        {formatCurrency(summary.estimatedSalary + summary.overtimePay + summary.benefits + summary.remainingBalanceFromPreviousMonth + summary.totalSpent)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {/* Left Column - Deductions (بدهکار - چه چیزی از نیرو کم می‌شود) */}
              <div className="space-y-4">
                <div className="bg-red-100 dark:bg-red-900/40 rounded-lg p-3 border border-red-300">
                  <h4 className="font-bold text-red-900 dark:text-red-100 text-center text-lg">
                    بدهکار (کسورات)
                  </h4>
                </div>
                
                <Table className="border border-red-200 rounded-lg overflow-hidden">
                  <TableBody>
                    <TableRow className="bg-red-50/50 dark:bg-red-900/20">
                      <TableCell className="font-medium text-right">دریافتی این ماه</TableCell>
                      <TableCell className="text-left font-bold text-red-600">{formatCurrency(summary.totalReceived)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-right">دریافتی اضافی از ماه قبل</TableCell>
                      <TableCell className="text-left font-bold text-red-600">{formatCurrency(summary.extraReceivedPreviousMonth)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-red-50/50 dark:bg-red-900/20">
                      <TableCell className="font-medium text-right">کسورات</TableCell>
                      <TableCell className="text-left font-bold text-red-600">{formatCurrency(summary.deductions)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-red-200 dark:bg-red-800 border-t-2 border-red-400">
                      <TableCell className="font-bold text-right text-lg">جمع بدهکار:</TableCell>
                      <TableCell className="text-left font-bold text-lg text-red-800 dark:text-red-200">
                        {formatCurrency(summary.totalReceived + summary.extraReceivedPreviousMonth + summary.deductions)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                {/* Spacer to align with left column */}
                <div className="h-[52px]"></div>
              </div>
            </div>
            
            <Separator className="my-6 bg-amber-400" />
            
            {/* Final Balance Calculation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calculation Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-amber-300 shadow-lg">
                <h5 className="font-bold text-amber-800 dark:text-amber-200 mb-3 text-center">محاسبه مانده حساب</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/30 rounded">
                    <span className="text-green-700 dark:text-green-300">جمع بستانکار:</span>
                    <span className="font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(summary.estimatedSalary + summary.overtimePay + summary.benefits + summary.remainingBalanceFromPreviousMonth + summary.totalSpent)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/30 rounded">
                    <span className="text-red-700 dark:text-red-300">جمع بدهکار:</span>
                    <span className="font-bold text-red-700 dark:text-red-300">
                      - {formatCurrency(summary.totalReceived + summary.extraReceivedPreviousMonth + summary.deductions)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-100 dark:bg-amber-900/40 rounded border-t-2 border-amber-400">
                    <span className="font-bold text-lg">تفاوت (مانده):</span>
                    <span className={`font-bold text-lg ${summary.netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {formatCurrency(Math.abs(summary.netBalance))}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Final Balance - Highlighted */}
              <div className="flex items-center">
                {summary.remainingBalanceThisMonth > 0 ? (
                  <div className="bg-sky-500 text-white rounded-lg p-6 text-center w-full shadow-lg">
                    <p className="text-sm opacity-90">مانده حساب این ماه:</p>
                    <p className="text-3xl font-bold my-2">{formatCurrency(summary.remainingBalanceThisMonth)}</p>
                    <p className="text-sm opacity-75">(شرکت بدهکار به نیرو)</p>
                  </div>
                ) : summary.extraReceivedThisMonth > 0 ? (
                  <div className="bg-amber-400 text-amber-900 rounded-lg p-6 text-center w-full shadow-lg">
                    <p className="text-sm opacity-90">دریافتی اضافی این ماه:</p>
                    <p className="text-3xl font-bold my-2">{formatCurrency(summary.extraReceivedThisMonth)}</p>
                    <p className="text-sm opacity-75">(نیرو بیشتر از حق خود دریافت کرده)</p>
                  </div>
                ) : (
                  <div className="bg-green-500 text-white rounded-lg p-6 text-center w-full shadow-lg">
                    <p className="text-sm opacity-90">تسویه کامل</p>
                    <p className="text-3xl font-bold my-2">۰ تومان</p>
                    <p className="text-sm opacity-75">(حساب‌ها تسویه شده)</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Notes Section */}
            {salarySettings.notes && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-blue-800 dark:text-blue-200 mb-1">یادداشت / توضیحات:</h5>
                    <p className="text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{salarySettings.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </>
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
