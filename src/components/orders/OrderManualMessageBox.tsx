import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, Loader2, MessageSquareText, Send, XCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { smsElementsFor, sortSmsElements } from '../../../supabase/functions/_shared/smsCustomVariables';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useOrderCollaboratorsSms } from '@/hooks/useOrderCollaboratorsSms';
import { OrderCollaboratorSmsChips } from './OrderCollaboratorSmsChips';
import {
  ORDER_MESSAGE_ELEMENTS, SMS_SERVICE_LINE, insertElementAt, previewOrderManualMessage, sendOrderManualMessage,
  type ManualMessageResult,
} from '@/lib/orderCollaboratorSms';

interface Props {
  orderId: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** شرح فعالیت خوانا برای المان {description} */
  description?: string;
}

const MAX_LEN = 700;

/** کادر «ارسال پیام سفارشی»: متن آزاد با المان‌های سفارش، انتخاب گیرنده‌ها و ارسال از خط خدماتی. فقط برای مدیران سفارش. */
export function OrderManualMessageBox({ orderId, orderCode, customerName, customerPhone, description }: Props) {
  const ids = useMemo(() => [orderId], [orderId]);
  const { byOrder, isManager, loading } = useOrderCollaboratorsSms(ids);
  const collaborators = byOrder.get(orderId) || [];

  const [text, setText] = useState('');
  const [toCustomer, setToCustomer] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const [results, setResults] = useState<ManualMessageResult[] | null>(null);
  const [customElements, setCustomElements] = useState<{ token: string; label: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  // پیش‌فرض: همکارانی که پیامکشان روشن است انتخاب شوند
  useEffect(() => {
    if (initialized.current || loading) return;
    initialized.current = true;
    setSelected(new Set(collaborators.filter((c) => c.sms_enabled && !c.sms_opted_out).map((c) => c.id)));
  }, [loading, collaborators]);

  // المان‌های سفارشی ساخته‌شده در مدیریت پیامک (اگر دسترسی باشد)
  useEffect(() => {
    let alive = true;
    supabase.from('sms_custom_variables').select('token, label, enabled, source_key, is_system, sort_order').eq('enabled', true).then(({ data }) => {
      if (!alive || !data) return;
      // همه المان‌های پیامک (پایه با نام فارسی و ساخته‌شده)؛ المان‌های رویداد اینجا مقدار ندارند
      setCustomElements(sortSmsElements(smsElementsFor(data as any[], null)).map((v: any) => ({ token: `{${String(v.token).replace(/[{}]/g, '')}}`, label: String(v.label || v.token) })));
    });
    return () => { alive = false; };
  }, []);

  if (!isManager) return null;

  const insert = (token: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const next = insertElementAt(text, token, start, end);
    if (next.text.length > MAX_LEN) { toast.error('متن پیام از حد مجاز بلندتر می‌شود'); return; }
    setText(next.text);
    setPreview(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(next.cursor, next.cursor); });
  };

  const toggleCollab = (id: string, on: boolean) => {
    setSelected((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  };

  const recipientsCount = (toCustomer ? 1 : 0) + selected.size;

  const doPreview = async () => {
    if (!text.trim()) { toast.error('ابتدا متن پیام را بنویسید'); return; }
    setBusy('preview');
    try { setPreview(await previewOrderManualMessage(orderId, text, description)); }
    catch (e: any) { toast.error(e?.message || 'پیش‌نمایش ساخته نشد'); }
    finally { setBusy(null); }
  };

  const doSend = async () => {
    if (!text.trim()) { toast.error('ابتدا متن پیام را بنویسید'); return; }
    if (recipientsCount === 0) { toast.error('حداقل یک گیرنده انتخاب کنید'); return; }
    setBusy('send');
    setResults(null);
    try {
      const res = await sendOrderManualMessage({ orderId, message: text, customer: toCustomer, collaboratorIds: Array.from(selected), description });
      setResults(res);
      const sent = res.filter((r) => r.status === 'sent').length;
      if (sent === res.length && sent > 0) toast.success(`پیام برای ${sent} گیرنده ارسال شد`);
      else if (sent > 0) toast.warning(`پیام برای ${sent} از ${res.length} گیرنده ارسال شد`);
      else toast.error('پیامی ارسال نشد؛ دلیل هر گیرنده را پایین کادر ببینید');
    } catch (e: any) {
      toast.error(e?.message || 'ارسال پیام انجام نشد');
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <MessageSquareText className="h-4 w-4 text-primary" /> ارسال پیام سفارشی
        </div>
        <Badge variant="outline" className="text-[11px]">خط خدماتی <span className="font-mono mr-1" dir="ltr">{SMS_SERVICE_LINE}</span></Badge>
      </div>

      {collaborators.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">پیامک خودکار تغییر مراحل این سفارش برای هر همکار:</p>
          <OrderCollaboratorSmsChips collaborators={collaborators} />
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">گیرندگان این پیام:</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer">
            <Checkbox className="h-4 w-4 min-h-0 shrink-0" checked={toCustomer} onCheckedChange={(v) => setToCustomer(v === true)} />
            مشتری{customerName ? `: ${customerName}` : ''}
            {customerPhone ? <span className="font-mono text-muted-foreground" dir="ltr">{customerPhone}</span> : null}
          </label>
          {collaborators.map((c) => (
            <label key={c.id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer">
              <Checkbox className="h-4 w-4 min-h-0 shrink-0" checked={selected.has(c.id)} onCheckedChange={(v) => toggleCollab(c.id, v === true)} />
              همکار: {c.name}
              {c.phone ? <span className="font-mono text-muted-foreground" dir="ltr">{c.phone}</span> : null}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); setPreview(null); }}
          placeholder={`مثلاً: {customerName} عزیز، مانده سفارش ${orderCode} مبلغ {remainingAmount} است.`}
          rows={4}
          className="text-sm"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>برای افزودن المان روی آن بزنید؛ مقدارش هنگام ارسال از همین سفارش پر می‌شود.</span>
          <span className="font-mono">{text.length}/{MAX_LEN}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(customElements.length ? customElements : ORDER_MESSAGE_ELEMENTS).map((el) => (
            <button
              key={el.token}
              type="button"
              onClick={() => insert(el.token)}
              className="rounded-full border border-dashed px-2 py-0.5 text-[11px] hover:bg-accent hover:text-accent-foreground transition-colors"
              title={el.token}
            >
              + {el.label}
            </button>
          ))}
        </div>
      </div>

      {preview !== null && (
        <div className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap leading-6">{preview}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={doPreview} disabled={!!busy || !text.trim()}>
          {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Eye className="h-4 w-4 ml-1" />}
          پیش‌نمایش متن نهایی
        </Button>
        <Button type="button" size="sm" onClick={doSend} disabled={!!busy || !text.trim() || recipientsCount === 0}>
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Send className="h-4 w-4 ml-1" />}
          ارسال برای {recipientsCount} گیرنده
        </Button>
      </div>

      {results && (
        <ul className="space-y-1 text-xs">
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.id || i}`} className="flex items-start gap-1.5">
              {r.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                : r.status === 'failed' ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                : <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span>
                {r.kind === 'customer' ? 'مشتری' : 'همکار'} {r.name}
                {r.status === 'sent' ? ': ارسال شد' : `: ${r.note || (r.status === 'failed' ? 'ارسال نشد' : 'ارسال نشد')}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
