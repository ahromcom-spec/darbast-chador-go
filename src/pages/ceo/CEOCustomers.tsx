import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Search, Phone, Calendar, ChevronDown, ChevronUp, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExecutiveStageTimeline } from '@/components/executive/ExecutiveStageTimeline';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Order {
  id: string;
  code: string;
  status: string;
  execution_stage: string | null;
  address: string;
  created_at: string;
}

interface Customer {
  id: string;
  user_id: string;
  customer_code: string;
  full_name: string;
  phone_number: string;
  created_at: string;
  total_orders: number;
  pending_orders: number;
  in_progress_orders: number;
  orders: Order[];
}

export function CEOCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Customers query
  const { data: customers, isLoading } = useQuery({
    queryKey: ['ceo-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, user_id, customer_code, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const customersWithOrders = await Promise.all(
        (data || []).map(async (customer: any) => {
          let fullName = 'نامشخص';
          let phoneNumber = '';

          if (customer.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customer.user_id)
              .maybeSingle();

            fullName = profileData?.full_name || 'نامشخص';
            phoneNumber = profileData?.phone_number || '';
          }

          const { data: orders } = await supabase
            .from('projects_v3')
            .select('id, code, status, execution_stage, address, created_at')
            .eq('customer_id', customer.id)
            .eq('is_archived', false)
            .order('code', { ascending: false });

          return {
            id: customer.id,
            user_id: customer.user_id,
            customer_code: customer.customer_code,
            full_name: fullName,
            phone_number: phoneNumber,
            created_at: customer.created_at,
            total_orders: orders?.length || 0,
            pending_orders: orders?.filter(o => o.status === 'approved' || o.status === 'pending_execution').length || 0,
            in_progress_orders: orders?.filter(o => o.status === 'in_progress').length || 0,
            orders: orders || []
          };
        })
      );

      return customersWithOrders;
    }
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ceo-customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects_v3' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ceo-customers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredCustomers = customers?.filter(
    (customer) =>
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone_number.includes(searchTerm) ||
      customer.customer_code?.includes(searchTerm)
  );

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت مشتریان"
        description="مشاهده و مدیریت اطلاعات مشتریان"
        showBackButton={true}
        backTo="/ceo"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            <CardTitle>لیست مشتریان</CardTitle>
          </div>
          <CardDescription>
            {customers?.length || 0} مشتری ثبت‌نام شده
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، شماره تماس یا کد مشتری..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>

          <div className="space-y-3">
            {filteredCustomers?.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                مشتری یافت نشد
              </div>
            ) : (
              filteredCustomers?.map((customer) => (
                <Collapsible
                  key={customer.id}
                  open={expandedCustomers.has(customer.id)}
                  onOpenChange={() => toggleCustomer(customer.id)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">کد مشتری</p>
                              <p className="font-mono text-sm font-medium">
                                {customer.customer_code || '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">نام کامل</p>
                              <p className="font-medium">{customer.full_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">شماره تماس</p>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <p className="text-sm">{customer.phone_number}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">تاریخ ثبت‌نام</p>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <p className="text-sm">
                                  {new Date(customer.created_at).toLocaleDateString('fa-IR')}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">وضعیت سفارشات</p>
                              <div className="flex gap-1 flex-wrap">
                                <Badge variant="outline">
                                  {customer.total_orders} سفارش
                                </Badge>
                                {customer.in_progress_orders > 0 && (
                                  <Badge className="bg-primary">
                                    {customer.in_progress_orders} در حال اجرا
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            {expandedCustomers.has(customer.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {customer.orders.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            هیچ سفارشی برای این مشتری ثبت نشده است
                          </p>
                        ) : (
                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm">سفارشات مشتری:</h4>
                            {customer.orders.map((order) => (
                              <Card key={order.id} className="bg-muted/30">
                                <CardContent className="py-3">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold">سفارش {order.code}</span>
                                        <Badge
                                          variant={
                                            order.status === 'completed' || order.status === 'closed'
                                              ? 'default'
                                              : order.status === 'in_progress'
                                              ? 'secondary'
                                              : 'outline'
                                          }
                                        >
                                          {order.status === 'pending' && 'در انتظار تایید'}
                                          {(order.status === 'approved' || order.status === 'pending_execution') && 'تایید شده'}
                                          {order.status === 'in_progress' && 'در حال اجرا'}
                                          {order.status === 'completed' && 'تکمیل شده'}
                                          {order.status === 'closed' && 'بسته شده'}
                                          {order.status === 'rejected' && 'رد شده'}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground">{order.address}</p>
                                    </div>
                                  </div>
                                  {order.status === 'in_progress' && order.execution_stage && (
                                    <div className="mt-4">
                                      <ExecutiveStageTimeline
                                        currentStage={order.execution_stage}
                                        projectId={order.id}
                                      />
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CEOCustomers;
