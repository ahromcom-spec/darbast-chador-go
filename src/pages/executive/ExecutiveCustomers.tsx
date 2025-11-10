import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Search, Phone, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
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

export default function ExecutiveCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const { data: customers, isLoading } = useQuery({
    queryKey: ['executive-customers'],
    queryFn: async () => {
      // 1) Fetch raw customers data
      const { data, error } = await supabase
        .from('customers')
        .select('id, user_id, customer_code, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2) Enrich each customer with profile and orders safely
      const customersWithOrders = await Promise.all(
        (data || []).map(async (customer: any) => {
          let fullName = 'نامشخص';
          let phoneNumber = '';

          // Fetch profile separately
          if (customer.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customer.user_id)
              .maybeSingle();

            fullName = profileData?.full_name || 'نامشخص';
            phoneNumber = profileData?.phone_number || '';
          }

          // Fetch orders for this customer
          const { data: orders } = await supabase
            .from('projects_v3')
            .select('id, code, status, execution_stage, address, created_at')
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false });

          return {
            id: customer.id,
            user_id: customer.user_id,
            customer_code: customer.customer_code,
            full_name: fullName,
            phone_number: phoneNumber,
            created_at: customer.created_at,
            total_orders: orders?.length || 0,
            pending_orders: orders?.filter(o => o.status === 'approved').length || 0,
            in_progress_orders: orders?.filter(o => o.status === 'in_progress').length || 0,
            orders: orders || []
          };
        })
      );

      return customersWithOrders;
    }
  });

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
        backTo="/executive"
      />

      <Card>
        <CardHeader>
          <CardTitle>لیست مشتریان</CardTitle>
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
                                <CardHeader>
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <CardTitle className="text-base">
                                        کد سفارش: {order.code}
                                      </CardTitle>
                                      <CardDescription className="text-xs">
                                        آدرس: {order.address}
                                      </CardDescription>
                                      <Badge variant="outline" className="mt-2">
                                        {order.status === 'pending' && 'در انتظار تایید'}
                                        {order.status === 'approved' && 'تایید شده'}
                                        {order.status === 'in_progress' && 'در حال اجرا'}
                                        {order.status === 'completed' && 'تکمیل شده'}
                                        {order.status === 'paid' && 'پرداخت شده'}
                                        {order.status === 'closed' && 'بسته شده'}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold">مراحل اجرایی:</h5>
                                    <ExecutiveStageTimeline
                                      projectId={order.id}
                                      currentStage={order.execution_stage}
                                      onStageChange={() => {
                                        // Refresh data after stage change
                                        window.location.reload();
                                      }}
                                      readOnly={false}
                                    />
                                  </div>
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
