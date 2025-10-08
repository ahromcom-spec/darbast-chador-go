import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStaffWhitelist } from '@/hooks/useStaffWhitelist';
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface StaffRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  scaffold_worker: 'نیروی داربست',
  scaffold_supervisor: 'سرپرست داربست',
  operations_manager: 'مدیر اجرایی',
  finance_manager: 'مدیر مالی',
  sales_manager: 'مدیر فروش',
  support_manager: 'مدیر پشتیبانی',
  general_manager: 'مدیریت کل',
  warehouse_manager: 'مدیر انبار',
  security_manager: 'مدیر حراست',
};

export const StaffRequestDialog = ({ open, onOpenChange }: StaffRequestDialogProps) => {
  const { allowedRole } = useStaffWhitelist();
  const { staffProfile, requestRole, refetch } = useStaffProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!allowedRole) return;

    setIsSubmitting(true);
    const { error } = await requestRole(allowedRole);

    if (error) {
      toast({
        title: 'خطا',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'موفق',
        description: 'درخواست شما با موفقیت ثبت شد و در انتظار تأیید مدیریت کل است.',
      });
      refetch();
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const renderContent = () => {
    if (staffProfile?.status === 'pending') {
      return (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            درخواست شما برای نقش <strong>{ROLE_LABELS[staffProfile.requested_role]}</strong> در
            انتظار تأیید مدیریت کل است.
          </AlertDescription>
        </Alert>
      );
    }

    if (staffProfile?.status === 'rejected') {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              درخواست قبلی شما رد شده است.
              {staffProfile.rejection_reason && (
                <p className="mt-2">
                  <strong>دلیل:</strong> {staffProfile.rejection_reason}
                </p>
              )}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            لطفاً با پشتیبانی تماس بگیرید.
          </p>
        </div>
      );
    }

    if (staffProfile?.status === 'approved') {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            شما به عنوان <strong>{ROLE_LABELS[staffProfile.requested_role]}</strong> تأیید شده‌اید.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          شمارهٔ موبایل شما در لیست پرسنل مجاز ثبت شده است. می‌توانید درخواست نقش سازمانی خود را ثبت کنید.
        </p>
        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">نقش مجاز شما:</p>
          <Badge variant="secondary" className="text-base">
            {allowedRole && ROLE_LABELS[allowedRole]}
          </Badge>
        </div>
        <Alert>
          <AlertDescription>
            پس از ثبت درخواست، مدیریت کل آن را بررسی و تأیید خواهد کرد. پس از تأیید، به امکانات مربوط به نقش خود دسترسی خواهید داشت.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const canSubmit = allowedRole && !staffProfile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>درخواست نقش سازمانی</DialogTitle>
          <DialogDescription>
            ثبت درخواست برای دریافت دسترسی به سیستم به عنوان پرسنل
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderContent()}</div>

        <DialogFooter>
          {canSubmit ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                انصراف
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'در حال ارسال...' : 'ثبت درخواست'}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>بستن</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
