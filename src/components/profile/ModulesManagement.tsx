import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Boxes, Plus, Trash2, User, Phone, Building2, Loader2, FolderPlus, Search, X, Filter, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleItem as ModuleItemComponent, ModuleItemData } from './ModuleItem';
import { AssignedModuleItemWithFolder, AssignedHierarchyItem, AssignedModuleData, AssignedUser } from './AssignedModuleItemWithFolder';
import { ModuleItem } from './DraggableModuleItem';
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
  {
    key: 'customer_comprehensive_invoice',
    name: 'ماژول صورتحساب جامع مشتریان',
    description: 'صدور صورتحساب جامع همه خدمات و پرداخت‌ها برای هر مشتری',
    href: '/customer-comprehensive-invoice',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    key: 'my_invoice',
    name: 'صورتحساب من',
    description: 'مشاهده صورتحساب جامع سفارشات و پرداخت‌های شخصی',
    href: '/my-invoice',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    key: 'site_analytics',
    name: 'ماژول آمار بازدید سایت اهرم',
    description: 'تحلیل جامع بازدیدکنندگان، کاربران، دستگاه‌ها و رفتار کاربران در سایت',
    href: '/site-analytics',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    key: 'media_approval',
    name: 'ماژول مدیریت رسانه‌های سایت',
    description: 'تایید و مدیریت عکس‌ها و فیلم‌هایی که در صفحه اصلی فعالیت‌های اخیر نمایش داده می‌شوند',
    href: '/media-approval',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
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

const isDeletedHierarchyItem = (item: ModuleItem) => Boolean((item as any).is_deleted);

// Hide deleted modules from UI while keeping their keys in the saved hierarchy
// so mergeAvailableHierarchy doesn't re-add them after refresh.
const stripDeletedHierarchyItems = (items: ModuleItem[]): ModuleItem[] =>
  items
    .filter((it) => !isDeletedHierarchyItem(it))
    .map((it) =>
      it.type === 'folder'
        ? { ...it, children: stripDeletedHierarchyItems(it.children || []) }
        : it
    );

export function ModulesManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>(AVAILABLE_MODULES[0].key);
  const [availableSearch, setAvailableSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');
  const [availableTypeFilter, setAvailableTypeFilter] = useState<string>('all');

  // OTP verification state for module deletion
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const [pendingDeleteItemName, setPendingDeleteItemName] = useState<string>('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);

  // OTP countdown timer effect
  useEffect(() => {
    if (!otpSent || otpTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setOtpTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSent, otpTimeLeft]);

  // Get unique module types for filter
  const moduleTypes = useMemo(() => {
    return AVAILABLE_MODULES.map(m => ({ key: m.key, name: m.name }));
  }, []);

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

  const visibleAvailableItems = useMemo(
    () => stripDeletedHierarchyItems(availableHierarchy.items),
    [availableHierarchy.items],
  );

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Mapping module keys to required roles
  const MODULE_TO_ROLE: Record<string, string> = {
    scaffold_execution_with_materials: 'executive_manager_scaffold_execution_with_materials',
    daily_report: 'scaffold_executive_manager',
    hr_management: 'general_manager',
    personnel_accounting: 'scaffold_executive_manager',
    site_registration: 'general_manager',
    comprehensive_accounting: 'finance_manager',
  };

  // Get all assignable modules (both base and custom/copied modules)
  const getAllAssignableModules = useMemo(() => {
    // Collect all modules from availableHierarchy, including from folders
    const collectModules = (items: ModuleItem[]): ModuleItem[] => {
      const result: ModuleItem[] = [];
      for (const item of items) {
        if (item.type === 'module') {
          result.push(item);
        } else if (item.type === 'folder' && item.children) {
          result.push(...collectModules(item.children));
        }
      }
      return result;
    };
    return collectModules(visibleAvailableItems);
  }, [visibleAvailableItems]);

  // Get module info for assignment dropdown with custom names
  const getModuleDisplayInfo = (item: ModuleItem) => {
    const customName = availableHierarchy.customNames[item.key]?.name || item.name;
    const customDesc = availableHierarchy.customNames[item.key]?.description || item.description;
    const baseModule = AVAILABLE_MODULES.find(m => m.key === item.key);
    return {
      key: item.key,
      name: customName,
      description: customDesc,
      href: item.href || baseModule?.href || '/executive',
      color: item.color || baseModule?.color || 'text-gray-600',
      bgColor: item.bgColor || baseModule?.bgColor || 'bg-gray-100',
    };
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

    // Find the selected module from all assignable modules
    const selectedItem = getAllAssignableModules.find(m => m.key === selectedModule);
    if (!selectedItem) {
      toast.error('ماژول نامعتبر');
      return;
    }

    const moduleInfo = getModuleDisplayInfo(selectedItem);

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
          module_key: selectedItem.key,
          module_name: moduleInfo.name,
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

      // If user exists, also assign the corresponding role (only for base modules)
      if (profile?.user_id) {
        const roleToAssign = MODULE_TO_ROLE[selectedItem.key];
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
    availableHierarchy.setItems(prev => {
      const newItems = [newFolder, ...prev];
      try {
        localStorage.setItem('module_hierarchy_available', JSON.stringify(newItems));
      } catch (error) {
        console.error('Error saving folder:', error);
      }
      return newItems;
    });
  };

  // Duplicate a module (copy with new id/key)
  const handleDuplicateModule = (item: ModuleItem) => {
    const timestamp = Date.now();
    const newModule: ModuleItem = {
      ...item,
      id: `custom-${timestamp}`,
      key: `custom-${timestamp}`,
      name: `${item.name} (کپی)`,
      description: item.description,
    };
    availableHierarchy.setItems(prev => {
      const newItems = [newModule, ...prev];
      // Save to localStorage immediately
      try {
        localStorage.setItem('module_hierarchy_available', JSON.stringify(newItems));
      } catch (error) {
        console.error('Error saving duplicated module:', error);
      }
      return newItems;
    });
    toast.success('ماژول کپی شد. می‌توانید آن را ویرایش کنید.');
  };

  // Check if a module has active assignments - check by module_key OR module_name
  const getModuleAssignments = (moduleKey: string, moduleName?: string): ModuleAssignment[] => {
    return assignments.filter(a => {
      if (!a.is_active) return false;
      // Check by key (for base modules)
      if (a.module_key === moduleKey) return true;
      // Also check by name (for duplicated modules with same name)
      if (moduleName && a.module_name === moduleName) return true;
      return false;
    });
  };

  // Check if an available module can be deleted (no assignments)
  const canDeleteModule = (item: ModuleItem): boolean => {
    const displayName = availableHierarchy.customNames[item.key]?.name || item.name;
    const baseKey = getBaseModuleKey(item);
    const moduleAssignments = getModuleAssignments(baseKey || item.key, displayName);
    return moduleAssignments.length === 0;
  };

  // Get the base module key from a possibly-duplicated module
  const getBaseModuleKey = (item: ModuleItem): string | null => {
    // If it's already a base module
    const baseModule = AVAILABLE_MODULES.find(m => m.key === item.key);
    if (baseModule) return baseModule.key;
    
    // Check if the name matches a base module (for duplicated modules)
    const displayName = availableHierarchy.customNames[item.key]?.name || item.name;
    const matchByName = AVAILABLE_MODULES.find(m => 
      displayName.includes(m.name) || m.name.includes(displayName.replace(' (کپی)', ''))
    );
    if (matchByName) return matchByName.key;
    
    return null;
  };

  // Send OTP to CEO for module deletion
  const sendCeoOtp = async (moduleName: string) => {
    setOtpSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-ceo-otp', {
        body: { 
          action: 'module_delete',
          purpose: `حذف ماژول "${moduleName}"`
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return false;
      }

      setOtpSent(true);
      setOtpTimeLeft(90); // Start 90 second countdown
      toast.success('کد تایید به شماره مدیرعامل ارسال شد');
      return true;
    } catch (error) {
      console.error('Error sending CEO OTP:', error);
      toast.error('خطا در ارسال کد تایید');
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  // Verify CEO OTP and delete module
  const verifyCeoOtpAndDelete = async () => {
    if (!otpCode || otpCode.length < 5) {
      toast.error('لطفاً کد ۵ رقمی را کامل وارد کنید');
      return;
    }

    if (!pendingDeleteItemId) return;

    setOtpVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-ceo-otp', {
        body: { 
          code: otpCode,
          action: 'module_delete'
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        toast.error(data?.error || 'کد تایید نادرست است');
        return;
      }

      // OTP verified - proceed with deletion
      // IMPORTANT: For base modules, simple removal would be undone on refresh because
      // mergeAvailableHierarchy re-adds any missing base modules. So we mark it as deleted
      // (tombstone) and hide it from UI.
      const markItemDeleted = (items: ModuleItem[], id: string): ModuleItem[] => {
        return items.map((item) => {
          if (item.id === id) {
            return { ...(item as any), is_deleted: true } as ModuleItem;
          }
          if (!item.children) return item;
          return { ...item, children: markItemDeleted(item.children, id) };
        });
      };

      const newItems = markItemDeleted(availableHierarchy.items, pendingDeleteItemId);

      // Update UI + persist immediately (so refresh won't bring it back)
      availableHierarchy.setItems(() => newItems);
      await availableHierarchy.saveNow(newItems);

      toast.success('ماژول با موفقیت حذف شد');
      
      // Reset OTP state
      setOtpDialogOpen(false);
      setOtpCode('');
      setPendingDeleteItemId(null);
      setPendingDeleteItemName('');
      setOtpSent(false);
      setOtpTimeLeft(0);
    } catch (error) {
      console.error('Error verifying CEO OTP:', error);
      toast.error('خطا در تایید کد');
    } finally {
      setOtpVerifying(false);
    }
  };

  // Delete a custom module (only if no assignments exist) - now requires OTP
  // For empty folders - delete immediately without OTP
  const handleDeleteAvailableModule = async (itemId: string) => {
    // Find the item in hierarchy
    const findItem = (items: ModuleItem[], id: string): ModuleItem | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findItem(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findItem(availableHierarchy.items, itemId);
    if (!item) {
      toast.error('آیتم یافت نشد');
      return;
    }

    // Check if this is an empty folder - delete directly without OTP
    if (item.type === 'folder') {
      if (item.children && item.children.length > 0) {
        toast.error('پوشه خالی نیست. ابتدا ماژول‌های داخل پوشه را خارج کنید.');
        return;
      }
      
      // Delete empty folder immediately
      const removeItem = (items: ModuleItem[], id: string): ModuleItem[] => {
        return items
          .filter((it) => it.id !== id)
          .map((it) => {
            if (!it.children) return it;
            return { ...it, children: removeItem(it.children, id) };
          });
      };

      const newItems = removeItem(availableHierarchy.items, itemId);
      availableHierarchy.setItems(() => newItems);
      await availableHierarchy.saveNow(newItems);

      toast.success('پوشه حذف شد');
      return;
    }

    // For modules - check assignments and require OTP
    // Get the display name (might be customized)
    const displayName = availableHierarchy.customNames[item.key]?.name || item.name;
    
    // Get the base module key (if this is related to a base module)
    const baseKey = getBaseModuleKey(item);
    
    // Get assignments for this module - check both key and name
    const moduleAssignments = getModuleAssignments(
      baseKey || item.key, 
      displayName
    );
    
    if (moduleAssignments.length > 0) {
      const assignedNames = moduleAssignments
        .map(a => a.assigned_user_name || a.assigned_phone_number)
        .slice(0, 3)
        .join('، ');
      
      const moreCount = moduleAssignments.length > 3 ? ` و ${moduleAssignments.length - 3} نفر دیگر` : '';
      
      toast.error(
        `این ماژول به ${moduleAssignments.length} نفر اختصاص داده شده است`,
        {
          description: `افراد: ${assignedNames}${moreCount}. ابتدا از بخش "اختصاص‌های فعلی" افراد را یکی یکی حذف کنید.`,
          duration: 7000,
        }
      );
      return;
    }

    // Store pending delete info and open OTP dialog
    setPendingDeleteItemId(itemId);
    setPendingDeleteItemName(displayName);
    setOtpCode('');
    setOtpSent(false);
    setOtpDialogOpen(true);
  };

  // Helper to find a module in availableHierarchy (including copied modules)
  const findModuleInHierarchy = (key: string, items: ModuleItem[]): ModuleItem | null => {
    for (const item of items) {
      if (item.key === key) return item;
      if (item.type === 'folder' && item.children) {
        const found = findModuleInHierarchy(key, item.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Group assignments by module_key to create AssignedModuleData[]
  const groupedAssignedModules = useMemo((): AssignedModuleData[] => {
    const grouped: Record<string, AssignedModuleData> = {};

    for (const a of assignments) {
      if (!grouped[a.module_key]) {
        // First check base modules
        const baseModuleInfo = getModuleInfo(a.module_key);
        // Then check availableHierarchy for copied/custom modules (ignore deleted/tombstoned)
        const customModule = !baseModuleInfo
          ? findModuleInHierarchy(a.module_key, visibleAvailableItems)
          : null;

        // For copied modules, derive href from original module name pattern
        let href = baseModuleInfo?.href || customModule?.href;
        if (!href && a.module_key.startsWith('custom-')) {
          const cleanName = a.module_name.replace(' (کپی)', '').trim();
          const matchedBase = AVAILABLE_MODULES.find(
            (m) =>
              m.name === cleanName ||
              cleanName.includes(m.name) ||
              m.name.includes(cleanName)
          );
          href = matchedBase?.href;
        }

        grouped[a.module_key] = {
          moduleKey: a.module_key,
          moduleName: a.module_name,
          moduleDescription: baseModuleInfo?.description || customModule?.description || '',
          href: href,
          color: baseModuleInfo?.color || customModule?.color || 'text-gray-600',
          bgColor: baseModuleInfo?.bgColor || customModule?.bgColor || 'bg-gray-100',
          assignments: [],
        };
      }

      grouped[a.module_key].assignments.push({
        id: a.id,
        phone: a.assigned_phone_number,
        name: a.assigned_user_name,
      });
    }

    return Object.values(grouped);
  }, [assignments, visibleAvailableItems]);

  // Create a Map of module data for quick lookup
  const assignedModulesDataMap = useMemo((): Map<string, AssignedModuleData> => {
    const map = new Map<string, AssignedModuleData>();
    groupedAssignedModules.forEach(mod => {
      map.set(mod.moduleKey, mod);
    });
    return map;
  }, [groupedAssignedModules]);

  // Convert assignments to ModuleItem format for assigned modules section (kept for ordering logic)
  const assignedModulesAsItems = useMemo((): ModuleItem[] => {
    return groupedAssignedModules.map(g => ({
      id: g.moduleKey,
      type: 'module' as const,
      key: g.moduleKey,
      name: g.moduleName,
      description: g.moduleDescription,
      href: g.href,
      color: g.color,
      bgColor: g.bgColor,
    }));
  }, [groupedAssignedModules]);

  // Module hierarchy for assigned modules (for ordering and folders)
  const assignedHierarchy = useModuleHierarchy({
    type: 'assigned',
    initialModules: assignedModulesAsItems,
    isInitialModulesReady: !loading,
  });

  // Create folder for assigned modules
  const handleCreateAssignedFolder = useCallback(() => {
    const newFolder: ModuleItem = {
      id: `assigned-folder-${Date.now()}`,
      type: 'folder',
      key: `assigned-folder-${Date.now()}`,
      name: 'پوشه جدید',
      description: 'برای دسته‌بندی ماژول‌های اختصاص یافته',
      children: [],
      isOpen: true,
    };
    assignedHierarchy.setItems(prev => [newFolder, ...prev]);
  }, [assignedHierarchy]);

  // Create subfolder (depth limit: folder > subfolder)
  const handleCreateAssignedSubfolder = useCallback((parentFolderId: string) => {
    const ts = Date.now();
    const newFolder: ModuleItem = {
      id: `assigned-subfolder-${ts}`,
      type: 'folder',
      key: `assigned-subfolder-${ts}`,
      name: 'پوشه جدید',
      description: 'زیرپوشه برای دسته‌بندی ماژول‌های اختصاص یافته',
      children: [],
      isOpen: true,
    };

    assignedHierarchy.setItems((prev) => {
      const addToParent = (items: ModuleItem[]): ModuleItem[] =>
        items.map((it) => {
          if (it.id === parentFolderId && it.type === 'folder') {
            return {
              ...it,
              isOpen: true,
              children: [...(it.children || []), newFolder],
            };
          }
          if (it.children) return { ...it, children: addToParent(it.children) };
          return it;
        });

      return addToParent(prev);
    });
  }, [assignedHierarchy]);

  // Edit module name in assigned list
  const handleEditAssignedModule = useCallback(
    (item: AssignedHierarchyItem, newName: string, newDescription: string) => {
      // Use the existing editItem which handles customNames + DB sync
      assignedHierarchy.editItem(
        { id: item.id, type: item.type, key: item.key, name: item.name, description: item.description } as ModuleItem,
        newName,
        newDescription
      );

      // Also update module_assignments in DB so all assigned users see the new name
      if (item.type === 'module') {
        supabase
          .from('module_assignments')
          .update({ module_name: newName })
          .eq('module_key', item.key)
          .then(({ error }) => {
            if (error) console.error('Error updating module name:', error);
            else fetchAssignments();
          });
      }
    },
    [assignedHierarchy, fetchAssignments]
  );

  // Handle module order change
  const handleMoveAssignedModuleUp = useCallback(
    (itemId: string) => {
      assignedHierarchy.moveItemUp(itemId);
    },
    [assignedHierarchy]
  );

  const handleMoveAssignedModuleDown = useCallback(
    (itemId: string) => {
      assignedHierarchy.moveItemDown(itemId);
    },
    [assignedHierarchy]
  );

  // Delete an assigned item (folder or module without assignments)
  const handleDeleteAssignedItem = useCallback(
    async (itemId: string) => {
      // Find item in hierarchy
      const findItem = (items: ModuleItem[], id: string): ModuleItem | null => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.children) {
            const found = findItem(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const item = findItem(assignedHierarchy.items, itemId);
      if (!item) return;

      // For folders - check if empty
      if (item.type === 'folder') {
        if (item.children && item.children.length > 0) {
          toast.error('پوشه خالی نیست. ابتدا ماژول‌های داخل پوشه را خارج کنید.');
          return;
        }
      } else {
        // For modules - check if has assignments
        const moduleData = groupedAssignedModules.find((m) => m.moduleKey === item.key);
        if (moduleData && moduleData.assignments.length > 0) {
          toast.error('ابتدا همه کاربران اختصاص داده شده را لغو کنید');
          return;
        }
      }

      // Remove item from hierarchy
      const removeItem = (items: ModuleItem[], id: string): ModuleItem[] => {
        return items.filter(it => {
          if (it.id === id) return false;
          if (it.children) {
            it.children = removeItem(it.children, id);
          }
          return true;
        });
      };

      assignedHierarchy.setItems(prev => removeItem([...prev], itemId));
      toast.success(item.type === 'folder' ? 'پوشه حذف شد' : 'ماژول از لیست حذف شد');
    },
    [assignedHierarchy, groupedAssignedModules]
  );

  // Get available modules for adding to folders (modules at root level)
  const getAssignedModulesForFolder = useCallback((): AssignedHierarchyItem[] => {
    return assignedHierarchy.items.filter(item => item.type === 'module') as AssignedHierarchyItem[];
  }, [assignedHierarchy.items]);


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
                با کلیدهای بالا و پایین ماژول‌ها را مرتب کنید. برای افزودن ماژول به پوشه، پوشه را باز کنید و «افزودن ماژول» را بزنید.
              </p>
              {/* Search and Filter for available modules */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="جستجو در ماژول‌های موجود..."
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    className="pr-10"
                  />
                  {availableSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setAvailableSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <select
                    value={availableTypeFilter}
                    onChange={(e) => setAvailableTypeFilter(e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm min-w-[150px]"
                  >
                    <option value="all">همه ماژول‌ها</option>
                    <option value="folder">فقط پوشه‌ها</option>
                    <option value="module">فقط ماژول‌ها</option>
                    {moduleTypes.map(type => (
                      <option key={type.key} value={type.key}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                {(() => {
                  const filteredItems = visibleAvailableItems.filter((item) => {
                    // Type filter
                    if (availableTypeFilter !== 'all') {
                      if (availableTypeFilter === 'folder' && item.type !== 'folder') return false;
                      if (availableTypeFilter === 'module' && item.type !== 'module') return false;
                      if (availableTypeFilter !== 'folder' && availableTypeFilter !== 'module') {
                        if (item.type === 'folder') {
                          if (!item.children?.some(child => child.key === availableTypeFilter)) return false;
                        } else if (item.key !== availableTypeFilter) {
                          return false;
                        }
                      }
                    }
                    // Search filter
                    if (!availableSearch) return true;
                    const searchLower = availableSearch.toLowerCase();
                    const itemName = (availableHierarchy.customNames[item.key]?.name || item.name).toLowerCase();
                    const itemDesc = (availableHierarchy.customNames[item.key]?.description || item.description || '').toLowerCase();
                    if (itemName.includes(searchLower) || itemDesc.includes(searchLower)) return true;
                    if (item.children) {
                      return item.children.some(child => {
                        const childName = (availableHierarchy.customNames[child.key]?.name || child.name).toLowerCase();
                        const childDesc = (availableHierarchy.customNames[child.key]?.description || child.description || '').toLowerCase();
                        return childName.includes(searchLower) || childDesc.includes(searchLower);
                      });
                    }
                    return false;
                  });
                  
                  return filteredItems.map((item, idx) => (
                    <ModuleItemComponent
                      key={item.id}
                      item={item as ModuleItemData}
                      index={idx}
                      totalItems={filteredItems.length}
                      onMoveUp={availableHierarchy.moveItemUp}
                      onMoveDown={availableHierarchy.moveItemDown}
                      onToggleFolder={availableHierarchy.toggleFolder}
                      onEditItem={availableHierarchy.editItem}
                      onNavigate={(href) => navigate(href)}
                      onDuplicate={handleDuplicateModule}
                      onDelete={handleDeleteAvailableModule}
                      onAddToFolder={availableHierarchy.addModuleToFolder}
                      onRemoveFromFolder={availableHierarchy.removeModuleFromFolder}
                      onMoveToFolder={availableHierarchy.moveItemToFolder}
                      onMoveToRoot={availableHierarchy.moveItemToRoot}
                      getAvailableFoldersForMove={(id) => availableHierarchy.getAvailableFoldersForMove(id) as ModuleItemData[]}
                      customNames={availableHierarchy.customNames}
                      showDuplicateButton={true}
                      showDeleteButton={true}
                      showMoveButton={true}
                      canDeleteItem={canDeleteModule}
                      availableModulesForFolder={stripDeletedHierarchyItems(availableHierarchy.getAvailableModulesForFolder() as any) as ModuleItemData[]}
                    />
                  ));
                })()}
                {(availableSearch || availableTypeFilter !== 'all') && visibleAvailableItems.filter((item) => {
                  if (availableTypeFilter !== 'all') {
                    if (availableTypeFilter === 'folder' && item.type !== 'folder') return false;
                    if (availableTypeFilter === 'module' && item.type !== 'module') return false;
                    if (availableTypeFilter !== 'folder' && availableTypeFilter !== 'module') {
                      if (item.type === 'folder') {
                        if (!item.children?.some(child => child.key === availableTypeFilter)) return false;
                      } else if (item.key !== availableTypeFilter) {
                        return false;
                      }
                    }
                  }
                  if (!availableSearch) return true;
                  const searchLower = availableSearch.toLowerCase();
                  const itemName = (availableHierarchy.customNames[item.key]?.name || item.name).toLowerCase();
                  const itemDesc = (availableHierarchy.customNames[item.key]?.description || item.description || '').toLowerCase();
                  if (itemName.includes(searchLower) || itemDesc.includes(searchLower)) return true;
                  if (item.children) {
                    return item.children.some(child => {
                      const childName = (availableHierarchy.customNames[child.key]?.name || child.name).toLowerCase();
                      const childDesc = (availableHierarchy.customNames[child.key]?.description || child.description || '').toLowerCase();
                      return childName.includes(searchLower) || childDesc.includes(searchLower);
                    });
                  }
                  return false;
                }).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    نتیجه‌ای یافت نشد
                  </div>
                )}
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
                    {getAllAssignableModules.map((item) => {
                      const info = getModuleDisplayInfo(item);
                      return (
                        <option key={item.key} value={item.key}>
                          {info.name}
                        </option>
                      );
                    })}
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

            {/* Current Assignments - Grouped by Module with Folders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">
                  ماژول‌های اختصاص داده شده
                  {groupedAssignedModules.length > 0 && (
                    <Badge variant="secondary" className="mr-2">
                      {groupedAssignedModules.length} ماژول ({assignments.length} اختصاص)
                    </Badge>
                  )}
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateAssignedFolder}
                  className="gap-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  ایجاد پوشه
                </Button>
              </div>
              
              {groupedAssignedModules.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  روی هر ماژول کلیک کنید تا لیست افراد اختصاص داده شده نمایش داده شود. با کلیدهای بالا و پایین ماژول‌ها را مرتب کنید.
                </p>
              )}
              
              {/* Search for assigned modules */}
              {(groupedAssignedModules.length > 0 || assignedHierarchy.items.some(i => i.type === 'folder')) && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="جستجو در ماژول‌ها (نام ماژول، شماره تلفن، نام کاربر)..."
                      value={assignedSearch}
                      onChange={(e) => setAssignedSearch(e.target.value)}
                      className="pr-10"
                    />
                    {assignedSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setAssignedSearch('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : assignedHierarchy.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  هنوز ماژولی اختصاص داده نشده است
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // Filter hierarchy items
                    const filterItems = (items: typeof assignedHierarchy.items): typeof assignedHierarchy.items => {
                      if (!assignedSearch) return items;
                      const searchLower = assignedSearch.toLowerCase();
                      
                      return items.filter(item => {
                        if (item.type === 'folder') {
                          const folderName = (assignedHierarchy.customNames[item.key]?.name || item.name).toLowerCase();
                          const folderDesc = (assignedHierarchy.customNames[item.key]?.description || item.description || '').toLowerCase();
                          if (folderName.includes(searchLower) || folderDesc.includes(searchLower)) return true;
                          // Check children
                          if (item.children) {
                            const filteredChildren = filterItems(item.children);
                            if (filteredChildren.length > 0) return true;
                          }
                          return false;
                        }
                        
                        // Module
                        const modName = (assignedHierarchy.customNames[item.key]?.name || item.name).toLowerCase();
                        const modDesc = (assignedHierarchy.customNames[item.key]?.description || item.description || '').toLowerCase();
                        if (modName.includes(searchLower) || modDesc.includes(searchLower)) return true;
                        
                        // Check assignments
                        const moduleData = assignedModulesDataMap.get(item.key);
                        if (moduleData?.assignments.some(u => 
                          u.phone.includes(searchLower) || 
                          u.name?.toLowerCase().includes(searchLower)
                        )) return true;
                        
                        return false;
                      });
                    };
                    
                    const filteredItems = filterItems(assignedHierarchy.items);
                    
                    if (filteredItems.length === 0) {
                      return (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          نتیجه‌ای یافت نشد
                        </div>
                      );
                    }

                    return filteredItems.map((item, idx) => (
                      <AssignedModuleItemWithFolder
                        key={item.id}
                        item={item as AssignedHierarchyItem}
                        index={idx}
                        totalItems={filteredItems.length}
                        onMoveUp={handleMoveAssignedModuleUp}
                        onMoveDown={handleMoveAssignedModuleDown}
                        onToggleFolder={assignedHierarchy.toggleFolder}
                        onEditItem={handleEditAssignedModule}
                        onRemoveAssignment={handleRemoveAssignment}
                        onDeleteItem={handleDeleteAssignedItem}
                        onAddToFolder={assignedHierarchy.addModuleToFolder}
                        onRemoveFromFolder={assignedHierarchy.removeModuleFromFolder}
                        onMoveToFolder={assignedHierarchy.moveItemToFolder}
                        onMoveToRoot={assignedHierarchy.moveItemToRoot}
                        getAvailableFoldersForMove={(id) => assignedHierarchy.getAvailableFoldersForMove(id) as AssignedHierarchyItem[]}
                        showMoveButton={true}
                        onCreateSubfolder={handleCreateAssignedSubfolder}
                        customNames={assignedHierarchy.customNames}
                        availableModulesForFolder={getAssignedModulesForFolder()}
                        allModulesData={assignedModulesDataMap}
                      />
                    ));
                  })()}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* OTP Verification Dialog for Module Deletion */}
      <Dialog open={otpDialogOpen} onOpenChange={(open) => {
        if (!open && !otpVerifying) {
          setOtpDialogOpen(false);
          setOtpCode('');
          setPendingDeleteItemId(null);
          setPendingDeleteItemName('');
          setOtpSent(false);
        }
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              تایید حذف ماژول
            </DialogTitle>
            <DialogDescription className="text-right">
              {otpSent ? (
                <>
                  کد تایید به شماره مدیرعامل (<span dir="ltr" className="inline-block">۰۹۱۲۵۵۱۱۴۹۴</span>) ارسال شد.
                  <br />
                  برای حذف ماژول «{pendingDeleteItemName}» کد را وارد کنید.
                </>
              ) : (
                <>
                  برای حذف ماژول «{pendingDeleteItemName}» ابتدا کد تایید به شماره مدیرعامل ارسال می‌شود.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {!otpSent ? (
              <Button 
                onClick={() => sendCeoOtp(pendingDeleteItemName)}
                disabled={otpSending}
                className="w-full"
              >
                {otpSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    در حال ارسال کد...
                  </>
                ) : (
                  'ارسال کد تایید به مدیرعامل'
                )}
              </Button>
            ) : (
              <>
                <div className="w-full" dir="ltr">
                  <InputOTP
                    maxLength={5}
                    value={otpCode}
                    onChange={setOtpCode}
                    className="justify-center"
                    disabled={otpVerifying}
                  >
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={0} className="w-12 h-12 text-xl" />
                      <InputOTPSlot index={1} className="w-12 h-12 text-xl" />
                      <InputOTPSlot index={2} className="w-12 h-12 text-xl" />
                      <InputOTPSlot index={3} className="w-12 h-12 text-xl" />
                      <InputOTPSlot index={4} className="w-12 h-12 text-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-sm text-muted-foreground">
                  کد ۵ رقمی ارسال شده را وارد کنید
                </p>
                {otpTimeLeft > 0 ? (
                  <p className="text-sm font-medium text-primary">
                    زمان باقی‌مانده: {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60).toString().padStart(2, '0')}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-destructive">
                    زمان وارد کردن کد به پایان رسید. لطفاً کد جدید دریافت کنید.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button
              variant="outline"
              onClick={() => {
                setOtpDialogOpen(false);
                setOtpCode('');
                setPendingDeleteItemId(null);
                setPendingDeleteItemName('');
                setOtpSent(false);
                setOtpTimeLeft(0);
              }}
              disabled={otpVerifying}
            >
              انصراف
            </Button>
            {otpSent && (
              <>
                <Button
                  variant="outline"
                  onClick={() => sendCeoOtp(pendingDeleteItemName)}
                  disabled={otpSending || otpVerifying}
                >
                  {otpSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'ارسال مجدد کد'
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={verifyCeoOtpAndDelete}
                  disabled={otpVerifying || otpCode.length < 5 || otpTimeLeft <= 0}
                >
                  {otpVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      در حال تایید...
                    </>
                  ) : (
                    'تایید و حذف'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
