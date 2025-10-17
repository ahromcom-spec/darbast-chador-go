import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRatingCriteria, useTopRatedUsers } from '@/hooks/useRatings';
import { RatingForm } from '@/components/ratings/RatingForm';
import { TrustBadge } from '@/components/ratings/TrustBadge';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Award, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function RatingTestPage() {
  const { user } = useAuth();
  const [selectedRatingType, setSelectedRatingType] = useState<string>('customer_to_contractor');
  const [showForm, setShowForm] = useState(false);

  const { data: criteria, isLoading: criteriaLoading } = useRatingCriteria(selectedRatingType);
  const { data: topUsers, isLoading: topUsersLoading } = useTopRatedUsers(10);

  const ratingTypes = [
    { value: 'customer_to_contractor', label: 'مشتری به پیمانکار' },
    { value: 'contractor_to_customer', label: 'پیمانکار به مشتری' },
    { value: 'staff_to_contractor', label: 'پرسنل به پیمانکار' },
    { value: 'contractor_to_staff', label: 'پیمانکار به پرسنل' },
    { value: 'customer_to_staff', label: 'مشتری به پرسنل' },
    { value: 'staff_to_customer', label: 'پرسنل به مشتری' },
  ];

  if (criteriaLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="تست سیستم امتیازدهی ۳۶۰ درجه"
        description="آزمایش عملکرد سیستم امتیازدهی و نمایش برترین کاربران"
      />

      {/* راهنما */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            سیستم امتیازدهی چندطرفه
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✅ امتیازدهی دوطرفه بین مشتری - پیمانکار - پرسنل</p>
          <p>✅ معیارهای وزن‌دار و تخصصی برای هر نوع رابطه</p>
          <p>✅ محاسبه خودکار نمایه اعتبار و سطوح اعتماد</p>
          <p>✅ سیستم رای مفید بودن و حق پاسخگویی</p>
          <p>✅ امتیازدهی ناشناس و تایید خودکار پروژه‌های بسته شده</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* فرم تست امتیازدهی */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تست ثبت امتیاز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">انتخاب نوع امتیازدهی</label>
                <Select value={selectedRatingType} onValueChange={setSelectedRatingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {criteria && criteria.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">معیارهای امتیازدهی ({criteria.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {criteria.map(criterion => (
                      <div key={criterion.key} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{criterion.title}</span>
                          {criterion.weight > 1 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              وزن: {criterion.weight}
                            </span>
                          )}
                        </div>
                        {criterion.description && (
                          <p className="text-xs text-muted-foreground">{criterion.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setShowForm(!showForm)}
                className="w-full"
              >
                {showForm ? 'پنهان کردن فرم' : 'نمایش فرم تست امتیازدهی'}
              </Button>

              {showForm && user && criteria && (
                <div className="border-t pt-4">
                  <RatingForm
                    projectId="00000000-0000-0000-0000-000000000001"
                    ratedUserId={user.id}
                    ratedUserName="کاربر تست"
                    ratingType={selectedRatingType}
                    criteria={criteria}
                    onSuccess={() => {
                      setShowForm(false);
                    }}
                    onCancel={() => setShowForm(false)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* توضیحات سطوح اعتماد */}
          <Card>
            <CardHeader>
              <CardTitle>سطوح اعتماد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <TrustBadge level="platinum" score={4.8} totalRatings={52} />
                <span className="text-sm">≥50 امتیاز، نمره ≥4.5</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <TrustBadge level="gold" score={4.2} totalRatings={28} />
                <span className="text-sm">≥25 امتیاز، نمره ≥4.0</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <TrustBadge level="silver" score={3.7} totalRatings={12} />
                <span className="text-sm">≥10 امتیاز، نمره ≥3.5</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <TrustBadge level="bronze" score={3.2} totalRatings={5} />
                <span className="text-sm">≥3 امتیاز، نمره ≥3.0</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <TrustBadge level="new" />
                <span className="text-sm">کاربران جدید</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* برترین کاربران */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                برترین کاربران
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topUsersLoading ? (
                <LoadingSpinner />
              ) : !topUsers || topUsers.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="کاربری یافت نشد"
                  description="هنوز کاربری امتیاز دریافت نکرده است"
                />
              ) : (
                <div className="space-y-3">
                  {topUsers.map((user, index) => (
                    <Link
                      key={user.id}
                      to={`/reputation/${user.user_id}`}
                      className="block"
                    >
                      <div className="p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-primary">#{index + 1}</span>
                            <span className="font-semibold">{user.full_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold">{user.overall_score.toFixed(1)}</span>
                          </div>
                        </div>
                        <TrustBadge
                          level={user.trust_level}
                          totalRatings={user.total_ratings}
                          size="sm"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
