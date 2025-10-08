import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  variant = 'default',
  className
}: QuickActionCardProps) {
  const variantStyles = {
    default: 'bg-card hover:bg-accent',
    primary: 'bg-primary/10 hover:bg-primary/20 border-primary/30',
    secondary: 'bg-secondary hover:bg-secondary/80',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border p-4 sm:p-6 text-right transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          'p-3 rounded-lg transition-transform group-hover:scale-110',
          variant === 'primary' ? 'bg-primary/20' : 'bg-primary/10'
        )}>
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg mb-1 truncate">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
      
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
    </button>
  );
}
