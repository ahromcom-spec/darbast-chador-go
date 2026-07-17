import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Building2, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseOrderNotes } from './OrderDetailsView';

interface Props {
  orderId: string;
  currentCustomerName?: string;
  currentCustomerPhone?: string;
  notes?: any;
  onUpdate?: () => void;
}

export const InvoiceEmployerOverrideDialog = ({
  orderId,
  currentCustomerName,
  currentCustomerPhone,
  notes,
  onUpdate,
}: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsedNotes = typeof notes === 'object' && notes !== null ? notes : parseOrderNotes(notes);
  const existing = parsedNotes?.invoice_override || {};

  const [employerName, setEmployerName] = useState<string>(existing.employer_name || '');
  const [employerPhone, setEmployerPhone] = useState<string>(existing.employer_phone || '');

  const persist = async (override: any | null) => {
    setSaving(true);
    try {
      // Fetch latest notes to avoid overwriting concurrent edits
      const { data: row, error: fetchErr } = await supabase
        .from('projects_v3')
        .select('notes')
        .eq('id', orderId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const latestNotes =
        typeof row?.notes === 'object' && row?.notes !== null
          ? row?.notes
          : parseOrderNotes(row?.notes as any) || {};

      const updatedNotes = { ...latestNotes };
      if (override) {
        updatedNotes.invoice_override = override;
      } else {
        delete updatedNotes.invoice_override;
      }

      const { error } = await supabase
        .from('projects_v3')
        .update({ notes: updatedNotes })
        .eq('id', orderId);
      if (error) throw error;

      toast({
        title: 'موفق',
        description: override
          ? 'فاکتور برای کارفرمای جدید تنظیم شد'
          : 'تنظیم کارفرمای فاکتور حذف شد',
      });
      setOpen(false);
      onUpdate?.();
    } catch (err: any) {
      console.error('Invoice override error:', err);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: err.message || 'خطا در ذخیره تغییرات',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const name = employerName.trim();
    const phone = employerPhone.trim();
    if (!name) {
      toast({ variant: 'destructive', title: 'خطا', description: 'نام کارفرما الزامی است' });
      return;
    }
    await persist({
      employer_name: name,
      employer_phone: phone,
      coordinator_name: currentCustomerName || '',
      coordinator_phone: currentCustomerPhone || '',
      set_at: new Date().toISOString(),
    });
  };

  const handleClear = async () => {
    await persist(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
        >
          <Building2 className="h-4 w-4 ml-1" />
          تنظیم فاکتور برای کارفرمای دیگر
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تنظیم فاکتور برای کارفرمای دیگر</DialogTitle>
          <DialogDescription>
            نام و شماره کارفرمای جدید را وارد کنید. مشتری فعلی به عنوان «هماهنگ‌کننده» در فاکتور
            ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>نام کارفرما (شرکت / شخص)</Label>
            <Input
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
              placeholder="مثال: شرکت فولاد پردیس"
            />
          </div>
          <div className="space-y-1">
            <Label>شماره تماس کارفرما</Label>
            <Input
              value={employerPhone}
              onChange={(e) => setEmployerPhone(e.target.value)}
              placeholder="مثال: 02112345678"
              dir="ltr"
            />
          </div>

          <div className="bg-muted/40 rounded-md p-3 text-sm space-y-1">
            <div className="font-medium">هماهنگ‌کننده (مشتری فعلی):</div>
            <div>نام: {currentCustomerName || '-'}</div>
            <div dir="ltr" className="text-right">
              شماره: {currentCustomerPhone || '-'}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-row-reverse">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
            ذخیره
          </Button>
          {existing.employer_name && (
            <Button variant="destructive" onClick={handleClear} disabled={saving}>
              <Trash2 className="h-4 w-4 ml-1" />
              حذف تنظیم
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
