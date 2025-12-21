import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Plus, Trash2, Save, Loader2, User, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrderSearchSelect } from '@/components/orders/OrderSearchSelect';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';

interface Order {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone?: string | null;
  address: string;
  subcategory_name?: string;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  phone_number: string;
}

interface OrderReportRow {
  id?: string;
  order_id: string;
  activity_description: string;
  service_details: string;
  team_name: string;
  notes: string;
  row_color: string;
}

interface StaffReportRow {
  id?: string;
  staff_user_id: string | null;
  staff_name: string;
  work_status: 'کارکرده' | 'غایب';
  overtime_hours: number;
  amount_received: number;
  receiving_notes: string;
  amount_spent: number;
  spending_notes: string;
  notes: string;
  is_cash_box: boolean;
}

const ROW_COLORS = [
  { value: 'yellow', label: 'زرد', class: 'bg-yellow-400' },
  { value: 'gold', label: 'طلایی', class: 'bg-yellow-500' },
  { value: 'cyan', label: 'فیروزه‌ای', class: 'bg-cyan-400' },
  { value: 'purple', label: 'بنفش', class: 'bg-purple-500' },
  { value: 'peach', label: 'هلویی', class: 'bg-orange-300' },
  { value: 'brown', label: 'قهوه‌ای', class: 'bg-amber-700' },
  { value: 'olive', label: 'زیتونی', class: 'bg-amber-800' },
  { value: 'green', label: 'سبز', class: 'bg-green-500' },
];

export default function DailyReportModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [orderReports, setOrderReports] = useState<OrderReportRow[]>([]);
  const [staffReports, setStaffReports] = useState<StaffReportRow[]>([]);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    if (reportDate) {
      fetchExistingReport();
    }
  }, [reportDate]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          customer_name,
          customer_phone,
          address,
          subcategory_id,
          subcategories!projects_v3_subcategory_id_fkey(name)
        `)
        .in('status', ['pending_execution', 'in_progress', 'scheduled', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((data || []).map((o: any) => ({
        id: o.id,
        code: o.code,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        address: o.address,
        subcategory_name: o.subcategories?.name
      })));
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      // Fetch staff from user_roles who have executive roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'sales_manager', 'general_manager', 'finance_manager']);

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        setStaffMembers((profiles || []).map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name || 'بدون نام',
          phone_number: p.phone_number || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchExistingReport = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const dateStr = reportDate.toISOString().split('T')[0];

      const { data: report, error: reportError } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('report_date', dateStr)
        .eq('created_by', user.id)
        .maybeSingle();

      if (reportError) throw reportError;

      if (report) {
        setExistingReportId(report.id);

        // Fetch order reports
        const { data: orderData } = await supabase
          .from('daily_report_orders')
          .select('*')
          .eq('daily_report_id', report.id);

        setOrderReports((orderData || []).map((o: any) => ({
          id: o.id,
          order_id: o.order_id,
          activity_description: o.activity_description || '',
          service_details: o.service_details || '',
          team_name: o.team_name || '',
          notes: o.notes || '',
          row_color: o.row_color || 'yellow'
        })));

        // Fetch staff reports
        const { data: staffData } = await supabase
          .from('daily_report_staff')
          .select('*')
          .eq('daily_report_id', report.id);

        setStaffReports((staffData || []).map((s: any) => ({
          id: s.id,
          staff_user_id: s.staff_user_id,
          staff_name: s.staff_name || '',
          work_status: s.work_status || 'غایب',
          overtime_hours: s.overtime_hours || 0,
          amount_received: s.amount_received || 0,
          receiving_notes: s.receiving_notes || '',
          amount_spent: s.amount_spent || 0,
          spending_notes: s.spending_notes || '',
          notes: s.notes || '',
          is_cash_box: s.is_cash_box || false
        })));
      } else {
        setExistingReportId(null);
        // Initialize with one default empty order row
        setOrderReports([{
          order_id: '',
          activity_description: '',
          service_details: '',
          team_name: '',
          notes: '',
          row_color: ROW_COLORS[0].value
        }]);
        // Initialize with cash box row and one default staff row
        setStaffReports([
          {
            staff_user_id: null,
            staff_name: 'کارت صندوق اهرم',
            work_status: 'کارکرده',
            overtime_hours: 0,
            amount_received: 0,
            receiving_notes: '',
            amount_spent: 0,
            spending_notes: '',
            notes: '',
            is_cash_box: true
          },
          {
            staff_user_id: null,
            staff_name: '',
            work_status: 'غایب',
            overtime_hours: 0,
            amount_received: 0,
            receiving_notes: '',
            amount_spent: 0,
            spending_notes: '',
            notes: '',
            is_cash_box: false
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOrderRow = () => {
    setOrderReports([...orderReports, {
      order_id: '',
      activity_description: '',
      service_details: '',
      team_name: '',
      notes: '',
      row_color: ROW_COLORS[orderReports.length % ROW_COLORS.length].value
    }]);
  };

  const removeOrderRow = (index: number) => {
    setOrderReports(orderReports.filter((_, i) => i !== index));
  };

  const updateOrderRow = (index: number, field: keyof OrderReportRow, value: string) => {
    setOrderReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // اگر آخرین ردیف ویرایش شد و مقداری وارد شد، یک ردیف جدید اضافه کن
      const isLastRow = index === prev.length - 1;
      const hasContent = value && value.trim().length > 0;
      if (isLastRow && hasContent) {
        updated.push({
          order_id: '',
          activity_description: '',
          service_details: '',
          team_name: '',
          notes: '',
          row_color: ROW_COLORS[updated.length % ROW_COLORS.length].value
        });
      }

      return updated;
    });
  };

  const addStaffRow = () => {
    setStaffReports([...staffReports, {
      staff_user_id: null,
      staff_name: '',
      work_status: 'غایب',
      overtime_hours: 0,
      amount_received: 0,
      receiving_notes: '',
      amount_spent: 0,
      spending_notes: '',
      notes: '',
      is_cash_box: false
    }]);
  };

  const removeStaffRow = (index: number) => {
    if (staffReports[index].is_cash_box) {
      toast.error('ردیف صندوق قابل حذف نیست');
      return;
    }
    setStaffReports(staffReports.filter((_, i) => i !== index));
  };

  const updateStaffRow = (index: number, field: keyof StaffReportRow, value: any) => {
    setStaffReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If selecting a staff member (from DB-based picker), update the name too
      if (field === 'staff_user_id' && value) {
        const staff = staffMembers.find((s) => s.user_id === value);
        if (staff) {
          updated[index].staff_name = staff.full_name;
        }
      }

      // آخرین ردیف غیر صندوق را پیدا کن
      const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
      const lastNonCashBoxIndex = updated.findIndex(
        (r, i) => !r.is_cash_box && i === updated.lastIndexOf(nonCashBoxRows[nonCashBoxRows.length - 1])
      );

      // اگر آخرین ردیف غیر صندوق ویرایش شد و مقداری وارد شد، یک ردیف جدید اضافه کن
      const isLastNonCashBoxRow = index === lastNonCashBoxIndex;
      const hasContent =
        (typeof value === 'string' && value.trim().length > 0) ||
        (typeof value === 'number' && value > 0);

      if (isLastNonCashBoxRow && hasContent && !updated[index].is_cash_box) {
        updated.push({
          staff_user_id: null,
          staff_name: '',
          work_status: 'غایب',
          overtime_hours: 0,
          amount_received: 0,
          receiving_notes: '',
          amount_spent: 0,
          spending_notes: '',
          notes: '',
          is_cash_box: false
        });
      }

      return updated;
    });
  };

  const calculateTotals = () => {
    const presentCount = staffReports.filter(s => s.work_status === 'کارکرده' && !s.is_cash_box).length;
    const totalOvertime = staffReports.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);
    
    // صندوق: مبلغ خرج کرده = پرداخت به نیروها
    const cashBoxSpent = staffReports
      .filter(s => s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    // نیروها: مبلغ دریافتی از صندوق
    const staffReceived = staffReports
      .filter(s => !s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_received || 0), 0);
    
    // کل دریافتی و خرج کرده برای نمایش
    const totalReceived = staffReports.reduce((sum, s) => sum + (s.amount_received || 0), 0);
    const totalSpent = staffReports.reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    return { presentCount, totalOvertime, totalReceived, totalSpent, cashBoxSpent, staffReceived };
  };

  const saveReport = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const dateStr = reportDate.toISOString().split('T')[0];

      let reportId = existingReportId;

      if (!reportId) {
        // Create new report
        const { data: newReport, error: createError } = await supabase
          .from('daily_reports')
          .insert({
            report_date: dateStr,
            created_by: user.id
          })
          .select('id')
          .single();

        if (createError) throw createError;
        reportId = newReport.id;
        setExistingReportId(reportId);
      }

      // Delete existing order reports and insert new ones
      await supabase
        .from('daily_report_orders')
        .delete()
        .eq('daily_report_id', reportId);

      if (orderReports.filter(r => r.order_id).length > 0) {
        const { error: orderError } = await supabase
          .from('daily_report_orders')
          .insert(orderReports.filter(r => r.order_id).map(r => ({
            daily_report_id: reportId,
            order_id: r.order_id,
            activity_description: r.activity_description,
            service_details: r.service_details,
            team_name: r.team_name,
            notes: r.notes,
            row_color: r.row_color
          })));

        if (orderError) throw orderError;
      }

      // Delete existing staff reports and insert new ones
      await supabase
        .from('daily_report_staff')
        .delete()
        .eq('daily_report_id', reportId);

      if (staffReports.length > 0) {
        const { error: staffError } = await supabase
          .from('daily_report_staff')
          .insert(staffReports.map(s => ({
            daily_report_id: reportId,
            staff_user_id: s.staff_user_id,
            staff_name: s.staff_name,
            work_status: s.work_status,
            overtime_hours: s.overtime_hours,
            amount_received: s.amount_received,
            receiving_notes: s.receiving_notes,
            amount_spent: s.amount_spent,
            spending_notes: s.spending_notes,
            notes: s.notes,
            is_cash_box: s.is_cash_box
          })));

        if (staffError) throw staffError;
      }

      toast.success('گزارش با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('خطا در ذخیره گزارش');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();
  // تراز مالی: پول خرج شده از صندوق باید برابر مبلغ دریافتی نیروها باشد
  const balance = totals.cashBoxSpent - totals.staffReceived;

  const getRowColorClass = (color: string) => {
    return ROW_COLORS.find(c => c.value === color)?.class || 'bg-background';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">گزارش روزانه شرکت اهرم</h1>
              <p className="text-sm text-muted-foreground">ثبت گزارش فعالیت‌های روزانه</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">تاریخ گزارش:</Label>
            <PersianDatePicker
              value={reportDate.toISOString()}
              onChange={(date) => date && setReportDate(new Date(date))}
              timeMode="none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            {/* Order Reports Table */}
            <Card className="border-2 border-blue-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">گزارش سفارشات مشتری</CardTitle>
                  </div>
                  <Button size="sm" onClick={addOrderRow} className="gap-2">
                    <Plus className="h-4 w-4" />
                    افزودن ردیف
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="table-auto">
                    <TableHeader>
                      <TableRow className="bg-blue-100 dark:bg-blue-900/30">
                        <TableHead className="text-right whitespace-nowrap px-2">سفارش مشتری را انتخاب کنید</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">شرح فعالیت امروز</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">تعداد، ابعاد و متراژ خدمات</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">اکیپ</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">توضیحات</TableHead>
                        <TableHead className="whitespace-nowrap px-2">رنگ</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            هنوز سفارشی اضافه نشده است
                          </TableCell>
                        </TableRow>
                      ) : (
                        orderReports.map((row, index) => (
                          <TableRow key={index} className={getRowColorClass(row.row_color)}>
                            <TableCell>
                              <OrderSearchSelect
                                orders={orders}
                                value={row.order_id}
                                onValueChange={(value) => updateOrderRow(index, 'order_id', value)}
                                placeholder="انتخاب سفارش"
                              />
                            </TableCell>
                            <TableCell>
                              <AutoResizeTextarea
                                value={row.activity_description}
                                onChange={(e) => updateOrderRow(index, 'activity_description', e.target.value)}
                                className="min-h-[40px] bg-white/50"
                                placeholder="شرح فعالیت..."
                              />
                            </TableCell>
                            <TableCell>
                              <AutoResizeTextarea
                                value={row.service_details}
                                onChange={(e) => updateOrderRow(index, 'service_details', e.target.value)}
                                className="min-h-[40px] bg-white/50"
                                placeholder="جزئیات خدمات..."
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.team_name}
                                onChange={(e) => updateOrderRow(index, 'team_name', e.target.value)}
                                className="bg-white/50"
                                placeholder="نام اکیپ"
                              />
                            </TableCell>
                            <TableCell>
                              <AutoResizeTextarea
                                value={row.notes}
                                onChange={(e) => updateOrderRow(index, 'notes', e.target.value)}
                                className="min-h-[40px] bg-white/50"
                                placeholder="توضیحات..."
                              />
                            </TableCell>
                            <TableCell>
                              <div className={`w-6 h-6 rounded ${getRowColorClass(row.row_color)}`}></div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOrderRow(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Staff Reports Table */}
            <Card className="border-2 border-amber-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <User className="h-5 w-5 text-amber-600" />
                    </div>
                    <CardTitle className="text-lg">گزارش نیروها</CardTitle>
                  </div>
                  <Button size="sm" onClick={addStaffRow} className="gap-2">
                    <Plus className="h-4 w-4" />
                    افزودن نیرو
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-visible">
                  <Table className="table-auto">
                    <TableHeader>
                      <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                        <TableHead className="text-right whitespace-nowrap px-2">نیروها</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">کارکرد</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">اضافه کاری</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">مبلغ دریافتی</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">توضیحات دریافتی</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">مبلغ خرج کرده شده در کار</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">توضیحات مبلغ خرج کرد</TableHead>
                        <TableHead className="text-right whitespace-nowrap px-2">توضیحات</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffReports.map((row, index) => (
                        <TableRow 
                          key={index} 
                          className={row.is_cash_box ? 'bg-amber-50 dark:bg-amber-900/20' : ''}
                        >
                          <TableCell>
                            {row.is_cash_box ? (
                              <div className="font-semibold text-amber-700">{row.staff_name}</div>
                            ) : (
                              <StaffSearchSelect
                                value={row.staff_user_id || ''}
                                onValueChange={(code, name) => {
                                  updateStaffRow(index, 'staff_user_id', code);
                                  updateStaffRow(index, 'staff_name', name);
                                }}
                                placeholder="انتخاب نیرو"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {row.is_cash_box ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Select
                                value={row.work_status}
                                onValueChange={(value: 'کارکرده' | 'غایب') => updateStaffRow(index, 'work_status', value)}
                              >
                                <SelectTrigger className="min-w-[90px] w-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  <SelectItem value="کارکرده">کارکرده</SelectItem>
                                  <SelectItem value="غایب">غایب</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.is_cash_box ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.overtime_hours === 0 ? '' : row.overtime_hours.toString()}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/^0+(?=\d)/, '');
                                    updateStaffRow(index, 'overtime_hours', parseFloat(val) || 0);
                                  }}
                                  className="min-w-[60px] w-[70px]"
                                  dir="ltr"
                                  placeholder="0"
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">ساعت</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={row.amount_received === 0 ? '' : row.amount_received.toString()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/^0+(?=\d)/, '');
                                  updateStaffRow(index, 'amount_received', parseFloat(val) || 0);
                                }}
                                className="min-w-[80px] w-[90px]"
                                dir="ltr"
                                placeholder="0"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">تومان</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AutoResizeTextarea
                              value={row.receiving_notes}
                              onChange={(e) => updateStaffRow(index, 'receiving_notes', e.target.value)}
                              placeholder="توضیحات..."
                              className="min-w-[100px] min-h-[36px]"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={row.amount_spent === 0 ? '' : row.amount_spent.toString()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/^0+(?=\d)/, '');
                                  updateStaffRow(index, 'amount_spent', parseFloat(val) || 0);
                                }}
                                className="min-w-[80px] w-[90px]"
                                dir="ltr"
                                placeholder="0"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">تومان</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AutoResizeTextarea
                              value={row.spending_notes}
                              onChange={(e) => updateStaffRow(index, 'spending_notes', e.target.value)}
                              placeholder="توضیحات..."
                              className="min-w-[100px] min-h-[36px]"
                            />
                          </TableCell>
                          <TableCell>
                            <AutoResizeTextarea
                              value={row.notes}
                              onChange={(e) => updateStaffRow(index, 'notes', e.target.value)}
                              placeholder="توضیحات..."
                              className="min-w-[100px] min-h-[36px]"
                            />
                          </TableCell>
                          <TableCell>
                            {!row.is_cash_box && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeStaffRow(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Summary Row */}
                      <TableRow className="bg-amber-200 dark:bg-amber-800/40 font-bold">
                        <TableCell>جمع:</TableCell>
                        <TableCell>{totals.presentCount} نیرو</TableCell>
                        <TableCell>{totals.totalOvertime} ساعت</TableCell>
                        <TableCell>{totals.totalReceived.toLocaleString()} تومان</TableCell>
                        <TableCell></TableCell>
                        <TableCell>{totals.totalSpent.toLocaleString()} تومان</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>

                      {/* Balance Row */}
                      <TableRow className={balance >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}>
                        <TableCell colSpan={9} className="text-center">
                          <Badge variant={balance >= 0 ? 'default' : 'destructive'} className="text-base px-4 py-2">
                            {balance >= 0 ? 'تراز مالی صحیح است' : 'کسری مالی'}
                            {balance !== 0 && ` (${Math.abs(balance).toLocaleString()} تومان)`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-center">
              <Button 
                onClick={saveReport} 
                disabled={saving}
                size="lg"
                className="gap-2 min-w-[200px]"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                ذخیره گزارش
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
