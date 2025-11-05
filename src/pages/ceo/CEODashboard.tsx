import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, UserCheck, Users, Clock, ShoppingCart } from 'lucide-react';
import { usePhoneWhitelist } from '@/hooks/usePhoneWhitelist';
import { useContractorVerificationRequests } from '@/hooks/useContractorVerificationRequests';
import { useStaffVerificationRequests } from '@/hooks/useStaffVerificationRequests';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useOrderStats } from '@/hooks/useOrderStats';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { QuickStatsGrid } from '@/components/ceo/QuickStatsGrid';
import { OrdersOverviewChart } from '@/components/ceo/OrdersOverviewChart';
import { OrdersStatusChart } from '@/components/ceo/OrdersStatusChart';
import { RecentOrdersList } from '@/components/ceo/RecentOrdersList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCEOPendingCount } from '@/hooks/useCEOPendingCount';

export const CEODashboard = () => {
  usePageTitle('داشبورد مدیرعامل');
  const navigate = useNavigate();

  const { whitelist, loading: whitelistLoading } = usePhoneWhitelist();
  const {
    pendingRequests: pendingContractors,
    loading: contractorsLoading,
  } = useContractorVerificationRequests();
  const {
    pendingRequests: pendingStaff,
    loading: staffLoading,
  } = useStaffVerificationRequests();
  const { stats: orderStats, trends, loading: statsLoading } = useOrderStats();
  const { data: ceoPendingCount = 0 } = useCEOPendingCount();

  const quickAccessStats = [
    {
      title: 'سفارشات در انتظار تایید شما',
      value: ceoPendingCount || '0',
      icon: ShoppingCart,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      onClick: () => navigate('/ceo/orders'),
      badge: ceoPendingCount > 0,
    },
    {
      title: 'شماره‌های مجاز',
      value: whitelistLoading ? '...' : whitelist.length,
      icon: Shield,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      onClick: () => navigate('/ceo/whitelist'),
    },
    {
      title: 'درخواست‌های پیمانکار',
      value: contractorsLoading ? '...' : pendingContractors.length,
      icon: UserCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950',
      onClick: () => navigate('/ceo/contractor-verifications'),
    },
    {
      title: 'درخواست‌های پرسنل',
      value: staffLoading ? '...' : pendingStaff.length,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      onClick: () => navigate('/ceo/staff-verifications'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">داشبورد مدیرعامل</h1>
        <p className="text-muted-foreground mt-2">
          مدیریت جامع سفارشات، دسترسی‌ها و عملکرد سیستم
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickAccessStats.map((stat) => (
          <Card 
            key={stat.title} 
            className="hover:shadow-lg transition-all cursor-pointer hover-scale"
            onClick={stat.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor} relative`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                {stat.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {stat.value}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders">سفارشات</TabsTrigger>
          <TabsTrigger value="management">مدیریت</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          {/* Order Statistics */}
          <QuickStatsGrid stats={orderStats} loading={statsLoading} />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OrdersOverviewChart data={trends} />
            <OrdersStatusChart stats={orderStats} />
          </div>

          {/* Recent Orders */}
          <RecentOrdersList />
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>درخواست‌های اخیر پیمانکاران</CardTitle>
              </CardHeader>
              <CardContent>
                {contractorsLoading ? (
                  <p className="text-muted-foreground">در حال بارگذاری...</p>
                ) : pendingContractors.length === 0 ? (
                  <p className="text-muted-foreground">درخواست جدیدی وجود ندارد</p>
                ) : (
                  <div className="space-y-3">
                    {pendingContractors.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {request.company_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.phone_number}
                          </p>
                        </div>
                        <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full">
                          در انتظار
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>درخواست‌های اخیر پرسنل</CardTitle>
              </CardHeader>
              <CardContent>
                {staffLoading ? (
                  <p className="text-muted-foreground">در حال بارگذاری...</p>
                ) : pendingStaff.length === 0 ? (
                  <p className="text-muted-foreground">درخواست جدیدی وجود ندارد</p>
                ) : (
                  <div className="space-y-3">
                    {pendingStaff.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {request.profiles?.full_name || 'نام نامشخص'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            نقش: {request.requested_role}
                          </p>
                        </div>
                        <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full">
                          در انتظار
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions for Management */}
          <Card>
            <CardHeader>
              <CardTitle>دسترسی سریع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => navigate('/ceo/staff-verifications')}
                >
                  <Users className="h-5 w-5 mb-2 text-primary" />
                  <span className="font-semibold">تایید پرسنل</span>
                  <span className="text-xs text-muted-foreground mt-1">بررسی درخواست‌های پرسنل</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => navigate('/ceo/contractor-verifications')}
                >
                  <UserCheck className="h-5 w-5 mb-2 text-primary" />
                  <span className="font-semibold">تایید پیمانکاران</span>
                  <span className="text-xs text-muted-foreground mt-1">بررسی درخواست‌های پیمانکاری</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto flex-col items-start p-4"
                  onClick={() => navigate('/ceo/whitelist')}
                >
                  <Shield className="h-5 w-5 mb-2 text-primary" />
                  <span className="font-semibold">مدیریت دسترسی</span>
                  <span className="text-xs text-muted-foreground mt-1">لیست شماره‌های مجاز</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
