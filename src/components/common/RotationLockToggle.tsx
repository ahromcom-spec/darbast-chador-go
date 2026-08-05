import { RotateCw, Lock } from 'lucide-react';
import { useOrientationLock } from '@/hooks/useOrientationLock';
import { cn } from '@/lib/utils';

/**
 * کلید شناور فعال/غیرفعال کردن چرخش صفحه (فقط موبایل و تبلت)
 */
export const RotationLockToggle = () => {
  const { allowRotation, toggleRotation } = useOrientationLock();

  return (
    <button
      type="button"
      onClick={toggleRotation}
      aria-label={allowRotation ? 'غیرفعال کردن چرخش صفحه' : 'فعال کردن چرخش صفحه'}
      title={allowRotation ? 'چرخش صفحه فعال است' : 'چرخش صفحه قفل است'}
      className={cn(
        'lg:hidden fixed bottom-4 right-4 z-[70] h-11 w-11 rounded-full',
        'flex items-center justify-center shadow-lg border backdrop-blur',
        'transition-colors active:scale-95',
        allowRotation
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background/90 text-muted-foreground border-border',
      )}
    >
      {allowRotation ? <RotateCw className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
    </button>
  );
};
