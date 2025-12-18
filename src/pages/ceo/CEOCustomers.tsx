import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Search, Phone, Calendar, ChevronDown, ChevronUp, Archive, ArchiveX, RotateCcw, Trash2, MapPin, User, AlertTriangle, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExecutiveStageTimeline } from '@/components/executive/ExecutiveStageTimeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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

interface ArchivedOrder {
  id: string;
  code: string;
  address: string;
  detailed_address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  archived_at: string;
  deep_archived_at?: string;
  archived_by: string | null;
  created_at: string;
  province: { name: string } | null;
  subcategory: { name: string } | null;
}

export function CEOCustomers() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('customers');
  const [selectedOrder, setSelectedOrder] = useState<ArchivedOrder | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeepArchiveDialog, setShowDeepArchiveDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Customers query
  const { data: customers, isLoading: customersLoading } = useQuery({
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
            pending_orders: orders?.filter(o => o.status === 'approved').length || 0,
            in_progress_orders: orders?.filter(o => o.status === 'in_progress').length || 0,
            orders: orders || []
          };
        })
      );

      return customersWithOrders;
    }
  });

  // Archived orders query
  const { data: archivedOrders = [], isLoading: archivedLoading } = useQuery({
    queryKey: ['ceo-archived-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id, code, address, detailed_address, customer_name, customer_phone,
          status, archived_at, archived_by, created_at,
          province:provinces(name),
          subcategory:subcategories(name)
        `)
        .eq('is_archived', true)
        .neq('is_deep_archived', true)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return data as ArchivedOrder[];
    }
  });

  // Deep archived orders query
  const { data: deepArchivedOrders = [], isLoading: deepArchivedLoading } = useQuery({
    queryKey: ['ceo-deep-archived-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id, code, address, detailed_address, customer_name, customer_phone,
          status, archived_at, deep_archived_at, created_at,
          province:provinces(name),
          subcategory:subcategories(name)
        `)
        .eq('is_deep_archived', true)
        .order('deep_archived_at', { ascending: false });

      if (error) throw error;
      return data as ArchivedOrder[];
    }
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ceo-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects_v3' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ceo-customers'] });
          queryClient.invalidateQueries({ queryKey: ['ceo-archived-orders'] });
          queryClient.invalidateQueries({ queryKey: ['ceo-deep-archived-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutations
  const restoreMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({ is_archived: false, archived_at: null, archived_by: null })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش با موفقیت بازگردانده شد' });
      queryClient.invalidateQueries({ queryKey: ['ceo-archived-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-customers'] });
      setShowRestoreDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در بازگردانی سفارش', variant: 'destructive' });
    }
  });

  const deepArchiveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_deep_archived: true,
          deep_archived_at: new Date().toISOString(),
          deep_archived_by: user?.id
        })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش به بایگانی عمیق منتقل شد' });
      queryClient.invalidateQueries({ queryKey: ['ceo-archived-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-deep-archived-orders'] });
      setShowDeepArchiveDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در بایگانی عمیق سفارش', variant: 'destructive' });
    }
  });

  const restoreFromDeepMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({ is_deep_archived: false, deep_archived_at: null, deep_archived_by: null })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش به بایگانی عادی بازگردانده شد' });
      queryClient.invalidateQueries({ queryKey: ['ceo-deep-archived-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-archived-orders'] });
      setShowRestoreDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در بازگردانی سفارش', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش به صورت دائمی حذف شد' });
      queryClient.invalidateQueries({ queryKey: ['ceo-archived-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ceo-deep-archived-orders'] });
      setShowDeleteDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در حذف سفارش', variant: 'destructive' });
    }
  });

  const filteredCustomers = customers?.filter(
    (customer) =>
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone_number.includes(searchTerm) ||
      customer.customer_code?.includes(searchTerm)
  );

  const filteredArchivedOrders = archivedOrders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      order.code?.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.customer_phone?.includes(search) ||
      order.address?.toLowerCase().includes(search)
    );
  });

  const filteredDeepArchivedOrders = deepArchivedOrders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      order.code?.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.customer_phone?.includes(search) ||
      order.address?.toLowerCase().includes(search)
    );
  });

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fa-IR');
  };

  const isLoading = customersLoading || archivedLoading || deepArchivedLoading;
  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت مشتریان"
        description="مشاهده و مدیریت اطلاعات مشتریان و سفارشات بایگانی"
        showBackButton={true}
        backTo="/ceo"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="customers" className="gap-2">
            <UsersRound className="h-4 w-4" />
            مشتریان
            <Badge variant="secondary" className="mr-1">{customers?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            بایگانی سفارشات
            <Badge variant="secondary" className="mr-1">{archivedOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="deep-archived" className="gap-2">
            <ArchiveX className="h-4 w-4" />
            بایگانی عمیق
            <Badge variant="secondary" className="mr-1">{deepArchivedOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
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
                                      {order.status === 'in_progress' ? (
                                        <div className="space-y-3">
                                          <h5 className="text-sm font-semibold">مراحل اجرایی:</h5>
                                          <ExecutiveStageTimeline
                                            projectId={order.id}
                                            currentStage={order.execution_stage || 'awaiting_payment'}
                                            onStageChange={() => {
                                              queryClient.invalidateQueries({ queryKey: ['ceo-customers'] });
                                            }}
                                            readOnly={false}
                                          />
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          مراحل اجرایی فقط برای سفارشات در حال اجرا قابل مشاهده است.
                                        </p>
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
        </TabsContent>

        {/* Archived Orders Tab */}
        <TabsContent value="archived">
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو بر اساس کد، نام، شماره تلفن یا آدرس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardContent>
          </Card>

          {filteredArchivedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">هیچ سفارش بایگانی شده‌ای یافت نشد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredArchivedOrders.map((order) => (
                <Card key={order.id} className="border-r-4 border-r-muted">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">سفارش {order.code}</span>
                          <Badge variant="secondary">بایگانی شده</Badge>
                        </div>
                        {order.customer_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{order.customer_name}</span>
                          </div>
                        )}
                        {order.customer_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span dir="ltr">{order.customer_phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{order.province?.name} - {order.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>تاریخ بایگانی: {formatDate(order.archived_at)}</span>
                        </div>
                        {order.subcategory?.name && (
                          <Badge variant="outline">{order.subcategory.name}</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setShowRestoreDialog(true); }}
                        >
                          <RotateCcw className="h-4 w-4 ml-2" />
                          بازگردانی
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setShowDeepArchiveDialog(true); }}
                        >
                          <ArchiveX className="h-4 w-4 ml-2" />
                          بایگانی عمیق
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف دائمی
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deep Archived Orders Tab */}
        <TabsContent value="deep-archived">
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو بر اساس کد، نام، شماره تلفن یا آدرس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardContent>
          </Card>

          {filteredDeepArchivedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ArchiveX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">هیچ سفارش بایگانی عمیق شده‌ای یافت نشد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredDeepArchivedOrders.map((order) => (
                <Card key={order.id} className="border-r-4 border-r-amber-500">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">سفارش {order.code}</span>
                          <Badge className="bg-amber-500 hover:bg-amber-600">بایگانی عمیق</Badge>
                        </div>
                        {order.customer_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{order.customer_name}</span>
                          </div>
                        )}
                        {order.customer_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span dir="ltr">{order.customer_phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{order.province?.name} - {order.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>تاریخ بایگانی عمیق: {formatDate(order.deep_archived_at || null)}</span>
                        </div>
                        {order.subcategory?.name && (
                          <Badge variant="outline">{order.subcategory.name}</Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setShowRestoreDialog(true); }}
                        >
                          <RotateCcw className="h-4 w-4 ml-2" />
                          بازگردانی به بایگانی
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setSelectedOrder(order); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف دائمی
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'deep-archived' ? 'بازگردانی به بایگانی عادی' : 'بازگردانی سفارش'}
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را بازگردانید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'deep-archived'
              ? 'این سفارش به بایگانی عادی بازگردانده می‌شود.'
              : 'این سفارش به لیست سفارشات فعال بازگردانده می‌شود.'}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>انصراف</Button>
            <Button
              onClick={() => {
                if (selectedOrder) {
                  if (activeTab === 'deep-archived') {
                    restoreFromDeepMutation.mutate(selectedOrder.id);
                  } else {
                    restoreMutation.mutate(selectedOrder.id);
                  }
                }
              }}
              disabled={restoreMutation.isPending || restoreFromDeepMutation.isPending}
            >
              {restoreMutation.isPending || restoreFromDeepMutation.isPending ? 'در حال بازگردانی...' : 'بازگردانی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deep Archive Dialog */}
      <Dialog open={showDeepArchiveDialog} onOpenChange={setShowDeepArchiveDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArchiveX className="h-5 w-5" />
              بایگانی عمیق سفارش
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را به بایگانی عمیق منتقل کنید؟
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              سفارشات بایگانی عمیق فقط توسط مدیرعامل قابل مشاهده هستند.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeepArchiveDialog(false)}>انصراف</Button>
            <Button
              variant="secondary"
              onClick={() => selectedOrder && deepArchiveMutation.mutate(selectedOrder.id)}
              disabled={deepArchiveMutation.isPending}
            >
              {deepArchiveMutation.isPending ? 'در حال انتقال...' : 'بایگانی عمیق'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف دائمی سفارش
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را به صورت دائمی حذف کنید؟
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              این عمل غیرقابل بازگشت است و تمام اطلاعات سفارش برای همیشه حذف خواهد شد.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>انصراف</Button>
            <Button
              variant="destructive"
              onClick={() => selectedOrder && deleteMutation.mutate(selectedOrder.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'در حال حذف...' : 'حذف دائمی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CEOCustomers;
