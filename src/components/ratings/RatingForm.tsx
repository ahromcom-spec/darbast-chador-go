import { useState } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RatingCriteria, useCreateRating } from '@/hooks/useRatings';

interface RatingFormProps {
  projectId: string;
  ratedUserId: string;
  ratedUserName: string;
  ratingType: string;
  criteria: RatingCriteria[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RatingForm({
  projectId,
  ratedUserId,
  ratedUserName,
  ratingType,
  criteria,
  onSuccess,
  onCancel,
}: RatingFormProps) {
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  const createRating = useCreateRating();

  const handleCriteriaScore = (key: string, score: number) => {
    setCriteriaScores(prev => ({ ...prev, [key]: score }));
  };

  const calculateOverallScore = () => {
    if (Object.keys(criteriaScores).length === 0) return 0;
    
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = criteria.reduce((sum, c) => {
      const score = criteriaScores[c.key] || 0;
      return sum + (score * c.weight);
    }, 0);
    
    return weightedSum / totalWeight;
  };

  const handleSubmit = () => {
    const overallScore = calculateOverallScore();
    
    if (overallScore === 0) {
      return;
    }

    createRating.mutate(
      {
        project_id: projectId,
        rating_type: ratingType,
        rated_id: ratedUserId,
        overall_score: overallScore,
        criteria_scores: criteriaScores,
        comment: comment.trim() || undefined,
        is_anonymous: isAnonymous,
      },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      }
    );
  };

  const renderStars = (currentScore: number, onSelect: (score: number) => void) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index + 1)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 ${
                index < currentScore
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const overallScore = calculateOverallScore();
  const canSubmit = Object.keys(criteriaScores).length === criteria.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>امتیازدهی به {ratedUserName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* نمایش امتیاز کلی */}
        {overallScore > 0 && (
          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-2">امتیاز کلی محاسبه شده</div>
            <div className="flex items-center justify-center gap-2">
              <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
              <span className="text-3xl font-bold">{overallScore.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* معیارهای امتیازدهی */}
        <div className="space-y-4">
          {criteria.map(criterion => (
            <div key={criterion.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">{criterion.title}</Label>
                  {criterion.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {criterion.description}
                    </p>
                  )}
                </div>
                {criterion.weight > 1 && (
                  <span className="text-xs text-muted-foreground">
                    وزن: {criterion.weight}
                  </span>
                )}
              </div>
              {renderStars(criteriaScores[criterion.key] || 0, score =>
                handleCriteriaScore(criterion.key, score)
              )}
            </div>
          ))}
        </div>

        {/* نظر */}
        <div className="space-y-2">
          <Label htmlFor="comment">نظر شما (اختیاری)</Label>
          <Textarea
            id="comment"
            placeholder="تجربه خود را با ما به اشتراک بگذارید..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
          />
        </div>

        {/* ناشناس */}
        <div className="flex items-center space-x-2 space-x-reverse">
          <Checkbox
            id="anonymous"
            checked={isAnonymous}
            onCheckedChange={checked => setIsAnonymous(checked as boolean)}
          />
          <label
            htmlFor="anonymous"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            ثبت امتیاز به صورت ناشناس
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            انصراف
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || createRating.isPending}
        >
          {createRating.isPending ? 'در حال ثبت...' : 'ثبت امتیاز'}
        </Button>
      </CardFooter>
    </Card>
  );
}
