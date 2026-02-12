import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Save, Trash2, Users, Info, 
  ChevronDown, ChevronUp, User, Phone, Briefcase,
  Building, Calendar, Check, Clock, X, Edit, UserCheck
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface HREmployee {
  id: string;
  phone_number: string;
  full_name: string;
  user_id: string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  status: 'active' | 'pending_registration' | 'inactive';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_DEPARTMENTS = [
  'مدیریت',
  'اجرایی',
  'فروش',
  'مالی',
  'فنی',
  'پشتیبانی',
  'انبار',
  'حمل و نقل',
];

const DEFAULT_POSITIONS = [
  'مدیرعامل',
  'مدیرکل',
  'مدیر اجرایی',
  'مدیر فروش',
  'مدیر مالی',
  'سرپرست',
  'استادکار',
  'کارگر',
  'راننده',
  'کارمند اداری',
  'حسابدار',
];

const STORAGE_KEY_POSITIONS = 'hr_custom_positions';
const STORAGE_KEY_DEPARTMENTS = 'hr_custom_departments';

function loadCustomItems(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomItems(key: string, items: string[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

// Multi-select dropdown component with add/remove
function MultiSelectDropdown({ options, selected, onChange, placeholder, className, customItems, onCustomItemsChange }: {
  options: readonly string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  className?: string;
  customItems?: string[];
  onCustomItemsChange?: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState('');
  const allOptions = [...options, ...(customItems || [])];

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed || allOptions.includes(trimmed)) return;
    onCustomItemsChange?.([...(customItems || []), trimmed]);
    setNewItem('');
  };

  const handleRemoveCustom = (item: string) => {
    onCustomItemsChange?.((customItems || []).filter(i => i !== item));
    // Also remove from selected if present
    if (selected.includes(item)) {
      onChange(selected.filter(v => v !== item));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`justify-between font-normal ${className || 'w-full'}`}>
          {selected.length > 0 ? (
            <span className="truncate text-right flex-1">{selected.length} مورد انتخاب شده</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 mr-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 z-[99999] bg-popover" align="start">
        {/* Add new item */}
        {onCustomItemsChange && (
          <div className="flex items-center gap-1 mb-2 pb-2 border-b">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="افزودن مورد جدید..."
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            />
            <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newItem.trim()} className="h-8 w-8 p-0 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {allOptions.map(opt => {
            const isCustom = (customItems || []).includes(opt);
            return (
              <div key={opt} className="flex items-center gap-1">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm flex-1">
                  <Checkbox
                    checked={selected.includes(opt)}
                    onCheckedChange={() => toggle(opt)}
                  />
                  <span>{opt}</span>
                </label>
                {isCustom && onCustomItemsChange && (
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveCustom(opt)} className="h-6 w-6 p-0 text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t mt-2 pt-2">
            <div className="flex flex-wrap gap-1">
              {selected.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(s)} />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface HRManagementProps {
  showAsCard?: boolean;
}

export function HRManagement({ showAsCard = true }: HRManagementProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(!showAsCard);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New employee form state
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPositions, setNewPositions] = useState<string[]>([]);
  const [newDepartments, setNewDepartments] = useState<string[]>([]);
  const [newHireDate, setNewHireDate] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Custom items for positions and departments
  const [customPositions, setCustomPositions] = useState<string[]>(() => loadCustomItems(STORAGE_KEY_POSITIONS));
  const [customDepartments, setCustomDepartments] = useState<string[]>(() => loadCustomItems(STORAGE_KEY_DEPARTMENTS));

  const handleCustomPositionsChange = (items: string[]) => {
    setCustomPositions(items);
    saveCustomItems(STORAGE_KEY_POSITIONS, items);
  };
  const handleCustomDepartmentsChange = (items: string[]) => {
    setCustomDepartments(items);
    saveCustomItems(STORAGE_KEY_DEPARTMENTS, items);
  };
  
  // User lookup state
  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [foundUser, setFoundUser] = useState<{ user_id: string; full_name: string } | null>(null);
  const debouncedPhone = useDebounce(newPhoneNumber, 500);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hr_employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees((data as HREmployee[]) || []);
    } catch (error) {
      console.error('Error fetching HR employees:', error);
      toast.error('خطا در دریافت لیست نیروها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || !showAsCard) {
      fetchEmployees();
    }
  }, [isOpen, showAsCard]);

  const isValidPhone = useMemo(() => {
    return /^09[0-9]{9}$/.test(newPhoneNumber);
  }, [newPhoneNumber]);

  // Lookup user when phone number changes
  const lookupUserByPhone = useCallback(async (phone: string) => {
    if (!/^09[0-9]{9}$/.test(phone)) {
      setFoundUser(null);
      return;
    }
    
    setLookingUpUser(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('phone_number', phone)
        .single();

      if (error || !data) {
        setFoundUser(null);
      } else {
        setFoundUser({ user_id: data.user_id, full_name: data.full_name || '' });
        // Auto-fill name if empty
        if (data.full_name && !newFullName.trim()) {
          setNewFullName(data.full_name);
        }
      }
    } catch (error) {
      setFoundUser(null);
    } finally {
      setLookingUpUser(false);
    }
  }, [newFullName]);

  useEffect(() => {
    if (debouncedPhone) {
      lookupUserByPhone(debouncedPhone);
    } else {
      setFoundUser(null);
    }
  }, [debouncedPhone, lookupUserByPhone]);

  const handleAddEmployee = async () => {
    if (!user?.id) {
      toast.error('لطفاً وارد حساب کاربری شوید');
      return;
    }

    if (!isValidPhone) {
      toast.error('شماره موبایل نامعتبر است');
      return;
    }

    if (!newFullName.trim()) {
      toast.error('لطفاً نام و نام خانوادگی را وارد کنید');
      return;
    }

    setSaving(true);
    try {
      // Check if phone already exists
      const { data: existing } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('phone_number', newPhoneNumber)
        .single();

      if (existing) {
        toast.error('این شماره موبایل قبلاً ثبت شده است');
        setSaving(false);
        return;
      }

      // Check if user exists in profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone_number', newPhoneNumber)
        .single();

      const { error } = await supabase
        .from('hr_employees')
        .insert({
          phone_number: newPhoneNumber,
          full_name: newFullName.trim(),
          position: newPositions.length > 0 ? newPositions.join('،') : null,
          department: newDepartments.length > 0 ? newDepartments.join('،') : null,
          hire_date: newHireDate || null,
          notes: newNotes.trim() || null,
          created_by: user.id,
          user_id: profileData?.user_id || null,
          status: profileData?.user_id ? 'active' : 'pending_registration',
        });

      if (error) throw error;

      toast.success('نیروی جدید با موفقیت ثبت شد');

      // Reset form
      setNewPhoneNumber('');
      setNewFullName('');
      setNewPositions([]);
      setNewDepartments([]);
      setNewHireDate('');
      setNewNotes('');

      fetchEmployees();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error('خطا در ثبت نیرو: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmployee = async (employee: HREmployee) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('hr_employees')
        .update({
          full_name: employee.full_name,
          position: employee.position,
          department: employee.department,
          hire_date: employee.hire_date,
          notes: employee.notes,
          status: employee.status,
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('اطلاعات نیرو بروزرسانی شد');
      setEditingId(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast.error('خطا در بروزرسانی');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('آیا از حذف این نیرو اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('hr_employees')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('نیرو حذف شد');
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('خطا در حذف');
    }
  };

  const updateEmployeeField = (id: string, field: keyof HREmployee, value: any) => {
    setEmployees(prev => prev.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const getStatusBadge = (status: HREmployee['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600"><Check className="h-3 w-3 ml-1" />فعال</Badge>;
      case 'pending_registration':
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="h-3 w-3 ml-1" />در انتظار ثبت‌نام</Badge>;
      case 'inactive':
        return <Badge variant="secondary"><X className="h-3 w-3 ml-1" />غیرفعال</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeCount = employees.filter(e => e.status === 'active').length;
  const pendingCount = employees.filter(e => e.status === 'pending_registration').length;

  const content = (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-900/20">
        <Info className="h-4 w-4" />
        <AlertTitle>راهنما</AlertTitle>
        <AlertDescription className="text-sm mt-2 space-y-1">
          <p>• وارد کردن <strong>شماره موبایل</strong> الزامی است</p>
          <p>• اگر نیرو هنوز در اهرم ثبت‌نام نکرده، وضعیت "در انتظار ثبت‌نام" خواهد بود</p>
          <p>• پس از ثبت‌نام، وضعیت خودکار به "فعال" تغییر می‌کند</p>
          <p>• نیروهای ثبت‌شده در تنظیمات حقوق گزارش روزانه قابل انتخاب هستند</p>
        </AlertDescription>
      </Alert>

      {/* Add New Employee Form */}
      <Card className="border-2 border-green-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Plus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">افزودن نیروی جدید</CardTitle>
              <CardDescription>اطلاعات نیروی جدید را وارد کنید</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                شماره موبایل <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="tel"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09123456789"
                  dir="ltr"
                  className={!newPhoneNumber ? '' : isValidPhone ? 'border-green-500' : 'border-destructive'}
                />
                {lookingUpUser && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {foundUser && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-md p-2">
                  <UserCheck className="h-4 w-4" />
                  <span>کاربر یافت شد: <strong>{foundUser.full_name || 'بدون نام'}</strong></span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <User className="h-4 w-4" />
                نام و نام خانوادگی <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="نام کامل نیرو"
              />
              {foundUser && foundUser.full_name && newFullName !== foundUser.full_name && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary h-auto p-1"
                  onClick={() => setNewFullName(foundUser.full_name)}
                >
                  استفاده از نام ثبت‌شده: {foundUser.full_name}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                سمت
              </Label>
              <MultiSelectDropdown
                options={DEFAULT_POSITIONS}
                selected={newPositions}
                onChange={setNewPositions}
                placeholder="انتخاب سمت‌ها"
                customItems={customPositions}
                onCustomItemsChange={handleCustomPositionsChange}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                واحد سازمانی
              </Label>
              <MultiSelectDropdown
                options={DEFAULT_DEPARTMENTS}
                selected={newDepartments}
                onChange={setNewDepartments}
                placeholder="انتخاب واحدها"
                customItems={customDepartments}
                onCustomItemsChange={handleCustomDepartmentsChange}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                تاریخ استخدام
              </Label>
              <PersianDatePicker
                value={newHireDate}
                onChange={(val) => setNewHireDate(val)}
                placeholder="انتخاب تاریخ"
                timeMode="none"
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <Label>توضیحات</Label>
              <AutoResizeTextarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="توضیحات اضافی..."
                className="min-h-[40px]"
              />
            </div>

            <div className="flex items-end lg:col-span-3">
              <Button
                onClick={handleAddEmployee}
                disabled={saving || !isValidPhone || !newFullName.trim()}
                className="gap-2 w-full md:w-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ثبت نیروی جدید
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">لیست نیروهای ثبت‌شده ({employees.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>هنوز نیرویی ثبت نشده است</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">نام</TableHead>
                    <TableHead className="text-right">شماره موبایل</TableHead>
                    <TableHead className="text-right">سمت</TableHead>
                    <TableHead className="text-right">واحد</TableHead>
                    <TableHead className="text-right">وضعیت</TableHead>
                    <TableHead className="text-center w-[100px]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        {editingId === employee.id ? (
                          <Input
                            value={employee.full_name}
                            onChange={(e) => updateEmployeeField(employee.id, 'full_name', e.target.value)}
                            className="w-40"
                          />
                        ) : (
                          <span className="font-medium">{employee.full_name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span dir="ltr" className="text-muted-foreground">
                          {employee.phone_number}
                        </span>
                      </TableCell>
                      <TableCell>
                        {editingId === employee.id ? (
                          <MultiSelectDropdown
                            options={DEFAULT_POSITIONS}
                            selected={employee.position ? employee.position.split('،') : []}
                            onChange={(vals) => updateEmployeeField(employee.id, 'position', vals.length > 0 ? vals.join('،') : null)}
                            placeholder="انتخاب"
                            className="w-36"
                            customItems={customPositions}
                            onCustomItemsChange={handleCustomPositionsChange}
                          />
                        ) : (
                          employee.position ? (
                            <div className="flex flex-wrap gap-1">
                              {employee.position.split('،').map((p, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{p.trim()}</Badge>
                              ))}
                            </div>
                          ) : '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === employee.id ? (
                          <MultiSelectDropdown
                            options={DEFAULT_DEPARTMENTS}
                            selected={employee.department ? employee.department.split('،') : []}
                            onChange={(vals) => updateEmployeeField(employee.id, 'department', vals.length > 0 ? vals.join('،') : null)}
                            placeholder="انتخاب"
                            className="w-36"
                            customItems={customDepartments}
                            onCustomItemsChange={handleCustomDepartmentsChange}
                          />
                        ) : (
                          employee.department ? (
                            <div className="flex flex-wrap gap-1">
                              {employee.department.split('،').map((d, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{d.trim()}</Badge>
                              ))}
                            </div>
                          ) : '-'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {editingId === employee.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateEmployee(employee)}
                                disabled={saving}
                                className="h-8 w-8 p-0 text-green-600"
                              >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(null);
                                  fetchEmployees();
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(employee.id)}
                                className="h-8 w-8 p-0 text-blue-600"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="h-8 w-8 p-0 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // If not showing as card, just return the content
  if (!showAsCard) {
    return content;
  }

  return (
    <Card className="border-2 border-indigo-500/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">مدیریت منابع انسانی</CardTitle>
                  <CardDescription>ثبت و مدیریت نیروهای شرکت اهرم</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {employees.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-green-600 font-medium">{activeCount} فعال</span>
                    {pendingCount > 0 && (
                      <span className="text-amber-600">| {pendingCount} در انتظار</span>
                    )}
                  </div>
                )}
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {content}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
