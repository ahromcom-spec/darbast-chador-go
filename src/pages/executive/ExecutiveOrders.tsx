import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, Clock, Search, MapPin, Phone, User, AlertCircle, Edit, Ruler, FileText, Banknote, Wrench, ArrowLeftRight, Users, Archive, RefreshCw, PackageOpen, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { formatPersianDateTimeFull, formatPersianDate } from '@/lib/dateUtils';
import { setOrderScheduleSchema, sendNotificationSchema } from '@/lib/rpcValidation';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { parseOrderNotes } from '@/components/orders/OrderDetailsView';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { buildOrderSmsAddress, sendOrderSms } from '@/lib/orderSms';
import { sendPushNotification, sendNotificationRpc } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { CollectionRequestDialog } from '@/components/orders/CollectionRequestDialog';
import { MultiPaymentDialog } from '@/components/orders/MultiPaymentDialog';
import { OrderLocationEditor } from '@/components/locations/OrderLocationEditor';
import { RentalStartDatePicker } from '@/components/orders/RentalStartDatePicker';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';

// مراحل اجرایی سفارش - key برای UI، statusMapping برای status در دیتابیس، executionStageMapping برای execution_stage
// IMPORTANT: pending_execution باید به status = 'pending_execution' در دیتابیس مپ شود
const executionStages = [
  { key: 'pending', label: 'در انتظار تایید مدیران', statusMapping: 'pending', executionStageMapping: null },
  { key: 'pending_execution', label: 'در انتظار اجرا', statusMapping: 'pending_execution', executionStageMapping: null },
  { key: 'in_progress', label: 'در حال اجرا', statusMapping: 'in_progress', executionStageMapping: null },
  { key: 'order_executed', label: 'اجرا شد', statusMapping: 'in_progress', executionStageMapping: 'order_executed' },
  { key: 'awaiting_payment', label: 'در انتظار پرداخت', statusMapping: 'completed', executionStageMapping: 'awaiting_payment' },
  { key: 'awaiting_collection', label: 'در انتظار جمع‌آوری', statusMapping: 'completed', executionStageMapping: 'awaiting_collection' },
  { key: 'in_collection', label: 'در حال جمع‌آوری', statusMapping: 'completed', executionStageMapping: 'in_collection' },
  { key: 'collected', label: 'جمع‌آوری شد', statusMapping: 'completed', executionStageMapping: 'collected' },
  { key: 'closed', label: 'اتمام سفارش', statusMapping: 'closed', executionStageMapping: null },
];

// Map DB execution_stage -> UI select key
const executionStageToUiKey: Record<string, string> = {
  order_executed: 'order_executed',
  awaiting_payment: 'awaiting_payment',
  awaiting_collection: 'awaiting_collection',
  in_collection: 'in_collection',
  collected: 'collected',
};

const SUBCATEGORY_SCAFFOLD_EXECUTION_WITH_MATERIALS = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d';

const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'داربست حجمی کفراژ',
  ceiling: 'داربست زیربتن سقف',
  column: 'داربست ستونی',
  pipe_length: 'داربست به طول لوله مصرفی',
};

function getOrderServiceLabel(notesObj: any): string | null {
  const raw =
    notesObj?.service_type ??
    notesObj?.serviceType ??
    notesObj?.scaffoldingType ??
    notesObj?.scaffold_type;

  if (!raw) return null;
  if (typeof raw === 'string') return scaffoldingTypeLabels[raw] ?? raw;
  return null;
}

// Component to display order technical details with edit capability
const OrderDetailsContent = ({ order, getStatusBadge, onUpdate, hidePrice = false, hideDetails = false }: { order: Order; getStatusBadge: (status: string) => JSX.Element; onUpdate?: () => void; hidePrice?: boolean; hideDetails?: boolean }) => {
  return (
    <div className="space-y-4">
      {/* Use editable component for details */}
      <EditableOrderDetails order={order} onUpdate={onUpdate} hidePrice={hidePrice} hideDetails={hideDetails} />
      
      {/* Additional execution-specific info */}
      {order.execution_start_date && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">تاریخ شروع اجرا</Label>
            <p className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              {formatPersianDateTimeFull(order.execution_start_date)}
            </p>
          </div>
        </>
      )}

      {/* Completion Confirmations */}
      {(order.customer_completion_date || order.executive_completion_date) && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">تاییدات اتمام کار</Label>
            {order.customer_completion_date && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>تایید مشتری: {formatPersianDate(order.customer_completion_date, { showDayOfWeek: true })}</span>
              </div>
            )}
            {order.executive_completion_date && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>تایید مدیر اجرایی: {formatPersianDate(order.executive_completion_date, { showDayOfWeek: true })}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  execution_start_date: string | null;
  execution_end_date: string | null;
  execution_stage?: string | null;
  execution_stage_updated_at?: string | null;
  customer_completion_date: string | null;
  executive_completion_date: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  hierarchy_project_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_confirmed_by_customer?: boolean;
  location_confirmed_at?: string | null;
  notes?: string | null;
  payment_amount?: number | null;
  total_price?: number | null;
  total_paid?: number | null;
  customer_id?: string;
  executed_by?: string | null;
  approved_by?: string | null;
  subcategory_id?: string | null;
  rental_start_date?: string | null;
  // نوع خدمات و زیرشاخه
  service_type_name?: string | null;
  subcategory_name?: string | null;
  subcategory_code?: string | null;
  collection_request?: {
    requested_date: string | null;
    status: string;
    created_at: string;
  } | null;
}

export default function ExecutiveOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [executionDate, setExecutionDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditScheduleDialog, setShowEditScheduleDialog] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  // Archive states
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkArchiving, setBulkArchiving] = useState(false);
  // Stage change confirmation
  const [stageChangeConfirmOpen, setStageChangeConfirmOpen] = useState(false);
  const [pendingStageChange, setPendingStageChange] = useState<{ orderId: string; newStage: string } | null>(null);
  // Cash payment confirmation
  const [cashPaymentDialogOpen, setCashPaymentDialogOpen] = useState(false);
  // Collection request dialog
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  // Auto-open order from URL param
  const urlOrderId = searchParams.get('orderId');
  
  // Check if this is the "scaffold execution with materials" module (code 101010)
  const activeModuleKey = searchParams.get('moduleKey') || '';
  // Also check moduleName for custom copies of the module
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');

  // آیا این ماژول مربوط به «اجرای داربست به همراه اجناس (101010)» است؟
  const isExecutionWithMaterialsModule =
    activeModuleKey === 'scaffold_execution_with_materials' ||
    activeModuleKey.includes('scaffold_execution_with_materials') ||
    moduleName.includes('101010') ||
    (moduleName.includes('اجرای داربست') && moduleName.includes('به همراه اجناس'));

  // ماژول مدیریت اجرایی - بدون دسترسی به قیمت و تایید
  const isExecutiveModule = moduleName.includes('مدیریت اجرایی') && !moduleName.includes('مدیریت کل');

  // ماژول مدیریت کلی - با دسترسی کامل به قیمت و تایید
  // اگر moduleKey مربوط به scaffold_execution_with_materials باشد یا نام ماژول شامل "مدیریت کل" باشد
  // یا اگر بدون moduleKey و در صفحه /executive/all-orders هستیم (دسترسی از سایدبار)
  const isGeneralManagerModule = 
    activeModuleKey === 'scaffold_execution_with_materials' ||
    activeModuleKey.includes('scaffold_execution') ||
    moduleName.includes('مدیریت کلی') || 
    moduleName.includes('مدیریت کل') ||
    // اگر moduleKey خالی باشد و در صفحات executive هستیم، فرض کنیم مدیر کل است
    (!activeModuleKey && window.location.pathname.includes('/executive/'));

  // Check if this is an accounting module - hide order details, only show financial info
  const isAccountingModule = activeModuleKey.includes('حسابداری') ||
                              activeModuleKey === 'comprehensive_accounting' ||
                              activeModuleKey.includes('accounting');

  // ماژول مدیریت کرایه اجناس داربست - فقط سفارشات با subcategory_code = '30'
  // اگر ماژول "مدیریت کلی" باشد، نباید فیلتر شود و همه سفارشات نمایش داده شوند
  const isRentalItemsModule = 
    !moduleName.includes('مدیریت کلی') && 
    !moduleName.includes('مدیریت کل') &&
    (moduleName.includes('کرایه اجناس داربست') ||
     moduleName.includes('کرایه اجناس'));

  useEffect(() => {
    fetchOrders();
  }, []);

  // Auto-open order details when orderId is in URL and orders are loaded
  useEffect(() => {
    if (urlOrderId && orders.length > 0 && !loading) {
      const order = orders.find(o => o.id === urlOrderId);
      if (order) {
        setSelectedOrder(order);
        setShowDetailsDialog(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [urlOrderId, orders, loading]);

  useEffect(() => {
    let filtered = orders;

    // فیلتر ماژول کرایه اجناس داربست - فقط سفارشات با کد زیرشاخه 30
    if (isRentalItemsModule) {
      filtered = filtered.filter(order => order.subcategory_code === '30');
    }

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        // شامل approved و pending_execution
        filtered = filtered.filter(order => order.status === 'approved' || order.status === 'pending_execution');
      } else {
        filtered = filtered.filter(order => order.status === statusFilter);
      }
    }

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.includes(term) ||
        order.address.toLowerCase().includes(term)
      );
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, orders, isRentalItemsModule]);

  const fetchOrders = async () => {
    try {
      // 1) Read raw orders without deep nested joins (FKs may be missing)
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          detailed_address,
          execution_start_date,
          execution_end_date,
          execution_stage,
          execution_stage_updated_at,
          customer_completion_date,
          executive_completion_date,
          created_at,
          customer_id,
          hierarchy_project_id,
          notes,
          payment_amount,
          total_price,
          total_paid,
          executed_by,
          approved_by,
          subcategory_id,
          location_lat,
          location_lng,
          location_confirmed_by_customer,
          location_confirmed_at,
          rental_start_date,
          subcategories (
            name,
            code,
            service_types_v3 (
              name
            )
          )
        `)
        .in('status', ['pending', 'approved', 'pending_execution', 'in_progress', 'completed', 'paid', 'closed', 'rejected'])
        // فقط سفارشات غیر بایگانی را نمایش بده
        .or('is_archived.is.null,is_archived.eq.false')
        .order('code', { ascending: false });

      if (error) throw error;

      // 2) Enrich each order with customer profile safely
      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          let customerName = 'نامشخص';
          let customerPhone = '';

          if (order.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('user_id')
              .eq('id', order.customer_id)
              .maybeSingle();

            const userId = customerData?.user_id;
            if (userId) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, phone_number')
                .eq('user_id', userId)
                .maybeSingle();

              customerName = profileData?.full_name || 'نامشخص';
              customerPhone = profileData?.phone_number || '';
            }
          }

          // Fetch location data - use order's direct lat/lng or from hierarchy
          let projectLat = order.location_lat;
          let projectLng = order.location_lng;

          if (!projectLat && !projectLng && order.hierarchy_project_id) {
            const { data: hierarchyData } = await supabase
              .from('projects_hierarchy')
              .select(`
                locations (
                  lat,
                  lng
                )
              `)
              .eq('id', order.hierarchy_project_id)
              .maybeSingle();

            if (hierarchyData?.locations) {
              projectLat = hierarchyData.locations.lat;
              projectLng = hierarchyData.locations.lng;
            }
          }

          // Fetch collection request data
          const { data: collectionRequestData } = await supabase
            .from('collection_requests')
            .select('requested_date, status, created_at')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // دریافت نام نوع خدمات و زیرشاخه
          const serviceTypeName = order.subcategories?.service_types_v3?.name || null;
          const subcategoryName = order.subcategories?.name || null;
          const subcategoryCode = order.subcategories?.code || null;

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            execution_start_date: order.execution_start_date,
            execution_end_date: order.execution_end_date,
            execution_stage: order.execution_stage,
            execution_stage_updated_at: order.execution_stage_updated_at,
            customer_completion_date: order.customer_completion_date,
            executive_completion_date: order.executive_completion_date,
            created_at: order.created_at,
            customer_name: customerName,
            customer_phone: customerPhone,
            hierarchy_project_id: order.hierarchy_project_id,
            location_lat: projectLat,
            location_lng: projectLng,
            location_confirmed_by_customer: order.location_confirmed_by_customer,
            location_confirmed_at: order.location_confirmed_at,
            notes: order.notes,
            payment_amount: order.payment_amount,
            total_price: order.total_price,
            total_paid: order.total_paid,
            customer_id: order.customer_id,
            executed_by: order.executed_by,
            approved_by: order.approved_by,
            subcategory_id: order.subcategory_id,
            rental_start_date: order.rental_start_date,
            service_type_name: serviceTypeName,
            subcategory_name: subcategoryName,
            subcategory_code: subcategoryCode,
            collection_request: collectionRequestData || null,
          } as Order;
        })
      );

      setOrders(ordersWithCustomer);
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
  const handleSetExecutionDate = async () => {
    if (!selectedOrder || !executionDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا تاریخ اجرا را وارد کنید'
      });
      return;
    }

    try {
      // Validate RPC parameters
      const validated = setOrderScheduleSchema.parse({
        _order_id: selectedOrder.id,
        _execution_start_date: new Date(executionDate).toISOString()
      });

      // Use the new RPC function for scheduling
      const { error } = await supabase.rpc('set_order_schedule', validated as { _order_id: string; _execution_start_date: string });

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان اجرا ثبت و سفارش زمان‌بندی شد'
      });

      setSelectedOrder(null);
      setExecutionDate('');
      setShowExecutionDialog(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error setting execution date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: error.message || 'ثبت زمان اجرا با خطا مواجه شد'
      });
    }
  };

  const handleStartExecution = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'in_progress',
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال پیامک به مشتری (در پس‌زمینه)
      const order = orders.find(o => o.id === orderId);
      if (order?.customer_phone) {
        sendOrderSms(order.customer_phone, order.code, 'in_progress', {
          orderId: order.id,
          address: buildOrderSmsAddress(order.address, order.detailed_address),
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '✓ موفق',
        description: 'سفارش به مرحله در حال اجرا منتقل شد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error starting execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'شروع اجرا با خطا مواجه شد'
      });
    }
  };

  const handleRentalStartDateUpdate = async (orderId: string, date: string | null, orderCode: string) => {
    // Optimistic update - بروزرسانی فوری محلی
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, rental_start_date: date } 
        : order
    ));

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
    } catch (error) {
      console.error('Error updating rental start date:', error);
      // Revert on error
      fetchOrders();
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ثبت تاریخ شروع کرایه'
      });
    }
  };

  const handleCompleteExecution = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'completed',
          executive_completion_date: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال پیامک به مشتری (در پس‌زمینه)
      const order = orders.find(o => o.id === orderId);
      if (order?.customer_phone) {
        sendOrderSms(order.customer_phone, order.code, 'executed', {
          orderId: order.id,
          address: buildOrderSmsAddress(order.address, order.detailed_address),
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '✓ موفق',
        description: 'خدمات شما اجرا شده و در انتظار پرداخت می‌باشد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'تایید اجرا با خطا مواجه شد'
      });
    }
  };

  // علامت زدن سفارش به عنوان اجرا شده
  const handleMarkAsExecuted = async (orderId: string, orderCode: string) => {
    try {
      // دریافت اطلاعات مشتری
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_stage: 'order_executed',
          execution_stage_updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال اعلان به مشتری
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
          await sendNotificationRpc(customerData.user_id, '✅ سفارش اجرا شد', `سفارش شما با کد ${orderCode} با موفقیت اجرا شد.`, `/user/orders/${orderId}`, 'success');
          
          // ارسال Push Notification به گوشی کاربر
          await sendPushNotification({
            user_id: customerData.user_id,
            title: '✅ سفارش اجرا شد',
            body: `سفارش شما با کد ${orderCode} با موفقیت اجرا شد.`,
            link: `/user/orders/${orderId}`,
            type: 'order-stage'
          });
        }
      }

      toast({
        title: '✓ اجرا شد',
        description: `سفارش ${orderCode} با موفقیت اجرا شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error marking as executed:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ثبت اجرای سفارش'
      });
    }
  };

  // تغییر مرحله سفارش به هر مرحله دلخواه
  const handleStageChange = async (orderId: string, newStage: string) => {
    const stage = executionStages.find(s => s.key === newStage);
    if (!stage) return;

    try {
      // دریافت اطلاعات سفارش برای ارسال اعلان
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id, code, notes, payment_amount, subcategory_id')
        .eq('id', orderId)
        .single();

      // جلوگیری از تایید سفارش «درخواست قیمت کارشناسی» قبل از ثبت و تایید قیمت
      if (newStage === 'pending_execution') {
        const notesObj =
          (orderData as any)?.notes && typeof (orderData as any).notes === 'object'
            ? (orderData as any).notes
            : parseOrderNotes(((orderData as any)?.notes ?? null) as any);

        const isExpertPricingRequest = notesObj?.is_expert_pricing_request === true;
        if (isExpertPricingRequest) {
          const priceSetByManager = notesObj?.price_set_by_manager === true;
          const amountRaw = (orderData as any)?.payment_amount ?? notesObj?.manager_set_price;
          const amountNumber = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
          const hasPaymentAmount = Number.isFinite(amountNumber) && amountNumber > 0;
          const customerPriceConfirmed = notesObj?.customer_price_confirmed === true;

          const canApprove = priceSetByManager && hasPaymentAmount && customerPriceConfirmed;
          if (!canApprove) {
            toast({
              variant: 'destructive',
              title: 'امکان تایید سفارش نیست',
              description:
                'این سفارش «درخواست قیمت کارشناسی» است؛ ابتدا قیمت را ثبت کنید و پس از تایید مشتری، تایید سفارش فعال می‌شود.'
            });
            return;
          }
        }
      }

      // به‌روزرسانی status و execution_stage با مقادیر صحیح
      const updateData: Record<string, any> = {
        execution_stage_updated_at: new Date().toISOString(),
        status: stage.statusMapping
      };

      // دریافت اطلاعات کاربر جاری برای ثبت approved_by
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      // تنظیم فیلدها بر اساس مرحله جدید - برای برگشت به عقب هم کار کند
      if (newStage === 'pending') {
        // بازگشت به انتظار تایید - ریست همه فیلدها
        updateData.approved_at = null;
        updateData.approved_by = null;
        updateData.execution_stage = null;
        updateData.execution_start_date = null;
        updateData.execution_end_date = null;
        updateData.execution_confirmed_at = null;
        updateData.closed_at = null;
      } else if (newStage === 'pending_execution') {
        // تایید سفارش و انتقال به انتظار اجرا
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = currentUserId;
        updateData.execution_stage = null;
        updateData.execution_confirmed_at = null;
        updateData.closed_at = null;
        
        // ثبت تایید در جدول order_approvals برای مدیر کل اجرای داربست به همراه اجناس
        // بررسی اینکه آیا سفارش مربوط به این زیردسته هست
        const isExecutionWithMaterials = orderData?.subcategory_id === SUBCATEGORY_SCAFFOLD_EXECUTION_WITH_MATERIALS;
        if (isExecutionWithMaterials && currentUserId) {
          // ثبت تایید در جدول order_approvals
          await supabase
            .from('order_approvals')
            .update({
              approver_user_id: currentUserId,
              approved_at: new Date().toISOString()
            })
            .eq('order_id', orderId)
            .eq('approver_role', 'executive_manager_scaffold_execution_with_materials');
        }
        
        // کپی قیمت از notes.estimated_price به payment_amount و total_price اگر خالی هستند
        const notesObj = orderData?.notes && typeof orderData.notes === 'object'
          ? orderData.notes as any
          : parseOrderNotes(orderData?.notes as any);
        const estimatedPrice = notesObj?.estimated_price || notesObj?.total_price || notesObj?.manager_set_price;
        if (estimatedPrice && estimatedPrice > 0 && (!orderData?.payment_amount || orderData.payment_amount === 0)) {
          updateData.payment_amount = estimatedPrice;
          updateData.total_price = estimatedPrice;
        }
      } else if (newStage === 'in_progress') {
        // شروع اجرا
        if (!updateData.approved_at) {
          updateData.approved_at = new Date().toISOString();
          updateData.approved_by = currentUserId;
        }
        updateData.execution_confirmed_at = new Date().toISOString();
        updateData.execution_stage = null;
        updateData.closed_at = null;
      } else if (stage.executionStageMapping) {
        // مراحل اجرایی - تنظیم execution_stage
        updateData.execution_stage = stage.executionStageMapping;
        // ریست closed_at اگر به عقب برگشتیم
        if (newStage !== 'closed') {
          updateData.closed_at = null;
        }
      }

      // اگر به مرحله closed رسید، closed_at را هم ثبت کن
      if (newStage === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.execution_stage = null;
        updateData.executive_completion_date = new Date().toISOString();
      }

      const { data: updatedRows, error } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', orderId)
        .select('id,status,execution_stage,execution_stage_updated_at,approved_by,execution_start_date,execution_end_date,customer_completion_date,executive_completion_date');

      if (error) {
        console.error('RLS/DB error updating stage:', error);
        throw error;
      }

      // اگر RLS اجازه آپدیت ندهد ممکن است هیچ ردیفی آپدیت نشود ولی error هم برنگردد
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('امکان تغییر مرحله این سفارش وجود ندارد (دسترسی یا وضعیت سفارش).');
      }

      // به‌روزرسانی سریع UI
      const updated = updatedRows[0];
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));

      // ارسال اعلان به مشتری
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          const stageMessages: Record<string, { title: string; body: string }> = {
            pending: {
              title: '⏳ سفارش در انتظار تایید',
              body: `سفارش ${orderData.code} به مرحله انتظار تایید بازگشت.`
            },
            pending_execution: {
              title: '✅ سفارش در انتظار اجرا',
              body: `سفارش ${orderData.code} در مرحله انتظار اجرا قرار گرفت.`
            },
            in_progress: {
              title: '🚧 سفارش در حال اجرا',
              body: `سفارش ${orderData.code} وارد مرحله اجرا شد.`
            },
            order_executed: {
              title: '✅ سفارش اجرا شد',
              body: `سفارش ${orderData.code} با موفقیت اجرا شد.`
            },
            awaiting_payment: {
              title: '💳 در انتظار پرداخت',
              body: `سفارش ${orderData.code} اجرا شده و در انتظار پرداخت می‌باشد.`
            },
            awaiting_collection: {
              title: '📦 سفارش در انتظار جمع‌آوری',
              body: `اجرای سفارش ${orderData.code} تکمیل شد. لطفاً تاریخ فک داربست را تعیین کنید.`
            },
            in_collection: {
              title: '🔧 داربست در حال جمع‌آوری',
              body: `جمع‌آوری داربست سفارش ${orderData.code} آغاز شده است.`
            },
            collected: {
              title: '✓ داربست جمع‌آوری شد',
              body: `جمع‌آوری داربست سفارش ${orderData.code} تکمیل شد.`
            },
            closed: {
              title: '🎉 سفارش تکمیل شد',
              body: `سفارش ${orderData.code} با موفقیت به اتمام رسید.`
            }
          };

          const message = stageMessages[newStage];
          if (message) {
            try {
              // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
              await sendNotificationRpc(customerData.user_id, message.title, message.body, `/user/orders/${orderId}`, 'info');
              
              // ارسال Push Notification به گوشی کاربر
              await sendPushNotification({
                user_id: customerData.user_id,
                title: message.title,
                body: message.body,
                link: `/user/orders/${orderId}`,
                type: 'order-stage'
              });
              
              // ارسال SMS برای مراحل کلیدی (اجرا شد و اتمام سفارش)
              if (newStage === 'order_executed' || newStage === 'closed') {
                // دریافت شماره مشتری
                const { data: customerProfile } = await supabase
                  .from('profiles')
                  .select('phone_number')
                  .eq('user_id', customerData.user_id)
                  .single();
                
                if (customerProfile?.phone_number) {
                  const smsStatus = newStage === 'closed' ? 'completed' : 'executed';
                  const order = orders.find(o => o.id === orderId);
                  sendOrderSms(customerProfile.phone_number, orderData.code || '', smsStatus, {
                    orderId: orderId,
                    address: buildOrderSmsAddress(order?.address, order?.detailed_address),
                  }).catch(err => {
                    console.error('SMS notification error:', err);
                  });
                }
              }
            } catch (notifError) {
              console.error('Error sending notification:', notifError);
            }
          }
        }
      }

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `سفارش به مرحله "${stage.label}" منتقل شد و به مشتری اطلاع داده شد.`
      });

      // استیت قبلاً به‌روزرسانی شده - نیازی به fetchOrders نیست
    } catch (error: any) {
      console.error('Error changing stage:', error);
      toast({
        variant: 'destructive',
        title: 'خطا در تغییر مرحله',
        description: error.message || 'خطا در تغییر مرحله سفارش. ممکن است دسترسی لازم را نداشته باشید.'
      });
    }
  };

  const handleSetExecutiveCompletion = async () => {
    if (!selectedOrder || !completionDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا تاریخ اتمام را وارد کنید'
      });
      return;
    }

    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          execution_stage: null,
          execution_stage_updated_at: new Date().toISOString(),
          executive_completion_date: new Date(completionDate).toISOString(),
          financial_confirmed_by: auth.user?.id,
          financial_confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // ارسال پیامک به مشتری (در پس‌زمینه)
      if (selectedOrder.customer_phone) {
        sendOrderSms(selectedOrder.customer_phone, selectedOrder.code, 'completed', {
          orderId: selectedOrder.id,
          address: buildOrderSmsAddress(selectedOrder.address, selectedOrder.detailed_address),
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '✓ موفق',
        description: 'سفارش با موفقیت به اتمام رسید و بسته شد'
      });

      setSelectedOrder(null);
      setCompletionDate('');
      setShowCompletionDialog(false);
      fetchOrders();
    } catch (error) {
      console.error('Error setting completion date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'ثبت تاریخ اتمام با خطا مواجه شد'
      });
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedOrder || !editStartDate || !editEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً هر دو تاریخ شروع و پایان را مشخص کنید'
      });
      return;
    }

    if (new Date(editEndDate) <= new Date(editStartDate)) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'زمان پایان باید بعد از زمان شروع باشد'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: editStartDate,
          execution_end_date: editEndDate
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان‌بندی اجرا با موفقیت به‌روزرسانی شد'
      });

      setSelectedOrder(null);
      setEditStartDate('');
      setEditEndDate('');
      setShowEditScheduleDialog(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'به‌روزرسانی زمان‌بندی با خطا مواجه شد'
      });
    }
  };

  // نمایش وضعیت سفارش بر اساس status و execution_stage
  const getOrderStageLabel = (order: Order): { label: string; className: string } => {
    // ابتدا بررسی execution_stage
    if (order.execution_stage) {
      const stageLabels: Record<string, { label: string; className: string }> = {
        order_executed: { label: 'اجرا شد', className: 'bg-emerald-500/10 text-emerald-600' },
        awaiting_payment: { label: 'در انتظار پرداخت', className: 'bg-orange-500/10 text-orange-600' },
        awaiting_collection: { label: 'در انتظار جمع‌آوری', className: 'bg-purple-500/10 text-purple-600' },
        in_collection: { label: 'در حال جمع‌آوری', className: 'bg-indigo-500/10 text-indigo-600' },
        collected: { label: 'جمع‌آوری شد', className: 'bg-teal-500/10 text-teal-600' },
      };
      if (stageLabels[order.execution_stage]) {
        return stageLabels[order.execution_stage];
      }
    }

    // سپس بررسی status
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: 'در انتظار تایید مدیران', className: 'bg-amber-500/10 text-amber-600' },
      pending_execution: { label: 'در انتظار اجرا', className: 'bg-yellow-500/10 text-yellow-600' },
      approved: { label: 'آماده اجرا', className: 'bg-yellow-500/10 text-yellow-600' },
      in_progress: { label: 'در حال اجرا', className: 'bg-blue-500/10 text-blue-600' },
      completed: { label: 'اتمام سفارش', className: 'bg-teal-500/10 text-teal-600' },
      closed: { label: 'بسته شده', className: 'bg-gray-500/10 text-gray-600' },
      rejected: { label: 'رد شده', className: 'bg-red-500/10 text-red-600' }
    };

    return statusMap[order.status] || { label: order.status, className: '' };
  };

  const getStatusBadge = (status: string, order?: Order) => {
    if (order) {
      const { label, className } = getOrderStageLabel(order);
      return <Badge className={className}>{label}</Badge>;
    }
    
    // Fallback برای استفاده‌های قدیمی بدون order
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: 'در انتظار تایید مدیران', className: 'bg-amber-500/10 text-amber-600' },
      pending_execution: { label: 'در انتظار اجرا', className: 'bg-yellow-500/10 text-yellow-600' },
      approved: { label: 'آماده اجرا', className: 'bg-yellow-500/10 text-yellow-600' },
      in_progress: { label: 'در حال اجرا', className: 'bg-blue-500/10 text-blue-600' },
      completed: { label: 'اتمام سفارش', className: 'bg-teal-500/10 text-teal-600' },
      closed: { label: 'بسته شده', className: 'bg-gray-500/10 text-gray-600' },
      rejected: { label: 'رد شده', className: 'bg-red-500/10 text-red-600' }
    };

    const { label, className } = statusMap[status] || { label: status, className: '' };
    return <Badge className={className}>{label}</Badge>;
  };

  // Archive functions
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

  const handleArchiveOrder = async () => {
    if (!selectedOrder || !user) return;

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: 'سفارش بایگانی شد',
        description: `سفارش ${selectedOrder.code} به بایگانی منتقل شد.`
      });

      setArchiveDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Error archiving order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارش'
      });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedOrderIds.size === 0 || !user) return;

    setBulkArchiving(true);
    try {
      const orderIdsArray = Array.from(selectedOrderIds);
      
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .in('id', orderIdsArray);

      if (error) throw error;

      toast({
        title: 'سفارشات بایگانی شدند',
        description: `${selectedOrderIds.size} سفارش به بایگانی منتقل شد.`
      });

      setBulkArchiveDialogOpen(false);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (error) {
      console.error('Error bulk archiving orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارشات'
      });
    } finally {
      setBulkArchiving(false);
    }
  };

  // رد سفارش توسط مدیر کل
  const handleRejectOrder = async () => {
    if (!selectedOrder || !user) return;

    if (!rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً دلیل رد سفارش را وارد کنید'
      });
      return;
    }

    try {
      // ذخیره دلیل رد در notes
      const currentNotesStr = selectedOrder.notes;
      let currentNotes: Record<string, any> = {};
      if (currentNotesStr) {
        try {
          if (typeof currentNotesStr === 'string') {
            currentNotes = JSON.parse(currentNotesStr);
          } else if (typeof currentNotesStr === 'object') {
            currentNotes = currentNotesStr as Record<string, any>;
          }
        } catch {
          currentNotes = {};
        }
      }
      const updatedNotes = {
        ...currentNotes,
        rejection_reason: rejectionReason,
        rejected_at: new Date().toISOString(),
        rejected_by: user.id
      };

      // به‌روزرسانی وضعیت سفارش به rejected و ذخیره دلیل رد
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          status: 'rejected',
          notes: JSON.stringify(updatedNotes) as any
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // ارسال اعلان به مشتری
      if (selectedOrder.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', selectedOrder.customer_id)
          .single();

        if (customerData?.user_id) {
          try {
            // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
            await sendNotificationRpc(customerData.user_id, '❌ سفارش رد شد', `سفارش ${selectedOrder.code} رد شد. دلیل: ${rejectionReason}`, `/user/orders/${selectedOrder.id}`, 'error');

            // ارسال Push Notification
            await sendPushNotification({
              user_id: customerData.user_id,
              title: '❌ سفارش رد شد',
              body: `سفارش ${selectedOrder.code} رد شد. دلیل: ${rejectionReason}`,
              link: `/user/orders/${selectedOrder.id}`,
              type: 'order-rejected'
            });
          } catch (notifError) {
            console.error('Error sending rejection notification:', notifError);
          }
        }
      }

      toast({
        title: 'سفارش رد شد',
        description: `سفارش ${selectedOrder.code} رد شد و به مشتری اطلاع داده شد.`
      });

      setRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'رد سفارش با خطا مواجه شد'
      });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت سفارشات اجرا"
        description={`${orders.length} سفارش • ${filteredOrders.length} نمایش داده شده`}
        showBackButton={true}
        backTo="/executive"
      />

      {/* Filters and Search */}
      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس کد سفارش، نام مشتری، شماره تلفن یا آدرس..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                همه ({orders.length})
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
              >
                تایید شده ({orders.filter(o => o.status === 'approved' || o.status === 'pending_execution').length})
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                اتمام ({orders.filter(o => o.status === 'completed' || o.status === 'closed').length})
              </Button>
              <Button
                variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('in_progress')}
              >
                در حال اجرا ({orders.filter(o => o.status === 'in_progress').length})
              </Button>
              <Button
                variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('rejected')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                رد شده ({orders.filter(o => o.status === 'rejected').length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Action Bar */}
      {filteredOrders.length > 0 && (
        <Card className="sticky top-0 z-10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedOrderIds.size > 0 
                    ? `${selectedOrderIds.size} سفارش انتخاب شده`
                    : 'انتخاب همه'}
                </span>
              </div>
              
              {selectedOrderIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkArchiveDialogOpen(true)}
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" />
                  بایگانی {selectedOrderIds.size} سفارش
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>{searchTerm || statusFilter !== 'all' ? 'سفارشی با این فیلترها یافت نشد' : 'سفارشی برای اجرا وجود ندارد'}</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => {
            const isSelected = selectedOrderIds.has(order.id);

            const notesObj =
              (order as any)?.notes && typeof (order as any).notes === 'object'
                ? (order as any).notes
                : parseOrderNotes((order as any)?.notes ?? null);

            const isExpertPricingRequest = notesObj?.is_expert_pricing_request === true;
            const priceSetByManager = notesObj?.price_set_by_manager === true;
            const amountRaw = (order as any)?.payment_amount ?? notesObj?.manager_set_price;
            const amountNumber = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
            const hasPaymentAmount = Number.isFinite(amountNumber) && amountNumber > 0;
            const customerPriceConfirmed = notesObj?.customer_price_confirmed === true;

            // برای درخواست کارشناسی: فقط وقتی قیمت ثبت شده و مشتری تایید کرده باشد، اجازه تایید سفارش بده
            const canApprove = !isExpertPricingRequest || (priceSetByManager && hasPaymentAmount && customerPriceConfirmed);

            const serviceLabel = getOrderServiceLabel(notesObj);
            const isExecutionWithMaterialsOrder = order.subcategory_id === SUBCATEGORY_SCAFFOLD_EXECUTION_WITH_MATERIALS;

            // امکان تایید سفارش - فقط برای pending
            const canManageInitialApproval =
              order.status === 'pending' &&
              ((isGeneralManagerModule && !isExecutiveModule) ||
                (isExecutiveModule && isExecutionWithMaterialsModule && isExecutionWithMaterialsOrder));

            // امکان رد/لغو سفارش - تا قبل از اجرا شدن (order_executed)
            // شامل: pending, pending_execution, in_progress (بدون execution_stage)
            const orderNotYetExecuted = 
              order.status === 'pending' ||
              order.status === 'pending_execution' ||
              (order.status === 'in_progress' && !order.execution_stage);

            const canRejectOrder =
              orderNotYetExecuted &&
              ((isGeneralManagerModule && !isExecutiveModule) ||
                (isExecutiveModule && isExecutionWithMaterialsModule && isExecutionWithMaterialsOrder));

            return (

            <Card key={order.id} className={`hover:shadow-lg transition-shadow duration-300 ease-in-out ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''} ${
              order.status === 'rejected' ? 'border-l-4 border-l-red-500' :
              (order.status === 'approved' || order.status === 'pending_execution') ? 'border-l-4 border-l-yellow-500' :
              order.status === 'in_progress' ? 'border-l-4 border-l-blue-500' :
              order.status === 'completed' ? 'border-l-4 border-l-purple-500' :
              'border-l-4 border-l-green-500'
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setArchiveDialogOpen(true);
                      }}
                      className="gap-1 text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2">
                    {/* نوع خدمات و زیرشاخه در بالای کارت */}
                    {(order.service_type_name || order.subcategory_name) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.service_type_name && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                            {order.service_type_name}
                          </Badge>
                        )}
                        {order.subcategory_name && (
                          <Badge variant="outline" className="text-xs border-amber-400/50 text-amber-700 dark:text-amber-400">
                            {order.subcategory_name}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      {getStatusBadge(order.status, order)}
                      {serviceLabel && (
                        <Badge variant="outline" className="text-xs">
                          {serviceLabel}
                        </Badge>
                      )}
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
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="space-y-0.5">
                          <div className="line-clamp-1">{order.address}</div>
                          {order.location_lat && order.location_lng && (
                            <div className="text-xs opacity-70">
                              موقعیت: {order.location_lat.toFixed(6)}, {order.location_lng.toFixed(6)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 transition-all duration-300 ease-in-out">
                <Separator />

                {/* دکمه‌های مدیریتی - جزئیات، انتقال، افزودن پرسنل */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowDetailsDialog(true);
                    }}
                    className="gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    جزئیات کامل
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setTransferDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    انتقال
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setCollaboratorDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    افزودن پرسنل
                  </Button>
                </div>

                <Separator className="my-2" />
                
                {/* انتخاب مرحله سفارش */}
                <div className="flex items-center gap-3 p-3 bg-gradient-to-l from-primary/5 to-transparent rounded-lg border border-primary/20">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium whitespace-nowrap">تغییر مرحله:</Label>
                  <Select
                    value={
                      order.status === 'closed'
                        ? 'closed'
                        : order.status === 'pending'
                        ? 'pending'
                        : (order.status === 'approved' || order.status === 'pending_execution')
                        ? 'pending_execution'
                        : order.execution_stage
                        ? (executionStageToUiKey[order.execution_stage] ?? 'awaiting_collection')
                        : order.status === 'in_progress'
                        ? 'in_progress'
                        : order.status === 'completed'
                        ? 'awaiting_collection'
                        : order.status
                    }
                    disabled={false}
                    onValueChange={(value) => {
                      setPendingStageChange({ orderId: order.id, newStage: value });
                      setStageChangeConfirmOpen(true);
                    }}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="انتخاب مرحله" />
                    </SelectTrigger>
                    <SelectContent>
                      {executionStages.map((stage) => (
                        <SelectItem key={stage.key} value={stage.key}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {order.detailed_address && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">آدرس تفصیلی:</span> {order.detailed_address}
                  </div>
                )}

                {order.execution_start_date && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">زمان شروع اجرا</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setEditStartDate(order.execution_start_date || '');
                          setEditEndDate(order.execution_end_date || '');
                          setShowEditScheduleDialog(true);
                        }}
                        className="h-6 px-2 gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        ویرایش
                      </Button>
                    </div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      {formatPersianDateTimeFull(order.execution_start_date)}
                    </p>
                    {order.execution_end_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        تا: {formatPersianDateTimeFull(order.execution_end_date)}
                      </p>
                    )}
                  </div>
                )}

                {/* نمایش تاریخ شروع کرایه داربست - فقط برای مراحل بعد از اجرا */}
                {(order.execution_stage === 'order_executed' || 
                  order.execution_stage === 'awaiting_payment' || 
                  order.execution_stage === 'awaiting_collection' || 
                  order.execution_stage === 'in_collection' || 
                  order.execution_stage === 'collected' ||
                  order.status === 'completed' || 
                  order.status === 'closed') && (
                  <div className={`p-3 rounded-lg border-2 ${order.rental_start_date ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700'}`}>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Calendar className={`h-4 w-4 ${order.rental_start_date ? 'text-green-600' : 'text-amber-600'}`} />
                      <span className={`font-medium ${order.rental_start_date ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
                        تاریخ شروع کرایه داربست {order.rental_start_date ? '✓' : '(الزامی)'}
                      </span>
                    </div>
                    <RentalStartDatePicker
                      value={order.rental_start_date || undefined}
                      onChange={(date) => handleRentalStartDateUpdate(order.id, date, order.code)}
                      placeholder="انتخاب تاریخ شروع کرایه"
                    />
                    {order.rental_start_date && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        ✓ تاریخ ثبت شده: {new Date(order.rental_start_date).toLocaleDateString('fa-IR')}
                      </p>
                    )}
                  </div>
                )}

                {/* نمایش وضعیت درخواست جمع‌آوری */}
                {order.collection_request ? (
                  <div className={`p-3 rounded-lg border ${
                    order.collection_request.status === 'approved' 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : order.collection_request.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <PackageOpen className={`h-4 w-4 ${
                          order.collection_request.status === 'approved' || order.collection_request.status === 'completed'
                            ? 'text-green-600' 
                            : order.collection_request.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`} />
                        <span className={`font-medium ${
                          order.collection_request.status === 'approved' || order.collection_request.status === 'completed'
                            ? 'text-green-700 dark:text-green-300' 
                            : order.collection_request.status === 'rejected'
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-orange-700 dark:text-orange-300'
                        }`}>
                          {order.collection_request.status === 'approved' 
                            ? 'درخواست جمع‌آوری تایید شده' 
                            : order.collection_request.status === 'completed'
                            ? 'جمع‌آوری تکمیل شده'
                            : order.collection_request.status === 'rejected'
                            ? 'درخواست جمع‌آوری رد شده'
                            : 'درخواست جمع‌آوری در انتظار تایید'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* دکمه بررسی/ویرایش تاریخ */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setCollectionDialogOpen(true);
                          }}
                          className={`gap-1 ${
                            order.collection_request.status === 'pending' 
                              ? 'text-orange-700 border-orange-300 hover:bg-orange-100' 
                              : 'text-blue-700 border-blue-300 hover:bg-blue-100'
                          }`}
                        >
                          {order.collection_request.status === 'pending' ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              تایید درخواست
                            </>
                          ) : (
                            <>
                              <Edit className="h-3 w-3" />
                              ویرایش تاریخ
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {order.collection_request.requested_date && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">تاریخ درخواستی: </span>
                        <span className="font-medium">
                          {new Date(order.collection_request.requested_date).toLocaleDateString('fa-IR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    {/* نمایش تاریخ جمع‌آوری تثبیت شده */}
                    {order.customer_completion_date && (
                      <div className="mt-2 text-sm bg-green-100 dark:bg-green-900/30 p-2 rounded">
                        <span className="text-green-700 dark:text-green-300 font-medium">✓ تاریخ جمع‌آوری تثبیت شده: </span>
                        <span className="font-bold text-green-800 dark:text-green-200">
                          {new Date(order.customer_completion_date).toLocaleDateString('fa-IR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border bg-muted/30 border-dashed">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <PackageOpen className="h-4 w-4" />
                        <span>درخواست جمع‌آوری ثبت نشده</span>
                      </div>
                      {/* دکمه فقط بعد از اجرای سفارش فعال می‌شود */}
                      {(order.execution_stage === 'order_executed' || 
                        order.execution_stage === 'awaiting_payment' || 
                        order.execution_stage === 'awaiting_collection' || 
                        order.execution_stage === 'in_collection' || 
                        order.execution_stage === 'collected' ||
                        order.status === 'completed' || 
                        order.status === 'closed') ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setCollectionDialogOpen(true);
                          }}
                          className="gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          ثبت درخواست
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">پس از اجرا فعال می‌شود</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-2">
                  {/* دکمه بایگانی - برای سفارشات رد شده */}
                  {order.status === 'rejected' && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setArchiveDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <Archive className="h-4 w-4" />
                      بایگانی
                    </Button>
                  )}

                  {/* دکمه تایید سفارش */}
                  {canManageInitialApproval && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'pending_execution')}
                      size="sm"
                      disabled={!canApprove}
                      title={!canApprove ? 'ابتدا باید قیمت ثبت شود و مشتری آن را تایید کند' : 'تایید سفارش'}
                      className={`gap-2 bg-green-600 hover:bg-green-700 ${
                        !canApprove ? 'opacity-50 cursor-not-allowed hover:bg-green-600' : ''
                      }`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      تایید سفارش
                    </Button>
                  )}

                  {/* دکمه رد سفارش - تا قبل از اجرا شدن */}
                  {canRejectOrder && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setRejectDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      لغو سفارش
                    </Button>
                  )}

                  {/* دکمه شروع اجرا - برای pending_execution */}
                  {order.status === 'pending_execution' && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'in_progress')}
                      size="sm"
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Clock className="h-4 w-4" />
                      شروع اجرا
                    </Button>
                  )}

                  {/* دکمه اجرا شد - برای سفارش‌های در حال اجرا */}
                  {order.status === 'in_progress' && !order.execution_stage && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'order_executed')}
                      size="sm"
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      اجرا شد
                    </Button>
                  )}

                  {/* دکمه در انتظار پرداخت - برای order_executed */}
                  {order.execution_stage === 'order_executed' && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'awaiting_payment')}
                      size="sm"
                      className="gap-2 bg-amber-600 hover:bg-amber-700"
                    >
                      <Banknote className="h-4 w-4" />
                      در انتظار پرداخت
                    </Button>
                  )}

                  {/* دکمه ثبت پرداخت - برای همه مراحل بعد از اجرا */}
                  {(order.execution_stage === 'order_executed' || 
                    order.execution_stage === 'awaiting_payment' || 
                    order.execution_stage === 'awaiting_collection' || 
                    order.execution_stage === 'in_collection' || 
                    order.execution_stage === 'collected' ||
                    order.status === 'closed') && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setCashPaymentDialogOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <Banknote className="h-4 w-4" />
                      ثبت پرداخت
                    </Button>
                  )}

                  {/* دکمه در انتظار جمع‌آوری - برای awaiting_payment و فقط وقتی تاریخ جمع‌آوری تنظیم شده یا درخواست تایید شده */}
                  {order.execution_stage === 'awaiting_payment' && (
                    (() => {
                      // تاریخ تثبیت شده یا درخواست جمع‌آوری تایید شده باشد
                      const hasConfirmedDate = !!order.customer_completion_date;
                      const hasApprovedRequest = order.collection_request?.status === 'approved' || order.collection_request?.status === 'completed';
                      const canProceed = hasConfirmedDate || hasApprovedRequest;
                      
                      return (
                        <Button
                          onClick={() => handleStageChange(order.id, 'awaiting_collection')}
                          size="sm"
                          disabled={!canProceed}
                          title={!canProceed ? 'ابتدا باید تاریخ جمع‌آوری تعیین شود' : 'انتقال به مرحله در انتظار جمع‌آوری'}
                          className={`gap-2 bg-orange-600 hover:bg-orange-700 ${
                            !canProceed ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Clock className="h-4 w-4" />
                          در انتظار جمع‌آوری
                        </Button>
                      );
                    })()
                  )}

                  {/* دکمه در حال جمع‌آوری - برای awaiting_collection */}
                  {order.execution_stage === 'awaiting_collection' && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'in_collection')}
                      size="sm"
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Wrench className="h-4 w-4" />
                      در حال جمع‌آوری
                    </Button>
                  )}

                  {/* دکمه جمع‌آوری شد - برای in_collection */}
                  {order.execution_stage === 'in_collection' && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'collected')}
                      size="sm"
                      className="gap-2 bg-teal-600 hover:bg-teal-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      جمع‌آوری شد
                    </Button>
                  )}

                  {/* دکمه اتمام سفارش - برای collected */}
                  {order.execution_stage === 'collected' && (
                    <Button
                      onClick={() => handleStageChange(order.id, 'closed')}
                      size="sm"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      اتمام سفارش
                    </Button>
                  )}

                  {/* دکمه درخواست جمع‌آوری - فقط بعد از اجرای سفارش فعال می‌شود */}
                  {(order.execution_stage === 'order_executed' || 
                    order.execution_stage === 'awaiting_payment' || 
                    order.execution_stage === 'awaiting_collection' || 
                    order.execution_stage === 'in_collection' || 
                    order.execution_stage === 'collected' ||
                    order.status === 'completed' || 
                    order.status === 'closed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setCollectionDialogOpen(true);
                      }}
                      className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <PackageOpen className="h-4 w-4" />
                      درخواست جمع‌آوری
                    </Button>
                  )}

                  {order.status === 'paid' && !order.executive_completion_date && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowCompletionDialog(true);
                      }}
                      size="sm"
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      تایید اتمام
                    </Button>
                  )}

                  {order.status === 'paid' && (
                    <div className="w-full mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          وضعیت تایید اتمام
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          {order.customer_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>مشتری: {order.customer_completion_date ? '✓' : 'منتظر'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.executive_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>شما: {order.executive_completion_date ? '✓' : 'منتظر'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      {/* Execution Date Dialog */}
      <Dialog open={showExecutionDialog} onOpenChange={setShowExecutionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت زمان اجرا برای سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>مشتری: {selectedOrder?.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="execution-date">تاریخ شروع اجرا</Label>
              <Input
                id="execution-date"
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowExecutionDialog(false);
                setSelectedOrder(null);
                setExecutionDate('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleSetExecutionDate} className="gap-2">
              <Clock className="h-4 w-4" />
              ثبت زمان اجرا
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Date Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تایید اتمام پروژه - سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>مشتری: {selectedOrder?.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              با ثبت تاریخ اتمام، تایید می‌کنید که پروژه به درستی انجام شده است.
            </p>
            <div>
              <Label htmlFor="completion-date">تاریخ اتمام پروژه</Label>
              <div className="mt-2">
                <PersianDatePicker
                  value={completionDate}
                  onChange={setCompletionDate}
                  placeholder="انتخاب تاریخ اتمام"
                  timeMode="none"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCompletionDialog(false);
                setSelectedOrder(null);
                setCompletionDate('');
              }}
            >
              انصراف
            </Button>
            <Button 
              onClick={handleSetExecutiveCompletion}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <CheckCircle className="h-4 w-4" />
              تایید اتمام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>اطلاعات جامع سفارش</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <>
              <OrderDetailsContent order={selectedOrder} getStatusBadge={getStatusBadge} onUpdate={fetchOrders} hidePrice={isExecutiveModule} hideDetails={isAccountingModule} />
              {/* نقشه موقعیت پروژه با امکان ویرایش - hidden for accounting module */}
              {!isAccountingModule && selectedOrder.location_lat && selectedOrder.location_lng && (
                <div className="mt-4">
                  <OrderLocationEditor
                    orderId={selectedOrder.id}
                    hierarchyProjectId={selectedOrder.hierarchy_project_id}
                    locationLat={selectedOrder.location_lat}
                    locationLng={selectedOrder.location_lng}
                    address={selectedOrder.address}
                    detailedAddress={selectedOrder.detailed_address || undefined}
                    orderStatus={selectedOrder.status}
                    locationConfirmedByCustomer={selectedOrder.location_confirmed_by_customer}
                    locationConfirmedAt={selectedOrder.location_confirmed_at || undefined}
                    isManager={true}
                    onLocationUpdated={fetchOrders}
                  />
                </div>
              )}
            </>
          )}
          <Separator />
          <DialogFooter className="gap-2 flex-wrap">
            {selectedOrder?.status === 'paid' && (
              <Button
                onClick={() => {
                  setShowDetailsDialog(false);
                  setShowCompletionDialog(true);
                }}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                تایید اتمام سفارش
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setTransferDialogOpen(true);
              }}
              className="gap-2"
            >
              <ArrowLeftRight className="h-4 w-4" />
              انتقال سفارش
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCollaboratorDialogOpen(true);
              }}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              افزودن همکار
            </Button>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={showEditScheduleDialog} onOpenChange={setShowEditScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ویرایش زمان‌بندی اجرا</DialogTitle>
            <DialogDescription>
              زمان‌بندی اجرای سفارش {selectedOrder?.code} را ویرایش کنید
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">شماره تماس مشتری</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <span dir="ltr" className="font-medium">{selectedOrder.customer_phone}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  در صورت نیاز با مشتری تماس بگیرید و تغییرات را هماهنگ کنید
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-start-date">تاریخ شروع اجرا</Label>
                <PersianDatePicker
                  value={editStartDate}
                  onChange={setEditStartDate}
                  placeholder="انتخاب تاریخ شروع"
                  timeMode="ampm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end-date">تاریخ پایان اجرا (تخمینی)</Label>
                <PersianDatePicker
                  value={editEndDate}
                  onChange={setEditEndDate}
                  placeholder="انتخاب تاریخ پایان"
                  timeMode="none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditScheduleDialog(false);
                setEditStartDate('');
                setEditEndDate('');
              }}
            >
              انصراف
            </Button>
            <Button 
              onClick={handleUpdateSchedule} 
              disabled={!editStartDate || !editEndDate}
            >
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <ManagerOrderTransfer
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferComplete={fetchOrders}
        />
      )}

      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorDialogOpen}
          onOpenChange={setCollaboratorDialogOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}

      {/* Collection Request Dialog */}
      {selectedOrder && (
        <CollectionRequestDialog
          open={collectionDialogOpen}
          onOpenChange={(open) => {
            setCollectionDialogOpen(open);
            if (!open) fetchOrders();
          }}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerId={selectedOrder.customer_id || ''}
          isManager={true}
        />
      )}

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              بایگانی سفارش
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را بایگانی کنید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            سفارش از دسترس مشتری و مدیران خارج می‌شود. می‌توانید بعداً از قسمت بایگانی آن را بازگردانید.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleArchiveOrder}>
              بایگانی سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Dialog */}
      <Dialog open={bulkArchiveDialogOpen} onOpenChange={setBulkArchiveDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              بایگانی دسته‌جمعی سفارشات
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید {selectedOrderIds.size} سفارش را بایگانی کنید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            تمام سفارشات انتخاب شده از دسترس مشتریان و مدیران خارج می‌شوند. می‌توانید بعداً از قسمت بایگانی آن‌ها را بازگردانید.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkArchiveDialogOpen(false)} disabled={bulkArchiving}>
              انصراف
            </Button>
            <Button onClick={handleBulkArchive} disabled={bulkArchiving}>
              {bulkArchiving ? 'در حال بایگانی...' : `بایگانی ${selectedOrderIds.size} سفارش`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Change Confirmation Dialog */}
      <Dialog open={stageChangeConfirmOpen} onOpenChange={setStageChangeConfirmOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              تایید تغییر مرحله سفارش
            </DialogTitle>
            <DialogDescription>
              {pendingStageChange && (
                <>
                  آیا مطمئن هستید که می‌خواهید مرحله سفارش را به{' '}
                  <span className="font-bold text-foreground">
                    "{executionStages.find(s => s.key === pendingStageChange.newStage)?.label}"
                  </span>{' '}
                  تغییر دهید؟
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            با تایید این عملیات، مشتری از تغییر مرحله سفارش مطلع خواهد شد.
          </p>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setStageChangeConfirmOpen(false);
                setPendingStageChange(null);
              }}
            >
              انصراف
            </Button>
            <Button 
              onClick={() => {
                if (pendingStageChange) {
                  handleStageChange(pendingStageChange.orderId, pendingStageChange.newStage);
                }
                setStageChangeConfirmOpen(false);
                setPendingStageChange(null);
              }}
            >
              تایید تغییر مرحله
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi Payment Dialog */}
      {selectedOrder && (
        <MultiPaymentDialog
          open={cashPaymentDialogOpen}
          onOpenChange={(open) => {
            setCashPaymentDialogOpen(open);
            if (!open) {
              setSelectedOrder(null);
            }
          }}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerName={selectedOrder.customer_name}
          customerId={selectedOrder.customer_id || ''}
          totalPrice={selectedOrder.total_price || selectedOrder.payment_amount || 0}
          onPaymentSuccess={fetchOrders}
          customerPhone={selectedOrder.customer_phone}
          address={buildOrderSmsAddress(selectedOrder.address, selectedOrder.detailed_address)}
          serviceType={getOrderServiceLabel(selectedOrder.notes) || 'خدمات'}
        />
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open);
        if (!open) {
          setRejectionReason('');
        }
      }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              رد سفارش
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را رد کنید؟
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                دلیل رد سفارش <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="لطفاً دلیل رد سفارش را توضیح دهید..."
                className="min-h-[100px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              این پیام به مشتری نمایش داده خواهد شد.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason('');
              }}
            >
              انصراف
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectOrder}
              disabled={!rejectionReason.trim()}
            >
              رد سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
