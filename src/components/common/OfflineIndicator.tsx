import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineIndicator() {
  const { online } = useNetworkStatus();

  if (online) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom">
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>حالت آفلاین</AlertTitle>
        <AlertDescription>
          اتصال اینترنت قطع است. داده‌های ذخیره شده قبلی نمایش داده می‌شوند.
        </AlertDescription>
      </Alert>
    </div>
  );
}
