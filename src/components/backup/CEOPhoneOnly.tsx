import { useIsCEOPhone } from '@/hooks/useIsCEOPhone';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

export default function CEOPhoneOnly({ children }: { children: ReactNode }) {
  const { isCEO, loading } = useIsCEOPhone();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isCEO) {
    return (
      <div className="container mx-auto max-w-2xl py-10 px-4" dir="rtl">
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>دسترسی محدود</AlertTitle>
          <AlertDescription>
            این بخش فقط برای مدیرعامل (شماره ثبت‌شده در سیستم) قابل دسترس است.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}
