import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ListChecks, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CategoryConditionsBoxProps {
  category: string;
  categoryLabel: string;
  value: string;
  onSave: (category: string, conditions: string) => Promise<void>;
  disabled?: boolean;
}

/**
 * کادر ثبت «شروط و اگر و اما»های قیمت‌گذاری برای هر بخش قیمت‌گذاری.
 * این متن در محاسبه/اعلام قیمت به کاربران استفاده می‌شود.
 */
export const CategoryConditionsBox = ({
  category,
  categoryLabel,
  value,
  onSave,
  disabled,
}: CategoryConditionsBoxProps) => {
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const isDirty = (draft || '') !== (value || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(category, draft);
      toast.success(`شروط «${categoryLabel}» ذخیره شد`);
    } catch (e: any) {
      toast.error('خطا در ذخیره شروط: ' + (e?.message || 'نامشخص'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`mt-4 p-3 rounded-lg border-2 border-dashed ${
        isDirty ? 'border-orange-400 bg-orange-50/40' : 'border-primary/30 bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="w-4 h-4 text-primary" />
          شروط و «اگر و اما»های قیمت‌گذاری این بخش
        </Label>
        <Button size="sm" onClick={handleSave} disabled={disabled || saving || !isDirty}>
          {saving ? (
            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 ml-1" />
          )}
          ذخیره شروط
        </Button>
      </div>
      <Textarea
        dir="rtl"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
        placeholder={`مثال: اگر متراژ ${categoryLabel} کمتر از ۲۰ متر بود، حداقل قیمت ثابت محاسبه شود؛ اگر کار در ارتفاع بیش از ۱۵ متر بود، ۲۰٪ اضافه شود...`}
        className="min-h-[110px] text-sm leading-7 bg-background"
      />
      <p className="text-xs text-muted-foreground mt-2">
        این شروط در محاسبه و اعلام قیمت به کاربران (از جمله دستیار آنلاین اهرم) در نظر گرفته می‌شود.
      </p>
    </div>
  );
};
