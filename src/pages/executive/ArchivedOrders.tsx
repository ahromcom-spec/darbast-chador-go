import { useState, useEffect } from 'react';
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
import { Archive, Search, RotateCcw, Trash2, MapPin, Phone, User, Calendar, AlertTriangle, ArchiveX, CheckSquare } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';

interface ArchivedOrder {
  id: string;
  code: string;
  address: string;
  detailed_address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  archived_at: string;
  archived_by: string | null;
  created_at: string;
  province: { name: string } | null;
  subcategory: { name: string } | null;
}

export default function ArchivedOrders() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ArchivedOrder | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeepArchiveDialog, setShowDeepArchiveDialog] = useState(false);
  const [showBulkDeepArchiveDialog, setShowBulkDeepArchiveDialog] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCEO, isAdmin, isGeneralManager } = useUserRoles();

  const canDelete = isCEO || isAdmin || isGeneralManager;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['archived-orders'],
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
        .or('is_deep_archived.is.null,is_deep_archived.eq.false')
        .order('code', { ascending: false });

      if (error) throw error;
      return data as ArchivedOrder[];
    }
  });

  // Subscribe to realtime changes for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('archived-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3'
        },
        (payload) => {
          console.log('Realtime archived order update:', payload);
          queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const restoreMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'سفارش با موفقیت بازگردانده شد' });
      queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
      setShowDeleteDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در حذف سفارش', variant: 'destructive' });
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
      queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
      setShowDeepArchiveDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: 'خطا در بایگانی عمیق سفارش', variant: 'destructive' });
    }
  });

  const bulkDeepArchiveMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_deep_archived: true,
          deep_archived_at: new Date().toISOString(),
          deep_archived_by: user?.id
        })
        .in('id', orderIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${selectedOrderIds.size} سفارش به بایگانی عمیق منتقل شدند` });
      queryClient.invalidateQueries({ queryKey: ['archived-orders'] });
      setShowBulkDeepArchiveDialog(false);
      setSelectedOrderIds(new Set());
    },
    onError: () => {
      toast({ title: 'خطا در بایگانی عمیق سفارشات', variant: 'destructive' });
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
        <Archive className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">بایگانی سفارشات</h1>
          <p className="text-sm text-muted-foreground">سفارشات بایگانی شده - قابل بازگردانی یا حذف دائمی</p>
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
        <Card className="mb-4 border-primary/20 bg-primary/5">
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
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBulkDeepArchiveDialog(true)}
                >
                  <ArchiveX className="h-4 w-4 ml-2" />
                  بایگانی عمیق ({selectedOrderIds.size})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">هیچ سفارش بایگانی شده‌ای یافت نشد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={`border-r-4 ${selectedOrderIds.has(order.id) ? 'border-r-primary bg-primary/5' : 'border-r-muted'}`}>
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
                      بازگردانی
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDeepArchiveDialog(true);
                      }}
                    >
                      <ArchiveX className="h-4 w-4 ml-2" />
                      بایگانی عمیق
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>بازگردانی سفارش</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را از بایگانی خارج کنید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            این سفارش به لیست سفارشات فعال بازگردانده می‌شود و مشتری و مدیران می‌توانند آن را مشاهده کنند.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              انصراف
            </Button>
            <Button
              onClick={() => selectedOrder && restoreMutation.mutate(selectedOrder.id)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? 'در حال بازگردانی...' : 'بازگردانی'}
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
              سفارشات بایگانی عمیق فقط توسط مدیرعامل قابل مشاهده هستند و از دسترس سایر مدیران خارج می‌شوند.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeepArchiveDialog(false)}>
              انصراف
            </Button>
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

      {/* Bulk Deep Archive Dialog */}
      <Dialog open={showBulkDeepArchiveDialog} onOpenChange={setShowBulkDeepArchiveDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              بایگانی عمیق گروهی
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید {selectedOrderIds.size} سفارش را به بایگانی عمیق منتقل کنید؟
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              تمام {selectedOrderIds.size} سفارش انتخاب شده به بایگانی عمیق منتقل شده و فقط توسط مدیرعامل قابل مشاهده خواهند بود.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeepArchiveDialog(false)}>
              انصراف
            </Button>
            <Button
              variant="secondary"
              onClick={() => bulkDeepArchiveMutation.mutate(Array.from(selectedOrderIds))}
              disabled={bulkDeepArchiveMutation.isPending}
            >
              {bulkDeepArchiveMutation.isPending ? 'در حال انتقال...' : `بایگانی عمیق (${selectedOrderIds.size})`}
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
    </div>
  );
}