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
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, Search, CheckCircle, XCircle, ArrowLeftRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

interface OrderTransferProps {
  orderId: string;
  orderCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferRequested?: () => void;
}

interface TransferRequest {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string | null;
  to_phone_number: string;
  status: string;
  created_at: string;
  manager_approved_at: string | null;
  manager_rejection_reason: string | null;
  recipient_responded_at: string | null;
  recipient_rejection_reason: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_manager: { label: 'در انتظار تایید مدیر', color: 'bg-yellow-500' },
  manager_approved: { label: 'تایید شده توسط مدیر - در انتظار تایید مقصد', color: 'bg-blue-500' },
  manager_rejected: { label: 'رد شده توسط مدیر', color: 'bg-red-500' },
  pending_recipient: { label: 'در انتظار تایید شخص مقصد', color: 'bg-blue-500' },
  recipient_accepted: { label: 'تایید شده توسط مقصد', color: 'bg-green-500' },
  recipient_rejected: { label: 'رد شده توسط مقصد', color: 'bg-red-500' },
  completed: { label: 'انتقال کامل شد', color: 'bg-green-600' },
};

export function OrderTransfer({ orderId, orderCode, open, onOpenChange, onTransferRequested }: OrderTransferProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [existingRequest, setExistingRequest] = useState<TransferRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Debounce phone number for auto-search
  const debouncedPhone = useDebounce(phoneNumber, 500);

  useEffect(() => {
    if (open) {
      checkExistingRequest();
    }
  }, [open, orderId]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('98')) {
      cleaned = '0' + cleaned.slice(2);
    }
    if (!cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  // Auto-search when debounced phone changes
  useEffect(() => {
    const formattedPhone = formatPhoneNumber(debouncedPhone);
    
    // Only search if phone is valid format (11 digits starting with 09)
    if (formattedPhone.length === 11 && formattedPhone.startsWith('09')) {
      searchUser(formattedPhone);
    } else {
      // Reset if phone is incomplete
      setTargetUser(null);
      setUserNotFound(false);
    }
  }, [debouncedPhone, user?.id]);

  const checkExistingRequest = async () => {
    setLoadingRequest(true);
    try {
      const { data, error } = await supabase
        .from('order_transfer_requests')
        .select('*')
        .eq('order_id', orderId)
        .not('status', 'in', '("completed", "manager_rejected", "recipient_rejected")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setExistingRequest(data as TransferRequest | null);
    } catch (error) {
      console.error('Error checking existing request:', error);
    } finally {
      setLoadingRequest(false);
    }
  };

  const searchUser = useCallback(async (formattedPhone: string) => {
    if (!formattedPhone || formattedPhone.length !== 11 || !formattedPhone.startsWith('09')) {
      return;
    }

    setSearching(true);
    setTargetUser(null);
    setUserNotFound(false);

    try {
      // Search for user by phone number in profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .eq('phone_number', formattedPhone)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        // Check if target user is the same as current user
        if (profile.user_id === user?.id) {
          toast({
            title: 'خطا',
            description: 'نمی‌توانید سفارش را به خودتان انتقال دهید',
            variant: 'destructive',
          });
          setUserNotFound(true);
          return;
        }

        setTargetUser({
          id: profile.user_id,
          name: profile.full_name || 'بدون نام',
          phone: profile.phone_number || formattedPhone,
        });
      } else {
        setUserNotFound(true);
      }
    } catch (error: any) {
      console.error('Error searching user:', error);
      toast({
        title: 'خطا',
        description: 'خطا در جستجوی کاربر',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  }, [user?.id, toast]);

  const submitTransferRequest = async () => {
    if (!targetUser || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('order_transfer_requests')
        .insert({
          order_id: orderId,
          from_user_id: user.id,
          to_user_id: targetUser.id,
          to_phone_number: targetUser.phone,
          status: 'pending_manager',
        });

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'درخواست انتقال سفارش ثبت شد. منتظر تایید مدیر باشید.',
      });

      setPhoneNumber('');
      setTargetUser(null);
      onOpenChange(false);
      onTransferRequested?.();
    } catch (error: any) {
      console.error('Error submitting transfer request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ثبت درخواست انتقال',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelTransferRequest = async () => {
    if (!existingRequest || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('order_transfer_requests')
        .delete()
        .eq('id', existingRequest.id)
        .eq('from_user_id', user.id)
        .eq('status', 'pending_manager');

      if (error) throw error;

      toast({
        title: '✓ لغو شد',
        description: 'درخواست انتقال سفارش لغو شد.',
      });

      setExistingRequest(null);
      onTransferRequested?.();
    } catch (error: any) {
      console.error('Error cancelling transfer request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در لغو درخواست انتقال',
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
            انتقال سفارش به شخص دیگر
          </DialogTitle>
          <DialogDescription>
            سفارش {orderCode} را به شخص دیگری منتقل کنید
          </DialogDescription>
        </DialogHeader>

        {loadingRequest ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : existingRequest ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">وضعیت درخواست:</span>
                  <Badge className={statusLabels[existingRequest.status]?.color || 'bg-gray-500'}>
                    {statusLabels[existingRequest.status]?.label || existingRequest.status}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">شماره مقصد:</span>
                  <span className="font-medium">{existingRequest.to_phone_number}</span>
                </div>
                {existingRequest.manager_rejection_reason && (
                  <>
                    <Separator />
                    <div className="text-sm">
                      <span className="text-muted-foreground">دلیل رد:</span>
                      <p className="text-destructive mt-1">{existingRequest.manager_rejection_reason}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center">
              یک درخواست انتقال فعال برای این سفارش وجود دارد.
            </p>
            
            {/* Cancel button - only show for pending_manager status */}
            {existingRequest.status === 'pending_manager' && (
              <Button
                variant="destructive"
                onClick={cancelTransferRequest}
                disabled={submitting}
                className="w-full gap-2"
              >
                {submitting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                لغو درخواست انتقال
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">شماره تماس شخص مقصد</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  placeholder="09123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1"
                  dir="ltr"
                />
                <Button variant="secondary" disabled className="cursor-default">
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {phoneNumber && formatPhoneNumber(phoneNumber).length < 11 && (
                <p className="text-xs text-muted-foreground">شماره باید ۱۱ رقم باشد (مثال: 09123456789)</p>
              )}
            </div>

            {userNotFound && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <span>کاربری با این شماره در سایت ثبت‌نام نکرده است.</span>
              </div>
            )}

            {targetUser && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">کاربر یافت شد</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">نام:</span>
                    <span className="font-medium">{targetUser.name}</span>
                    <span className="text-muted-foreground">شماره:</span>
                    <span className="font-medium" dir="ltr">{targetUser.phone}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• پس از ثبت درخواست، مدیر باید آن را تایید کند.</p>
              <p>• سپس شخص مقصد باید انتقال را قبول کند.</p>
              <p>• پس از تایید نهایی، سفارش به نام شخص مقصد منتقل می‌شود.</p>
            </div>

            <Button
              onClick={submitTransferRequest}
              disabled={!targetUser || submitting}
              className="w-full gap-2"
            >
              {submitting ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              ثبت درخواست انتقال
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
