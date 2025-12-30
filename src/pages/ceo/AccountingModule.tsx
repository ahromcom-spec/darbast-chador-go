import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import { 
  Calculator, 
  Loader2,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  User,
  Phone,
  Building2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MapPin,
  FolderOpen,
  FileText,
  Archive,
  ArchiveX,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types for hierarchical structure
interface OrderDetail {
  id: string;
  code: string;
  total_price: number;
  total_paid: number;
  remaining: number;
  status: string;
  created_at: string;
  is_archived: boolean;
  is_deep_archived: boolean;
}

interface ProjectGroup {
  project_id: string | null;
  project_name: string;
  service_type: string | null;
  subcategory: string | null;
  total_price: number;
  total_paid: number;
  remaining: number;
  order_count: number;
  orders: OrderDetail[];
}

interface AddressGroup {
  address: string;
  total_price: number;
  total_paid: number;
  remaining: number;
  order_count: number;
  projects: ProjectGroup[];
}

interface CustomerAccountHierarchy {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  total_orders: number;
  total_paid: number;
  total_remaining: number;
  last_order_date: string | null;
  addresses: AddressGroup[];
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

type ArchiveFilter = 'all' | 'active' | 'archived' | 'deep_archived';

const DEFAULT_TITLE = 'ماژول حسابداری جامع';
const DEFAULT_DESCRIPTION = 'مدیریت حساب‌های مشتریان، نیروها و پرسنل';

export default function AccountingModule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isCEO, loading: ceoLoading } = useCEORole();
  const activeModuleKey = searchParams.get('moduleKey') || 'comprehensive_accounting';
  const { moduleName, moduleDescription } = useModuleAssignmentInfo(activeModuleKey, DEFAULT_TITLE, DEFAULT_DESCRIPTION);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  
  // Customer Accounts with hierarchy
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccountHierarchy[]>([]);
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
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && isCEO) {
      fetchAllData();
    }
  }, [user, isCEO, archiveFilter]);

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
      // Get all customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, user_id');

      if (customersError) throw customersError;

      // Get profiles separately
      const userIds = customers?.map(c => c.user_id).filter(Boolean) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build query based on archive filter
      let query = supabase
        .from('projects_v3')
        .select(`
          id, customer_id, code, address, payment_amount, total_paid, 
          created_at, status, is_archived, is_deep_archived,
          hierarchy_project_id,
          subcategory:subcategories(name, service_type:service_types_v3(name))
        `)
        .not('status', 'in', '(draft,rejected)');

      // Apply archive filter
      if (archiveFilter === 'active') {
        query = query.or('is_archived.is.null,is_archived.eq.false')
                     .or('is_deep_archived.is.null,is_deep_archived.eq.false');
      } else if (archiveFilter === 'archived') {
        query = query.eq('is_archived', true).or('is_deep_archived.is.null,is_deep_archived.eq.false');
      } else if (archiveFilter === 'deep_archived') {
        query = query.eq('is_deep_archived', true);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      // Get hierarchy projects for project names
      const hierarchyIds = orders?.map(o => o.hierarchy_project_id).filter(Boolean) || [];
      const { data: hierarchyProjects } = await supabase
        .from('projects_hierarchy')
        .select('id, location:locations(title, address_line)')
        .in('id', hierarchyIds);

      const hierarchyMap = new Map(hierarchyProjects?.map(h => [h.id, h]) || []);

      // Group orders by customer -> address -> project
      const ordersByCustomer = new Map<string, typeof orders>();
      orders?.forEach(order => {
        const existing = ordersByCustomer.get(order.customer_id) || [];
        existing.push(order);
        ordersByCustomer.set(order.customer_id, existing);
      });

      // Build customer accounts with hierarchy
      const accounts: CustomerAccountHierarchy[] = (customers || []).map(customer => {
        const customerOrders = ordersByCustomer.get(customer.id) || [];
        const profile = profileMap.get(customer.user_id);
        
        // Group by address
        const addressMap = new Map<string, typeof customerOrders>();
        customerOrders.forEach(order => {
          const address = order.address || 'بدون آدرس';
          const existing = addressMap.get(address) || [];
          existing.push(order);
          addressMap.set(address, existing);
        });

        // Build address groups
        const addresses: AddressGroup[] = [];
        addressMap.forEach((addressOrders, address) => {
          // Group by project (hierarchy_project_id)
          const projectMap = new Map<string, typeof addressOrders>();
          addressOrders.forEach(order => {
            const projectKey = order.hierarchy_project_id || 'no-project';
            const existing = projectMap.get(projectKey) || [];
            existing.push(order);
            projectMap.set(projectKey, existing);
          });

          // Build project groups
          const projects: ProjectGroup[] = [];
          projectMap.forEach((projectOrders, projectId) => {
            const hierarchy = projectId !== 'no-project' ? hierarchyMap.get(projectId) : null;
            const firstOrder = projectOrders[0];
            const subcategoryData = firstOrder?.subcategory as any;
            
            // استفاده از payment_amount به جای total_price (مطابق صورتحساب مشتری)
            const projectTotalPrice = projectOrders.reduce((sum, o) => sum + (o.payment_amount || 0), 0);
            const projectTotalPaid = projectOrders.reduce((sum, o) => sum + (o.total_paid || 0), 0);

            projects.push({
              project_id: projectId !== 'no-project' ? projectId : null,
              project_name: hierarchy?.location?.title || hierarchy?.location?.address_line || 'پروژه بدون نام',
              service_type: subcategoryData?.service_type?.name || null,
              subcategory: subcategoryData?.name || null,
              total_price: projectTotalPrice,
              total_paid: projectTotalPaid,
              remaining: Math.max(0, projectTotalPrice - projectTotalPaid),
              order_count: projectOrders.length,
              orders: projectOrders.map(o => ({
                id: o.id,
                code: o.code,
                total_price: o.payment_amount || 0,
                total_paid: o.total_paid || 0,
                remaining: Math.max(0, (o.payment_amount || 0) - (o.total_paid || 0)),
                status: o.status,
                created_at: o.created_at,
                is_archived: o.is_archived || false,
                is_deep_archived: o.is_deep_archived || false
              }))
            });
          });

          const addressTotalPrice = projects.reduce((sum, p) => sum + p.total_price, 0);
          const addressTotalPaid = projects.reduce((sum, p) => sum + p.total_paid, 0);

          addresses.push({
            address,
            total_price: addressTotalPrice,
            total_paid: addressTotalPaid,
            remaining: Math.max(0, addressTotalPrice - addressTotalPaid),
            order_count: addressOrders.length,
            projects
          });
        });

        // Sort addresses by remaining amount
        addresses.sort((a, b) => b.remaining - a.remaining);

        // استفاده از payment_amount به جای total_price (مطابق صورتحساب مشتری)
        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.total_paid || 0), 0);
        const totalPrice = customerOrders.reduce((sum, o) => sum + (o.payment_amount || 0), 0);
        const lastOrder = customerOrders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: customer.id,
          user_id: customer.user_id,
          full_name: profile?.full_name || null,
          phone_number: profile?.phone_number || null,
          total_orders: customerOrders.length,
          total_paid: totalPaid,
          total_remaining: Math.max(0, totalPrice - totalPaid),
          last_order_date: lastOrder?.created_at || null,
          addresses
        };
      }).filter(c => c.total_orders > 0);

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
      const { data: employees, error: empError } = await supabase
        .from('hr_employees')
        .select('*')
        .order('full_name');

      if (empError) throw empError;

      const { data: allRecords, error: recordsError } = await supabase
        .from('daily_report_staff')
        .select('staff_user_id, staff_name, work_status, amount_received, amount_spent, overtime_hours');

      if (recordsError) throw recordsError;

      const recordsByUserId = new Map<string, typeof allRecords>();
      const recordsByName = new Map<string, typeof allRecords>();
      
      allRecords?.forEach(r => {
        if (r.staff_user_id) {
          const existing = recordsByUserId.get(r.staff_user_id) || [];
          existing.push(r);
          recordsByUserId.set(r.staff_user_id, existing);
        }
        if (r.staff_name) {
          const existing = recordsByName.get(r.staff_name) || [];
          existing.push(r);
          recordsByName.set(r.staff_name, existing);
        }
      });

      const accounts: StaffAccount[] = (employees || []).map(emp => {
        let records = emp.user_id ? recordsByUserId.get(emp.user_id) : null;
        if (!records || records.length === 0) {
          records = recordsByName.get(emp.full_name) || [];
        }

        let totalPresent = 0;
        let totalReceived = 0;
        let totalSpent = 0;

        records.forEach(r => {
          if (r.work_status === 'حاضر') totalPresent++;
          totalReceived += r.amount_received || 0;
          totalSpent += r.amount_spent || 0;
        });

        return {
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
          balance: totalSpent - totalReceived
        };
      });

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
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('user_id, amount, created_at, balance_after')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userTransactions = new Map<string, typeof transactions>();
      transactions?.forEach(tx => {
        const existing = userTransactions.get(tx.user_id) || [];
        existing.push(tx);
        userTransactions.set(tx.user_id, existing);
      });

      const userIds = Array.from(userTransactions.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

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

  // تبدیل ریال به تومان و نمایش بدون رند کردن - تومان در سمت چپ
  // استفاده از LTR override برای نمایش صحیح در RTL
  const formatCurrency = (amount: number) => {
    const toman = Math.round(amount / 10);
    const formatted = new Intl.NumberFormat('fa-IR').format(toman);
    return `\u200F${formatted} تومان`;
  };

  // نمایش کامل بدون رند کردن (برای حسابداری دقیق) - تومان در سمت چپ
  const formatCurrencyShort = (amount: number) => {
    const toman = Math.round(amount / 10);
    const formatted = new Intl.NumberFormat('fa-IR').format(toman);
    return `\u200F${formatted} تومان`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'yyyy/MM/dd', { locale: faIR });
    } catch {
      return '—';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'در انتظار', variant: 'secondary' },
      pending_execution: { label: 'در انتظار اجرا', variant: 'secondary' },
      approved: { label: 'تأیید شده', variant: 'default' },
      in_progress: { label: 'در حال اجرا', variant: 'default' },
      awaiting_payment: { label: 'در انتظار پرداخت', variant: 'secondary' },
      awaiting_collection: { label: 'در انتظار جمع‌آوری', variant: 'secondary' },
      in_collection: { label: 'در حال جمع‌آوری', variant: 'default' },
      completed: { label: 'تکمیل شده', variant: 'default' },
      paid: { label: 'پرداخت شده', variant: 'default' },
      closed: { label: 'بسته شده', variant: 'outline' },
      rejected: { label: 'رد شده', variant: 'destructive' },
      cancelled: { label: 'لغو شده', variant: 'destructive' },
    };
    const config = statusMap[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const toggleAddressExpand = (key: string) => {
    const newExpanded = new Set(expandedAddresses);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedAddresses(newExpanded);
  };

  const toggleProjectExpand = (key: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedProjects(newExpanded);
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
          <p className="text-muted-foreground mb-4">شما دسترسی به این بخش را ندارید</p>
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
          title={moduleName}
          description={moduleDescription}
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

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام یا شماره تلفن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          
          {activeTab === 'customers' && (
            <Select value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as ArchiveFilter)}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 ml-2" />
                <SelectValue placeholder="فیلتر بایگانی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه سفارشات</SelectItem>
                <SelectItem value="active">سفارشات فعال</SelectItem>
                <SelectItem value="archived">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    بایگانی شده
                  </div>
                </SelectItem>
                <SelectItem value="deep_archived">
                  <div className="flex items-center gap-2">
                    <ArchiveX className="h-4 w-4" />
                    بایگانی عمیق
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
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

            {/* Customer List with Hierarchy */}
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>هیچ مشتری‌ای یافت نشد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="border-2 hover:border-primary/30 transition-colors overflow-hidden">
                    <Collapsible open={expandedCustomers.has(customer.id)}>
                      <CollapsibleTrigger asChild>
                        <div 
                          className="p-4 cursor-pointer flex items-center justify-between bg-gradient-to-l from-emerald-50/50 to-transparent dark:from-emerald-950/20"
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
                        <div className="border-t">
                          {/* Customer Summary Row */}
                          <div className="px-4 py-3 bg-muted/30 border-b">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">تعداد سفارش</p>
                                <p className="font-semibold">{customer.total_orders}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">کل حساب</p>
                                <p className="font-semibold">{formatCurrency(customer.total_paid + customer.total_remaining)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">پرداختی</p>
                                <p className="font-semibold text-emerald-600">{formatCurrency(customer.total_paid)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">مانده</p>
                                <p className="font-semibold text-amber-600">{formatCurrency(customer.total_remaining)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Address Level */}
                          <div className="divide-y">
                            {customer.addresses.map((address, addrIdx) => {
                              const addressKey = `${customer.id}-addr-${addrIdx}`;
                              return (
                                <Collapsible key={addressKey} open={expandedAddresses.has(addressKey)}>
                                  <CollapsibleTrigger asChild>
                                    <div 
                                      className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-muted/20 pr-8"
                                      onClick={() => toggleAddressExpand(addressKey)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        <div>
                                          <p className="font-medium text-sm">{address.address}</p>
                                          <p className="text-xs text-muted-foreground">{address.order_count} سفارش</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-left text-sm">
                                          <span className="text-muted-foreground ml-2">کل:</span>
                                          <span className="font-medium">{formatCurrencyShort(address.total_price)}</span>
                                          <span className="text-emerald-600 mx-2">| پرداختی: {formatCurrencyShort(address.total_paid)}</span>
                                          <span className="text-amber-600">| مانده: {formatCurrencyShort(address.remaining)}</span>
                                        </div>
                                        {expandedAddresses.has(addressKey) ? 
                                          <ChevronUp className="h-4 w-4 text-muted-foreground" /> : 
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        }
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    {/* Project Level */}
                                    <div className="bg-muted/10 divide-y divide-dashed">
                                      {address.projects.map((project, projIdx) => {
                                        const projectKey = `${addressKey}-proj-${projIdx}`;
                                        return (
                                          <Collapsible key={projectKey} open={expandedProjects.has(projectKey)}>
                                            <CollapsibleTrigger asChild>
                                              <div 
                                                className="px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-muted/20 pr-12"
                                                onClick={() => toggleProjectExpand(projectKey)}
                                              >
                                                <div className="flex items-center gap-3">
                                                  <FolderOpen className="h-4 w-4 text-purple-500" />
                                                  <div>
                                                    <p className="font-medium text-sm">
                                                      {project.subcategory || 'پروژه'}
                                                      {project.service_type && <span className="text-muted-foreground text-xs mr-2">({project.service_type})</span>}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{project.order_count} سفارش</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                  <div className="text-left text-xs">
                                                    <span className="text-muted-foreground ml-1">کل:</span>
                                                    <span className="font-medium">{formatCurrencyShort(project.total_price)}</span>
                                                    <span className="text-emerald-600 mx-1">| {formatCurrencyShort(project.total_paid)}</span>
                                                    <span className="text-amber-600">| {formatCurrencyShort(project.remaining)}</span>
                                                  </div>
                                                  {expandedProjects.has(projectKey) ? 
                                                    <ChevronUp className="h-4 w-4 text-muted-foreground" /> : 
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                  }
                                                </div>
                                              </div>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              {/* Order Level */}
                                              <div className="bg-background/50 divide-y divide-dotted pr-16">
                                                {project.orders.map((order) => (
                                                  <div key={order.id} className="px-4 py-2 flex items-center justify-between hover:bg-muted/10">
                                                    <div className="flex items-center gap-3">
                                                      <FileText className="h-4 w-4 text-gray-400" />
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                          <p className="font-mono text-sm">{order.code}</p>
                                                          {getStatusBadge(order.status)}
                                                          {order.is_deep_archived && (
                                                            <Badge variant="destructive" className="text-xs">
                                                              <ArchiveX className="h-3 w-3 ml-1" />
                                                              بایگانی عمیق
                                                            </Badge>
                                                          )}
                                                          {order.is_archived && !order.is_deep_archived && (
                                                            <Badge variant="secondary" className="text-xs">
                                                              <Archive className="h-3 w-3 ml-1" />
                                                              بایگانی
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                                                      </div>
                                                    </div>
                                                    <div className="text-left text-xs flex items-center gap-3">
                                                      <div>
                                                        <p className="text-muted-foreground">کل</p>
                                                        <p className="font-medium">{formatCurrency(order.total_price)}</p>
                                                      </div>
                                                      <div className="border-r pr-3">
                                                        <p className="text-muted-foreground">پرداختی</p>
                                                        <p className="font-medium text-emerald-600">{formatCurrency(order.total_paid)}</p>
                                                      </div>
                                                      <div className="border-r pr-3">
                                                        <p className="text-muted-foreground">مانده</p>
                                                        <p className={`font-medium ${order.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                          {formatCurrency(order.remaining)}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
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
