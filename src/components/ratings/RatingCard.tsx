import { Star, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/hooks/useRatings';
import { formatDistanceToNow } from 'date-fns';

interface RatingCardProps {
  rating: Rating;
  onVoteHelpful?: (ratingId: string, isHelpful: boolean) => void;
}

export function RatingCard({ rating, onVoteHelpful }: RatingCardProps) {
  const renderStars = (score: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < Math.floor(score)
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-muted-foreground'
        }`}
      />
    ));
  };

  const getRatingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      customer_to_contractor: 'مشتری → پیمانکار',
      contractor_to_customer: 'پیمانکار → مشتری',
      staff_to_contractor: 'پرسنل → پیمانکار',
      contractor_to_staff: 'پیمانکار → پرسنل',
      customer_to_staff: 'مشتری → پرسنل',
      staff_to_customer: 'پرسنل → مشتری',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{rating.rater_name}</span>
              {rating.is_verified && (
                <Badge variant="secondary" className="text-xs">
                  تایید شده
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {getRatingTypeLabel(rating.rating_type)}
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1 mb-1">
              {renderStars(rating.overall_score)}
            </div>
            <div className="text-sm font-bold">{rating.overall_score.toFixed(1)}</div>
          </div>
        </div>
      </CardHeader>

      {rating.comment && (
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground">{rating.comment}</p>
        </CardContent>
      )}

      <CardFooter className="flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(rating.created_at), {
            addSuffix: true,
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVoteHelpful?.(rating.id, true)}
          className="text-xs"
        >
          <ThumbsUp className="h-3 w-3 ml-1" />
          مفید بود ({rating.helpful_count})
        </Button>
      </CardFooter>
    </Card>
  );
}
