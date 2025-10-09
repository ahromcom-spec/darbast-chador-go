import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserPlus,
  ClipboardList,
  Loader2,
  ArrowLeft
} from 'lucide-react';

interface StaffStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export const GeneralManagerDashboard = () => {
  const { user } = useAuth();
  const { isGeneralManager, loading: roleLoading } = useGeneralManagerRole();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<StaffStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGeneralManager && user) {
      fetchData();
    }
  }, [isGeneralManager, user]);

  const fetchData = async () => {
    try {
      // دریافت اطلاعات پروفایل
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      setProfile(profileData);

      // دریافت آمار درخواست‌های پرسنل
      const { data: staffRequests } = await supabase
        .from('staff_profiles')
        .select('status');

      const pending = staffRequests?.filter((r) => r.status === 'pending').length || 0;
      const approved = staffRequests?.filter((r) => r.status === 'approved').length || 0;
      const rejected = staffRequests?.filter((r) => r.status === 'rejected').length || 0;

      setStats({
        pending,
        approved,
        rejected,
        total: staffRequests?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isGeneralManager) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getInitials = (name: string) => {
    if (!name) return 'GM';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name[0];
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header with Back Button */}
      <div className="mb-6 flex items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">پنل کاربری</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">مدیریت اطلاعات و سفارشات خود</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                {getInitials(profile?.full_name || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl">اطلاعات حساب کاربری</CardTitle>
              <CardDescription className="text-xs sm:text-sm">مشاهده و ویرایش اطلاعات شخصی</CardDescription>
            </div>
            <Badge variant="default" className="bg-purple-600 shrink-0">
              مدیریت کل
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">نام و نام خانوادگی</label>
            <div className="p-3 bg-muted rounded-md font-medium flex items-center justify-between gap-2">
              <span className="truncate">{profile?.full_name || 'نام ثبت نشده'}</span>
              <Button variant="ghost" size="sm" className="shrink-0">
                <span className="text-lg">✏️</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">شماره موبایل</label>
            <div className="p-3 bg-muted rounded-md font-medium direction-ltr text-right break-all">
              {profile?.phone_number || 'ثبت نشده'}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">آدرس ایمیل</label>
            <div className="p-3 bg-muted rounded-md text-sm direction-ltr text-right break-all">
              {user?.email || 'ثبت نشده'}
            </div>
            <p className="text-xs text-muted-foreground">ایمیل قابل تغییر نیست</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-4">آمار کلی</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">در انتظار</p>
                  <p className="text-3xl sm:text-4xl font-bold mt-2">{stats.pending}</p>
                </div>
                <div className="h-12 w-12 shrink-0 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">کل سفارشات</p>
                  <p className="text-3xl sm:text-4xl font-bold mt-2">{stats.total}</p>
                </div>
                <div className="h-12 w-12 shrink-0 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">تأیید شده</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">رد شده</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">کل درخواست‌ها</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">مدیریت پرسنل</CardTitle>
          <CardDescription className="text-xs sm:text-sm">دسترسی سریع به امکانات مدیریتی</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full justify-start gap-3 h-auto min-h-[3rem] py-3"
            variant="outline"
            onClick={() => navigate('/admin/staff-requests')}
          >
            <ClipboardList className="h-5 w-5 shrink-0" />
            <div className="flex-1 text-right min-w-0">
              <div className="font-semibold text-sm sm:text-base">بررسی درخواست‌های پرسنل</div>
              <div className="text-xs text-muted-foreground">تأیید یا رد درخواست‌های نقش سازمانی</div>
            </div>
            {stats.pending > 0 && (
              <Badge variant="destructive" className="ml-auto shrink-0">
                {stats.pending}
              </Badge>
            )}
          </Button>

          <Button
            className="w-full justify-start gap-3 h-auto min-h-[3rem] py-3"
            variant="outline"
            onClick={() => navigate('/admin/whitelist')}
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            <div className="flex-1 text-right min-w-0">
              <div className="font-semibold text-sm sm:text-base">مدیریت لیست مجاز</div>
              <div className="text-xs text-muted-foreground">افزودن و حذف شماره‌های مجاز برای ثبت‌نام</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
