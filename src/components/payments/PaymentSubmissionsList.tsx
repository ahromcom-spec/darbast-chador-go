import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import {
  kindLabels, signPaymentImages, submissionStatusLabels, type PaymentSubmission,
} from '@/lib/paymentSubmissions';

interface Props {
  orderId?: string | null;
  statementId?: string | null;
  refreshKey?: number;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

export default function PaymentSubmissionsList({ orderId, statementId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!orderId && !statementId) return;
    let q = supabase.from('payment_submissions').select('*').order('created_at', { ascending: false });
    q = orderId ? q.eq('order_id', orderId) : q.eq('statement_id', statementId!);
    const { data } = await q;
    const list = (data || []) as unknown as PaymentSubmission[];
    setRows(list);
    setImages(await signPaymentImages(list.map(r => r.image_path)));
  }, [orderId, statementId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 mt-3" dir="rtl">
      <p className="text-sm font-semibold">فیش‌های ارسالی شما</p>
      {rows.map((r) => {
        const st = submissionStatusLabels[r.status];
        return (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{kindLabels[r.kind]}</Badge>
              <span className="font-bold">{fmt(r.amount)}</span>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fa-IR')}</span>
              {r.notes && <span className="text-muted-foreground">— {r.notes}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={st.cls}>{st.label}</Badge>
              {r.image_path && images[r.image_path] && (
                <Button size="sm" variant="ghost" className="h-7 gap-1" asChild>
                  <a href={images[r.image_path]} target="_blank" rel="noreferrer">
                    <Eye className="h-3.5 w-3.5" /> تصویر
                  </a>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
