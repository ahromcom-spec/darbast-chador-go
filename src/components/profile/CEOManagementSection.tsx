import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Users, FileText, Settings } from 'lucide-react';
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
      title: 'مدیریت نقش‌ها',
      description: 'تخصیص نقش به کاربران',
      icon: Shield,
      href: '/ceo/staff-verifications',
    },
    {
      title: 'مشاهده کاربران',
      description: 'لیست کاربران سیستم',
      icon: Users,
      href: '/admin/users',
    },
    {
      title: 'گزارشات',
      description: 'مشاهده گزارش‌ها و آمار',
      icon: FileText,
      href: '/ceo/dashboard',
    },
    {
      title: 'تنظیمات',
      description: 'مدیریت تنظیمات سیستم',
      icon: Settings,
      href: '/ceo/phone-whitelist',
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
                    دسترسی به امکانات مدیریتی سیستم
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  onClick={() => window.location.href = action.href}
                  className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 bg-background hover:bg-accent/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{action.title}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
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
