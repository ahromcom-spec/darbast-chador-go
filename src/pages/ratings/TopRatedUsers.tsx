import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { TrustBadge } from '@/components/ratings/TrustBadge';
import { useTopRatedUsers } from '@/hooks/useRatings';
import { useRegions } from '@/hooks/useRegions';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { Star, Award, TrendingUp, Users, Filter } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function TopRatedUsers() {
  usePageTitle('برترین پیمانکاران و پرسنل');
  
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userType, setUserType] = useState<'all' | 'contractor' | 'staff'>('all');
  
  const { data: topUsers, isLoading } = useTopRatedUsers(50);
  const { provinces } = useRegions();
  const { categories } = useServiceCategories();

  // Filter users based on selections
  const filteredUsers = topUsers?.filter(user => {
    // این قسمت را می‌توان با اطلاعات بیشتر از جدول reputation_scores تکمیل کرد
    // فعلاً فیلتر بر اساس نوع کاربر (contractor/staff) را انجام می‌دهیم
    if (userType === 'contractor' && !user.contractor_score) return false;
    if (userType === 'staff' && !user.staff_score) return false;
    return true;
  });

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-600';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-700';
    return 'text-muted-foreground';
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Award className={`h-6 w-6 ${getRankColor(rank)}`} />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">برترین پیمانکاران و پرسنل</h1>
          </div>
          <p className="text-muted-foreground">
            کاربران با بالاترین امتیازات بر اساس نظرات و ارزیابی‌های مشتریان
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کل کاربران</p>
                  <p className="text-2xl font-bold">{topUsers?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">میانگین امتیاز</p>
                  <p className="text-2xl font-bold">
                    {topUsers && topUsers.length > 0
                      ? (topUsers.reduce((sum, u) => sum + u.overall_score, 0) / topUsers.length).toFixed(1)
                      : '0'}
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">کل امتیازدهی‌ها</p>
                  <p className="text-2xl font-bold">
                    {topUsers?.reduce((sum, u) => sum + u.total_ratings, 0) || 0}
                  </p>
                </div>
                <Award className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              فیلترها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">نوع کاربر</label>
                <Select value={userType} onValueChange={(value: any) => setUserType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه</SelectItem>
                    <SelectItem value="contractor">پیمانکاران</SelectItem>
                    <SelectItem value="staff">پرسنل</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">منطقه</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="همه مناطق" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه مناطق</SelectItem>
                    {provinces?.map((province) => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">نوع خدمات</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="همه خدمات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه خدمات</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Users List */}
        <div className="space-y-4">
          {filteredUsers && filteredUsers.length > 0 ? (
            filteredUsers.map((user, index) => {
              const rank = index + 1;
              const userScore = userType === 'contractor' 
                ? user.contractor_score 
                : userType === 'staff' 
                  ? user.staff_score 
                  : user.overall_score;

              return (
                <Card 
                  key={user.id} 
                  className={`transition-all hover:shadow-lg cursor-pointer ${
                    rank <= 3 ? 'border-2 border-primary/20' : ''
                  }`}
                  onClick={() => navigate(`/reputation/${user.user_id}`)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-12 flex items-center justify-center">
                        {getRankIcon(rank)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold">{user.full_name || 'کاربر'}</h3>
                          <TrustBadge 
                            level={user.trust_level}
                            score={userScore || user.overall_score} 
                            size="sm" 
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            <span className="font-bold text-foreground">
                              {(userScore || user.overall_score).toFixed(1)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4" />
                            <span>{user.total_ratings} امتیازدهی</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {user.verified_projects} پروژه تایید شده
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Scores Breakdown */}
                      <div className="hidden md:flex flex-col gap-2 text-xs">
                        {user.contractor_score !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">پیمانکار:</span>
                            <Badge variant="secondary">
                              {user.contractor_score.toFixed(1)}
                            </Badge>
                          </div>
                        )}
                        {user.staff_score !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">پرسنل:</span>
                            <Badge variant="secondary">
                              {user.staff_score.toFixed(1)}
                            </Badge>
                          </div>
                        )}
                        {user.customer_score !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">مشتری:</span>
                            <Badge variant="secondary">
                              {user.customer_score.toFixed(1)}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* View Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/reputation/${user.user_id}`);
                        }}
                      >
                        مشاهده پروفایل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">کاربری با این فیلترها یافت نشد</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
