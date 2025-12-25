import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  Loader2,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  User,
  Phone,
  CreditCard,
  Building2,
  Download,
  ChevronDown,
  ChevronUp,
  Banknote,
  Receipt,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useCEORole } from '@/hooks/useCEORole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import { ModuleHeader } from '@/components/common/ModuleHeader';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CustomerAccount {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  total_orders: number;
  total_paid: number;
  total_remaining: number;
  last_order_date: string | null;
}

interface StaffAccount {
  id: string;
  user_id: string | null;
  full_name: string;
  phone_number: string;
  status: string;
  position: string | null;
  department: string | null;
  total_present: number;
  total_received: number;
  total_spent: number;
  balance: number;
}

interface WalletSummary {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  wallet_balance: number;
  transaction_count: number;
  last_transaction: string | null;
}

export default function AccountingModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCEO, loading: ceoLoading } = useCEORole();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customers');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer Accounts
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccount[]>([]);
  const [customerSummary, setCustomerSummary] = useState({
    totalCustomers: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalOrders: 0
  });
  
  // Staff Accounts
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [staffSummary, setStaffSummary] = useState({
    totalStaff: 0,
    totalReceived: 0,
    totalSpent: 0,
    totalBalance: 0
  });
  
  // Wallet Summaries
  const [walletSummaries, setWalletSummaries] = useState<WalletSummary[]>([]);
  const [walletSummaryTotal, setWalletSummaryTotal] = useState({
    totalUsers: 0,
    totalBalance: 0,
    totalTransactions: 0
  });
  
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && isCEO) {
      fetchAllData();
    }
  }, [user, isCEO]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCustomerAccounts(),
      fetchStaffAccounts(),
      fetchWalletSummaries()
    ]);
    setLoading(false);
  };

  const fetchCustomerAccounts = async () => {
    try {
      // Get all customers with their orders
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          user_id,
          profiles!customers_user_id_fkey1(full_name, phone_number)
        `);

      if (customersError) throw customersError;

      // Get orders for each customer
      const { data: orders, error: ordersError } = await supabase
        .from('projects_v3')
        .select('customer_id, total_price, total_paid, created_at, status')
        .in('status', ['approved', 'pending_execution', 'scheduled', 'in_progress', 'completed', 'paid', 'closed']);

      if (ordersError) throw ordersError;

      // Group orders by customer
      const ordersByCustomer = new Map<string, typeof orders>();
      orders?.forEach(order => {
        const existing = ordersByCustomer.get(order.customer_id) || [];
        existing.push(order);
        ordersByCustomer.set(order.customer_id, existing);
      });

      // Build customer accounts
      const accounts: CustomerAccount[] = (customers || []).map(customer => {
        const customerOrders = ordersByCustomer.get(customer.id) || [];
        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.total_paid || 0), 0);
        const totalPrice = customerOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const lastOrder = customerOrders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: customer.id,
          user_id: customer.user_id,
          full_name: (customer.profiles as any)?.full_name || null,
          phone_number: (customer.profiles as any)?.phone_number || null,
          total_orders: customerOrders.length,
          total_paid: totalPaid,
          total_remaining: Math.max(0, totalPrice - totalPaid),
          last_order_date: lastOrder?.created_at || null
        };
      }).filter(c => c.total_orders > 0); // Only show customers with orders

      // Sort by remaining balance descending
      accounts.sort((a, b) => b.total_remaining - a.total_remaining);

      setCustomerAccounts(accounts);
      setCustomerSummary({
        totalCustomers: accounts.length,
        totalPaid: accounts.reduce((sum, a) => sum + a.total_paid, 0),
        totalRemaining: accounts.reduce((sum, a) => sum + a.total_remaining, 0),
        totalOrders: accounts.reduce((sum, a) => sum + a.total_orders, 0)
      });
    } catch (error) {
      console.error('Error fetching customer accounts:', error);
      toast.error('خطا در دریافت حساب‌های مشتریان');
    }
  };

  const fetchStaffAccounts = async () => {
    try {
      // Get all HR employees
      const { data: employees, error: empError } = await supabase
        .from('hr_employees')
        .select('*')
        .order('full_name');

      if (empError) throw empError;

      // Get daily report staff records for each employee
      const accounts: StaffAccount[] = [];
      
      for (const emp of employees || []) {
        let totalPresent = 0;
        let totalReceived = 0;
        let totalSpent = 0;

        if (emp.user_id) {
          // Fetch work records by user_id
          const { data: records } = await supabase
            .from('daily_report_staff')
            .select('work_status, amount_received, amount_spent')
            .eq('staff_user_id', emp.user_id);

          records?.forEach(r => {
            if (r.work_status === 'حاضر') totalPresent++;
            totalReceived += r.amount_received || 0;
            totalSpent += r.amount_spent || 0;
          });
        }

        accounts.push({
          id: emp.id,
          user_id: emp.user_id,
          full_name: emp.full_name,
          phone_number: emp.phone_number,
          status: emp.status,
          position: emp.position,
          department: emp.department,
          total_present: totalPresent,
          total_received: totalReceived,
          total_spent: totalSpent,
          balance: totalSpent - totalReceived // مثبت = طلب از شرکت، منفی = بدهی به شرکت
        });
      }

      // Sort by balance descending (those who owe more first)
      accounts.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

      setStaffAccounts(accounts);
      setStaffSummary({
        totalStaff: accounts.length,
        totalReceived: accounts.reduce((sum, a) => sum + a.total_received, 0),
        totalSpent: accounts.reduce((sum, a) => sum + a.total_spent, 0),
        totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0)
      });
    } catch (error) {
      console.error('Error fetching staff accounts:', error);
      toast.error('خطا در دریافت حساب‌های پرسنل');
    }
  };

  const fetchWalletSummaries = async () => {
    try {
      // Get all wallet transactions grouped by user
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('user_id, amount, created_at, balance_after')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by user_id
      const userTransactions = new Map<string, typeof transactions>();
      transactions?.forEach(tx => {
        const existing = userTransactions.get(tx.user_id) || [];
        existing.push(tx);
        userTransactions.set(tx.user_id, existing);
      });

      // Get user profiles
      const userIds = Array.from(userTransactions.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build summaries
      const summaries: WalletSummary[] = [];
      userTransactions.forEach((txs, userId) => {
        const profile = profileMap.get(userId);
        const latestTx = txs[0];
        
        summaries.push({
          user_id: userId,
          full_name: profile?.full_name || null,
          phone_number: profile?.phone_number || null,
          wallet_balance: latestTx?.balance_after || 0,
          transaction_count: txs.length,
          last_transaction: latestTx?.created_at || null
        });
      });

      // Sort by balance descending
      summaries.sort((a, b) => Math.abs(b.wallet_balance) - Math.abs(a.wallet_balance));

      setWalletSummaries(summaries);
      setWalletSummaryTotal({
        totalUsers: summaries.length,
        totalBalance: summaries.reduce((sum, s) => sum + s.wallet_balance, 0),
        totalTransactions: summaries.reduce((sum, s) => sum + s.transaction_count, 0)
      });
    } catch (error) {
      console.error('Error fetching wallet summaries:', error);
      toast.error('خطا در دریافت کیف پول‌ها');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const formatCurrencyShort = (amount: number) => {
    if (Math.abs(amount) >= 1_000_000_000) {
      return (amount / 1_000_000_000).toFixed(1) + ' میلیارد';
    }
    if (Math.abs(amount) >= 1_000_000) {
      return (amount / 1_000_000).toFixed(1) + ' میلیون';
    }
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd', { locale: faIR });
    } catch {
      return '—';
    }
  };

  const filteredCustomers = customerAccounts.filter(c => 
    (c.full_name?.includes(searchQuery) || 
     c.phone_number?.includes(searchQuery))
  );

  const filteredStaff = staffAccounts.filter(s => 
    s.full_name.includes(searchQuery) || 
    s.phone_number.includes(searchQuery)
  );

  const filteredWallets = walletSummaries.filter(w => 
    (w.full_name?.includes(searchQuery) || 
     w.phone_number?.includes(searchQuery))
  );

  const toggleCustomerExpand = (id: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleStaffExpand = (id: string) => {
    const newExpanded = new Set(expandedStaff);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedStaff(newExpanded);
  };

  if (ceoLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">در حال بارگذاری...</span>
        </div>
      </div>
    );
  }

  if (!isCEO) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto text-center py-20">
          <h2 className="text-xl font-bold text-destructive mb-2">دسترسی محدود</h2>
          <p className="text-muted-foreground mb-4">
            شما دسترسی به این بخش را ندارید
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowRight className="ml-2 h-4 w-4" />
            بازگشت
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <ModuleHeader
          title="ماژول حسابداری جامع"
          description="مدیریت حساب‌های مشتریان، نیروها و پرسنل"
          icon={<Calculator className="h-5 w-5" />}
          backTo="/profile?tab=modules"
        />
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مشتریان</p>
                  <p className="text-lg font-bold">{customerSummary.totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">پرداختی مشتریان</p>
                  <p className="text-lg font-bold">{formatCurrencyShort(customerSummary.totalPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مانده مشتریان</p>
                  <p className="text-lg font-bold">{formatCurrencyShort(customerSummary.totalRemaining)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Building2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">پرسنل</p>
                  <p className="text-lg font-bold">{staffSummary.totalStaff}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو بر اساس نام یا شماره تلفن..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              مشتریان
              <Badge variant="secondary" className="mr-1">{customerSummary.totalCustomers}</Badge>
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              پرسنل
              <Badge variant="secondary" className="mr-1">{staffSummary.totalStaff}</Badge>
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              کیف پول‌ها
              <Badge variant="secondary" className="mr-1">{walletSummaryTotal.totalUsers}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            {/* Customer Summary */}
            <Card className="bg-gradient-to-l from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">تعداد سفارشات</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{customerSummary.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">جمع پرداختی</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrencyShort(customerSummary.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">جمع مانده</p>
                    <p className="text-xl font-bold text-amber-600">{formatCurrencyShort(customerSummary.totalRemaining)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">درصد وصول</p>
                    <p className="text-xl font-bold text-blue-600">
                      {customerSummary.totalPaid + customerSummary.totalRemaining > 0 
                        ? ((customerSummary.totalPaid / (customerSummary.totalPaid + customerSummary.totalRemaining)) * 100).toFixed(1) + '%'
                        : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer List */}
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هیچ مشتری‌ای یافت نشد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="border-2 hover:border-primary/30 transition-colors">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="p-4 cursor-pointer flex items-center justify-between"
                          onClick={() => toggleCustomerExpand(customer.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                              <User className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{customer.full_name || 'بدون نام'}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span dir="ltr">{customer.phone_number || '—'}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-left">
                              <p className="text-xs text-muted-foreground">مانده</p>
                              <p className={`font-bold ${customer.total_remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {formatCurrencyShort(customer.total_remaining)}
                              </p>
                            </div>
                            {expandedCustomers.has(customer.id) ? 
                              <ChevronUp className="h-5 w-5 text-muted-foreground" /> : 
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            }
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 border-t pt-4 bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">تعداد سفارش</p>
                              <p className="font-semibold">{customer.total_orders}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">پرداختی</p>
                              <p className="font-semibold text-emerald-600">{formatCurrency(customer.total_paid)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">مانده</p>
                              <p className="font-semibold text-amber-600">{formatCurrency(customer.total_remaining)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">آخرین سفارش</p>
                              <p className="font-semibold">{formatDate(customer.last_order_date)}</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="space-y-4">
            {/* Staff Summary */}
            <Card className="bg-gradient-to-l from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-2 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">کل نیروها</p>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{staffSummary.totalStaff}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">دریافتی نیروها</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrencyShort(staffSummary.totalReceived)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">پرداختی نیروها</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrencyShort(staffSummary.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">مانده کل</p>
                    <p className={`text-xl font-bold ${staffSummary.totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrencyShort(Math.abs(staffSummary.totalBalance))}
                      <span className="text-xs mr-1">
                        {staffSummary.totalBalance >= 0 ? '(طلب نیروها)' : '(بدهی نیروها)'}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staff List */}
            {filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هیچ پرسنلی یافت نشد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStaff.map((staff) => (
                  <Card key={staff.id} className="border-2 hover:border-primary/30 transition-colors">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="p-4 cursor-pointer flex items-center justify-between"
                          onClick={() => toggleStaffExpand(staff.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                              <User className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold">{staff.full_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span dir="ltr">{staff.phone_number}</span>
                                {staff.position && (
                                  <>
                                    <span>•</span>
                                    <span>{staff.position}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-left">
                              <p className="text-xs text-muted-foreground">مانده</p>
                              <p className={`font-bold ${staff.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrencyShort(Math.abs(staff.balance))}
                              </p>
                            </div>
                            <Badge variant={staff.status === 'active' ? 'default' : 'secondary'}>
                              {staff.status === 'active' ? 'فعال' : 'غیرفعال'}
                            </Badge>
                            {expandedStaff.has(staff.id) ? 
                              <ChevronUp className="h-5 w-5 text-muted-foreground" /> : 
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            }
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 border-t pt-4 bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">روز حضور</p>
                              <p className="font-semibold">{staff.total_present}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">دریافتی</p>
                              <p className="font-semibold text-red-600">{formatCurrency(staff.total_received)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">پرداختی</p>
                              <p className="font-semibold text-emerald-600">{formatCurrency(staff.total_spent)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">مانده</p>
                              <p className={`font-semibold ${staff.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(staff.balance))}
                                <span className="text-xs mr-1">
                                  {staff.balance >= 0 ? '(طلب)' : '(بدهی)'}
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">دپارتمان</p>
                              <p className="font-semibold">{staff.department || '—'}</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            {/* Wallet Summary */}
            <Card className="bg-gradient-to-l from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">کاربران</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{walletSummaryTotal.totalUsers}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">جمع موجودی</p>
                    <p className={`text-xl font-bold ${walletSummaryTotal.totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrencyShort(walletSummaryTotal.totalBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">تراکنش‌ها</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{walletSummaryTotal.totalTransactions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet List */}
            {filteredWallets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هیچ کیف پولی یافت نشد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWallets.map((wallet) => (
                  <Card key={wallet.user_id} className="border-2 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Wallet className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{wallet.full_name || 'بدون نام'}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{wallet.phone_number || '—'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">موجودی</p>
                            <p className={`font-bold ${wallet.wallet_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(wallet.wallet_balance)}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">تراکنش</p>
                            <p className="font-semibold">{wallet.transaction_count}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">آخرین</p>
                            <p className="font-semibold text-sm">{formatDate(wallet.last_transaction)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
