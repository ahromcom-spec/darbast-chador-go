import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, UserCheck, Users, Clock } from 'lucide-react';
import { usePhoneWhitelist } from '@/hooks/usePhoneWhitelist';
import { useContractorVerificationRequests } from '@/hooks/useContractorVerificationRequests';
import { useStaffVerificationRequests } from '@/hooks/useStaffVerificationRequests';
import { usePageTitle } from '@/hooks/usePageTitle';

export const CEODashboard = () => {
  usePageTitle('داشبورد CEO');

  const { whitelist, loading: whitelistLoading } = usePhoneWhitelist();
  const {
    pendingRequests: pendingContractors,
    loading: contractorsLoading,
  } = useContractorVerificationRequests();
  const {
    pendingRequests: pendingStaff,
    loading: staffLoading,
  } = useStaffVerificationRequests();

  const stats = [
    {
      title: 'شماره‌های مجاز',
      value: whitelistLoading ? '...' : whitelist.length,
      icon: Shield,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'درخواست‌های پیمانکار',
      value: contractorsLoading ? '...' : pendingContractors.length,
      icon: UserCheck,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'درخواست‌های پرسنل',
      value: staffLoading ? '...' : pendingStaff.length,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: 'در انتظار بررسی',
      value:
        contractorsLoading || staffLoading
          ? '...'
          : pendingContractors.length + pendingStaff.length,
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">داشبورد مدیریت</h1>
        <p className="text-muted-foreground mt-2">
          خلاصه‌ای از وضعیت سیستم مدیریت دسترسی و تأیید کاربران
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
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
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                      در انتظار
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
