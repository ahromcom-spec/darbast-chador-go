import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Search, Phone, Calendar } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
}

export default function ExecutiveCustomers() {
  const [searchTerm, setSearchTerm] = useState('');

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
            .select('status')
            .eq('customer_id', customer.id);

          return {
            id: customer.id,
            user_id: customer.user_id,
            customer_code: customer.customer_code,
            full_name: fullName,
            phone_number: phoneNumber,
            created_at: customer.created_at,
            total_orders: orders?.length || 0,
            pending_orders: orders?.filter(o => o.status === 'approved').length || 0,
            in_progress_orders: orders?.filter(o => o.status === 'in_progress').length || 0
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کد مشتری</TableHead>
                  <TableHead>نام کامل</TableHead>
                  <TableHead>شماره تماس</TableHead>
                  <TableHead>تاریخ ثبت‌نام</TableHead>
                  <TableHead>سفارشات</TableHead>
                  <TableHead>وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      مشتری یافت نشد
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono text-sm">
                        {customer.customer_code || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.full_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {customer.phone_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(customer.created_at).toLocaleDateString('fa-IR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-sm">
                          {customer.total_orders > 0 && (
                            <Badge variant="outline">
                              {customer.total_orders} سفارش
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {customer.pending_orders > 0 && (
                            <Badge variant="secondary">
                              {customer.pending_orders} منتظر
                            </Badge>
                          )}
                          {customer.in_progress_orders > 0 && (
                            <Badge className="bg-primary">
                              {customer.in_progress_orders} در حال اجرا
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
