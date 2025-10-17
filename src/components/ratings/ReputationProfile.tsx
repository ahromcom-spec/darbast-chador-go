import { Star, Award, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrustBadge } from './TrustBadge';
import { ReputationScore } from '@/hooks/useRatings';

interface ReputationProfileProps {
  reputation: ReputationScore;
}

export function ReputationProfile({ reputation }: ReputationProfileProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>نمایه اعتبار</span>
          <TrustBadge
            level={reputation.trust_level}
            score={reputation.overall_score}
            totalRatings={reputation.total_ratings}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* امتیاز کلی */}
        <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
            <span className="text-4xl font-bold">{reputation.overall_score.toFixed(1)}</span>
            <span className="text-muted-foreground">/5.0</span>
          </div>
          <p className="text-sm text-muted-foreground">
            بر اساس {reputation.total_ratings} امتیاز
          </p>
        </div>

        {/* امتیازات جزئی */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">امتیازات بر اساس نقش</h3>
          
          {reputation.customer_score !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>به عنوان مشتری</span>
                <span className="font-semibold">{reputation.customer_score.toFixed(1)}</span>
              </div>
              <Progress value={(reputation.customer_score / 5) * 100} />
            </div>
          )}

          {reputation.contractor_score !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>به عنوان پیمانکار</span>
                <span className="font-semibold">{reputation.contractor_score.toFixed(1)}</span>
              </div>
              <Progress value={(reputation.contractor_score / 5) * 100} />
            </div>
          )}

          {reputation.staff_score !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>به عنوان پرسنل</span>
                <span className="font-semibold">{reputation.staff_score.toFixed(1)}</span>
              </div>
              <Progress value={(reputation.staff_score / 5) * 100} />
            </div>
          )}
        </div>

        {/* آمار */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold">{reputation.verified_projects}</div>
            <div className="text-xs text-muted-foreground">پروژه تایید شده</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <Award className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold">{reputation.total_ratings}</div>
            <div className="text-xs text-muted-foreground">امتیاز دریافتی</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
