import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArchiveX, Search, RotateCcw, Trash2, MapPin, Phone, User, Calendar, AlertTriangle, CheckSquare } from 'lucide-react';

interface DeepArchivedOrder {
  id: string;
  code: string;
  address: string;
  detailed_address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  archived_at: string;
  deep_archived_at: string;
  created_at: string;
  province: { name: string } | null;
  subcategory: { name: string } | null;
}

export default function DeepArchivedOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DeepArchivedOrder | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['deep-archived-orders'],
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
        .order('code', { ascending: false });

      if (error) throw error;
      return data as DeepArchivedOrder[];
    }
  });

  // بازگردانی به بایگانی عادی (فقط حذف deep archive)
  const restoreToArchiveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_deep_archived: false,
          deep_archived_at: null,
          deep_archived_by: null
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش به بایگانی عادی بازگردانده شد' });
      queryClient.invalidateQueries({ queryKey: ['deep-archived-orders'] });
      setShowRestoreDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در بازگردانی سفارش', variant: 'destructive' });
    }
  });

  // بازگردانی کامل به جریان سفارشات (حذف هر دو بایگانی)
  // نکته: ممکن است در زمان بایگانی، آدرس مربوطه غیرفعال شده باشد؛ برای نمایش دوباره روی نقشه، location را فعال می‌کنیم.
  const restoreMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // ابتدا hierarchy_project_id را می‌گیریم تا بتوانیم location را فعال کنیم
      const { data: orderRow, error: orderFetchError } = await supabase
        .from('projects_v3')
        .select('hierarchy_project_id')
        .eq('id', orderId)
        .maybeSingle();

      if (orderFetchError) throw orderFetchError;

      const { error: restoreError } = await supabase
        .from('projects_v3')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          is_deep_archived: false,
          deep_archived_at: null,
          deep_archived_by: null
        })
        .eq('id', orderId);

      if (restoreError) throw restoreError;

      const hierarchyProjectId = (orderRow as any)?.hierarchy_project_id as string | null | undefined;
      if (!hierarchyProjectId) return;

      const { data: projectRow, error: projectFetchError } = await supabase
        .from('projects_hierarchy')
        .select('location_id')
        .eq('id', hierarchyProjectId)
        .maybeSingle();

      if (projectFetchError) throw projectFetchError;

      const locationId = (projectRow as any)?.location_id as string | null | undefined;
      if (!locationId) return;

      const { error: locationUpdateError } = await supabase
        .from('locations')
        .update({ is_active: true })
        .eq('id', locationId);

      if (locationUpdateError) throw locationUpdateError;
    },
    onSuccess: () => {
      toast({ title: 'سفارش به جریان سفارشات بازگردانده شد' });
      queryClient.invalidateQueries({ queryKey: ['deep-archived-orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['deep-archived-orders'] });
      setShowDeleteDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در حذف سفارش', variant: 'destructive' });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { error } = await supabase
        .from('projects_v3')
        .delete()
        .in('id', orderIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${selectedOrderIds.size} سفارش به صورت دائمی حذف شدند` });
      queryClient.invalidateQueries({ queryKey: ['deep-archived-orders'] });
      setShowBulkDeleteDialog(false);
      setSelectedOrderIds(new Set());
    },
    onError: () => {
      toast({ title: 'خطا در حذف سفارشات', variant: 'destructive' });
    }
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const filteredOrders = orders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      order.code?.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.customer_phone?.includes(search) ||
      order.address?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fa-IR');
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto py-6 px-4" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <ArchiveX className="h-8 w-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold">بایگانی عمیق</h1>
          <p className="text-sm text-muted-foreground">سفارشات بایگانی عمیق شده - فقط مدیرعامل دسترسی دارد</p>
        </div>
      </div>

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

      {/* Bulk Selection Bar */}
      {filteredOrders.length > 0 && (
        <Card className="mb-4 border-destructive/20 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm">
                  {selectedOrderIds.size > 0 
                    ? `${selectedOrderIds.size} سفارش انتخاب شده از ${filteredOrders.length}`
                    : `انتخاب همه (${filteredOrders.length})`
                  }
                </span>
              </div>
              
              {selectedOrderIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف دائمی ({selectedOrderIds.size})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArchiveX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">هیچ سفارش بایگانی عمیق شده‌ای یافت نشد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={`border-r-4 ${selectedOrderIds.has(order.id) ? 'border-r-destructive bg-destructive/5' : 'border-r-amber-500'}`}>
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedOrderIds.has(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                      className="mt-1"
                    />
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
                        <span>تاریخ بایگانی عمیق: {formatDate(order.deep_archived_at)}</span>
                      </div>

                      {order.subcategory?.name && (
                        <Badge variant="outline">{order.subcategory.name}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mr-8 md:mr-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowRestoreDialog(true);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 ml-2" />
                      بازگردانی کامل
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => restoreToArchiveMutation.mutate(order.id)}
                      disabled={restoreToArchiveMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4 ml-2" />
                      به بایگانی عادی
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDeleteDialog(true);
                      }}
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

      {/* Restore Dialog - بازگردانی کامل به جریان سفارشات */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>بازگردانی سفارش به جریان سفارشات</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را به جریان عادی سفارشات بازگردانید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            این سفارش از بایگانی خارج شده و کاربر و مدیران می‌توانند آن را در پنل خود مشاهده کنند.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              انصراف
            </Button>
            <Button
              onClick={() => selectedOrder && restoreMutation.mutate(selectedOrder.id)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? 'در حال بازگردانی...' : 'بازگردانی کامل'}
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              انصراف
            </Button>
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

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <CheckSquare className="h-5 w-5" />
              حذف دائمی گروهی
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید {selectedOrderIds.size} سفارش را به صورت دائمی حذف کنید؟
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              این عمل غیرقابل بازگشت است و تمام {selectedOrderIds.size} سفارش انتخاب شده برای همیشه حذف خواهند شد.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedOrderIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'در حال حذف...' : `حذف دائمی (${selectedOrderIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
