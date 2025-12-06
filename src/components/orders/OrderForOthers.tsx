import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Check, Clock, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrderForOthersProps {
  onRecipientSelected: (recipientData: RecipientData | null) => void;
  disabled?: boolean;
}

export interface RecipientData {
  phoneNumber: string;
  userId: string | null;
  fullName: string | null;
  isRegistered: boolean;
}

export function OrderForOthers({ onRecipientSelected, disabled }: OrderForOthersProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<RecipientData | null>(null);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const normalizePhoneNumber = (phone: string): string => {
    let normalized = phone.replace(/\s/g, '');
    if (normalized.startsWith('+98')) {
      normalized = '0' + normalized.slice(3);
    } else if (normalized.startsWith('98') && normalized.length === 12) {
      normalized = '0' + normalized.slice(2);
    } else if (!normalized.startsWith('0')) {
      normalized = '0' + normalized;
    }
    return normalized;
  };

  const searchRecipient = useCallback(async (phone: string) => {
    const normalizedPhone = normalizePhoneNumber(phone.trim());

    // اعتبارسنجی شماره موبایل
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setRecipientInfo(null);
      setSearchCompleted(false);
      return;
    }

    setSearching(true);
    setSearchCompleted(false);

    try {
      // جستجو در جدول profiles با شماره موبایل
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (profileError) {
        console.error('Profile search error:', profileError);
      }

      if (profileData) {
        // کاربر پیدا شد
        setRecipientInfo({
          phoneNumber: normalizedPhone,
          userId: profileData.user_id,
          fullName: profileData.full_name,
          isRegistered: true
        });
      } else {
        // کاربر ثبت‌نام نکرده
        setRecipientInfo({
          phoneNumber: normalizedPhone,
          userId: null,
          fullName: null,
          isRegistered: false
        });
      }

      setSearchCompleted(true);
    } catch (error) {
      console.error('Search error:', error);
      setRecipientInfo(null);
      setSearchCompleted(false);
    } finally {
      setSearching(false);
    }
  }, []);

  // جستجوی خودکار با debounce
  useEffect(() => {
    const normalizedPhone = normalizePhoneNumber(phoneNumber.trim());
    
    // فقط وقتی شماره کامل است جستجو کن
    if (normalizedPhone.length === 11 && normalizedPhone.startsWith('09')) {
      const debounceTimer = setTimeout(() => {
        searchRecipient(phoneNumber);
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setRecipientInfo(null);
      setSearchCompleted(false);
    }
  }, [phoneNumber, searchRecipient]);

  const handleConfirm = () => {
    if (!recipientInfo) return;

    onRecipientSelected(recipientInfo);
    setIsActive(true);
    setIsOpen(false);

    if (recipientInfo.isRegistered) {
      toast({
        title: 'کاربر مقصد انتخاب شد',
        description: `سفارش برای ${recipientInfo.fullName || recipientInfo.phoneNumber} ثبت خواهد شد`,
      });
    } else {
      toast({
        title: 'کاربر مقصد انتخاب شد',
        description: 'پس از ثبت سفارش، زمانی که کاربر مقصد ثبت‌نام کند سفارش به او منتقل خواهد شد',
      });
    }
  };

  const handleCancel = () => {
    setIsActive(false);
    setPhoneNumber('');
    setRecipientInfo(null);
    setSearchCompleted(false);
    onRecipientSelected(null);
    toast({
      title: 'لغو شد',
      description: 'سفارش برای خودتان ثبت خواهد شد',
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when dialog closes without confirmation
      if (!isActive) {
        setPhoneNumber('');
        setRecipientInfo(null);
        setSearchCompleted(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant={isActive ? "default" : "outline"}
            size="sm"
            className={`gap-2 ${isActive ? 'bg-primary text-primary-foreground' : ''}`}
            disabled={disabled}
          >
            <Users className="h-4 w-4" />
            {isActive ? 'ثبت برای دیگری (فعال)' : 'ثبت سفارش برای دیگری'}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">ثبت سفارش برای شخص دیگر</DialogTitle>
            <DialogDescription className="text-right">
              شماره موبایل شخصی که می‌خواهید سفارش برای او ثبت شود را وارد کنید
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-phone" className="text-right block">شماره موبایل مقصد</Label>
              <div className="relative">
                <Input
                  id="recipient-phone"
                  type="tel"
                  placeholder="09xxxxxxxxx"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                  }}
                  className="text-left pr-10"
                  dir="ltr"
                />
                {searching && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {phoneNumber && !searching && !searchCompleted && phoneNumber.length < 11 && (
                <p className="text-xs text-muted-foreground">شماره باید 11 رقم باشد ({phoneNumber.length}/11)</p>
              )}
            </div>

            {/* نتیجه جستجو */}
            {searchCompleted && recipientInfo && (
              <div className="space-y-3">
                {recipientInfo.isRegistered ? (
                  <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      <span className="font-bold">کاربر پیدا شد:</span>
                      <br />
                      {recipientInfo.fullName || 'بدون نام'}
                      <br />
                      <span className="text-sm text-muted-foreground" dir="ltr">{recipientInfo.phoneNumber}</span>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-700 dark:text-orange-300">
                      <span className="font-bold">کاربر هنوز ثبت‌نام نکرده</span>
                      <br />
                      <span className="text-sm">
                        سفارش ثبت می‌شود و پس از ثبت‌نام کاربر با این شماره، سفارش به او منتقل خواهد شد.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    انصراف
                  </Button>
                  <Button onClick={handleConfirm}>
                    تایید و انتخاب
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* نمایش وضعیت فعال بودن */}
      {isActive && recipientInfo && (
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-sm text-primary">
            برای: {recipientInfo.fullName || recipientInfo.phoneNumber}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-destructive hover:text-destructive"
            onClick={handleCancel}
          >
            لغو
          </Button>
        </div>
      )}
    </div>
  );
}
