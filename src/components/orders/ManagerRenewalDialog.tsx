import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, RefreshCw, Clock, CheckCircle, XCircle, Edit, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, addMonths } from 'date-fns-jalali';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface ManagerRenewalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderCode: string;
  customerId: string;
  rentalStartDate: string | null;
  originalPrice: number;
  onRenewalComplete?: () => void;
}

interface RenewalRecord {
  id: string;
  renewal_number: number;
  status: string;
  original_price: number;
  renewal_price: number;
  new_start_date: string;
  new_end_date: string;
  previous_end_date: string;
  approved_at: string | null;
  approved_by: string | null;
  manager_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function ManagerRenewalDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  customerId,
  rentalStartDate,
  originalPrice,
  onRenewalComplete,
}: ManagerRenewalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loadingRenewals, setLoadingRenewals] = useState(true);
  const [editingRenewal, setEditingRenewal] = useState<RenewalRecord | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [managerNotes, setManagerNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRenewalPrice, setNewRenewalPrice] = useState<string>(String(originalPrice || ''));
  const [newRenewalStartDate, setNewRenewalStartDate] = useState<string>('');
  const [newRenewalEndDate, setNewRenewalEndDate] = useState<string>('');
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const calculateCurrentEndDate = () => {
    if (!rentalStartDate) return null;
    const startDate = new Date(rentalStartDate);
    return addMonths(startDate, 1);
  };

  // محاسبه تاریخ شروع تمدید بعدی - زنجیره‌ای از تمام تمدیدها (تایید شده و در انتظار)
  const calculateNewStartDate = (rows: RenewalRecord[] = renewals) => {
    // از بین تمام تمدیدها (approved + pending) آخرین تمدید بر اساس شماره سری را پیدا کن
    const activeRenewals = rows.filter((r) => r.status === 'approved' || r.status === 'pending');
    if (activeRenewals.length > 0) {
      const lastRenewal = activeRenewals.reduce((prev, current) =>
        prev.renewal_number > current.renewal_number ? prev : current,
      );
      return new Date(lastRenewal.new_end_date);
    }

    // برای سری اول: یک ماه بعد از rental_start_date
    if (rentalStartDate) {
      return addMonths(new Date(rentalStartDate), 1);
    }

    return calculateCurrentEndDate();
  };

  const getNextRenewalNumber = (rows: RenewalRecord[] = renewals) => {
    const usedNumbers = new Set(rows.map((r) => r.renewal_number));
    for (let number = 1; number <= 12; number += 1) {
      if (!usedNumbers.has(number)) return number;
    }
    return null;
  };

  // همگام‌سازی total_price با جمع payment_amount + تمدیدهای تایید شده
  const syncOrderTotalPrice = async () => {
    // Row triggers recompute both financial owners, including transferred items.
    // Never overwrite their totals from operational order_id on the client.
  };

  const fetchRenewals = async () => {
    try {
      const { data, error } = await supabase
        .from('order_renewals')
        .select('*')
        .eq('order_id', orderId)
        .order('renewal_number', { ascending: true });

      if (error) throw error;
      const fetchedRenewals = (data as RenewalRecord[]) || [];
      setRenewals(fetchedRenewals);

      // تنظیم تاریخ‌های پیش‌فرض برای تمدید جدید
      const newStart = calculateNewStartDate(fetchedRenewals);
      if (newStart) {
        setNewRenewalStartDate(newStart.toISOString());
        setNewRenewalEndDate(addMonths(newStart, 1).toISOString());
      }
    } catch (error) {
      console.error('Error fetching renewals:', error);
    } finally {
      setLoadingRenewals(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRenewals();
      setNewRenewalPrice(String(originalPrice || ''));
    }
  }, [open, orderId, originalPrice]);

  useEffect(() => {
    // وقتی تاریخ شروع تغییر کرد، تاریخ پایان را به‌روز کن
    if (newRenewalStartDate) {
      const startDate = new Date(newRenewalStartDate);
      setNewRenewalEndDate(addMonths(startDate, 1).toISOString());
    }
  }, [newRenewalStartDate]);

  const handleEditRenewal = (renewal: RenewalRecord) => {
    setEditingRenewal(renewal);
    setEditPrice(String(toNumber(renewal.renewal_price) || ''));
    setEditStartDate(renewal.new_start_date);
    setEditEndDate(renewal.new_end_date);
    setManagerNotes(renewal.manager_notes || '');
  };

  const handleApproveRenewal = async (renewalId: string) => {
    setLoading(true);
    try {
      const updateData: any = {
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      // اگر در حال ویرایش هستیم، قیمت و تاریخ‌ها را هم به‌روز کن
      if (editingRenewal && editingRenewal.id === renewalId) {
        updateData.renewal_price = parseLocalizedNumber(editPrice);
        updateData.new_start_date = editStartDate;
        updateData.new_end_date = editEndDate;
        updateData.manager_notes = managerNotes;
      }

      const { error } = await supabase.from('order_renewals').update(updateData).eq('id', renewalId);

      if (error) throw error;

      // total_price را از روی داده‌های تایید شده دوباره محاسبه کن (در برابر ویرایش/حذف مقاوم‌تر است)
      await syncOrderTotalPrice();

      toast({
        title: '✓ تمدید تایید شد',
        description: 'درخواست تمدید با موفقیت تایید شد و مبلغ در مبلغ کل سفارش لحاظ گردید',
      });

      setEditingRenewal(null);
      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error approving renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در تایید تمدید',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRenewal = async (renewalId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً دلیل رد را وارد کنید',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_renewals')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', renewalId);

      if (error) throw error;

      toast({
        title: 'تمدید رد شد',
        description: 'درخواست تمدید رد شد',
      });

      setEditingRenewal(null);
      setRejectionReason('');
      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error rejecting renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در رد تمدید',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApprovedRenewalEdits = async (renewalId: string) => {
    if (!editingRenewal || editingRenewal.id !== renewalId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_renewals')
        .update({
          renewal_price: parseLocalizedNumber(editPrice),
          new_start_date: editStartDate,
          new_end_date: editEndDate,
          manager_notes: managerNotes,
        })
        .eq('id', renewalId);

      if (error) throw error;

      await syncOrderTotalPrice();

      toast({
        title: '✓ تمدید به‌روزرسانی شد',
        description: 'مبلغ تمدید اصلاح شد و مبلغ کل سفارش نیز به‌روزرسانی گردید',
      });

      setEditingRenewal(null);
      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error updating approved renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ویرایش تمدید',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRenewal = async (renewal: RenewalRecord) => {
    const ok = window.confirm(`آیا از حذف «تمدید ماه ${renewal.renewal_number + 1}» مطمئن هستید؟`);
    if (!ok) return;

    setDeleteLoadingId(renewal.id);
    try {
      const { error } = await supabase.from('order_renewals').delete().eq('id', renewal.id);
      if (error) throw error;

      // اگر تایید شده بود، روی total_price اثر می‌گذارد
      if (renewal.status === 'approved') {
        await syncOrderTotalPrice();
      }

      toast({
        title: '✓ تمدید حذف شد',
        description: 'تمدید حذف شد و مبلغ کل سفارش به‌روزرسانی گردید',
      });

      if (editingRenewal?.id === renewal.id) {
        setEditingRenewal(null);
      }

      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error deleting renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در حذف تمدید',
      });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleRestoreRenewal = async (renewal: RenewalRecord) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_renewals')
        .update({ status: 'pending', rejection_reason: null, approved_by: null, approved_at: null })
        .eq('id', renewal.id)
        .eq('status', 'rejected');
      if (error) throw error;
      toast({ title: '✓ تمدید بازگردانده شد', description: 'درخواست دوباره در انتظار بررسی مدیر قرار گرفت' });
      await fetchRenewals();
      onRenewalComplete?.();
    } catch (error) {
      console.error('Error restoring renewal:', error);
      toast({ variant: 'destructive', title: 'خطا', description: 'خطا در بازگرداندن تمدید' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRenewal = async () => {
    if (!newRenewalStartDate || !newRenewalEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً تاریخ‌ها را وارد کنید',
      });
      return;
    }

    setLoading(true);
    try {
      const nextNumber = getNextRenewalNumber();
      if (nextNumber === null) {
        toast({
          variant: 'destructive',
          title: 'محدودیت تمدید',
          description: 'حداکثر 12 بار امکان تمدید سفارش وجود دارد',
        });
        return;
      }

      const parsedRenewalPrice = parseLocalizedNumber(newRenewalPrice);
      if (parsedRenewalPrice <= 0) {
        toast({ variant: 'destructive', title: 'خطا', description: 'مبلغ تمدید باید بیشتر از صفر باشد' });
        return;
      }

      const { error } = await supabase.from('order_renewals').insert({
        order_id: orderId,
        customer_id: customerId,
        renewal_number: nextNumber,
        previous_end_date: newRenewalStartDate,
        new_start_date: newRenewalStartDate,
        new_end_date: newRenewalEndDate,
        original_price: originalPrice,
        renewal_price: parsedRenewalPrice,
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        manager_notes: managerNotes,
      });

      if (error) throw error;

      await syncOrderTotalPrice();

      toast({
        title: '✓ تمدید ایجاد شد',
        description: 'تمدید جدید ایجاد شد و مبلغ کل سفارش نیز به‌روزرسانی گردید',
      });

      setShowCreateForm(false);
      setManagerNotes('');
      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error creating renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ایجاد تمدید',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentEndDate = calculateCurrentEndDate();
  const approvedRenewalsCount = renewals.filter((r) => r.status === 'approved').length;
  const pendingRenewals = renewals.filter((r) => r.status === 'pending');
  const nextRenewalNumber = getNextRenewalNumber();
  const canCreateRenewal = nextRenewalNumber !== null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            در انتظار تایید
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            تایید شده
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            رد شده
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            مدیریت تمدید سفارش {orderCode}
          </DialogTitle>
          <DialogDescription>تایید، ویرایش و مدیریت تمدیدهای سفارش</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* اطلاعات دوره فعلی */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              اطلاعات دوره اصلی
            </h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <Label className="text-muted-foreground">تاریخ شروع کرایه:</Label>
                <p className="font-medium">{rentalStartDate ? format(new Date(rentalStartDate), 'yyyy/MM/dd') : 'تعیین نشده'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">تاریخ پایان کرایه:</Label>
                <p className="font-medium">{currentEndDate ? format(currentEndDate, 'yyyy/MM/dd') : 'تعیین نشده'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">هزینه اصلی:</Label>
                <p className="font-medium text-primary">{toNumber(originalPrice)?.toLocaleString('fa-IR')} تومان</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">تعداد تمدید: {approvedRenewalsCount} از 12 سری</p>
          </div>

          {/* تمدیدهای در انتظار تایید */}
          {pendingRenewals.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-yellow-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  درخواست‌های در انتظار تایید
                </h4>
                {pendingRenewals.map((renewal) => (
                  <div
                    key={renewal.id}
                    className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">تمدید ماه {renewal.renewal_number + 1}</span>
                      {getStatusBadge(renewal.status)}
                    </div>

                    {editingRenewal?.id === renewal.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>قیمت تمدید (تومان)</Label>
                            <Input
                              inputMode="numeric"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>تاریخ شروع</Label>
                            <PersianDatePicker
                              value={editStartDate || undefined}
                              onChange={(dateStr) => {
                                if (dateStr) {
                                  setEditStartDate(dateStr);
                                  setEditEndDate(addMonths(new Date(dateStr), 1).toISOString());
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label>تاریخ پایان</Label>
                            <PersianDatePicker
                              value={editEndDate || undefined}
                              onChange={(dateStr) => {
                                if (dateStr) {
                                  setEditEndDate(dateStr);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>شرح / توضیحات این تمدید (به مشتری نمایش داده می‌شود)</Label>
                          <Textarea
                            value={managerNotes}
                            onChange={(e) => setManagerNotes(e.target.value)}
                            placeholder="مثال: تمدید ماه دوم با تخفیف ویژه..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleApproveRenewal(renewal.id)} disabled={loading} className="flex-1">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            تایید با این تغییرات
                          </Button>
                          <Button variant="outline" onClick={() => setEditingRenewal(null)}>
                            انصراف
                          </Button>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-red-600">دلیل رد (اختیاری)</Label>
                          <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="در صورت رد، دلیل را بنویسید..."
                            className="mt-1"
                          />
                          <Button
                            variant="destructive"
                            onClick={() => handleRejectRenewal(renewal.id)}
                            disabled={loading}
                            className="mt-2"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            رد درخواست
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">از:</span> {format(new Date(renewal.new_start_date), 'yyyy/MM/dd')}
                          </div>
                          <div>
                            <span className="text-muted-foreground">تا:</span> {format(new Date(renewal.new_end_date), 'yyyy/MM/dd')}
                          </div>
                          <div>
                            <span className="text-muted-foreground">قیمت:</span> {toNumber(renewal.renewal_price)?.toLocaleString('fa-IR')} تومان
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleApproveRenewal(renewal.id)} disabled={loading} className="flex-1">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            تایید
                          </Button>
                          <Button variant="outline" onClick={() => handleEditRenewal(renewal)}>
                            <Edit className="h-4 w-4 mr-2" />
                            ویرایش و تایید
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ایجاد تمدید جدید توسط مدیر */}
          {canCreateRenewal && (
            <>
              <Separator />
              {showCreateForm ? (
                <div className="bg-primary/5 p-4 rounded-lg space-y-3 border border-primary/20">
                  <h4 className="font-medium flex items-center gap-2 text-primary">
                    <RefreshCw className="h-4 w-4" />
                    ایجاد تمدید ماه {(nextRenewalNumber || 1) + 1}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>قیمت تمدید (تومان)</Label>
                      <Input
                        inputMode="numeric"
                        value={newRenewalPrice}
                        onChange={(e) => setNewRenewalPrice(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>تاریخ شروع</Label>
                      <PersianDatePicker
                        value={newRenewalStartDate || undefined}
                        onChange={(dateStr) => {
                          if (dateStr) {
                            setNewRenewalStartDate(dateStr);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>تاریخ پایان</Label>
                    <PersianDatePicker
                      value={newRenewalEndDate || undefined}
                      onChange={(dateStr) => {
                        if (dateStr) {
                          setNewRenewalEndDate(dateStr);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>شرح / توضیحات این تمدید (به مشتری نمایش داده می‌شود)</Label>
                    <Textarea
                      value={managerNotes}
                      onChange={(e) => setManagerNotes(e.target.value)}
                      placeholder="مثال: تمدید ماه دوم با تخفیف ویژه..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateRenewal} disabled={loading} className="flex-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      ایجاد و تایید تمدید
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setManagerNotes('');
                      }}
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowCreateForm(true)} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ایجاد تمدید جدید
                </Button>
              )}
            </>
          )}

          {/* لیست تمدیدهای تایید شده */}
          {renewals.filter((r) => r.status === 'approved').length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  تمدیدهای تایید شده
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {renewals
                    .filter((r) => r.status === 'approved')
                    .map((renewal) => (
                      <div key={renewal.id} className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200">
                        {editingRenewal?.id === renewal.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>قیمت تمدید (تومان)</Label>
                                <Input
                                  inputMode="numeric"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label>تاریخ شروع</Label>
                                <PersianDatePicker
                                  value={editStartDate || undefined}
                                  onChange={(dateStr) => {
                                    if (dateStr) {
                                      setEditStartDate(dateStr);
                                      setEditEndDate(addMonths(new Date(dateStr), 1).toISOString());
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <Label>تاریخ پایان</Label>
                                <PersianDatePicker
                                  value={editEndDate || undefined}
                                  onChange={(dateStr) => {
                                    if (dateStr) {
                                      setEditEndDate(dateStr);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <Label>شرح / توضیحات این تمدید (به مشتری نمایش داده می‌شود)</Label>
                              <Textarea
                                value={managerNotes}
                                onChange={(e) => setManagerNotes(e.target.value)}
                                placeholder="مثال: تمدید ماه دوم با تخفیف ویژه..."
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSaveApprovedRenewalEdits(renewal.id)}
                                disabled={loading}
                                className="flex-1"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                ذخیره تغییرات
                              </Button>
                              <Button variant="outline" onClick={() => setEditingRenewal(null)}>
                                انصراف
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">تمدید ماه {renewal.renewal_number + 1}</span>
                              <span className="text-green-700 font-medium">
                                {toNumber(renewal.renewal_price)?.toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              از {format(new Date(renewal.new_start_date), 'yyyy/MM/dd')} تا{' '}
                              {format(new Date(renewal.new_end_date), 'yyyy/MM/dd')}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditRenewal(renewal)} className="flex-1">
                                <Edit className="h-4 w-4 mr-2" />
                                ویرایش
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteRenewal(renewal)}
                                disabled={deleteLoadingId === renewal.id}
                                className="flex-1"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {deleteLoadingId === renewal.id ? 'در حال حذف...' : 'حذف'}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {renewals.filter((r) => r.status === 'rejected').length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  تمدیدهای رد شده
                </h4>
                {renewals.filter((r) => r.status === 'rejected').map((renewal) => (
                  <div key={renewal.id} className="border border-destructive/30 bg-destructive/5 p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">تمدید ماه {renewal.renewal_number + 1}</span>
                      {getStatusBadge(renewal.status)}
                    </div>
                    {renewal.rejection_reason && <p className="text-sm text-muted-foreground">دلیل رد: {renewal.rejection_reason}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRestoreRenewal(renewal)} disabled={loading}>
                        <Undo2 className="h-4 w-4 mr-2" />
                        بازگرداندن
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteRenewal(renewal)} disabled={deleteLoadingId === renewal.id}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {nextRenewalNumber === null && (
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-muted-foreground">به حداکثر تعداد تمدید (12 سری) رسیده‌اید</p>
            </div>
          )}

          {loadingRenewals && (
            <div className="text-center text-sm text-muted-foreground">در حال بارگذاری سوابق تمدید...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
