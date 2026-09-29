import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { Trash2 } from 'lucide-react';

export const SCAFFOLD_SALE_ITEMS: { k: string; l: string }[] = [
  { k: 'pipe6', l: '6 متری' }, { k: 'pipe5', l: '5 متری' }, { k: 'pipe4', l: '4 متری' },
  { k: 'pipe3', l: '3 متری' }, { k: 'pipe2', l: '2 متری' }, { k: 'pipe1', l: '1 متری' },
  { k: 'mold1', l: 'قالب یک متری' }, { k: 'mold70', l: 'قالب 70 سانتی' }, { k: 'mold50', l: 'قالب 50 سانتی' },
  { k: 'mold30', l: 'قالب 30 سانتی' }, { k: 'clamp', l: 'بست چهارپیچ داربست' }, { k: 'coupler', l: 'رابط داربست' },
];

export const isScaffoldSaleSub = (name?: string) => /فروش\s*اجناس\s*داربست/.test(name || '');

export interface SaleResult {
  condition: 'new' | 'used';
  lines: { label: string; qty: number; unit_price: number; amount: number }[];
  shipping: boolean;
  shippingFee: number;
  total: number;
  hasPricing: boolean;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

export function ScaffoldSaleItems({ subcategoryId, onChange }: { subcategoryId: string; onChange: (r: SaleResult) => void }) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [rows, setRows] = useState<{ k: string; qty: string }[]>([]);
  const [shipping, setShipping] = useState(false);

  useEffect(() => {
    supabase.from('subcategory_pricing_items').select('key,value').eq('subcategory_id', subcategoryId)
      .then(({ data }) => {
        const m: Record<string, number> = {};
        (data || []).forEach((r: any) => { m[r.key] = Number(r.value) || 0; });
        setPrices(m);
      });
  }, [subcategoryId]);

  const price = (k: string) => prices[`${condition}_${k}`] || 0;
  const shippingFee = prices['shipping'] || 0;

  const result = useMemo<SaleResult>(() => {
    const lines = rows.map(r => {
      const qty = Number(parseLocalizedNumber(r.qty || '0')) || 0;
      const up = price(r.k);
      return { label: SCAFFOLD_SALE_ITEMS.find(i => i.k === r.k)!.l, qty, unit_price: up, amount: qty * up };
    }).filter(l => l.qty > 0);
    const sub = lines.reduce((a, l) => a + l.amount, 0);
    const fee = shipping ? shippingFee : 0;
    const hasPricing = lines.length > 0 && lines.every(l => l.unit_price > 0);
    return { condition, lines, shipping, shippingFee: fee, total: sub + fee, hasPricing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, condition, shipping, prices]);

  useEffect(() => { onChange(result); }, [result, onChange]);

  const available = SCAFFOLD_SALE_ITEMS.filter(i => !rows.some(r => r.k === i.k));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>نوع اجناس</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={condition === 'new' ? 'default' : 'outline'} onClick={() => setCondition('new')}>نو</Button>
          <Button type="button" variant={condition === 'used' ? 'default' : 'outline'} onClick={() => setCondition('used')}>دست دوم</Button>
        </div>
      </div>

      {available.length > 0 && (
        <div className="space-y-1">
          <Label>افزودن جنس</Label>
          <Select value="" onValueChange={k => setRows(p => [...p, { k, qty: '1' }])}>
            <SelectTrigger><SelectValue placeholder="یک جنس انتخاب کنید" /></SelectTrigger>
            <SelectContent>
              {available.map(i => (
                <SelectItem key={i.k} value={i.k}>
                  {i.l} — {price(i.k) > 0 ? `${fa(price(i.k))} تومان` : 'قیمت کارشناسی'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {rows.map(r => {
        const item = SCAFFOLD_SALE_ITEMS.find(i => i.k === r.k)!;
        const up = price(r.k);
        const qty = Number(parseLocalizedNumber(r.qty || '0')) || 0;
        return (
          <div key={r.k} className="flex items-center gap-2 rounded-md border p-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{item.l}</div>
              <div className="text-xs text-muted-foreground">
                هر عدد: {up > 0 ? `${fa(up)} تومان` : 'قیمت کارشناسی'}{up > 0 && qty > 0 && ` — جمع: ${fa(up * qty)}`}
              </div>
            </div>
            <Input className="w-24" inputMode="numeric" placeholder="تعداد" value={r.qty}
              onChange={e => setRows(p => p.map(x => x.k === r.k ? { ...x, qty: e.target.value } : x))} />
            <Button type="button" size="icon" variant="ghost" onClick={() => setRows(p => p.filter(x => x.k !== r.k))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-md border p-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shipping} onChange={e => setShipping(e.target.checked)} />
          نیاز به ارسال
        </label>
        <span className="text-xs text-muted-foreground">{shippingFee > 0 ? `${fa(shippingFee)} تومان` : 'تعیین توسط کارشناس'}</span>
      </div>
    </div>
  );
}
