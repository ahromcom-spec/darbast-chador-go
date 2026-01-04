import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Loader2, 
  Search, 
  User, 
  Phone, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  Printer,
  Download,
  Building2,
  Package,
  CreditCard,
  Calendar,
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useCEORole } from '@/hooks/useCEORole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';

// Types
interface OrderItem {
  id: string;
  code: string;
  address: string;
  service_type_name: string;
  subcategory_name: string;
  status: string;
  payment_amount: number;
  total_paid: number;
  remaining: number;
  created_at: string;
  notes: any;
}

interface PaymentRecord {
  id: string;
  amount: number;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  order_code: string;
}

interface CustomerData {
  customer_id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  total_orders: number;
  total_amount: number;
  total_paid: number;
  total_remaining: number;
  orders: OrderItem[];
  payments: PaymentRecord[];
}

const statusLabels: Record<string, string> = {
  pending: 'در انتظار تایید',
  approved: 'تایید شده',
  ready: 'آماده اجرا',
  in_progress: 'در حال اجرا',
  order_executed: 'اجرا شده',
  awaiting_payment: 'منتظر پرداخت',
  awaiting_collection: 'منتظر جمع‌آوری',
  collected: 'جمع‌آوری شده',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
  draft: 'پیش‌نویس'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  ready: 'bg-cyan-100 text-cyan-800',
  in_progress: 'bg-purple-100 text-purple-800',
  order_executed: 'bg-indigo-100 text-indigo-800',
  awaiting_payment: 'bg-orange-100 text-orange-800',
  awaiting_collection: 'bg-pink-100 text-pink-800',
  collected: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  paid: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-500'
};

const DEFAULT_TITLE = 'صورتحساب جامع مشتریان';
const DEFAULT_DESCRIPTION = 'مدیریت و چاپ صورتحساب جامع خدمات و پرداخت‌های مشتریان';

export default function CustomerComprehensiveInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isCEO, loading: ceoLoading } = useCEORole();
  const activeModuleKey = searchParams.get('moduleKey') || 'customer_comprehensive_invoice';
  const { moduleName, moduleDescription } = useModuleAssignmentInfo(activeModuleKey, DEFAULT_TITLE, DEFAULT_DESCRIPTION);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  // Summary stats
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalOrders: 0
  });

  useEffect(() => {
    if (user && isCEO) {
      fetchCustomersData();
    }
  }, [user, isCEO]);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const fetchCustomersData = async () => {
    setLoading(true);
    try {
      // Get all customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, user_id');

      if (customersError) throw customersError;

      // Get profiles
      const userIds = customersData?.map(c => c.user_id).filter(Boolean) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get all orders with service info
      const { data: orders, error: ordersError } = await supabase
        .from('projects_v3')
        .select(`
          id, customer_id, code, address, payment_amount, total_paid, 
          created_at, status, notes,
          subcategory:subcategories(name, service_type:service_types_v3(name))
        `)
        .not('status', 'in', '(draft,rejected)')
        .or('is_archived.is.null,is_archived.eq.false')
        .or('is_deep_archived.is.null,is_deep_archived.eq.false');

      if (ordersError) throw ordersError;

      // Get all payments
      const orderIds = orders?.map(o => o.id) || [];
      const { data: payments, error: paymentsError } = await supabase
        .from('order_payments')
        .select('id, order_id, amount, payment_method, receipt_number, notes, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Create order code map for payments
      const orderCodeMap = new Map(orders?.map(o => [o.id, o.code]) || []);

      // Group by customer
      const ordersByCustomer = new Map<string, typeof orders>();
      orders?.forEach(order => {
        const existing = ordersByCustomer.get(order.customer_id) || [];
        existing.push(order);
        ordersByCustomer.set(order.customer_id, existing);
      });

      // Group payments by customer
      const paymentsByCustomer = new Map<string, typeof payments>();
      payments?.forEach(payment => {
        const order = orders?.find(o => o.id === payment.order_id);
        if (order) {
          const existing = paymentsByCustomer.get(order.customer_id) || [];
          existing.push(payment);
          paymentsByCustomer.set(order.customer_id, existing);
        }
      });

      // Build customer data
      const customerDataList: CustomerData[] = [];

      customersData?.forEach(customer => {
        const profile = profileMap.get(customer.user_id);
        const customerOrders = ordersByCustomer.get(customer.id) || [];
        const customerPayments = paymentsByCustomer.get(customer.id) || [];

        if (customerOrders.length === 0) return;

        const totalAmount = customerOrders.reduce((sum, o) => sum + (o.payment_amount || 0), 0);
        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.total_paid || 0), 0);

        customerDataList.push({
          customer_id: customer.id,
          user_id: customer.user_id,
          full_name: profile?.full_name || 'بدون نام',
          phone_number: profile?.phone_number || '-',
          total_orders: customerOrders.length,
          total_amount: totalAmount,
          total_paid: totalPaid,
          total_remaining: Math.max(0, totalAmount - totalPaid),
          orders: customerOrders.map(o => {
            const subcategoryData = o.subcategory as any;
            return {
              id: o.id,
              code: o.code,
              address: o.address || '-',
              service_type_name: subcategoryData?.service_type?.name || '-',
              subcategory_name: subcategoryData?.name || '-',
              status: o.status,
              payment_amount: o.payment_amount || 0,
              total_paid: o.total_paid || 0,
              remaining: Math.max(0, (o.payment_amount || 0) - (o.total_paid || 0)),
              created_at: o.created_at,
              notes: o.notes
            };
          }),
          payments: customerPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            payment_method: p.payment_method,
            receipt_number: p.receipt_number,
            notes: p.notes,
            created_at: p.created_at,
            order_code: orderCodeMap.get(p.order_id) || '-'
          }))
        });
      });

      // Sort by remaining amount (descending)
      customerDataList.sort((a, b) => b.total_remaining - a.total_remaining);

      setCustomers(customerDataList);
      setFilteredCustomers(customerDataList);

      // Calculate summary
      setSummary({
        totalCustomers: customerDataList.length,
        totalAmount: customerDataList.reduce((sum, c) => sum + c.total_amount, 0),
        totalPaid: customerDataList.reduce((sum, c) => sum + c.total_paid, 0),
        totalRemaining: customerDataList.reduce((sum, c) => sum + c.total_remaining, 0),
        totalOrders: customerDataList.reduce((sum, c) => sum + c.total_orders, 0)
      });

    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('خطا در دریافت اطلاعات مشتریان');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = customers.filter(c => 
      c.full_name.toLowerCase().includes(query) ||
      c.phone_number.includes(query) ||
      c.orders.some(o => o.code.includes(query) || o.address.toLowerCase().includes(query))
    );
    setFilteredCustomers(filtered);
  }, [searchQuery, customers]);

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(Math.round(amount)) + ' تومان';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd', { locale: faIR });
    } catch {
      return '-';
    }
  };

  const openInvoiceDialog = (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setInvoiceDialogOpen(true);
  };

  const getInvoiceHTML = (customer: CustomerData) => {
    const today = format(new Date(), 'yyyy/MM/dd - HH:mm', { locale: faIR });
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>صورتحساب جامع - ${customer.full_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Vazirmatn', sans-serif;
            direction: rtl;
            padding: 20px;
            background: #fff;
            color: #333;
            font-size: 12px;
          }
          
          .invoice-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          
          .invoice-header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
          }
          
          .invoice-header p {
            color: #666;
            font-size: 11px;
          }
          
          .customer-info {
            display: flex;
            justify-content: space-between;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          
          .customer-info .info-item {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          
          .customer-info .label {
            font-weight: 600;
            color: #555;
          }
          
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          
          .summary-card {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e0e0e0;
          }
          
          .summary-card.total {
            background: #e3f2fd;
            border-color: #90caf9;
          }
          
          .summary-card.paid {
            background: #e8f5e9;
            border-color: #a5d6a7;
          }
          
          .summary-card.remaining {
            background: #fff3e0;
            border-color: #ffcc80;
          }
          
          .summary-card .value {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          
          .summary-card .label {
            font-size: 10px;
            color: #666;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 600;
            margin: 20px 0 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: right;
          }
          
          th {
            background: #f5f5f5;
            font-weight: 600;
          }
          
          tr:nth-child(even) {
            background: #fafafa;
          }
          
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
          }
          
          .signature-area {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          
          .signature-box {
            text-align: center;
            width: 200px;
          }
          
          .signature-line {
            border-bottom: 1px solid #333;
            height: 60px;
            margin-bottom: 5px;
          }
          
          @media print {
            body { padding: 10px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>صورتحساب جامع خدمات</h1>
          <p>تاریخ صدور: ${today}</p>
        </div>
        
        <div class="customer-info">
          <div class="info-item">
            <span class="label">نام مشتری:</span>
            <span>${customer.full_name}</span>
          </div>
          <div class="info-item">
            <span class="label">شماره تماس:</span>
            <span>${customer.phone_number}</span>
          </div>
          <div class="info-item">
            <span class="label">تعداد سفارشات:</span>
            <span>${customer.total_orders}</span>
          </div>
        </div>
        
        <div class="summary-cards">
          <div class="summary-card">
            <div class="value">${customer.total_orders}</div>
            <div class="label">تعداد سفارشات</div>
          </div>
          <div class="summary-card total">
            <div class="value">${formatCurrency(customer.total_amount)}</div>
            <div class="label">مبلغ کل</div>
          </div>
          <div class="summary-card paid">
            <div class="value">${formatCurrency(customer.total_paid)}</div>
            <div class="label">پرداخت شده</div>
          </div>
          <div class="summary-card remaining">
            <div class="value">${formatCurrency(customer.total_remaining)}</div>
            <div class="label">مانده بدهی</div>
          </div>
        </div>
        
        <h3 class="section-title">لیست سفارشات</h3>
        <table>
          <thead>
            <tr>
              <th>ردیف</th>
              <th>کد سفارش</th>
              <th>نوع خدمت</th>
              <th>زیرشاخه</th>
              <th>آدرس</th>
              <th>تاریخ</th>
              <th>وضعیت</th>
              <th>مبلغ کل</th>
              <th>پرداخت شده</th>
              <th>مانده</th>
            </tr>
          </thead>
          <tbody>
            ${customer.orders.map((order, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${order.code}</td>
                <td>${order.service_type_name}</td>
                <td>${order.subcategory_name}</td>
                <td>${order.address}</td>
                <td>${formatDate(order.created_at)}</td>
                <td><span class="status-badge">${statusLabels[order.status] || order.status}</span></td>
                <td>${formatCurrency(order.payment_amount)}</td>
                <td>${formatCurrency(order.total_paid)}</td>
                <td>${formatCurrency(order.remaining)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${customer.payments.length > 0 ? `
          <h3 class="section-title">تاریخچه پرداخت‌ها</h3>
          <table>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>تاریخ</th>
                <th>کد سفارش</th>
                <th>مبلغ</th>
                <th>روش پرداخت</th>
                <th>شماره فیش</th>
                <th>توضیحات</th>
              </tr>
            </thead>
            <tbody>
              ${customer.payments.map((payment, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${formatDate(payment.created_at)}</td>
                  <td>${payment.order_code}</td>
                  <td>${formatCurrency(payment.amount)}</td>
                  <td>${payment.payment_method || '-'}</td>
                  <td>${payment.receipt_number || '-'}</td>
                  <td>${payment.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        
        <div class="signature-area">
          <div class="signature-box">
            <div class="signature-line"></div>
            <p>امضاء مشتری</p>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <p>امضاء و مهر شرکت</p>
          </div>
        </div>
        
        <div class="footer">
          <span>این صورتحساب به صورت سیستمی صادر شده است.</span>
          <span>شرکت اهرم</span>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintInvoice = (customer: CustomerData) => {
    const html = getInvoiceHTML(customer);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleDownloadPDF = async (customer: CustomerData) => {
    try {
      toast.info('در حال آماده‌سازی PDF...');
      
      const html2pdf = (await import('html2pdf.js')).default;
      const html = getInvoiceHTML(customer);
      
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const options = {
        margin: 10,
        filename: `صورتحساب-جامع-${customer.full_name}-${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(options).from(container).save();
      document.body.removeChild(container);
      
      toast.success('PDF با موفقیت دانلود شد');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('خطا در ایجاد PDF');
    }
  };

  if (ceoLoading || loading) {
    return (
      <ModuleLayout
        defaultModuleKey={activeModuleKey}
        defaultTitle={DEFAULT_TITLE}
        defaultDescription={DEFAULT_DESCRIPTION}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!isCEO) {
    return (
      <ModuleLayout
        defaultModuleKey={activeModuleKey}
        defaultTitle={DEFAULT_TITLE}
        defaultDescription={DEFAULT_DESCRIPTION}
      >
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">دسترسی محدود</p>
            <p className="text-muted-foreground mt-2">شما دسترسی به این ماژول ندارید.</p>
          </CardContent>
        </Card>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout
      defaultModuleKey={activeModuleKey}
      defaultTitle={DEFAULT_TITLE}
      defaultDescription={DEFAULT_DESCRIPTION}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4 text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-blue-700">{summary.totalCustomers}</p>
            <p className="text-xs text-blue-600">مشتریان</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold text-purple-700">{summary.totalOrders}</p>
            <p className="text-xs text-purple-600">سفارشات</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardContent className="pt-4 text-center">
            <Receipt className="h-6 w-6 mx-auto mb-2 text-cyan-600" />
            <p className="text-lg font-bold text-cyan-700">{formatCurrency(summary.totalAmount)}</p>
            <p className="text-xs text-cyan-600">مبلغ کل</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-lg font-bold text-green-700">{formatCurrency(summary.totalPaid)}</p>
            <p className="text-xs text-green-600">پرداخت شده</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-4 text-center">
            <Banknote className="h-6 w-6 mx-auto mb-2 text-orange-600" />
            <p className="text-lg font-bold text-orange-700">{formatCurrency(summary.totalRemaining)}</p>
            <p className="text-xs text-orange-600">مانده بدهی</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، شماره تماس یا کد سفارش..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <div className="space-y-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">مشتری‌ای یافت نشد</p>
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.customer_id} className="overflow-hidden">
              <Collapsible
                open={expandedCustomers.has(customer.customer_id)}
                onOpenChange={() => toggleCustomer(customer.customer_id)}
              >
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{customer.full_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone_number}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {customer.total_orders} سفارش
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-sm text-muted-foreground">مانده بدهی</p>
                          <p className={`font-bold ${customer.total_remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(customer.total_remaining)}
                          </p>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInvoiceDialog(customer);
                          }}
                        >
                          <FileText className="h-4 w-4 ml-1" />
                          صورتحساب
                        </Button>
                        
                        {expandedCustomers.has(customer.customer_id) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t pt-4 bg-muted/30">
                    {/* Orders Table */}
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        سفارشات
                      </h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>کد</TableHead>
                              <TableHead>نوع خدمت</TableHead>
                              <TableHead>آدرس</TableHead>
                              <TableHead>تاریخ</TableHead>
                              <TableHead>وضعیت</TableHead>
                              <TableHead>مبلغ</TableHead>
                              <TableHead>پرداختی</TableHead>
                              <TableHead>مانده</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customer.orders.map((order) => (
                              <TableRow key={order.id}>
                                <TableCell className="font-mono text-xs">{order.code}</TableCell>
                                <TableCell className="text-sm">{order.service_type_name}</TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate">{order.address}</TableCell>
                                <TableCell className="text-xs">{formatDate(order.created_at)}</TableCell>
                                <TableCell>
                                  <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                                    {statusLabels[order.status] || order.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{formatCurrency(order.payment_amount)}</TableCell>
                                <TableCell className="text-sm text-green-600">{formatCurrency(order.total_paid)}</TableCell>
                                <TableCell className={`text-sm ${order.remaining > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}`}>
                                  {formatCurrency(order.remaining)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    
                    {/* Summary Row */}
                    <div className="flex justify-end gap-6 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">مجموع</p>
                        <p className="font-bold">{formatCurrency(customer.total_amount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">پرداخت شده</p>
                        <p className="font-bold text-green-600">{formatCurrency(customer.total_paid)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">مانده</p>
                        <p className="font-bold text-orange-600">{formatCurrency(customer.total_remaining)}</p>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>صورتحساب جامع - {selectedCustomer?.full_name}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedCustomer && handlePrintInvoice(selectedCustomer)}
                >
                  <Printer className="h-4 w-4 ml-1" />
                  چاپ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedCustomer && handleDownloadPDF(selectedCustomer)}
                >
                  <Download className="h-4 w-4 ml-1" />
                  دانلود PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{selectedCustomer.full_name}</p>
                  <p className="text-muted-foreground">{selectedCustomer.phone_number}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">تعداد سفارشات</p>
                  <p className="text-xl font-bold">{selectedCustomer.total_orders}</p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(selectedCustomer.total_amount)}</p>
                    <p className="text-sm text-blue-600">مبلغ کل خدمات</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(selectedCustomer.total_paid)}</p>
                    <p className="text-sm text-green-600">پرداخت شده</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-orange-700">{formatCurrency(selectedCustomer.total_remaining)}</p>
                    <p className="text-sm text-orange-600">مانده بدهی</p>
                  </CardContent>
                </Card>
              </div>

              {/* Orders */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  لیست سفارشات
                </h3>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead>ردیف</TableHead>
                        <TableHead>کد سفارش</TableHead>
                        <TableHead>نوع خدمت</TableHead>
                        <TableHead>آدرس</TableHead>
                        <TableHead>تاریخ</TableHead>
                        <TableHead>وضعیت</TableHead>
                        <TableHead>مبلغ</TableHead>
                        <TableHead>پرداختی</TableHead>
                        <TableHead>مانده</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.orders.map((order, idx) => (
                        <TableRow key={order.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-mono">{order.code}</TableCell>
                          <TableCell>{order.service_type_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{order.address}</TableCell>
                          <TableCell>{formatDate(order.created_at)}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status]}>
                              {statusLabels[order.status] || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(order.payment_amount)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(order.total_paid)}</TableCell>
                          <TableCell className={order.remaining > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                            {formatCurrency(order.remaining)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payments */}
              {selectedCustomer.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    تاریخچه پرداخت‌ها
                  </h3>
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead>ردیف</TableHead>
                          <TableHead>تاریخ</TableHead>
                          <TableHead>کد سفارش</TableHead>
                          <TableHead>مبلغ</TableHead>
                          <TableHead>روش پرداخت</TableHead>
                          <TableHead>شماره فیش</TableHead>
                          <TableHead>توضیحات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCustomer.payments.map((payment, idx) => (
                          <TableRow key={payment.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{formatDate(payment.created_at)}</TableCell>
                            <TableCell className="font-mono">{payment.order_code}</TableCell>
                            <TableCell className="text-green-600 font-medium">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{payment.payment_method || '-'}</TableCell>
                            <TableCell>{payment.receipt_number || '-'}</TableCell>
                            <TableCell>{payment.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}
