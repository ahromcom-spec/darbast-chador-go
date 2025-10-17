import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useReputationScore, useUserRatings, useVoteHelpful } from '@/hooks/useRatings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ReputationProfile } from '@/components/ratings/ReputationProfile';
import { RatingCard } from '@/components/ratings/RatingCard';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { Star } from 'lucide-react';

export default function ReputationDashboard() {
  const { userId } = useParams();
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  const { data: reputation, isLoading: reputationLoading } = useReputationScore(targetUserId);
  const { data: ratings, isLoading: ratingsLoading } = useUserRatings(targetUserId || '');
  const voteHelpful = useVoteHelpful();

  if (reputationLoading || ratingsLoading) {
    return <LoadingSpinner />;
  }

  if (!targetUserId) {
    return (
      <div className="container mx-auto p-6">
        <EmptyState
          icon={Star}
          title="کاربر یافت نشد"
          description="لطفاً وارد شوید یا کاربر معتبری را انتخاب کنید"
        />
      </div>
    );
  }

  // گروه‌بندی امتیازات بر اساس نوع
  const groupedRatings = ratings?.reduce((acc, rating) => {
    const type = rating.rating_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(rating);
    return acc;
  }, {} as Record<string, typeof ratings>);

  const getRatingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      customer_to_contractor: 'به عنوان پیمانکار',
      contractor_to_customer: 'به عنوان مشتری',
      staff_to_contractor: 'به عنوان پیمانکار (از پرسنل)',
      contractor_to_staff: 'به عنوان پرسنل',
      customer_to_staff: 'به عنوان پرسنل (از مشتری)',
      staff_to_customer: 'به عنوان مشتری (از پرسنل)',
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="نمایه اعتبار و امتیازات"
        description="مشاهده امتیازات دریافتی و نمایه اعتبار کاربر"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* نمایه اعتبار */}
        <div className="lg:col-span-1">
          {reputation ? (
            <ReputationProfile reputation={reputation} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>نمایه اعتبار</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Star}
                  title="امتیازی ثبت نشده"
                  description="هنوز امتیازی برای این کاربر ثبت نشده است"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* امتیازات دریافتی */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>امتیازات دریافتی ({ratings?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!ratings || ratings.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="امتیازی وجود ندارد"
                  description="هنوز امتیازی برای نمایش وجود ندارد"
                />
              ) : (
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="all">همه ({ratings.length})</TabsTrigger>
                    {Object.keys(groupedRatings || {}).map(type => (
                      <TabsTrigger key={type} value={type}>
                        {getRatingTypeLabel(type)} ({groupedRatings?.[type]?.length})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="all" className="space-y-4 mt-4">
                    {ratings.map(rating => (
                      <RatingCard
                        key={rating.id}
                        rating={rating}
                        onVoteHelpful={(ratingId, isHelpful) =>
                          voteHelpful.mutate({ ratingId, isHelpful })
                        }
                      />
                    ))}
                  </TabsContent>

                  {Object.entries(groupedRatings || {}).map(([type, typeRatings]) => (
                    <TabsContent key={type} value={type} className="space-y-4 mt-4">
                      {typeRatings.map(rating => (
                        <RatingCard
                          key={rating.id}
                          rating={rating}
                          onVoteHelpful={(ratingId, isHelpful) =>
                            voteHelpful.mutate({ ratingId, isHelpful })
                          }
                        />
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
