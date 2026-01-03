import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowRight, 
  ClipboardList, 
  Search, 
  Calendar, 
  MapPin, 
  User, 
  Building2,
  Phone,
  Filter,
  Eye,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCEORole } from '@/hooks/useCEORole';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';

interface Order {
  id: string;
  code: string;
  status: string;
  execution_stage: string | null;
  created_at: string;
  updated_at: string;
  price: number | null;
  customer_id: string;
  address: string | null;
  subcategory_id: string | null;
  customer?: {
    user_id: string;
    profiles?: {
      full_name: string | null;
      phone_number: string | null;
    };
  };
  subcategory?: {
    name: string;
    service_type?: {
      name: string;
    };
  };
  province?: {
    name: string;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تایید شده',
  pending_execution: 'در انتظار اجرا',
  in_progress: 'در حال اجرا',
  completed: 'تکمیل شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pending_execution: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  in_progress: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

const EXECUTION_STAGE_LABELS: Record<string, string> = {
  not_started: 'شروع نشده',
  ready_for_execution: 'آماده اجرا',
  in_execution: 'در حال اجرا',
  order_executed: 'اجرا شده',
  awaiting_payment: 'در انتظار پرداخت',
  awaiting_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'جمع‌آوری شده',
};

export default function AllCompanyOrdersModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCEO, loading: ceoLoading } = useCEORole();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!ceoLoading) {
      fetchAllOrders();
    }
  }, [ceoLoading]);

  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          execution_stage,
          created_at,
          updated_at,
          price,
          customer_id,
          address,
          subcategory_id,
          customers!projects_v3_customer_id_fkey (
            user_id,
            profiles:user_id (
              full_name,
              phone_number
            )
          ),
          subcategories (
            name,
            service_types_v3 (
              name
            )
          ),
          provinces (
            name
          )
        `)
        .order('code', { ascending: false })
        .limit(500);

      if (error) throw error;

      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        execution_stage: order.execution_stage,
        created_at: order.created_at,
        updated_at: order.updated_at,
        price: order.price,
        customer_id: order.customer_id,
        address: order.address,
        subcategory_id: order.subcategory_id,
        customer: order.customers ? {
          user_id: order.customers.user_id,
          profiles: order.customers.profiles
        } : undefined,
        subcategory: order.subcategories ? {
          name: order.subcategories.name,
          service_type: order.subcategories.service_types_v3
        } : undefined,
        province: order.provinces,
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('خطا در دریافت سفارشات');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllOrders();
    setRefreshing(false);
    toast.success('لیست سفارشات به‌روزرسانی شد');
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.profiles?.phone_number?.includes(searchTerm) ||
      order.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    orders.forEach(order => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (ceoLoading) {
    return <LoadingSpinner size="lg" text="در حال بررسی دسترسی..." />;
  }

  if (!isCEO) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">عدم دسترسی</h1>
          <p className="text-muted-foreground mb-6">
            شما دسترسی به این ماژول را ندارید. فقط مدیرعامل می‌تواند این صفحه را مشاهده کند.
          </p>
          <Button onClick={() => navigate('/profile')}>
            <ArrowRight className="h-4 w-4 ml-2" />
            بازگشت به پروفایل
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/profile?tab=modules')}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">کل سفارشات شرکت اهرم</h1>
                <p className="text-sm text-muted-foreground">
                  مشاهده تمام سفارشات ثبت شده در سیستم
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              به‌روزرسانی
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{orders.length}</p>
              <p className="text-xs text-muted-foreground">کل سفارشات</p>
            </CardContent>
          </Card>
          {Object.entries(statusCounts).slice(0, 5).map(([status, count]) => (
            <Card key={status}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS[status] || status}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو بر اساس کد سفارش، نام مشتری، تلفن یا آدرس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 ml-2" />
                    <SelectValue placeholder="فیلتر وضعیت" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" text="در حال بارگذاری سفارشات..." />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'سفارشی با این فیلترها یافت نشد' 
                  : 'هنوز سفارشی ثبت نشده است'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card 
                key={order.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Order Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-lg">{order.code}</span>
                        <Badge className={STATUS_COLORS[order.status]}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                        {order.execution_stage && order.execution_stage !== 'not_started' && (
                          <Badge variant="outline">
                            {EXECUTION_STAGE_LABELS[order.execution_stage] || order.execution_stage}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {/* Customer */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {order.customer?.profiles?.full_name || 'بدون نام'}
                          </span>
                        </div>
                        
                        {/* Phone */}
                        {order.customer?.profiles?.phone_number && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span dir="ltr">{order.customer.profiles.phone_number}</span>
                          </div>
                        )}
                        
                        {/* Service Type */}
                        {order.subcategory && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {order.subcategory.service_type?.name} - {order.subcategory.name}
                            </span>
                          </div>
                        )}
                        
                        {/* Location */}
                        {(order.address || order.province) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {order.province?.name}{order.address ? ` - ${order.address}` : ''}
                            </span>
                          </div>
                        )}
                        
                        {/* Date */}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>{new Date(order.created_at).toLocaleDateString('fa-IR')}</span>
                        </div>
                        
                        {/* Price */}
                        {order.price && (
                          <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                            <span>{order.price.toLocaleString('fa-IR')} تومان</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/orders/${order.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      مشاهده جزئیات
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Show count */}
        {filteredOrders.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            نمایش {filteredOrders.length} سفارش از {orders.length} سفارش
          </p>
        )}
      </div>
    </div>
  );
}
