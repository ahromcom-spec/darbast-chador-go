import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HRStaffSearchSelect } from '@/components/staff/HRStaffSearchSelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2, Settings, Info, Calculator, DollarSign, Edit, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SalarySetting {
  id: string;
  staff_code: string;
  staff_name: string;
  base_daily_salary: number;
  overtime_rate_fraction: number;
  notes: string | null;
}

export function StaffSalarySettingsTab() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SalarySetting[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [lastSaveDebug, setLastSaveDebug] = useState<string | null>(null);

  // New staff form state
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newBaseSalary, setNewBaseSalary] = useState<number>(0);
  const [newOvertimeFraction, setNewOvertimeFraction] = useState<number>(0.167);
  const [newNotes, setNewNotes] = useState('');

  const copyDebugToClipboard = async (debugText: string) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(debugText);
      toast.success('جزئیات خطا کپی شد؛ برای پشتیبانی ارسال کنید');
    } catch (e) {
      console.error('Clipboard copy failed:', e);
      toast.error('کپی انجام نشد؛ لطفاً از همین صفحه اسکرین‌شات بگیرید');
    }
  };

  const showPersistError = (err: any, operation: string, payload?: Record<string, unknown>) => {
    const debugPayload = {
      feature: 'staff_salary_settings',
      operation,
      time: new Date().toISOString(),
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userId: user?.id ?? null,
      authLoading,
      error: {
        code: err?.code ?? err?.status ?? null,
        message: err?.message ?? String(err),
        details: err?.details ?? null,
        hint: err?.hint ?? null,
      },
      payload,
    };

    const debugText = JSON.stringify(debugPayload, null, 2);
    setLastSaveDebug(debugText);

    // Always log full details (helps support)
    console.error('[SalarySettings Persist Error]', debugPayload, err);

    toast.error('خطا در ذخیره تنظیمات حقوق', {
      description: `کد خطا: ${debugPayload.error.code ?? '—'}\n${debugPayload.error.message ?? ''}`,
      action: {
        label: 'کپی جزئیات',
        onClick: () => copyDebugToClipboard(debugText),
      },
    });
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_salary_settings')
        .select('*')
        .order('staff_name', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching salary settings:', error);
      toast.error('خطا در دریافت تنظیمات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddNew = async () => {
    const payload = {
      staff_code: newStaffCode,
      staff_name: newStaffName,
      base_daily_salary: newBaseSalary,
      overtime_rate_fraction: newOvertimeFraction,
      notes: newNotes || null,
      created_by: user?.id ?? null,
    };

    if (authLoading) {
      toast.error('لطفاً چند لحظه صبر کنید؛ در حال بررسی ورود شما هستیم');
      return;
    }

    if (!user?.id) {
      showPersistError({ message: 'Not authenticated' }, 'insert', payload);
      return;
    }

    if (!newStaffCode || !newStaffName) {
      toast.error('لطفاً نیرو را انتخاب کنید');
      return;
    }

    if (newBaseSalary <= 0) {
      toast.error('لطفاً حقوق روزانه را وارد کنید');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('staff_salary_settings')
        .insert({
          staff_code: newStaffCode,
          staff_name: newStaffName,
          base_daily_salary: newBaseSalary,
          overtime_rate_fraction: newOvertimeFraction,
          notes: newNotes || null,
          created_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          // Duplicate staff_code
          const debugPayload = {
            feature: 'staff_salary_settings',
            operation: 'insert',
            time: new Date().toISOString(),
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
            userId: user.id,
            authLoading,
            error: {
              code: error.code,
              message: error.message,
              details: (error as any)?.details ?? null,
              hint: (error as any)?.hint ?? null,
            },
            payload,
          };
          const debugText = JSON.stringify(debugPayload, null, 2);
          setLastSaveDebug(debugText);
          console.error('[SalarySettings Persist Error - Duplicate]', debugPayload, error);

          toast.error('این نیرو قبلاً ثبت شده است', {
            description: 'کد پرسنلی تکراری است. اگر لازم بود، جزئیات را کپی کنید.',
            action: {
              label: 'کپی جزئیات',
              onClick: () => copyDebugToClipboard(debugText),
            },
          });
        } else {
          showPersistError(error, 'insert', payload);
        }
        return;
      }

      toast.success('تنظیمات حقوق با موفقیت ذخیره شد');

      // Reset form
      setNewStaffCode('');
      setNewStaffName('');
      setNewBaseSalary(0);
      setNewOvertimeFraction(0.167);
      setNewNotes('');
      setLastSaveDebug(null);

      // Refresh list
      fetchSettings();
    } catch (error) {
      showPersistError(error, 'insert', payload);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (setting: SalarySetting) => {
    const payload = {
      id: setting.id,
      base_daily_salary: setting.base_daily_salary,
      overtime_rate_fraction: setting.overtime_rate_fraction,
      notes: setting.notes,
    };

    if (authLoading) {
      toast.error('لطفاً چند لحظه صبر کنید؛ در حال بررسی ورود شما هستیم');
      return;
    }

    if (!user?.id) {
      showPersistError({ message: 'Not authenticated' }, 'update', payload);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('staff_salary_settings')
        .update({
          base_daily_salary: setting.base_daily_salary,
          overtime_rate_fraction: setting.overtime_rate_fraction,
          notes: setting.notes,
        })
        .eq('id', setting.id);

      if (error) {
        showPersistError(error, 'update', payload);
        return;
      }

      toast.success('تنظیمات بروزرسانی شد');
      setLastSaveDebug(null);
      setEditingId(null);
      fetchSettings();
    } catch (error) {
      showPersistError(error, 'update', payload);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const payload = { id };

    if (authLoading) {
      toast.error('لطفاً چند لحظه صبر کنید؛ در حال بررسی ورود شما هستیم');
      return;
    }

    if (!user?.id) {
      showPersistError({ message: 'Not authenticated' }, 'delete', payload);
      return;
    }

    if (!confirm('آیا از حذف این تنظیمات اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('staff_salary_settings')
        .delete()
        .eq('id', id);

      if (error) {
        showPersistError(error, 'delete', payload);
        return;
      }

      toast.success('تنظیمات حذف شد');
      setLastSaveDebug(null);
      fetchSettings();
    } catch (error) {
      showPersistError(error, 'delete', payload);
    }
  };

  const updateSettingField = (id: string, field: keyof SalarySetting, value: any) => {
    setSettings(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  // Overtime is calculated as: dailySalary / fraction denominator
  // e.g., if fraction is 0.167 (1/6), overtime per hour = dailySalary / 6
  const calculateOvertimeExamples = (dailySalary: number, fraction: number) => {
    // Convert fraction to denominator (0.167 -> 6, 0.125 -> 8)
    const denominator = fraction > 0 ? Math.round(1 / fraction) : 6;
    const hourlyOvertime = dailySalary / denominator;
    return {
      oneHour: Math.round(hourlyOvertime),
      twoHours: Math.round(hourlyOvertime * 2),
      fourHours: Math.round(hourlyOvertime * 4)
    };
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-900/20">
        <Info className="h-4 w-4" />
        <AlertTitle>راهنمای تنظیمات حقوق</AlertTitle>
        <AlertDescription className="text-sm mt-2 space-y-1">
          <p>• <strong>حقوق روزانه:</strong> مبلغ پایه حقوق یک روز کاری (بدون اضافه‌کاری)</p>
          <p>• <strong>ضریب اضافه‌کاری:</strong> هر ساعت اضافه‌کاری چه نسبتی از حقوق روزانه است</p>
          <p>• <strong>مثال:</strong> اگر ضریب ۱/۶ باشد (۰.۱۶۷)، هر ساعت اضافه‌کاری = حقوق روزانه ÷ ۶</p>
        </AlertDescription>
      </Alert>

      {/* Add New Staff Salary */}
      <Card className="border-2 border-green-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Plus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">افزودن تنظیمات حقوق جدید</CardTitle>
              <CardDescription>تنظیمات حقوق یک نیرو را تعیین کنید</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>انتخاب نیرو</Label>
              <HRStaffSearchSelect
                value={newStaffCode}
                onValueChange={(phone, name) => {
                  setNewStaffCode(phone);
                  setNewStaffName(name || '');
                }}
                placeholder="انتخاب از منابع انسانی"
              />
            </div>

            <div className="space-y-2">
              <Label>حقوق روزانه (تومان)</Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={newBaseSalary === 0 ? '' : newBaseSalary.toLocaleString('en-US')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setNewBaseSalary(parseInt(val) || 0);
                  }}
                  className="pl-14"
                  dir="ltr"
                  placeholder="0"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">تومان</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ضریب اضافه‌کاری</Label>
              <div className="text-sm text-muted-foreground">
                ۱/۶ حقوق روزانه
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>توضیحات</Label>
              <AutoResizeTextarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="توضیحات اضافی..."
                className="min-h-[40px]"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleAddNew}
                disabled={saving || !newStaffCode || newBaseSalary <= 0}
                className="gap-2 w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره
              </Button>
            </div>
          </div>

          {/* Preview calculation - only 1 hour */}
          {newBaseSalary > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              هر ساعت اضافه‌کاری: <strong className="text-foreground">{calculateOvertimeExamples(newBaseSalary, 0.167).oneHour.toLocaleString('fa-IR')}</strong> تومان
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">لیست تنظیمات حقوق نیروها</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          ) : settings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>هنوز تنظیمات حقوقی ثبت نشده است</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">نام نیرو</TableHead>
                    <TableHead className="text-right">کد پرسنلی</TableHead>
                    <TableHead className="text-right">حقوق روزانه</TableHead>
                    <TableHead className="text-right">ضریب</TableHead>
                    <TableHead className="text-right">توضیحات</TableHead>
                    <TableHead className="text-center w-[100px]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium">{setting.staff_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{setting.staff_code}</Badge>
                      </TableCell>
                      <TableCell>
                        {editingId === setting.id ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={setting.base_daily_salary.toLocaleString('en-US')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              updateSettingField(setting.id, 'base_daily_salary', parseInt(val) || 0);
                            }}
                            className="w-28"
                            dir="ltr"
                          />
                        ) : (
                          <span>{setting.base_daily_salary.toLocaleString('fa-IR')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === setting.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={setting.overtime_rate_fraction}
                            onChange={(e) => updateSettingField(setting.id, 'overtime_rate_fraction', parseFloat(e.target.value) || 0)}
                            className="w-20"
                            dir="ltr"
                          />
                        ) : (
                          <span>{setting.overtime_rate_fraction === 0.167 ? '۱/۶' : setting.overtime_rate_fraction}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        {editingId === setting.id ? (
                          <AutoResizeTextarea
                            value={setting.notes || ''}
                            onChange={(e) => updateSettingField(setting.id, 'notes', e.target.value)}
                            className="min-h-[36px]"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">{setting.notes || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {editingId === setting.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdate(setting)}
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingId(null);
                                  fetchSettings();
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingId(setting.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(setting.id)}
                                className="text-destructive hover:text-destructive"
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
