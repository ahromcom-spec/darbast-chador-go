import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { Navigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

const ROLE_LABELS: Record<string, string> = {
  scaffold_worker: 'نیروی داربست',
  scaffold_supervisor: 'سرپرست داربست',
  operations_manager: 'مدیر اجرایی',
  finance_manager: 'مدیر مالی',
  sales_manager: 'مدیر فروش',
  support_manager: 'مدیر پشتیبانی',
  warehouse_manager: 'مدیر انبار',
  security_manager: 'مدیر حراست',
};

interface WhitelistEntry {
  id: string;
  phone: string;
  allowed_role: string;
  note?: string;
  created_at: string;
}

export const WhitelistManagement = () => {
  const { isGeneralManager, loading: roleLoading } = useGeneralManagerRole();
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [allowedRole, setAllowedRole] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isGeneralManager) {
      fetchWhitelist();
    }
  }, [isGeneralManager]);

  const fetchWhitelist = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching whitelist:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت لیست',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!phoneNumber || !allowedRole) {
      toast({
        title: 'خطا',
        description: 'لطفاً همه فیلدهای الزامی را پر کنید',
        variant: 'destructive',
      });
      return;
    }

    // اعتبارسنجی شماره تلفن
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast({
        title: 'خطا',
        description: 'شماره تلفن باید با 09 شروع شود و 11 رقم باشد',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('کاربر وارد نشده است');

      // بررسی وجود قبلی شماره
      const { data: existing } = await supabase
        .from('staff_whitelist')
        .select('id')
        .eq('phone', phoneNumber)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'خطا',
          description: 'این شماره قبلاً در لیست ثبت شده است',
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      const { error } = await supabase
        .from('staff_whitelist')
        .insert([{
          phone: phoneNumber,
          allowed_role: allowedRole as any,
          note: note || null,
          created_by: user.id,
        }]);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      toast({
        title: 'موفق',
        description: `شماره ${phoneNumber} با موفقیت به لیست اضافه شد`,
      });

      setShowAddDialog(false);
      setPhoneNumber('');
      setAllowedRole('');
      setNote('');
      fetchWhitelist();
    } catch (error: any) {
      console.error('Error adding to whitelist:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در افزودن به لیست',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این شماره اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('staff_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'شماره با موفقیت حذف شد',
      });

      fetchWhitelist();
    } catch (error: any) {
      console.error('Error deleting from whitelist:', error);
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isGeneralManager) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مدیریت لیست مجاز پرسنل</h1>
          <p className="text-muted-foreground">افزودن و مدیریت شماره‌های مجاز برای ثبت‌نام</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          افزودن شماره جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست شماره‌های مجاز</CardTitle>
          <CardDescription>شماره‌هایی که مجاز به ثبت‌نام پرسنل هستند</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              هیچ شماره‌ای در لیست نیست
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شماره تلفن</TableHead>
                  <TableHead>نقش مجاز</TableHead>
                  <TableHead>یادداشت</TableHead>
                  <TableHead>زمان افزودن</TableHead>
                  <TableHead className="text-left">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium direction-ltr text-right">
                      {entry.phone}
                    </TableCell>
                    <TableCell>
                      {ROLE_LABELS[entry.allowed_role] || entry.allowed_role}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.note || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.created_at), {
                        addSuffix: true,
                        locale: faIR,
                      })}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>افزودن شماره جدید</DialogTitle>
            <DialogDescription>
              شماره تلفن و نقش مجاز را وارد کنید
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">شماره تلفن *</Label>
              <Input
                id="phone"
                placeholder="09121234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={11}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">نقش مجاز *</Label>
              <Select value={allowedRole || undefined} onValueChange={setAllowedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نقش" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">یادداشت (اختیاری)</Label>
              <Textarea
                id="note"
                placeholder="توضیحات اضافی..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={processing}
            >
              انصراف
            </Button>
            <Button onClick={handleAdd} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  در حال افزودن...
                </>
              ) : (
                'افزودن'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
