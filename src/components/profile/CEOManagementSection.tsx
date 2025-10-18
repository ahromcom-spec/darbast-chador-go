import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Users, FileText, Settings, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CEOManagementSectionProps {
  userId: string;
  userEmail?: string;
}

export function CEOManagementSection({ userId, userEmail }: CEOManagementSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const quickActions = [
    {
      title: 'مدیریت سفارشات',
      description: 'بررسی و تایید سفارشات مشتریان',
      icon: FileText,
      href: '/ceo/orders',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'تایید پرسنل',
      description: 'بررسی درخواست‌های پرسنل',
      icon: Users,
      href: '/ceo/staff-verifications',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'تایید پیمانکاران',
      description: 'بررسی درخواست‌های پیمانکاری',
      icon: Shield,
      href: '/ceo/contractor-verifications',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'مشاهده کاربران',
      description: 'لیست کامل کاربران سیستم',
      icon: Users,
      href: '/admin/users',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'گزارشات و آمار',
      description: 'داشبورد و گزارش‌های مدیریتی',
      icon: BarChart3,
      href: '/ceo/dashboard',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'تنظیمات دسترسی',
      description: 'مدیریت شماره‌های مجاز',
      icon: Settings,
      href: '/ceo/phone-whitelist',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <Card className="border-2 border-primary/30 shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">پنل مدیریت CEO</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    دسترسی سریع به ابزارهای مدیریتی کلیدی سیستم
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="group-hover:bg-accent"
              >
                {isOpen ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => window.location.href = action.href}
                  className="p-4 rounded-lg border-2 border-border hover:border-primary/40 bg-background hover:bg-accent/5 transition-all text-right group hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${action.bgColor} group-hover:scale-110 transition-transform`}>
                      <action.icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">{action.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{action.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
