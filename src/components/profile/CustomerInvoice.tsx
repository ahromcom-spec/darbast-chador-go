import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PaymentProofDialog from '@/components/payments/PaymentProofDialog';
import PaymentSubmissionsList from '@/components/payments/PaymentSubmissionsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Wallet, TrendingUp, TrendingDown, ChevronDown, ChevronUp, FileText, CheckCircle2, Lock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatementInvoiceDialog } from '@/components/executive/StatementInvoiceDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseLocalizedNumber, toEnglishDigits } from '@/lib/numberParsing';

const PAYMENT_GATEWAY_UNAVAILABLE_MESSAGE = 'درگاه پرداخت زرین‌پال در حال حاضر در دسترس نیست. لطفاً چند دقیقه دیگر دوباره تلاش کنید.';

const getPaymentErrorMessage = (message?: string) => {
  if (!message) return 'لطفاً مجدداً تلاش کنید';
  if (/api\.zarinpal\.com|ETIMEDOUT|AbortError|Connection timed out|tcp connect error|NETWORK_ERROR|error sending request/i.test(message)) {
    return PAYMENT_GATEWAY_UNAVAILABLE_MESSAGE;
  }
  return message;
};

interface OrderRow {
  id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  subcategory_name: string | null;
  description: string | null;
}

import { extractOrderDescription } from '@/lib/orderDescription';

interface StatementGroup {
  id: string;
  statement_number: number;
  status: 'open' | 'closed';
  closed_at: string | null;
  created_at: string;
  total_amount: number;
  total_paid: number;
  total_remaining: number;
  subcategory_name: string | null;
  address: string | null;
  detailed_address: string | null;
  service_types: string[];
  addresses: string[];
  orders: OrderRow[];
  is_manual: boolean;
  is_archived: boolean;
  is_deep_archived: boolean;
}

const statusLabels: Record<string, string> = {
  pending: 'در انتظار تایید',
  pending_execution: 'در انتظار اجرا',
  approved: 'تایید شده',
  scheduled: 'زمان‌بندی شده',
  in_progress: 'در حال اجرا',
  pending_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'جمع‌آوری شد',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
};

const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

export const CustomerInvoice = () => {
  const { user } = useAuth();
  const [proofRefreshKey, setProofRefreshKey] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<StatementGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<{ full_name: string | null; phone_number: string | null; customer_code: string | null }>({ full_name: null, phone_number: null, customer_code: null });
  const [payDialog, setPayDialog] = useState<{ open: boolean; statement: StatementGroup | null; payAll?: boolean }>({ open: false, statement: null });
  const [payAmountInput, setPayAmountInput] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const openPayDialog = (s: StatementGroup) => {
    setPayAmountInput(String(Math.round(s.total_remaining || 0)));
    setPayDialog({ open: true, statement: s, payAll: false });
  };

  const openPayAllDialog = () => {
    setPayAmountInput(String(Math.round(summary.remaining || 0)));
    setPayDialog({ open: true, statement: null, payAll: true });
  };


  const handleStatementPay = async () => {
    if (!payDialog.statement && !payDialog.payAll) return;
    const amount = Math.round(parseLocalizedNumber(payAmountInput));
    if (!amount || amount <= 0) {
      toast({ title: 'مبلغ نامعتبر', description: 'لطفاً مبلغ معتبری وارد کنید', variant: 'destructive' });
      return;
    }
    try {
      setPaying(true);
      toast({ title: 'در حال اتصال به درگاه پرداخت', description: 'لطفاً صبر کنید...' });
      const { data, error } = await supabase.functions.invoke('zarinpal-payment', {
        body: payDialog.payAll
          ? { pay_all: true, amount }
          : { statement_id: payDialog.statement!.id, amount },
      });

      if (error) throw error;
      if (data?.payment_url) {
        window.location.href = data.payment_url;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error(data?.error || 'URL پرداخت دریافت نشد');
      }
    } catch (err: any) {
      console.error('Statement payment error:', err);
      toast({ title: 'خطا در اتصال به درگاه', description: getPaymentErrorMessage(err?.message), variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!customer) {
        setStatements([]);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, phone_number, customer_code')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (prof) setProfile({ full_name: prof.full_name, phone_number: prof.phone_number, customer_code: (prof as any).customer_code ?? null });

      const { data: stmts, error: e1 } = await supabase
        .from('customer_statements' as any)
        .select('*')
        .eq('customer_id', customer.id)
        .order('statement_number', { ascending: false });
      if (e1) throw e1;

      const { data: orders, error: e2 } = await supabase
        .from('projects_v3')
        .select('id, code, status, payment_amount, total_price, total_paid, created_at, statement_id, address, detailed_address, notes, subcategories(name)')
        .eq('customer_id', customer.id)
        .neq('status', 'rejected')
        .or('is_deep_archived.is.null,is_deep_archived.eq.false')
        .order('created_at', { ascending: false });
      if (e2) throw e2;

      const groups: StatementGroup[] = (stmts || []).map((s: any) => {
        const matchingOrders = (orders || []).filter((o: any) => o.statement_id === s.id);
        const myOrders: OrderRow[] = matchingOrders.map((o: any) => {
          const total = Number(o.total_price) || Number(o.payment_amount) || 0;
          const paid = Math.min(Number(o.total_paid ?? 0), total > 0 ? total : Number.MAX_SAFE_INTEGER);
          return {
            id: o.id,
            code: o.code,
            status: o.status || 'pending',
            total,
            paid,
            remaining: Math.max(total - paid, 0),
            created_at: o.created_at,
            subcategory_name: o.subcategories?.name || null,
            description: extractOrderDescription(o.notes),
          };
        });
        const total_amount = myOrders.reduce((a, o) => a + o.total, 0);
        const total_paid = myOrders.reduce((a, o) => a + o.paid, 0);
        const service_types = Array.from(new Set(
          matchingOrders.map((o: any) => o.subcategories?.name).filter(Boolean)
        )) as string[];
        const addresses = Array.from(new Set(
          matchingOrders.map((o: any) => {
            const a = (o.address || '').trim();
            const d = (o.detailed_address || '').trim();
            return [a, d].filter(Boolean).join(' - ');
          }).filter(Boolean)
        )) as string[];
        return {
          id: s.id,
          statement_number: s.statement_number,
          status: s.status,
          closed_at: s.closed_at,
          created_at: s.created_at,
          total_amount,
          total_paid,
          total_remaining: Math.max(total_amount - total_paid, 0),
          subcategory_name: matchingOrders[0]?.subcategories?.name || null,
          address: s.address || matchingOrders[0]?.address || null,
          detailed_address: s.detailed_address || matchingOrders[0]?.detailed_address || null,
          service_types,
          addresses,
          orders: myOrders,
          is_manual: !!s.is_manual,
          is_archived: !!s.is_archived,
          is_deep_archived: !!s.is_deep_archived,
        };
      });

      // سفارش‌های همکاری (پذیرفته‌شده) را به‌عنوان یک گروه مجازی اضافه کن
      const { data: collabs } = await supabase
        .from('order_collaborators')
        .select('order_id')
        .eq('invitee_user_id', user?.id)
        .eq('status', 'accepted');

      const collabOrderIds = (collabs || []).map((c: any) => c.order_id).filter(Boolean);
      let collabGroup: StatementGroup | null = null;
      if (collabOrderIds.length > 0) {
        const { data: collabOrders } = await supabase
          .from('projects_v3')
          .select('id, code, status, payment_amount, total_price, total_paid, created_at, address, detailed_address, notes, subcategories(name)')
          .in('id', collabOrderIds)
          .neq('status', 'rejected')
          .or('is_deep_archived.is.null,is_deep_archived.eq.false');

        const myCollabOrders: OrderRow[] = (collabOrders || []).map((o: any) => {
          const total = Number(o.total_price) || Number(o.payment_amount) || 0;
          const paid = Math.min(Number(o.total_paid ?? 0), total > 0 ? total : Number.MAX_SAFE_INTEGER);
          return {
            id: o.id,
            code: o.code,
            status: o.status || 'pending',
            total,
            paid,
            remaining: Math.max(total - paid, 0),
            created_at: o.created_at,
            subcategory_name: (o as any).subcategories?.name || null,
            description: extractOrderDescription(o.notes),
          };
        });
        if (myCollabOrders.length > 0) {
          const total_amount = myCollabOrders.reduce((a, o) => a + o.total, 0);
          const total_paid_c = myCollabOrders.reduce((a, o) => a + o.paid, 0);
          collabGroup = {
            id: 'collab-virtual',
            statement_number: 0,
            status: 'open',
            closed_at: null,
            created_at: myCollabOrders[0]?.created_at || new Date().toISOString(),
            total_amount,
            total_paid: total_paid_c,
            total_remaining: Math.max(total_amount - total_paid_c, 0),
            subcategory_name: 'سفارش‌های همکاری',
            address: null,
            detailed_address: null,
            service_types: Array.from(new Set((collabOrders || []).map((o: any) => o.subcategories?.name).filter(Boolean))) as string[],
            addresses: Array.from(new Set((collabOrders || []).map((o: any) => {
              const a = (o.address || '').trim();
              const d = (o.detailed_address || '').trim();
              return [a, d].filter(Boolean).join(' - ');
            }).filter(Boolean))) as string[],
            orders: myCollabOrders,
            is_manual: false,
          } as StatementGroup;
        }
      }

      // صورتحساب خالی خودکار نمایش داده نشود؛ فقط صورتحساب دارای سفارش یا دستی نمایش داده شود.
      const filtered = groups.filter(g => g.orders.length > 0 || g.is_manual === true);
      if (collabGroup) filtered.unshift(collabGroup);
      setStatements(filtered);
      // باز کردن آخرین صورتحساب (بالاترین شماره) به‌صورت پیش‌فرض
      if (filtered.length > 0) {
        setExpanded(new Set([filtered[0].id]));
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'خطا', description: 'بارگذاری صورتحساب‌ها با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const summary = statements.reduce(
    (a, s) => ({
      count: a.count + s.orders.length,
      total: a.total + s.total_amount,
      paid: a.paid + s.total_paid,
      remaining: a.remaining + s.total_remaining,
    }),
    { count: 0, total: 0, paid: 0, remaining: 0 }
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* خلاصه */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
          <CardContent className="p-4 text-center">
            <Receipt className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-muted-foreground">تعداد سفارشات</p>
            <p className="text-lg font-bold text-blue-600">{summary.count}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
          <CardContent className="p-4 text-center">
            <Wallet className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <p className="text-xs text-muted-foreground">مجموع کل</p>
            <p className="text-sm font-bold text-purple-600">{formatPrice(summary.total)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-xs text-muted-foreground">پرداخت شده</p>
            <p className="text-sm font-bold text-green-600">{formatPrice(summary.paid)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200">
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" />
            <p className="text-xs text-muted-foreground">مانده بدهی</p>
            <p className="text-sm font-bold text-red-600">{formatPrice(summary.remaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* پرداخت کلی همه صورتحساب‌ها (آبشاری از پایین‌ترین شماره صورتحساب) */}
      {summary.remaining > 0 && (
        <Card className="border-emerald-300 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                پرداخت کلی همه صورتحساب‌ها
              </p>
              <p className="text-xs text-muted-foreground">
                مبلغ پرداختی به‌صورت آبشاری از پایین‌ترین شماره صورتحساب و قدیمی‌ترین فاکتور تخصیص داده می‌شود و در همان صورتحساب‌ها و فاکتورها ثبت می‌گردد.
              </p>
              <p className="text-sm font-bold text-red-600">مانده کل: {formatPrice(summary.remaining)}</p>
            </div>
            <Button onClick={openPayAllDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CreditCard className="h-4 w-4" />
              پرداخت از صورتحساب کلی
            </Button>
          </CardContent>
        </Card>
      )}



      {/* لیست صورتحساب‌ها */}
      {statements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            هنوز صورتحسابی ندارید
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {statements.map(s => {
            const isOpen = expanded.has(s.id);
            return (
              <Collapsible key={s.id} open={isOpen} onOpenChange={() => toggle(s.id)}>
                <Card className={s.status === 'open' ? 'border-primary/40' : ''}>
                  <CollapsibleTrigger className="w-full text-right">
                    <CardHeader className="p-4 cursor-pointer hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                              صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(s.statement_number)}
                              {(s.service_types.length > 0 ? s.service_types : (s.subcategory_name ? [s.subcategory_name] : [])).map((st, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{st}</Badge>
                              ))}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {s.orders.length} سفارش
                              {s.status === 'closed' && s.closed_at
                                ? ` • بسته‌شده در ${new Date(s.closed_at).toLocaleDateString('fa-IR')}`
                                : ''}
                            </p>
                            {(s.addresses.length > 0 ? s.addresses : ((s.address || s.detailed_address) ? [[s.address, s.detailed_address].filter(Boolean).join(' - ')] : [])).map((addr, i) => (
                              <p key={i} className="text-xs text-muted-foreground mt-0.5">
                                📍 {addr}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {s.status === 'open' ? (
                            <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40">
                              صورتحساب باز
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="h-3 w-3" /> بسته شده
                            </Badge>
                          )}
                          <span className="text-sm font-bold">{formatPrice(s.total_amount)}</span>
                          <span className="text-xs text-green-600">پرداختی: {formatPrice(s.total_paid)}</span>
                          <span className="text-xs text-red-600">مانده: {formatPrice(s.total_remaining)}</span>
                          <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
                            {s.status === 'open' && s.orders.length > 0 && (
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openPayDialog(s)}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                پرداخت آنلاین
                              </Button>
                            )}
                            <PaymentProofDialog
                              statementId={s.id}
                              customerId={user?.id}
                              defaultAmount={s.total_remaining}
                              buttonLabel="ارسال فیش / چک"
                              className="h-7 text-xs gap-1"
                              onSubmitted={() => setProofRefreshKey((k) => k + 1)}
                            />
                            <StatementInvoiceDialog
                              statementNumber={s.statement_number}
                              statementStatus={s.status}
                              closedAt={s.closed_at}
                              customerName={profile.full_name}
                              customerPhone={profile.phone_number}
                              customerCode={profile.customer_code}
                              serviceType={(s.service_types.length > 0 ? s.service_types : (s.subcategory_name ? [s.subcategory_name] : [])).join(' | ') || null}
                              address={(s.addresses.length > 0 ? s.addresses : ((s.address || s.detailed_address) ? [[s.address, s.detailed_address].filter(Boolean).join(' - ')] : [])).join(' | ') || null}
                              detailedAddress={null}
                              orders={s.orders}
                            />
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {s.orders.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          هنوز سفارشی در این صورتحساب ثبت نشده است
                        </div>
                      ) : (
                        <Table className="min-w-[920px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right whitespace-nowrap">ردیف</TableHead>
                              <TableHead className="text-right whitespace-nowrap">کد فاکتور</TableHead>
                              <TableHead className="text-right min-w-[320px]">شرح خدمات</TableHead>
                              <TableHead className="text-right whitespace-nowrap">تاریخ</TableHead>
                              <TableHead className="text-right whitespace-nowrap">مبلغ فاکتور</TableHead>
                              <TableHead className="text-right whitespace-nowrap">پرداختی</TableHead>
                              <TableHead className="text-right whitespace-nowrap">مانده</TableHead>
                              <TableHead className="text-right whitespace-nowrap">وضعیت</TableHead>
                              <TableHead className="text-right whitespace-nowrap">عملیات</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {s.orders.map((o, idx) => (
                              <TableRow key={o.id}>
                                <TableCell className="whitespace-nowrap">{new Intl.NumberFormat('fa-IR').format(idx + 1)}</TableCell>
                                <TableCell className="font-mono text-xs whitespace-nowrap">{o.code}</TableCell>
                                <TableCell className="text-xs min-w-[320px] whitespace-normal break-words leading-6">{o.description || o.subcategory_name || '—'}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('fa-IR')}</TableCell>
                                <TableCell className="font-medium whitespace-nowrap">{formatPrice(o.total)}</TableCell>
                                <TableCell className="text-green-600 whitespace-nowrap">{formatPrice(o.paid)}</TableCell>
                                <TableCell className="text-red-600 whitespace-nowrap">{formatPrice(o.remaining)}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant="outline" className="text-xs">
                                    {statusLabels[o.status] || o.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Button size="sm" variant="ghost" onClick={() => navigate(`/user/orders/${o.id}`)}>
                                    مشاهده
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-bold whitespace-nowrap">جمع صورتحساب</TableCell>
                              <TableCell className="font-bold whitespace-nowrap">{formatPrice(s.total_amount)}</TableCell>
                              <TableCell className="font-bold text-green-600 whitespace-nowrap">{formatPrice(s.total_paid)}</TableCell>
                              <TableCell className="font-bold text-red-600 whitespace-nowrap">{formatPrice(s.total_remaining)}</TableCell>
                              <TableCell colSpan={2} className="whitespace-nowrap">
                                {s.status === 'closed' && (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <CheckCircle2 className="h-3 w-3" /> صورتحساب بسته‌شده
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                       )}
                      <div className="px-4 pb-4">
                        <PaymentSubmissionsList statementId={s.id} refreshKey={proofRefreshKey} />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* دیالوگ پرداخت آنلاین صورتحساب */}
      <Dialog open={payDialog.open} onOpenChange={(o) => !o && setPayDialog({ open: false, statement: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              {payDialog.payAll ? 'پرداخت کلی همه صورتحساب‌ها' : 'پرداخت آنلاین صورتحساب'}
            </DialogTitle>
            <DialogDescription>
              {payDialog.payAll ? (
                <>
                  مانده کل بدهی: <span className="font-bold text-red-600">{formatPrice(summary.remaining)}</span>
                </>
              ) : payDialog.statement ? (
                <>
                  صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(payDialog.statement.statement_number)} — مانده فعلی:
                  {' '}
                  <span className="font-bold text-red-600">{formatPrice(payDialog.statement.total_remaining)}</span>
                </>
              ) : null}
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="pay-amount">مبلغ پرداخت (تومان)</Label>
            <Input
              id="pay-amount"
              dir="ltr"
              inputMode="numeric"
              className="text-right text-lg"
              value={(() => {
                const digits = toEnglishDigits(payAmountInput).replace(/[^\d]/g, '');
                return digits ? new Intl.NumberFormat('fa-IR').format(Number(digits)) : '';
              })()}
              onChange={(e) => {
                const digits = toEnglishDigits(e.target.value).replace(/[^\d]/g, '');
                setPayAmountInput(digits);
              }}
              placeholder="مبلغ مورد نظر را وارد کنید"
            />
            <p className="text-xs text-muted-foreground leading-6">
              {payDialog.payAll
                ? 'مبلغ پرداختی به‌صورت آبشاری از پایین‌ترین شماره صورتحساب و قدیمی‌ترین فاکتور تخصیص می‌یابد؛ هر فاکتور تا سقف مانده‌اش تسویه و باقیمانده به فاکتور بعدی منتقل می‌شود.'
                : 'می‌توانید مبلغی بیشتر از مانده صورتحساب نیز پرداخت کنید. مبلغ پرداختی به‌ترتیب از اولین سفارش تا آخرین سفارش این صورتحساب تخصیص می‌یابد و باقیمانده روی آخرین سفارش ثبت می‌شود.'}
            </p>

          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialog({ open: false, statement: null })} disabled={paying}>
              انصراف
            </Button>
            <Button onClick={handleStatementPay} disabled={paying} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CreditCard className="h-4 w-4" />
              {paying ? 'در حال اتصال...' : 'پرداخت در درگاه'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
