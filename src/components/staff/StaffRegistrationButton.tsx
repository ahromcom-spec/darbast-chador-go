import { Button } from '@/components/ui/button';
import { useStaffWhitelist } from '@/hooks/useStaffWhitelist';
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { UserPlus } from 'lucide-react';

interface StaffRegistrationButtonProps {
  onClick: () => void;
}

export const StaffRegistrationButton = ({ onClick }: StaffRegistrationButtonProps) => {
  const { isWhitelisted, loading: whitelistLoading } = useStaffWhitelist();
  const { staffProfile, loading: profileLoading } = useStaffProfile();

  // نمایش دکمه فقط اگر:
  // 1. کاربر در whitelist باشد
  // 2. هنوز درخواست تأییدشده نداشته باشد
  const shouldShow =
    !whitelistLoading &&
    !profileLoading &&
    isWhitelisted &&
    (!staffProfile || staffProfile.status !== 'approved');

  if (!shouldShow) return null;

  return (
    <Button onClick={onClick} variant="default" className="gap-2">
      <UserPlus className="h-4 w-4" />
      ثبت‌نام پرسنل
    </Button>
  );
};
