import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BASE_KEY, getFormSchema } from '@/lib/serviceFormSchemas';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subcategory: { id: string; name: string } | null;
  serviceName: string;
}

export function ServicePricingRatesDialog({ open, onOpenChange, subcategory, serviceName }: Props) {
  const [schema, setSchema] = useState<unknown>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const k = (f: string, o = '') => `${f}|${o}`;

  useEffect(() => {
    if (!open || !subcategory) return;
    setVals({});
    supabase.from('subcategories').select('form_schema').eq('id', subcategory.id).maybeSingle()
      .then(({ data }) => setSchema((data as any)?.form_schema ?? null));
    supabase.from('service_pricing_rates' as any).select('field_key, option_value, unit_price').eq('subcategory_id', subcategory.id)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        ((data as any) || []).forEach((r: any) => { m[k(r.field_key, r.option_value)] = String(r.unit_price); });
        setVals(m);
      });
  }, [open, subcategory]);

  if (!subcategory) return null;
  const fields = getFormSchema(serviceName, subcategory.name, schema);
  const rows: { key: string; field: string; option: string; label: string }[] = [
    { key: k(BASE_KEY), field: BASE_KEY, option: '', label: 'هزینه پایه هر سفارش' },
  ];
  for (const f of fields) {
    if (f.info || f.type === 'text' || (f.type === 'number' && f.multiplier)) continue;
    if (f.type === 'select') (f.options || []).forEach(o => rows.push({ key: k(f.key, o), field: f.key, option: o, label: `${f.label}: ${o}` }));
    else rows.push({ key: k(f.key), field: f.key, option: '', label: f.type === 'number' ? `قیمت هر ${f.unit || 'واحد'} ${f.label}` : f.label });
  }
  const mults = fields.filter(f => f.multiplier).map(f => f.label).join('، ');

  const save = async () => {
    setSaving(true);
    const payload = rows.map(r => ({
      subcategory_id: subcategory.id, field_key: r.field, option_value: r.option,
      unit_price: Number(parseLocalizedNumber(vals[r.key] || '0')) || 0,
    }));
    const { error } = await supabase.from('service_pricing_rates' as any).upsert(payload as any, { onConflict: 'subcategory_id,field_key,option_value' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('قیمت‌ها ذخیره شد');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>قیمت‌گذاری فرم: {subcategory.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">مبالغ به تومان. خالی یا صفر یعنی در قیمت تقریبی حساب نمی‌شود.{mults && ` جمع کل در «${mults}» ضرب می‌شود.`}</p>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{r.label}</span>
              <Input className="w-40" inputMode="numeric" value={vals[r.key] ?? ''} onChange={e => setVals(p => ({ ...p, [r.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره قیمت‌ها'}</Button>
      </DialogContent>
    </Dialog>
  );
}
