import { Award, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrustBadgeProps {
  level: string;
  score?: number;
  totalRatings?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TrustBadge({ level, score, totalRatings, size = 'md' }: TrustBadgeProps) {
  const getBadgeConfig = (trustLevel: string) => {
    switch (trustLevel) {
      case 'platinum':
        return {
          label: 'پلاتینیوم',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-slate-400 to-slate-600 text-white',
        };
      case 'gold':
        return {
          label: 'طلایی',
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
        };
      case 'silver':
        return {
          label: 'نقره‌ای',
          variant: 'secondary' as const,
          className: 'bg-gradient-to-r from-gray-300 to-gray-500 text-white',
        };
      case 'bronze':
        return {
          label: 'برنزی',
          variant: 'secondary' as const,
          className: 'bg-gradient-to-r from-orange-400 to-orange-600 text-white',
        };
      default:
        return {
          label: 'جدید',
          variant: 'outline' as const,
          className: '',
        };
    }
  };

  const config = getBadgeConfig(level);
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Badge variant={config.variant} className={`${config.className} ${sizeClasses[size]}`}>
        <Award className="h-3 w-3 ml-1" />
        {config.label}
      </Badge>
      {score !== undefined && (
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold">{score.toFixed(1)}</span>
          {totalRatings !== undefined && (
            <span className="text-muted-foreground text-xs">({totalRatings})</span>
          )}
        </div>
      )}
    </div>
  );
}
