import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, RefreshCw, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths } from 'date-fns-jalali';

interface RenewalRequestDialogProps {
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
  renewal_price: number;
  new_start_date: string;
  new_end_date: string;
  approved_at: string | null;
  created_at: string;
}

export function RenewalRequestDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  customerId,
  rentalStartDate,
  originalPrice,
  onRenewalComplete
}: RenewalRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loadingRenewals, setLoadingRenewals] = useState(true);
  const { toast } = useToast();

  // محاسبه تاریخ پایان کرایه فعلی (یک ماه از تاریخ شروع)
  const calculateCurrentEndDate = () => {
    if (!rentalStartDate) return null;
    const startDate = new Date(rentalStartDate);
    return addMonths(startDate, 1);
  };

  // محاسبه تاریخ شروع تمدید جدید - زنجیره‌ای از تمام تمدیدها (تایید شده و در انتظار)
  const calculateNewStartDate = () => {
    // از بین تمام تمدیدها (approved + pending) آخرین تمدید بر اساس شماره سری را پیدا کن
    const activeRenewals = renewals.filter(r => r.status === 'approved' || r.status === 'pending');
    if (activeRenewals.length > 0) {
      const lastRenewal = activeRenewals.reduce((prev, current) => 
        prev.renewal_number > current.renewal_number ? prev : current
      );
      return new Date(lastRenewal.new_end_date);
    }
    
    // برای سری اول: یک ماه بعد از rental_start_date
    if (rentalStartDate) {
      const startDate = new Date(rentalStartDate);
      return addMonths(startDate, 1);
    }
    
    return null;
  };

  const getNextRenewalNumber = () => {
    const usedNumbers = new Set(renewals.map(r => r.renewal_number));
    for (let number = 1; number <= 12; number += 1) {
      if (!usedNumbers.has(number)) return number;
    }
    return null;
  };

  const fetchRenewals = async () => {
    try {
      const { data, error } = await supabase
        .from('order_renewals')
        .select('*')
        .eq('order_id', orderId)
        .order('renewal_number', { ascending: true });

      if (error) throw error;
      setRenewals((data as RenewalRecord[]) || []);
    } catch (error) {
      console.error('Error fetching renewals:', error);
    } finally {
      setLoadingRenewals(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRenewals();
    }
  }, [open, orderId]);

  const handleRequestRenewal = async () => {
    setLoading(true);
    try {
      // بررسی تعداد تمدیدها
      const nextRenewalNumber = getNextRenewalNumber();
      if (nextRenewalNumber === null) {
        toast({
          variant: 'destructive',
          title: 'محدودیت تمدید',
          description: 'حداکثر 12 بار امکان تمدید سفارش وجود دارد'
        });
        return;
      }

      // بررسی آیا تمدید در انتظار تایید وجود دارد
      const pendingRenewal = renewals.find(r => r.status === 'pending');
      if (pendingRenewal) {
        toast({
          variant: 'destructive',
          title: 'درخواست در انتظار',
          description: 'یک درخواست تمدید در انتظار تایید مدیر وجود دارد'
        });
        return;
      }

      // تاریخ شروع تمدید جدید
      const newStartDate = calculateNewStartDate();
      
      if (!newStartDate) {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'تاریخ شروع کرایه داربست هنوز تعیین نشده است'
        });
        setLoading(false);
        return;
      }

      const newEndDate = addMonths(newStartDate, 1);
      const previousEndDate = newStartDate; // تاریخ پایان قبلی همان شروع جدید است

      const { error } = await supabase
        .from('order_renewals')
        .insert({
          order_id: orderId,
          customer_id: customerId,
          renewal_number: nextRenewalNumber,
          previous_end_date: previousEndDate.toISOString(),
          new_start_date: newStartDate.toISOString(),
          new_end_date: newEndDate.toISOString(),
          original_price: originalPrice,
          renewal_price: originalPrice, // قیمت اولیه همان قیمت اصلی است، مدیر می‌تواند تغییر دهد
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: '✓ درخواست تمدید ثبت شد',
        description: 'درخواست تمدید شما در انتظار تایید مدیر قرار گرفت'
      });

      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error requesting renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ثبت درخواست تمدید'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRenewal = async (renewalId: string) => {
    setCancelLoading(true);
    try {
      const { error } = await supabase
        .from('order_renewals')
        .delete()
        .eq('id', renewalId)
        .eq('status', 'pending'); // فقط درخواست‌های pending قابل لغو هستند

      if (error) throw error;

      toast({
        title: '✓ درخواست لغو شد',
        description: 'درخواست تمدید با موفقیت لغو شد'
      });

      fetchRenewals();
      onRenewalComplete?.();
    } catch (error: any) {
      console.error('Error canceling renewal:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در لغو درخواست تمدید'
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const currentEndDate = calculateCurrentEndDate();
  const newStartDate = calculateNewStartDate();
  const approvedRenewalsCount = renewals.filter(r => r.status === 'approved').length;
  const pendingRenewal = renewals.find(r => r.status === 'pending');
  const nextRenewalNumber = getNextRenewalNumber();
  const canRequestRenewal = nextRenewalNumber !== null && !pendingRenewal && rentalStartDate;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">در انتظار تایید</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">تایید شده</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">رد شده</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            تمدید سفارش {orderCode}
          </DialogTitle>
          <DialogDescription>
            درخواست تمدید کرایه داربست برای دوره جدید
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* اطلاعات دوره فعلی */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              اطلاعات دوره فعلی
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-muted-foreground">تاریخ شروع کرایه:</Label>
                <p className="font-medium">
                  {rentalStartDate 
                    ? format(new Date(rentalStartDate), 'yyyy/MM/dd')
                    : 'تعیین نشده'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">تاریخ پایان کرایه:</Label>
                <p className="font-medium">
                  {currentEndDate 
                    ? format(currentEndDate, 'yyyy/MM/dd')
                    : 'تعیین نشده'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">هزینه کرایه:</Label>
                <p className="font-medium text-primary">
                  {originalPrice?.toLocaleString('fa-IR')} تومان
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">تعداد تمدید:</Label>
                <p className="font-medium">
                  {approvedRenewalsCount} از 12 سری
                </p>
              </div>
            </div>
          </div>

          {/* درخواست تمدید جدید */}
          {canRequestRenewal && (
            <>
              <Separator />
              <div className="bg-primary/5 p-4 rounded-lg space-y-3 border border-primary/20">
                <h4 className="font-medium flex items-center gap-2 text-primary">
                  <RefreshCw className="h-4 w-4" />
                  درخواست تمدید ماه {(nextRenewalNumber || 1) + 1}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">تاریخ شروع جدید:</Label>
                    <p className="font-medium">
                      {newStartDate 
                        ? format(newStartDate, 'yyyy/MM/dd')
                        : 'تعیین نشده'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">تاریخ پایان جدید:</Label>
                    <p className="font-medium">
                      {newStartDate 
                        ? format(addMonths(newStartDate, 1), 'yyyy/MM/dd')
                        : 'تعیین نشده'}
                    </p>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    💡 هزینه تمدید: <span className="font-bold">{originalPrice?.toLocaleString('fa-IR')} تومان</span>
                    <br />
                    <span className="text-xs">این مبلغ پس از تایید مدیر قطعی خواهد شد</span>
                  </p>
                </div>
                <Button 
                  onClick={handleRequestRenewal} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      در حال ثبت...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      درخواست تمدید
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* لیست تمدیدهای قبلی */}
          {renewals.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">سوابق تمدید</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {renewals.map((renewal) => (
                    <div 
                      key={renewal.id} 
                      className={`p-3 rounded-lg border ${
                        renewal.status === 'approved' 
                          ? 'bg-green-50 dark:bg-green-950 border-green-200' 
                          : renewal.status === 'pending'
                            ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200'
                            : 'bg-red-50 dark:bg-red-950 border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {renewal.status === 'approved' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : renewal.status === 'pending' ? (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">تمدید ماه {renewal.renewal_number + 1}</span>
                        </div>
                        {getStatusBadge(renewal.status)}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <span>از: {format(new Date(renewal.new_start_date), 'yyyy/MM/dd')}</span>
                        <span>تا: {format(new Date(renewal.new_end_date), 'yyyy/MM/dd')}</span>
                      </div>
                      {renewal.status === 'approved' && (
                        <div className="mt-2 text-sm font-medium text-green-700 dark:text-green-300">
                          هزینه: {renewal.renewal_price?.toLocaleString('fa-IR')} تومان
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* پیام عدم تعیین تاریخ شروع کرایه */}
          {!rentalStartDate && renewals.length < 12 && !pendingRenewal && (
            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg text-center border border-amber-200 dark:border-amber-700">
              <p className="text-amber-700 dark:text-amber-300">
                ⚠️ تاریخ شروع کرایه داربست هنوز توسط مدیر تعیین نشده است.
                <br />
                <span className="text-sm">پس از تعیین تاریخ شروع کرایه، امکان درخواست تمدید وجود خواهد داشت.</span>
              </p>
            </div>
          )}

          {/* پیام محدودیت */}
          {renewals.length >= 12 && (
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-muted-foreground">
                به حداکثر تعداد تمدید (12 سری) رسیده‌اید
              </p>
            </div>
          )}

          {pendingRenewal && (
            <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg space-y-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                درخواست تمدید ماه {pendingRenewal.renewal_number + 1} در انتظار تایید مدیر است
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCancelRenewal(pendingRenewal.id)}
                disabled={cancelLoading}
                className="w-full"
              >
                {cancelLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    در حال لغو...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    لغو درخواست تمدید
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
