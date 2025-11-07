import { cn } from '@/lib/utils';
import ahromLogo from '@/assets/ahrom-logo.png';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', text, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32'
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative">
        <img 
          src={ahromLogo} 
          alt="اهرم" 
          className={cn(
            "animate-pulse drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]",
            sizeClasses[size]
          )}
          style={{
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite, float 3s ease-in-out infinite'
          }}
        />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse font-semibold">{text}</p>
      )}
    </div>
  );
}
