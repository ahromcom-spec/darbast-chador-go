import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Package, MapPin, Calendar, Eye, Filter, X, Users } from 'lucide-react';

interface Order {
  id: string;
  code: string;
  created_at: string;
  status: string | null;
  address: string | null;
  execution_stage: string | null;
  payment_confirmed_at: string | null;
  subcategory_id: string;
  subcategory_name?: string;
  province_name?: string;
  notes?: any;
  isCollaborated?: boolean;
}

interface MyOrdersListProps {
  userId: string;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'در انتظار تایید', variant: 'secondary' },
  approved: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
  in_progress: { label: 'در حال اجرا', variant: 'default' },
  completed: { label: 'تکمیل شده', variant: 'default' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
};

const executionStageLabels: Record<string, string> = {
  pending_execution: 'در انتظار اجرا',
  in_progress: 'در حال اجرا',
  awaiting_collection: 'در انتظار جمع‌آوری',
  order_executed: 'اجرا شده',
  awaiting_payment: 'در انتظار پرداخت',
  completed: 'تکمیل شده',
};

export function MyOrdersList({ userId }: MyOrdersListProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  
  // Filters
  const [selectedAddress, setSelectedAddress] = useState<string>('all');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  const fetchOrders = async () => {
    try {
      // Get customer ID first
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      // Fetch own orders
      let ownOrders: Order[] = [];
      if (customer) {
        const { data: ordersData, error } = await supabase
          .from('projects_v3')
          .select(`
            id,
            code,
            created_at,
            status,
            address,
            execution_stage,
            payment_confirmed_at,
            subcategory_id,
            notes,
            subcategories:subcategory_id (name),
            provinces:province_id (name)
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (!error && ordersData) {
          ownOrders = ordersData.map((order: any) => ({
            id: order.id,
            code: order.code,
            created_at: order.created_at,
            status: order.status,
            address: order.address,
            execution_stage: order.execution_stage,
            payment_confirmed_at: order.payment_confirmed_at,
            subcategory_id: order.subcategory_id,
            subcategory_name: order.subcategories?.name || '',
            province_name: order.provinces?.name || '',
            notes: order.notes,
            isCollaborated: false,
          }));
        }
      }

      // Fetch collaborated orders (orders where user is an accepted collaborator)
      const { data: collaborations } = await supabase
        .from('order_collaborators')
        .select('order_id')
        .eq('invitee_user_id', userId)
        .eq('status', 'accepted');

      let collaboratedOrders: Order[] = [];
      if (collaborations && collaborations.length > 0) {
        const orderIds = collaborations.map(c => c.order_id);
        
        const { data: collabOrdersData } = await supabase
          .from('projects_v3')
          .select(`
            id,
            code,
            created_at,
            status,
            address,
            execution_stage,
            payment_confirmed_at,
            subcategory_id,
            notes,
            subcategories:subcategory_id (name),
            provinces:province_id (name)
          `)
          .in('id', orderIds)
          .order('created_at', { ascending: false });

        if (collabOrdersData) {
          collaboratedOrders = collabOrdersData.map((order: any) => ({
            id: order.id,
            code: order.code,
            created_at: order.created_at,
            status: order.status,
            address: order.address,
            execution_stage: order.execution_stage,
            payment_confirmed_at: order.payment_confirmed_at,
            subcategory_id: order.subcategory_id,
            subcategory_name: order.subcategories?.name || '',
            province_name: order.provinces?.name || '',
            notes: order.notes,
            isCollaborated: true,
          }));
        }
      }

      // Combine and sort by created_at
      const allOrders = [...ownOrders, ...collaboratedOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(allOrders);

      // Extract unique addresses and service types for filters
      const uniqueAddresses = [...new Set(allOrders.map(o => o.address).filter(Boolean))] as string[];
      setAddresses(uniqueAddresses);

      const uniqueServices = allOrders
        .filter(o => o.subcategory_name)
        .reduce((acc: { id: string; name: string }[], o) => {
          if (!acc.find(s => s.id === o.subcategory_id)) {
            acc.push({ id: o.subcategory_id, name: o.subcategory_name || '' });
          }
          return acc;
        }, []);
      setServiceTypes(uniqueServices);

    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderDisplayStatus = (order: Order): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    // Check payment status first
    if (order.payment_confirmed_at) {
      return { label: 'پرداخت شده', variant: 'default' };
    }

    // Check execution stage
    if (order.execution_stage) {
      const stageLabel = executionStageLabels[order.execution_stage];
      if (stageLabel) {
        return { label: stageLabel, variant: 'default' };
      }
    }

    // Fall back to main status
    return statusLabels[order.status || 'pending'] || { label: 'نامشخص', variant: 'outline' };
  };

  const getFilteredOrders = () => {
    return orders.filter(order => {
      // Address filter
      if (selectedAddress !== 'all' && order.address !== selectedAddress) {
        return false;
      }

      // Service type filter
      if (selectedServiceType !== 'all' && order.subcategory_id !== selectedServiceType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'paid' && !order.payment_confirmed_at) return false;
        if (selectedStatus === 'awaiting_payment' && order.execution_stage !== 'awaiting_payment') return false;
        if (selectedStatus === 'awaiting_collection' && order.execution_stage !== 'awaiting_collection') return false;
        if (selectedStatus === 'in_progress' && order.execution_stage !== 'in_progress' && order.status !== 'in_progress') return false;
        if (selectedStatus === 'pending' && order.status !== 'pending') return false;
        if (selectedStatus === 'completed' && order.status !== 'completed' && order.execution_stage !== 'completed') return false;
        if (selectedStatus === 'rejected' && order.status !== 'rejected') return false;
      }

      return true;
    });
  };

  const clearFilters = () => {
    setSelectedAddress('all');
    setSelectedServiceType('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = selectedAddress !== 'all' || selectedServiceType !== 'all' || selectedStatus !== 'all';
  const filteredOrders = getFilteredOrders();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" text="در حال بارگذاری سفارشات..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">فیلتر سفارشات</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mr-auto text-xs h-7"
              >
                <X className="h-3 w-3 ml-1" />
                پاک کردن فیلترها
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Address Filter */}
            <Select value={selectedAddress} onValueChange={setSelectedAddress}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="انتخاب آدرس" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه آدرس‌ها</SelectItem>
                {addresses.map((addr, idx) => (
                  <SelectItem key={idx} value={addr}>
                    {addr.length > 40 ? addr.substring(0, 40) + '...' : addr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Service Type Filter */}
            <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="نوع خدمات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه خدمات</SelectItem>
                {serviceTypes.map(svc => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="وضعیت سفارش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="pending">در انتظار تایید</SelectItem>
                <SelectItem value="in_progress">در حال اجرا</SelectItem>
                <SelectItem value="awaiting_collection">در انتظار جمع‌آوری</SelectItem>
                <SelectItem value="awaiting_payment">در انتظار پرداخت</SelectItem>
                <SelectItem value="paid">پرداخت شده</SelectItem>
                <SelectItem value="completed">تکمیل شده</SelectItem>
                <SelectItem value="rejected">رد شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredOrders.length} سفارش {hasActiveFilters && `از ${orders.length}`}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={hasActiveFilters ? "سفارشی با این فیلترها یافت نشد" : "سفارشی ثبت نشده"}
          description={hasActiveFilters ? "فیلترهای خود را تغییر دهید" : "برای ثبت سفارش جدید از صفحه اصلی اقدام کنید"}
          actionLabel={hasActiveFilters ? "پاک کردن فیلترها" : "ثبت سفارش جدید"}
          onAction={hasActiveFilters ? clearFilters : () => navigate('/')}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const displayStatus = getOrderDisplayStatus(order);
            
            return (
              <Card 
                key={order.id} 
                className="hover:shadow-md transition-shadow cursor-pointer border-border/50"
                onClick={() => navigate(`/user/orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      {/* Order Code & Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">#{order.code}</span>
                        <Badge variant={displayStatus.variant}>
                          {displayStatus.label}
                        </Badge>
                        {order.isCollaborated && (
                          <Badge variant="outline" className="gap-1 text-xs border-primary/50 text-primary">
                            <Users className="h-3 w-3" />
                            همکار
                          </Badge>
                        )}
                      </div>

                      {/* Service Type */}
                      {order.subcategory_name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Package className="h-4 w-4" />
                          <span>{order.subcategory_name}</span>
                        </div>
                      )}

                      {/* Address */}
                      {order.address && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{order.address}</span>
                        </div>
                      )}

                      {/* Date */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(order.created_at).toLocaleDateString('fa-IR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/orders/${order.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      مشاهده
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
