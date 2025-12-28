import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Eye, Search, MapPin, Phone, User, Calendar, RefreshCw, ArrowLeftRight, Users, Archive, PackageOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { useOrderArchive } from '@/hooks/useOrderArchive';
import { OrderArchiveControls, OrderCardArchiveButton } from '@/components/orders/OrderArchiveControls';
import { CollectionRequestDialog } from '@/components/orders/CollectionRequestDialog';
import { RentalStartDatePicker } from '@/components/orders/RentalStartDatePicker';
import { ManagerRenewalDialog } from '@/components/orders/ManagerRenewalDialog';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  execution_start_date: string | null;
  execution_end_date: string | null;
  execution_stage: string | null;
  rental_start_date: string | null;
  customer_completion_date: string | null;
  notes: any;
  total_price: number | null;
  collection_request_date?: string | null;
}

const stageLabels: Record<string, string> = {
  awaiting_payment: 'در انتظار پرداخت',
  order_executed: 'سفارش اجرا شده',
  awaiting_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری'
};

export default function ExecutiveStageOrderExecuted() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [savingRentalDate, setSavingRentalDate] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Archive functionality
  const archive = useOrderArchive(() => fetchOrders());

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = orders.filter(order => 
        order.code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.includes(term) ||
        order.address.toLowerCase().includes(term)
      );
      setFilteredOrders(filtered);
    }
  }, [searchTerm, orders]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          detailed_address,
          created_at,
          execution_start_date,
          execution_end_date,
          execution_stage,
          rental_start_date,
          customer_completion_date,
          notes,
          total_price,
          customer_id
        `)
        .eq('execution_stage', 'order_executed')
        .order('code', { ascending: false });

      if (error) throw error;

      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: customerData } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', order.customer_id)
            .maybeSingle();

          let customerName = 'نامشخص';
          let customerPhone = '';

          if (customerData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customerData.user_id)
              .maybeSingle();

            customerName = profileData?.full_name || 'نامشخص';
            customerPhone = profileData?.phone_number || '';
          }

          // Fetch collection request date if exists
          const { data: collectionData } = await supabase
            .from('collection_requests')
            .select('requested_date, status')
            .eq('order_id', order.id)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            execution_start_date: order.execution_start_date,
            execution_end_date: order.execution_end_date,
            execution_stage: order.execution_stage,
            rental_start_date: order.rental_start_date,
            customer_completion_date: order.customer_completion_date,
            notes: order.notes,
            total_price: order.total_price,
            customer_id: order.customer_id,
            customer_name: customerName,
            customer_phone: customerPhone,
            collection_request_date: collectionData?.requested_date || null
          };
        })
      );

      setOrders(ordersWithCustomer as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت سفارشات با خطا مواجه شد'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (orderId: string, newStage: string, orderCode: string) => {
    setUpdatingStage(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          execution_stage: newStage as 'awaiting_payment' | 'order_executed' | 'awaiting_collection' | 'in_collection',
          execution_stage_updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `مرحله سفارش ${orderCode} به "${stageLabels[newStage]}" تغییر یافت.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در به‌روزرسانی مرحله'
      });
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleRentalStartDateUpdate = async (orderId: string, date: string | null, orderCode: string) => {
    setSavingRentalDate(orderId);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          rental_start_date: date
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: date ? '✓ تاریخ شروع کرایه ثبت شد' : '✓ تاریخ شروع کرایه پاک شد',
        description: date 
          ? `تاریخ شروع کرایه سفارش ${orderCode} ثبت شد.`
          : `تاریخ شروع کرایه سفارش ${orderCode} پاک شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating rental start date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ثبت تاریخ شروع کرایه'
      });
    } finally {
      setSavingRentalDate(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات اجرا شده"
        description={`${orders.length} سفارش در این مرحله`}
      />

      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Selection Bar */}
      <OrderArchiveControls
        showBulkBar={true}
        selectedCount={archive.selectedOrderIds.size}
        totalCount={filteredOrders.length}
        onToggleSelectAll={() => archive.toggleSelectAll(filteredOrders.map(o => o.id))}
        onBulkArchive={() => archive.setBulkArchiveDialogOpen(true)}
        archiveDialogOpen={archive.archiveDialogOpen}
        onArchiveDialogChange={archive.setArchiveDialogOpen}
        orderToArchive={archive.orderToArchive}
        onConfirmArchive={archive.handleArchiveOrder}
        bulkArchiveDialogOpen={archive.bulkArchiveDialogOpen}
        onBulkArchiveDialogChange={archive.setBulkArchiveDialogOpen}
        onConfirmBulkArchive={archive.handleBulkArchive}
        archiving={archive.archiving}
      />

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در این مرحله وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <OrderCardArchiveButton
                    orderId={order.id}
                    isSelected={archive.selectedOrderIds.has(order.id)}
                    onToggleSelection={() => archive.toggleOrderSelection(order.id)}
                    onArchive={() => archive.openArchiveDialog({ id: order.id, code: order.code })}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      <StatusBadge status={order.status as any} />
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span dir="ltr">{order.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{order.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                
                {order.execution_start_date && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">زمان‌بندی اجرا:</span>
                      <span>
                        {new Date(order.execution_start_date).toLocaleDateString('fa-IR')}
                        {order.execution_end_date && ' تا ' + new Date(order.execution_end_date).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                  </div>
                )}

                {order.execution_stage && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCw className="h-4 w-4 text-green-600" />
                        <span className="font-medium">مرحله فعلی:</span>
                        <span className="text-green-700 dark:text-green-300 font-medium">
                          {stageLabels[order.execution_stage] || order.execution_stage}
                        </span>
                      </div>
                      <Select
                        value={order.execution_stage}
                        onValueChange={(value) => handleStageUpdate(order.id, value, order.code)}
                        disabled={updatingStage}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="awaiting_payment">در انتظار پرداخت</SelectItem>
                          <SelectItem value="order_executed">سفارش اجرا شده</SelectItem>
                          <SelectItem value="awaiting_collection">در انتظار جمع‌آوری</SelectItem>
                          <SelectItem value="in_collection">در حال جمع‌آوری</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* مرحله ۱: کادر تعیین تاریخ شروع کرایه */}
                <div className={`p-3 rounded-lg border-2 ${order.rental_start_date ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'}`}>
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Calendar className={`h-4 w-4 ${order.rental_start_date ? 'text-green-600' : 'text-amber-600'}`} />
                    <span className={`font-medium ${order.rental_start_date ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
                      ۱. تاریخ شروع کرایه داربست {order.rental_start_date ? '✓' : '(الزامی)'}
                    </span>
                  </div>
                  
                  {savingRentalDate === order.id ? (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">در حال ثبت تاریخ...</span>
                    </div>
                  ) : (
                    <RentalStartDatePicker
                      value={order.rental_start_date || undefined}
                      onChange={(date) => handleRentalStartDateUpdate(order.id, date, order.code)}
                      placeholder="انتخاب تاریخ شروع کرایه"
                      allowClear={true}
                    />
                  )}
                  
                  {order.rental_start_date && savingRentalDate !== order.id && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      ✓ تاریخ ثبت شده: {new Date(order.rental_start_date).toLocaleDateString('fa-IR')}
                    </p>
                  )}
                </div>

                {/* مرحله ۲: تاریخ جمع‌آوری - فقط بعد از ثبت تاریخ کرایه فعال می‌شود */}
                <div className={`p-3 rounded-lg border-2 ${
                  !order.rental_start_date 
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                    : order.collection_request_date
                      ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700'
                      : 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800'
                }`}>
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <PackageOpen className={`h-4 w-4 ${
                      !order.rental_start_date ? 'text-gray-500' : order.collection_request_date ? 'text-green-600' : 'text-teal-600'
                    }`} />
                    <span className={`font-medium ${
                      !order.rental_start_date 
                        ? 'text-gray-500 dark:text-gray-400' 
                        : order.collection_request_date
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-teal-800 dark:text-teal-200'
                    }`}>
                      ۲. تاریخ جمع‌آوری {order.collection_request_date ? '✓' : !order.rental_start_date ? '(ابتدا تاریخ کرایه)' : '(الزامی)'}
                    </span>
                  </div>
                  
                  {order.rental_start_date ? (
                    order.collection_request_date ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          ✓ تاریخ جمع‌آوری: {new Date(order.collection_request_date).toLocaleDateString('fa-IR')}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setSelectedOrder(order); setCollectionDialogOpen(true); }}
                            className="gap-2 border-green-300 text-green-700 hover:bg-green-100"
                          >
                            <PackageOpen className="h-4 w-4" />
                            ویرایش تاریخ
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleStageUpdate(order.id, 'awaiting_collection', order.code)}
                            disabled={updatingStage}
                            className="gap-2 bg-primary hover:bg-primary/90"
                          >
                            <RefreshCw className="h-4 w-4" />
                            ارسال به جمع‌آوری
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setSelectedOrder(order); setCollectionDialogOpen(true); }}
                        className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-100"
                      >
                        <Calendar className="h-4 w-4" />
                        ثبت تاریخ جمع‌آوری
                      </Button>
                    )
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      پس از ثبت تاریخ شروع کرایه فعال می‌شود
                    </p>
                  )}
                </div>

                {/* مرحله ۳: ارسال به جمع‌آوری - فقط بعد از ثبت هر دو تاریخ فعال می‌شود */}
                <div className={`p-3 rounded-lg border-2 ${
                  order.rental_start_date && order.collection_request_date
                    ? 'bg-primary/10 border-primary'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className={`h-4 w-4 ${
                        order.rental_start_date && order.collection_request_date ? 'text-primary' : 'text-gray-500'
                      }`} />
                      <span className={`font-medium ${
                        order.rental_start_date && order.collection_request_date ? 'text-primary' : 'text-gray-500'
                      }`}>
                        ۳. ارسال به مرحله جمع‌آوری
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStageUpdate(order.id, 'awaiting_collection', order.code)}
                      disabled={!order.rental_start_date || !order.collection_request_date || updatingStage}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      ارسال به جمع‌آوری
                    </Button>
                  </div>
                  {(!order.rental_start_date || !order.collection_request_date) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      برای فعال‌سازی، ابتدا تاریخ شروع کرایه و سپس تاریخ جمع‌آوری را ثبت کنید
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setDetailsOpen(true); }} className="gap-2">
                    <Eye className="h-4 w-4" />
                    جزئیات
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setTransferDialogOpen(true); }} className="gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    انتقال
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setCollaboratorDialogOpen(true); }} className="gap-2">
                    <Users className="h-4 w-4" />
                    افزودن پرسنل
                  </Button>

                  <Button variant="default" size="sm" onClick={() => { setSelectedOrder(order); setRenewalDialogOpen(true); }} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    تمدید
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails 
              order={{
                id: selectedOrder.id,
                code: selectedOrder.code,
                customer_name: selectedOrder.customer_name,
                customer_phone: selectedOrder.customer_phone,
                address: selectedOrder.address,
                detailed_address: selectedOrder.detailed_address,
                created_at: selectedOrder.created_at,
                notes: selectedOrder.notes,
                execution_start_date: selectedOrder.execution_start_date,
                execution_end_date: selectedOrder.execution_end_date,
                execution_stage: selectedOrder.execution_stage,
                rental_start_date: selectedOrder.rental_start_date,
                customer_completion_date: selectedOrder.customer_completion_date
              }}
              onUpdate={fetchOrders}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <ManagerOrderTransfer orderId={selectedOrder.id} orderCode={selectedOrder.code} open={transferDialogOpen} onOpenChange={setTransferDialogOpen} onTransferComplete={fetchOrders} />
      )}

      {selectedOrder && (
        <ManagerAddStaffCollaborator orderId={selectedOrder.id} orderCode={selectedOrder.code} open={collaboratorDialogOpen} onOpenChange={setCollaboratorDialogOpen} onCollaboratorAdded={fetchOrders} />
      )}

      {selectedOrder && (
        <CollectionRequestDialog
          open={collectionDialogOpen}
          onOpenChange={setCollectionDialogOpen}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerId={selectedOrder.customer_id}
          isManager={true}
        />
      )}

      {selectedOrder && (
        <ManagerRenewalDialog
          open={renewalDialogOpen}
          onOpenChange={setRenewalDialogOpen}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerId={selectedOrder.customer_id}
          rentalStartDate={selectedOrder.rental_start_date}
          originalPrice={(() => {
            // اولویت: total_price از دیتابیس، سپس قیمت از notes
            if (selectedOrder.total_price) return selectedOrder.total_price;
            try {
              const notes = typeof selectedOrder.notes === 'string' ? JSON.parse(selectedOrder.notes) : selectedOrder.notes;
              return notes?.estimated_price || notes?.estimatedPrice || 0;
            } catch { return 0; }
          })()}
          onRenewalComplete={fetchOrders}
        />
      )}
    </div>
  );
}
