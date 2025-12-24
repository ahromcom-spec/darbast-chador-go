import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Boxes, Plus, Trash2, User, Phone, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAssignment {
  id: string;
  module_key: string;
  module_name: string;
  assigned_phone_number: string;
  assigned_user_id: string | null;
  assigned_at: string;
  is_active: boolean;
  assigned_user_name?: string;
}

interface Module {
  key: string;
  name: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
}

const AVAILABLE_MODULES: Module[] = [
  {
    key: 'scaffold_execution_with_materials',
    name: 'ماژول مدیریت اجرای داربست به همراه اجناس',
    description: 'مدیریت سفارشات اجرای داربست به همراه اجناس',
    href: '/executive',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'daily_report',
    name: 'ماژول گزارش روزانه شرکت اهرم',
    description: 'ثبت گزارش فعالیت‌های روزانه شرکت و نیروها',
    href: '/daily-report',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'hr_management',
    name: 'ماژول مدیریت منابع انسانی',
    description: 'ثبت و مدیریت نیروهای شرکت اهرم',
    href: '/hr-management',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    key: 'personnel_accounting',
    name: 'ماژول حسابکتاب و کارکرد پرسنل',
    description: 'مشاهده کارکرد و حسابکتاب شخصی',
    href: '/personnel-accounting',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    key: 'site_registration',
    name: 'ماژول ثبت‌نام در سایت اهرم',
    description: 'ثبت‌نام کاربران جدید بدون نیاز به کد تایید',
    href: '/site-registration',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
];

export function ModulesManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>(AVAILABLE_MODULES[0].key);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('module_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user names for assigned users
      const assignmentsWithNames: ModuleAssignment[] = [];
      for (const assignment of data || []) {
        let userName = null;
        if (assignment.assigned_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', assignment.assigned_user_id)
            .single();
          userName = profile?.full_name;
        }
        assignmentsWithNames.push({
          ...assignment,
          assigned_user_name: userName || undefined,
        });
      }

      setAssignments(assignmentsWithNames);
    } catch (error) {
      console.error('Error fetching module assignments:', error);
      toast.error('خطا در دریافت ماژول‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignModule = async () => {
    if (!newPhoneNumber.trim()) {
      toast.error('لطفاً شماره موبایل را وارد کنید');
      return;
    }

    // Validate phone number format
    if (!/^09[0-9]{9}$/.test(newPhoneNumber)) {
      toast.error('شماره موبایل باید با 09 شروع شود و 11 رقم باشد');
      return;
    }

    const module = AVAILABLE_MODULES.find(m => m.key === selectedModule);
    if (!module) {
      toast.error('ماژول نامعتبر');
      return;
    }

    try {
      setSaving(true);

      // Check if user exists with this phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('phone_number', newPhoneNumber)
        .single();

      // Insert the assignment
      const { error } = await supabase
        .from('module_assignments')
        .insert({
          module_key: module.key,
          module_name: module.name,
          assigned_phone_number: newPhoneNumber,
          assigned_user_id: profile?.user_id || null,
          assigned_by: user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('این شماره قبلاً به این ماژول اختصاص یافته است');
        } else {
          throw error;
        }
        return;
      }

      toast.success('ماژول با موفقیت اختصاص یافت');
      setNewPhoneNumber('');
      fetchAssignments();
    } catch (error) {
      console.error('Error assigning module:', error);
      toast.error('خطا در اختصاص ماژول');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('module_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('اختصاص ماژول لغو شد');
      fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('خطا در لغو اختصاص');
    }
  };

  const getModuleInfo = (key: string) => {
    return AVAILABLE_MODULES.find(m => m.key === key);
  };

  return (
    <Card className="border-2 border-amber-500/30 shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Boxes className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">ماژول‌ها</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    مدیریت و اختصاص ماژول‌ها به پرسنل
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
          <CardContent className="pt-0 space-y-6">
            {/* Available Modules */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">ماژول‌های موجود</h4>
              <div className="grid gap-3">
                {AVAILABLE_MODULES.map((module) => (
                  <div
                    key={module.key}
                    className="p-4 rounded-lg border-2 border-border bg-background"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${module.bgColor}`}>
                        <Building2 className={`h-5 w-5 ${module.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1">{module.name}</div>
                        <div className="text-xs text-muted-foreground">{module.description}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(module.href)}
                      >
                        ورود به ماژول
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assign Module */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">اختصاص ماژول به پرسنل</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {AVAILABLE_MODULES.map((module) => (
                      <option key={module.key} value={module.key}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Input
                    type="tel"
                    placeholder="شماره موبایل (مثال: 09123456789)"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <Button
                  onClick={handleAssignModule}
                  disabled={saving || !/^09[0-9]{9}$/.test(newPhoneNumber)}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  اختصاص
                </Button>
              </div>
            </div>

            {/* Current Assignments */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                اختصاص‌های فعلی
                {assignments.length > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {assignments.length}
                  </Badge>
                )}
              </h4>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  هنوز ماژولی اختصاص داده نشده است
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => {
                    const moduleInfo = getModuleInfo(assignment.module_key);
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${moduleInfo?.bgColor || 'bg-gray-100'}`}>
                            <Building2 className={`h-4 w-4 ${moduleInfo?.color || 'text-gray-600'}`} />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {assignment.module_name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{assignment.assigned_phone_number}</span>
                              {assignment.assigned_user_name && (
                                <>
                                  <User className="h-3 w-3 mr-2" />
                                  <span>{assignment.assigned_user_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
