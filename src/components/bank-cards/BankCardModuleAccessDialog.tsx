import { useState, useEffect } from 'react';
import { BankCard } from '@/hooks/useBankCards';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Blocks, Info } from 'lucide-react';

interface Module {
  key: string;
  label: string;
  description: string;
  color: string;
}

const MODULES: Module[] = [
  {
    key: 'executive',
    label: 'گزارش روزانه اجرایی',
    description: 'ماژول‌های گزارش روزانه تیم اجرایی',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  {
    key: 'management',
    label: 'گزارش روزانه مدیریت',
    description: 'ماژول گزارش روزانه مدیریت اهرم',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
  },
  {
    key: 'support',
    label: 'گزارش روزانه پشتیبانی',
    description: 'ماژول‌های گزارش روزانه تیم پشتیبانی',
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
  },
  {
    key: 'order_payment',
    label: 'ثبت پرداخت سفارشات',
    description: 'دسترسی به این کارت در دیالوگ ثبت پرداخت سفارشات مشتری',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  },
];

interface BankCardModuleAccessDialogProps {
  card: BankCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BankCardModuleAccessDialog({
  card,
  open,
  onOpenChange,
  onSaved,
}: BankCardModuleAccessDialogProps) {
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card && open) {
      setAllowedModules((card as any).allowed_modules ?? null);
    }
  }, [card, open]);

  // null means "all allowed"
  const isAllAllowed = allowedModules === null;

  const isModuleAllowed = (key: string) => {
    if (isAllAllowed) return true;
    return allowedModules!.includes(key);
  };

  const toggleAll = () => {
    if (isAllAllowed) {
      // Switch to "none allowed" -> start with all selected so admin can pick
      setAllowedModules(MODULES.map((m) => m.key));
    } else {
      setAllowedModules(null);
    }
  };

  const toggleModule = (key: string) => {
    if (isAllAllowed) {
      // Move from "all" mode to specific modules (all except this one)
      setAllowedModules(MODULES.map((m) => m.key).filter((k) => k !== key));
      return;
    }
    setAllowedModules((prev) => {
      if (!prev) return prev;
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSave = async () => {
    if (!card) return;
    setSaving(true);
    try {
      // If all modules are selected, save as null (unrestricted)
      const valueToSave =
        allowedModules !== null && allowedModules.length === MODULES.length
          ? null
          : allowedModules;

      const { error } = await supabase
        .from('bank_cards')
        .update({ allowed_modules: valueToSave, updated_at: new Date().toISOString() } as any)
        .eq('id', card.id);

      if (error) throw error;
      toast.success('تنظیمات دسترسی ماژول‌ها ذخیره شد');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-primary" />
            دسترسی ماژول‌ها به کارت
          </DialogTitle>
          <DialogDescription>
            تعیین کنید کدام ماژول‌ها به کارت «<strong>{card?.card_name}</strong>» دسترسی داشته باشند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* All access toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="font-medium text-sm">دسترسی آزاد برای همه ماژول‌ها</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                در صورت فعال بودن، همه ماژول‌ها به این کارت دسترسی دارند
              </p>
            </div>
            <Switch checked={isAllAllowed} onCheckedChange={toggleAll} />
          </div>

          {/* Individual module toggles */}
          {!isAllAllowed && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Info className="h-3.5 w-3.5" />
                ماژول‌هایی که می‌توانند از این کارت استفاده کنند را انتخاب کنید
              </div>
              {MODULES.map((module) => (
                <div
                  key={module.key}
                  className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${module.color}`}>
                      {module.label}
                    </Badge>
                  </div>
                  <Switch
                    checked={isModuleAllowed(module.key)}
                    onCheckedChange={() => toggleModule(module.key)}
                  />
                </div>
              ))}
            </div>
          )}

          {isAllAllowed && (
          <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
            <p className="text-sm text-primary/80">
                ✓ همه ماژول‌ها به این کارت دسترسی دارند. برای محدودسازی، گزینه «دسترسی آزاد» را غیرفعال کنید.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                در حال ذخیره...
              </>
            ) : (
              'ذخیره'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
