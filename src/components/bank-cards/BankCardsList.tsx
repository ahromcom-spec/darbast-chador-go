import { useState } from 'react';
import { BankCard } from '@/hooks/useBankCards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  CreditCard, 
  Edit, 
  Trash2, 
  History, 
  ToggleLeft, 
  ToggleRight,
  Building2,
  Calendar,
  ArrowLeftRight,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns-jalali';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BankCardsListProps {
  cards: BankCard[];
  loading: boolean;
  onEdit: (card: BankCard) => void;
  onDelete: (id: string) => Promise<boolean>;
  onToggleStatus: (id: string, isActive: boolean) => Promise<boolean>;
  onViewTransactions: (card: BankCard) => void;
  onTransfer?: (cardId: string) => void;
}

export function BankCardsList({
  cards,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewTransactions,
  onTransfer,
}: BankCardsListProps) {
  const [deletingCard, setDeletingCard] = useState<BankCard | null>(null);
  const [otpStep, setOtpStep] = useState<'confirm' | 'otp'>('confirm');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const startOtpTimer = () => {
    setOtpTimer(120);
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestDelete = (card: BankCard) => {
    setDeletingCard(card);
    setOtpStep('confirm');
    setOtpCode('');
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-ceo-otp', {
        body: { action: 'bank_card_delete', purpose: 'حذف کارت بانکی' },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'خطا در ارسال کد تایید');
        return;
      }

      toast.success('کد تایید به شماره مدیرعامل ارسال شد');
      setOtpStep('otp');
      startOtpTimer();
    } catch (err) {
      toast.error('خطا در ارسال کد تایید');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (!deletingCard || !otpCode) return;

    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-ceo-otp', {
        body: { code: otpCode, action: 'bank_card_delete' },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'کد تایید نادرست است');
        setOtpLoading(false);
        return;
      }

      // OTP verified, proceed with deletion
      const deleted = await onDelete(deletingCard.id);
      if (deleted) {
        setDeletingCard(null);
      }
    } catch (err) {
      toast.error('خطا در تایید کد');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setDeletingCard(null);
    setOtpStep('confirm');
    setOtpCode('');
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <Skeleton className="h-6 w-32 mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">کارتی ثبت نشده</h3>
          <p className="text-muted-foreground">
            برای شروع، یک کارت بانکی جدید ثبت کنید
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{card.card_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {card.bank_name}
                    </div>
                  </div>
                </div>
                <Badge variant={card.is_active ? 'default' : 'secondary'}>
                  {card.is_active ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>

              {card.card_number && (
                <p className="text-xs text-muted-foreground font-mono mb-2 text-left" dir="ltr">
                  {card.card_number}
                </p>
              )}

              <div className="mb-3">
                <span className="text-xs text-muted-foreground">موجودی فعلی</span>
                <p className={`text-lg font-bold ${card.current_balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {card.current_balance.toLocaleString('fa-IR')} تومان
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <Calendar className="h-3 w-3" />
                تاریخ ثبت: {format(new Date(card.registration_date), 'yyyy/MM/dd')}
              </div>

              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => onEdit(card)} className="gap-1">
                  <Edit className="h-3 w-3" />
                  ویرایش
                </Button>
                <Button variant="outline" size="sm" onClick={() => onViewTransactions(card)} className="gap-1">
                  <History className="h-3 w-3" />
                  تراکنش‌ها
                </Button>
                {onTransfer && (
                  <Button variant="outline" size="sm" onClick={() => onTransfer(card.id)} className="gap-1">
                    <ArrowLeftRight className="h-3 w-3" />
                    انتقال
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleStatus(card.id, !card.is_active)}
                  className="gap-1"
                >
                  {card.is_active ? (
                    <>
                      <ToggleRight className="h-3 w-3" />
                      غیرفعال
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-3 w-3" />
                      فعال
                    </>
                  )}
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive gap-1"
                  onClick={() => handleRequestDelete(card)}
                >
                  <Trash2 className="h-3 w-3" />
                  حذف
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* OTP Verification Dialog for Delete */}
      <Dialog open={!!deletingCard} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              تایید حذف کارت بانکی
            </DialogTitle>
            <DialogDescription>
              {deletingCard && (
                <>برای حذف کارت «{deletingCard.card_name}» نیاز به تایید مدیرعامل است.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {otpStep === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                با کلیک بر روی دکمه زیر، یک کد تایید به شماره مدیرعامل ارسال می‌شود.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  انصراف
                </Button>
                <Button 
                  onClick={handleSendOtp} 
                  disabled={otpSending}
                  variant="destructive"
                >
                  {otpSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      در حال ارسال...
                    </>
                  ) : (
                    'ارسال کد تایید'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {otpStep === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">کد تایید ۵ رقمی</label>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="کد تایید را وارد کنید"
                  maxLength={5}
                  className="text-center text-lg tracking-widest"
                  dir="ltr"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otpCode.length === 5) {
                      handleVerifyAndDelete();
                    }
                  }}
                />
                {otpTimer > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')} تا انقضای کد
                  </p>
                )}
                {otpTimer === 0 && otpStep === 'otp' && (
                  <Button
                    variant="link"
                    size="sm"
                    className="w-full mt-2"
                    onClick={handleSendOtp}
                    disabled={otpSending}
                  >
                    ارسال مجدد کد
                  </Button>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  انصراف
                </Button>
                <Button
                  onClick={handleVerifyAndDelete}
                  disabled={otpLoading || otpCode.length < 5}
                  variant="destructive"
                >
                  {otpLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      در حال تایید...
                    </>
                  ) : (
                    'تایید و حذف'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
