import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { ContactPickerButton } from '@/components/common/ContactPickerButton';
import { ArrowLeftRight, CheckCircle, Loader2, Search, XCircle, Wallet } from 'lucide-react';

interface Props {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete?: () => void;
}

export function ManagerCustomerOrderTransfer({
  orderId,
  orderCode,
  open,
  onOpenChange,
  onTransferComplete,
}: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const { toast } = useToast();

  const debouncedPhone = useDebounce(phoneNumber, 500);

  useEffect(() => {
    if (open) {
      setPhoneNumber('');
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [open]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('98')) cleaned = '0' + cleaned.slice(2);
    if (!cleaned.startsWith('0') && cleaned.length === 10) cleaned = '0' + cleaned;
    return cleaned;
  };

  const searchUser = useCallback(async (formattedPhone: string) => {
    setSearching(true);
    setTargetUser(null);
    setUserNotFound(false);
    try {
      const { data, error } = await supabase
        .rpc('lookup_profile_by_phone' as any, { _phone: formattedPhone })
        .maybeSingle();
      if (error) throw error;
      const profile = data as { user_id: string; full_name: string | null; phone_number: string | null } | null;
      if (profile) {
        setTargetUser({
          id: profile.user_id,
          name: profile.full_name || 'بدون نام',
          phone: profile.phone_number || formattedPhone,
        });
      } else {
        setUserNotFound(true);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      toast({ title: 'خطا', description: 'خطا در جستجوی مشتری', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, [toast]);

  useEffect(() => {
    const formatted = formatPhoneNumber(debouncedPhone);
    if (formatted.length === 11 && formatted.startsWith('09')) {
      searchUser(formatted);
    } else {
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [debouncedPhone, searchUser]);

  const handleTransfer = async () => {
    if (!targetUser) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('manager_transfer_order_to_customer' as any, {
        p_order_id: orderId,
        p_phone: targetUser.phone,
      });
      if (error) throw error;

      toast({
        title: '✓ انتقال انجام شد',
        description: `سفارش ${orderCode} به ${targetUser.name} منتقل شد و مبالغ در صورتحساب مقصد حسابرسی شد.`,
      });
      onOpenChange(false);
      onTransferComplete?.();
    } catch (error: any) {
      console.error('Error transferring order to customer:', error);
      toast({
        title: 'خطا',
        description: error.message || 'انتقال سفارش با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            انتقال سفارش به مشتری دیگر
          </DialogTitle>
          <DialogDescription>
            سفارش {orderCode} را به یک مشتری دیگر منتقل کنید. سفارش از حساب مشتری فعلی خارج می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>شماره تلفن مشتری مقصد</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  dir="ltr"
                  className="pr-10 text-left"
                />
              </div>
              <ContactPickerButton onContactSelected={(phone) => setPhoneNumber(phone)} />
            </div>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال جستجو...
            </div>
          )}

          {targetUser && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {targetUser.name}
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">{targetUser.phone}</p>
              </CardContent>
            </Card>
          )}

          {userNotFound && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-4 flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-destructive" />
                مشتری با این شماره در سامانه ثبت‌نام نکرده است.
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <Wallet className="h-4 w-4 text-amber-600 mt-0.5" />
            <span>
              با انتقال سفارش، مبالغ و پرداخت‌های آن از صورتحساب مشتری قبلی خارج و در صورتحساب باز مشتری مقصد
              حسابرسی و بازمحاسبه می‌شود.
            </span>
          </div>

          <Button onClick={handleTransfer} disabled={!targetUser || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            تایید و انتقال سفارش
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
