import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CreditCard, Search, CheckCircle, Clock, User, Phone, Calendar, Receipt, Banknote } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

interface PaymentRecord {
  id: string;
  code: string | null;
  payment_amount: number | null;
  payment_confirmed_at: string | null;
  payment_method: string | null;
  transaction_reference: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  status: string;
  created_at: string;
}

const PaymentHistory = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      // Fetch all orders with payment information
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          payment_amount,
          payment_confirmed_at,
          payment_method,
          transaction_reference,
          customer_name,
          customer_phone,
          address,
          status,
          created_at
        `)
        .not('payment_amount', 'is', null)
        .order('payment_confirmed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }

      setPayments(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.code?.toLowerCase().includes(searchLower) ||
      payment.customer_name?.toLowerCase().includes(searchLower) ||
      payment.customer_phone?.includes(searchTerm) ||
      payment.transaction_reference?.includes(searchTerm) ||
      payment.address?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'd MMMM yyyy - HH:mm', { locale: faIR });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
  };

  const getPaymentStatus = (payment: PaymentRecord) => {
    if (payment.payment_confirmed_at) {
      return { label: 'پرداخت شده', variant: 'default' as const, icon: CheckCircle };
    }
    if (payment.payment_amount) {
      return { label: 'در انتظار پرداخت', variant: 'secondary' as const, icon: Clock };
    }
    return { label: 'بدون پرداخت', variant: 'outline' as const, icon: Clock };
  };

  const totalPaid = payments
    .filter(p => p.payment_confirmed_at)
    .reduce((sum, p) => sum + (p.payment_amount || 0), 0);

  const pendingPayments = payments.filter(p => !p.payment_confirmed_at && p.payment_amount);

  if (loading) {
    return <LoadingSpinner text="در حال بارگذاری تاریخچه پرداخت‌ها..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            تاریخچه پرداخت‌ها
          </h1>
          <p className="text-muted-foreground mt-1">
            مشاهده تمام پرداخت‌های انجام شده توسط مشتریان
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل پرداخت‌های موفق</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تعداد پرداخت موفق</p>
                <p className="text-2xl font-bold text-blue-600">
                  {payments.filter(p => p.payment_confirmed_at).length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">در انتظار پرداخت</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس کد سفارش، نام مشتری، شماره تماس یا شماره تراکنش..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>هیچ پرداختی یافت نشد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">کد سفارش</TableHead>
                    <TableHead className="text-right">مشتری</TableHead>
                    <TableHead className="text-right">مبلغ</TableHead>
                    <TableHead className="text-right">تاریخ پرداخت</TableHead>
                    <TableHead className="text-right">شماره تراکنش</TableHead>
                    <TableHead className="text-right">روش پرداخت</TableHead>
                    <TableHead className="text-right">وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const status = getPaymentStatus(payment);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          {payment.code || payment.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <User className="h-3 w-3" />
                              {payment.customer_name || 'نامشخص'}
                            </div>
                            {payment.customer_phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                                <Phone className="h-3 w-3" />
                                {payment.customer_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(payment.payment_amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(payment.payment_confirmed_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.transaction_reference ? (
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <Receipt className="h-3 w-3 text-muted-foreground" />
                              {payment.transaction_reference}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.payment_method === 'zarinpal' ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              زرین‌پال
                            </Badge>
                          ) : payment.payment_method ? (
                            <Badge variant="outline">{payment.payment_method}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50/50 border-blue-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-800">💡 راهنما</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <p>
            این جدول تمام پرداخت‌های ثبت شده در سایت را نمایش می‌دهد. با استفاده از <strong>شماره تراکنش</strong> می‌توانید پرداخت‌ها را در پنل زرین‌پال پیدا کنید.
          </p>
          <p>
            از این پس، در پنل زرین‌پال نیز نام مشتری و کد سفارش در <strong>توضیحات تراکنش</strong> نمایش داده می‌شود.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;
