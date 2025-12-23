import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Building2, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAssignment {
  id: string;
  module_key: string;
  module_name: string;
  assigned_phone_number: string;
  assigned_at: string;
  is_active: boolean;
}

interface ModuleInfo {
  key: string;
  name: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  icon: string;
}

const MODULE_DETAILS: Record<string, ModuleInfo> = {
  scaffold_execution_with_materials: {
    key: 'scaffold_execution_with_materials',
    name: 'ماژول مدیریت اجرایی خدمات اجرای داربست به همراه اجناس',
    description: 'مدیریت و پیگیری سفارشات خدمات اجرای داربست به همراه اجناس',
    href: '/executive',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: 'scaffold',
  },
  daily_report: {
    key: 'daily_report',
    name: 'ماژول گزارش روزانه شرکت اهرم',
    description: 'ثبت گزارش فعالیت‌های روزانه شرکت و نیروها',
    href: '/daily-report',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: 'report',
  },
  hr_management: {
    key: 'hr_management',
    name: 'ماژول مدیریت منابع انسانی',
    description: 'ثبت و مدیریت نیروهای شرکت اهرم',
    href: '/hr-management',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: 'users',
  },
};

export function UserModulesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchUserPhone();
  }, [user]);

  useEffect(() => {
    if (userPhone) {
      fetchUserModules();
    }
  }, [userPhone]);

  const fetchUserPhone = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setUserPhone(data?.phone_number || null);
    } catch (error) {
      console.error('Error fetching user phone:', error);
      setLoading(false);
    }
  };

  const fetchUserModules = async () => {
    if (!userPhone) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('module_assignments')
        .select('*')
        .eq('assigned_phone_number', userPhone)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching module assignments:', error);
      toast.error('خطا در دریافت ماژول‌ها');
    } finally {
      setLoading(false);
    }
  };

  const getModuleInfo = (key: string): ModuleInfo => {
    return MODULE_DETAILS[key] || {
      key,
      name: key,
      description: '',
      href: '/',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: 'default',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">در حال بارگذاری ماژول‌ها...</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">ماژولی یافت نشد</h3>
          <p className="text-muted-foreground">
            هنوز ماژولی به شما اختصاص داده نشده است. برای دریافت دسترسی با مدیر سیستم تماس بگیرید.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          ماژول‌های من
        </h3>
        <p className="text-sm text-muted-foreground">
          ماژول‌هایی که به شما اختصاص داده شده و می‌توانید به آنها دسترسی داشته باشید
        </p>
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => {
          const moduleInfo = getModuleInfo(assignment.module_key);
          // Use assignment.module_name as fallback if MODULE_DETAILS doesn't have the name
          const displayName = MODULE_DETAILS[assignment.module_key]?.name || assignment.module_name || assignment.module_key;
          return (
            <Card
              key={assignment.id}
              className="border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => navigate(moduleInfo.href)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${moduleInfo.bgColor} group-hover:scale-105 transition-transform`}>
                    <Building2 className={`h-8 w-8 ${moduleInfo.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-foreground mb-1">
                      {displayName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {moduleInfo.description}
                    </p>
                  </div>
                  <Button
                    variant="default"
                    className="gap-2 group-hover:translate-x-[-4px] transition-transform"
                  >
                    <span>ورود به ماژول</span>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
