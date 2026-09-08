import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ListChecks, Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface CategoryConditionsBoxProps {
  category: string;
  categoryLabel: string;
  value: string;
  onSave: (category: string, conditions: string) => Promise<void>;
  disabled?: boolean;
}

/** هر خط یک شرط مستقل است */
export const parseConditions = (value: string | null | undefined): string[] =>
  (value || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export const joinConditions = (items: string[]): string =>
  items.map((s) => s.trim()).filter(Boolean).join('\n');

/**
 * فهرست شروط ثبت‌شده هر بخش قیمت‌گذاری (بالای بخش نمایش داده می‌شود)
 * با امکان ویرایش و حذف هر شرط.
 */
export const CategoryConditionsList = ({
  category,
  categoryLabel,
  value,
  onSave,
  disabled,
}: CategoryConditionsBoxProps) => {
  const items = parseConditions(value);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!items.length) return null;

  const commit = async (next: string[], msg: string) => {
    setBusy(true);
    try {
      await onSave(category, joinConditions(next));
      toast.success(msg);
      setEditIndex(null);
    } catch (e: any) {
      toast.error('خطا در ذخیره شروط: ' + (e?.message || 'نامشخص'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5" dir="rtl">
      <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
        <ListChecks className="w-4 h-4 text-primary" />
        شروط ثبت‌شده «{categoryLabel}» ({items.length.toLocaleString('fa-IR')})
      </Label>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 p-2 rounded-md bg-background border border-border"
          >
            <span className="text-xs font-bold text-primary shrink-0 mt-1">
              {(i + 1).toLocaleString('fa-IR')}.
            </span>
            {editIndex === i ? (
              <>
                <Textarea
                  dir="rtl"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[70px] text-sm leading-7 flex-1"
                  disabled={busy}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={busy || !editText.trim()}
                    onClick={() => {
                      const next = [...items];
                      next[i] = editText.trim();
                      commit(next, 'شرط ویرایش شد');
                    }}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={busy}
                    onClick={() => setEditIndex(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm leading-7 whitespace-pre-wrap">{item}</p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={disabled || busy}
                    onClick={() => {
                      setEditIndex(i);
                      setEditText(item);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    disabled={disabled || busy}
                    onClick={() => commit(items.filter((_, idx) => idx !== i), 'شرط حذف شد')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * کادر افزودن شرط جدید برای هر بخش قیمت‌گذاری.
 * پس از ذخیره، شرط به فهرست بالای همان بخش اضافه می‌شود و کادر خالی می‌گردد.
 */
export const CategoryConditionsBox = ({
  category,
  categoryLabel,
  value,
  onSave,
  disabled,
}: CategoryConditionsBoxProps) => {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft('');
  }, [category]);

  const isDirty = draft.trim().length > 0;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const next = [...parseConditions(value), draft.trim()];
      await onSave(category, joinConditions(next));
      setDraft('');
      toast.success(`شرط جدید «${categoryLabel}» ذخیره شد`);
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
          افزودن شرط و «اگر و اما»ی جدید برای این بخش
        </Label>
        <Button size="sm" onClick={handleSave} disabled={disabled || saving || !isDirty}>
          {saving ? (
            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 ml-1" />
          )}
          ثبت شرط
        </Button>
      </div>
      <Textarea
        dir="rtl"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
        placeholder={`مثال: اگر متراژ ${categoryLabel} کمتر از ۲۰ متر بود، حداقل قیمت ثابت محاسبه شود...`}
        className="min-h-[90px] text-sm leading-7 bg-background"
      />
      <p className="text-xs text-muted-foreground mt-2">
        پس از ثبت، شرط به فهرست بالای همین بخش اضافه می‌شود و قابل ویرایش یا حذف است. این شروط در
        محاسبه و اعلام قیمت به کاربران (از جمله دستیار آنلاین اهرم) در نظر گرفته می‌شود.
      </p>
    </div>
  );
};
