import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Boxes, Plus, Trash2, User, Phone, Building2, Loader2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DraggableModuleItem, ModuleItem } from './DraggableModuleItem';
import { useModuleHierarchy } from '@/hooks/useModuleHierarchy';

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
    key: 'all_company_orders',
    name: 'ماژول کل سفارشات شرکت اهرم',
    description: 'مشاهده تمام سفارشات ثبت شده توسط همه کاربران',
    href: '/all-company-orders',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
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
  {
    key: 'comprehensive_accounting',
    name: 'ماژول حسابداری جامع',
    description: 'مدیریت حساب‌های مشتریان، نیروها و پرسنل',
    href: '/comprehensive-accounting',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
];

// Convert modules to ModuleItem format
const convertModulesToItems = (modules: Module[]): ModuleItem[] => {
  return modules.map(m => ({
    id: m.key,
    type: 'module' as const,
    key: m.key,
    name: m.name,
    description: m.description,
    href: m.href,
    color: m.color,
    bgColor: m.bgColor,
  }));
};

export function ModulesManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>(AVAILABLE_MODULES[0].key);

  // Memoize initial modules to prevent infinite loop
  const initialAvailableModules = useMemo(() => convertModulesToItems(AVAILABLE_MODULES), []);

  // Fetch assignments function - defined with useCallback before useModuleHierarchy
  const fetchAssignments = useCallback(async () => {
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
  }, []);

  // Module hierarchy for available modules
  const availableHierarchy = useModuleHierarchy({
    type: 'available',
    initialModules: initialAvailableModules,
    onModuleNameChange: fetchAssignments,
  });

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Mapping module keys to required roles
  const MODULE_TO_ROLE: Record<string, string> = {
    all_company_orders: 'ceo',
    scaffold_execution_with_materials: 'executive_manager_scaffold_execution_with_materials',
    daily_report: 'scaffold_executive_manager',
    hr_management: 'general_manager',
    personnel_accounting: 'scaffold_executive_manager',
    site_registration: 'general_manager',
    comprehensive_accounting: 'finance_manager',
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

      // If user exists, also assign the corresponding role
      if (profile?.user_id) {
        const roleToAssign = MODULE_TO_ROLE[module.key];
        if (roleToAssign) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .upsert({
              user_id: profile.user_id,
              role: roleToAssign as any,
            }, { onConflict: 'user_id,role' });

          // Ignore duplicate role error (23505)
          if (roleError && roleError.code !== '23505') {
            console.error('Error assigning role:', roleError);
          }
        }
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

  const handleCreateFolder = () => {
    const newFolder: ModuleItem = {
      id: `folder-${Date.now()}`,
      type: 'folder',
      key: `folder-${Date.now()}`,
      name: 'پوشه جدید',
      description: 'برای اضافه کردن ماژول‌ها، آن‌ها را روی این پوشه بکشید',
      children: [],
      isOpen: true,
    };
    availableHierarchy.setItems(prev => [newFolder, ...prev]);
  };

  // Convert assignments to ModuleItem format for assigned modules section
  const assignedModulesAsItems = useMemo((): ModuleItem[] => {
    return assignments.map(a => {
      const moduleInfo = getModuleInfo(a.module_key);
      return {
        id: a.id,
        type: 'module' as const,
        key: a.module_key,
        name: a.module_name,
        description: `${a.assigned_phone_number} - ${a.assigned_user_name || 'کاربر یافت نشد'}`,
        href: moduleInfo?.href,
        color: moduleInfo?.color || 'text-gray-600',
        bgColor: moduleInfo?.bgColor || 'bg-gray-100',
      };
    });
  }, [assignments]);

  // Module hierarchy for assigned modules
  const assignedHierarchy = useModuleHierarchy({
    type: 'assigned',
    initialModules: assignedModulesAsItems,
  });

  // Update assigned hierarchy when assignments change
  useEffect(() => {
    if (assignedHierarchy.isLoaded && assignedModulesAsItems.length > 0) {
      // Only update if there are new assignments not in hierarchy
      const currentIds = new Set<string>();
      const collectIds = (items: ModuleItem[]) => {
        items.forEach(item => {
          currentIds.add(item.id);
          if (item.children) collectIds(item.children);
        });
      };
      collectIds(assignedHierarchy.items);
      
      const newAssignments = assignedModulesAsItems.filter(a => !currentIds.has(a.id));
      if (newAssignments.length > 0) {
        assignedHierarchy.setItems(prev => [...prev, ...newAssignments]);
      }
    }
  }, [assignedModulesAsItems, assignedHierarchy.isLoaded]);

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
            {/* Available Modules with Drag & Drop */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">ماژول‌های موجود</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateFolder}
                  className="gap-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  ایجاد پوشه
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                برای مرتب‌سازی، ماژول‌ها را بکشید و رها کنید. با انداختن ماژول روی ماژول دیگر، پوشه ایجاد می‌شود.
              </p>
              <div className="space-y-2">
                {availableHierarchy.items.map((item) => (
                  <DraggableModuleItem
                    key={item.id}
                    item={item}
                    onDragStart={availableHierarchy.handleDragStart}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={availableHierarchy.handleDrop}
                    onDragEnd={availableHierarchy.handleDragEnd}
                    onToggleFolder={availableHierarchy.toggleFolder}
                    onEditItem={availableHierarchy.editItem}
                    onNavigate={(href) => navigate(href)}
                    customNames={availableHierarchy.customNames}
                  />
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

            {/* Current Assignments with Drag & Drop */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">
                  اختصاص‌های فعلی
                  {assignments.length > 0 && (
                    <Badge variant="secondary" className="mr-2">
                      {assignments.length}
                    </Badge>
                  )}
                </h4>
              </div>
              
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
