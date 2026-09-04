import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDate } from '@/lib/dateUtils';

export type DocKind = 'order' | 'statement' | 'daily_report';

export interface ArchiveDoc {
  id: string;
  kind: DocKind;
  title: string;
  subtitle: string;
  date: string | null;
  amount?: number;
  html: string;
}

export interface ArchiveFilters {
  includeOrders: boolean;
  includeStatements: boolean;
  includeDailyReports: boolean;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string;
  moduleKey?: string; // for daily reports
  statementStatus?: 'all' | 'open' | 'closed';
  onlyPaidOrders?: boolean;
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  order: 'فاکتور سفارش',
  statement: 'فاکتور صورتحساب',
  daily_report: 'گزارش روزانه',
};

const KIND_FOLDER: Record<DocKind, string> = {
  order: 'فاکتور-سفارشات',
  statement: 'صورتحساب-ها',
  daily_report: 'گزارشات-روزانه',
};

export const DAILY_REPORT_MODULES: { key: string; label: string }[] = [
  { key: 'daily_report', label: 'گزارش روزانه اجرایی' },
  { key: 'daily_report_management', label: 'گزارش روزانه مدیریت' },
  { key: 'daily_report_support', label: 'گزارش روزانه پشتیبانی' },
];

const fa = (n: number | null | undefined) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(Number(n) || 0));

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function docShell(title: string, meta: string[], body: string) {
  return `
  <div style="font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;color:#111;padding:28px;background:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f59e0b;padding-bottom:12px;margin-bottom:16px;">
      <div>
        <div style="font-size:22px;font-weight:800;">${esc(title)}</div>
        <div style="font-size:12px;color:#555;margin-top:6px;">${meta.map(esc).join(' &nbsp;|&nbsp; ')}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:18px;font-weight:800;color:#b45309;">شرکت اهرم</div>
        <div style="font-size:11px;color:#666;">ahrom.ir</div>
      </div>
    </div>
    ${body}
    <div style="margin-top:22px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#888;">
      تاریخ تولید سند: ${esc(formatPersianDate(new Date(), { showTime: true }))}
    </div>
  </div>`;
}

function table(headers: string[], rows: (string | number)[][]) {
  if (!rows.length) return '<div style="font-size:12px;color:#777;">موردی ثبت نشده است.</div>';
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f3f4f6;">
      ${headers.map((h) => `<th style="border:1px solid #d1d5db;padding:6px;text-align:right;">${esc(h)}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${r
              .map((c) => `<td style="border:1px solid #e5e7eb;padding:6px;">${esc(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('')}
    </tbody></table>`;
}

function summaryBox(items: { label: string; value: string }[]) {
  return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0;">
    ${items
      .map(
        (i) => `<div style="flex:1;min-width:150px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;background:#fafafa;">
          <div style="font-size:11px;color:#666;">${esc(i.label)}</div>
          <div style="font-size:15px;font-weight:700;margin-top:3px;">${esc(i.value)}</div>
        </div>`,
      )
      .join('')}
  </div>`;
}

/* ---------------------------------- fetch --------------------------------- */

export async function fetchArchiveDocs(f: ArchiveFilters): Promise<ArchiveDoc[]> {
  const docs: ArchiveDoc[] = [];
  const s = (f.search || '').trim();

  if (f.includeOrders) {
    let q = supabase
      .from('projects_v3')
      .select(
        'id, code, customer_name, customer_phone, address, detailed_address, total_price, total_paid, created_at, status, execution_stage, notes, subcategory_id, statement_id',
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (f.fromDate) q = q.gte('created_at', f.fromDate);
    if (f.toDate) q = q.lte('created_at', f.toDate);
    if (f.onlyPaidOrders) q = q.not('payment_confirmed_at', 'is', null);
    const { data: orders, error } = await q;
    if (error) throw error;

    const subIds = Array.from(new Set((orders || []).map((o: any) => o.subcategory_id).filter(Boolean)));
    const subMap: Record<string, string> = {};
    if (subIds.length) {
      const { data: subs } = await supabase.from('subcategories').select('id, name').in('id', subIds);
      (subs || []).forEach((x: any) => (subMap[x.id] = x.name));
    }

    for (const o of orders || []) {
      const label = `${o.code || ''} ${o.customer_name || ''} ${o.customer_phone || ''} ${o.address || ''}`;
      if (s && !label.includes(s)) continue;
      const total = Number(o.total_price) || 0;
      const paid = Number(o.total_paid) || 0;
      const body =
        summaryBox([
          { label: 'مبلغ کل', value: `${fa(total)} تومان` },
          { label: 'پرداخت شده', value: `${fa(paid)} تومان` },
          { label: 'باقیمانده', value: `${fa(Math.max(total - paid, 0))} تومان` },
        ]) +
        table(
          ['عنوان', 'مقدار'],
          [
            ['کد سفارش', o.code || '-'],
            ['کارفرما', o.customer_name || '-'],
            ['شماره تماس', o.customer_phone || '-'],
            ['خدمت', subMap[o.subcategory_id] || '-'],
            ['آدرس', o.address || '-'],
            ['آدرس دقیق', o.detailed_address || '-'],
            ['تاریخ ثبت', formatPersianDate(o.created_at, { showTime: true })],
            ['وضعیت', String(o.status || '-')],
            ['مرحله اجرا', String(o.execution_stage || '-')],
            ['توضیحات', o.notes || '-'],
          ],
        );
      docs.push({
        id: `order-${o.id}`,
        kind: 'order',
        title: `فاکتور سفارش ${o.code || ''}`,
        subtitle: `${o.customer_name || 'بدون نام'} — ${o.address || ''}`,
        date: o.created_at,
        amount: total,
        html: docShell(
          `فاکتور سفارش ${o.code || ''}`,
          [`کارفرما: ${o.customer_name || '-'}`, `تاریخ: ${formatPersianDate(o.created_at)}`],
          body,
        ),
      });
    }
  }

  if (f.includeStatements) {
    let q = supabase
      .from('customer_statements')
      .select(
        'id, statement_number, customer_id, status, total_amount, total_paid, address, detailed_address, created_at, closed_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (f.fromDate) q = q.gte('created_at', f.fromDate);
    if (f.toDate) q = q.lte('created_at', f.toDate);
    if (f.statementStatus && f.statementStatus !== 'all') q = q.eq('status', f.statementStatus);
    const { data: sts, error } = await q;
    if (error) throw error;

    const custIds = Array.from(new Set((sts || []).map((x: any) => x.customer_id).filter(Boolean)));
    const nameMap: Record<string, string> = {};
    if (custIds.length) {
      const { data: cust } = await supabase.from('customers').select('id, user_id').in('id', custIds);
      const userIds = (cust || []).map((c: any) => c.user_id).filter(Boolean);
      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('user_id, full_name, phone_number').in('user_id', userIds)
        : { data: [] as any[] };
      const byUser: Record<string, any> = {};
      (profs || []).forEach((p: any) => (byUser[p.user_id] = p));
      (cust || []).forEach((c: any) => {
        const p = byUser[c.user_id];
        nameMap[c.id] = p ? `${p.full_name || 'بدون نام'} (${p.phone_number || '-'})` : 'مشتری';
      });
    }

    const stIds = (sts || []).map((x: any) => x.id);
    const ordersByStatement: Record<string, any[]> = {};
    if (stIds.length) {
      const { data: ords } = await supabase
        .from('projects_v3')
        .select('id, code, customer_name, address, total_price, total_paid, created_at, statement_id')
        .in('statement_id', stIds);
      (ords || []).forEach((o: any) => {
        (ordersByStatement[o.statement_id] ||= []).push(o);
      });
    }

    for (const st of sts || []) {
      const customer = nameMap[st.customer_id] || 'مشتری';
      const label = `${st.statement_number} ${customer} ${st.address || ''}`;
      if (s && !label.includes(s)) continue;
      const rows = (ordersByStatement[st.id] || []).map((o: any) => [
        o.code || '-',
        o.customer_name || '-',
        o.address || '-',
        formatPersianDate(o.created_at),
        `${fa(o.total_price)} تومان`,
        `${fa(o.total_paid)} تومان`,
      ]);
      const total = Number(st.total_amount) || 0;
      const paid = Number(st.total_paid) || 0;
      const body =
        summaryBox([
          { label: 'وضعیت', value: st.status === 'closed' ? 'بسته شده' : 'باز' },
          { label: 'مبلغ کل', value: `${fa(total)} تومان` },
          { label: 'پرداخت شده', value: `${fa(paid)} تومان` },
          { label: 'باقیمانده', value: `${fa(Math.max(total - paid, 0))} تومان` },
        ]) +
        `<div style="font-size:13px;font-weight:700;margin:10px 0 6px;">سفارش‌های این صورتحساب</div>` +
        table(['کد سفارش', 'کارفرما', 'آدرس', 'تاریخ', 'مبلغ', 'پرداخت شده'], rows);
      docs.push({
        id: `statement-${st.id}`,
        kind: 'statement',
        title: `صورتحساب شماره ${st.statement_number}`,
        subtitle: `${customer} — ${st.address || ''}`,
        date: st.created_at,
        amount: total,
        html: docShell(
          `فاکتور صورتحساب شماره ${st.statement_number}`,
          [`مشتری: ${customer}`, `آدرس: ${st.address || '-'}`, `تاریخ: ${formatPersianDate(st.created_at)}`],
          body,
        ),
      });
    }
  }

  if (f.includeDailyReports) {
    let q = supabase
      .from('daily_reports')
      .select('id, report_date, module_key, notes, created_at')
      .order('report_date', { ascending: false })
      .limit(400);
    if (f.fromDate) q = q.gte('report_date', f.fromDate.slice(0, 10));
    if (f.toDate) q = q.lte('report_date', f.toDate.slice(0, 10));
    if (f.moduleKey && f.moduleKey !== 'all') q = q.eq('module_key', f.moduleKey);
    const { data: reports, error } = await q;
    if (error) throw error;

    const ids = (reports || []).map((r: any) => r.id);
    const rowsByReport: Record<string, any[]> = {};
    const staffByReport: Record<string, any[]> = {};
    if (ids.length) {
      const [{ data: ro }, { data: rs }] = await Promise.all([
        supabase
          .from('daily_report_orders')
          .select('daily_report_id, order_id, activity_description, service_details, team_name, notes')
          .in('daily_report_id', ids),
        supabase
          .from('daily_report_staff')
          .select(
            'daily_report_id, staff_name, work_status, overtime_hours, amount_received, amount_spent, notes',
          )
          .in('daily_report_id', ids),
      ]);
      (ro || []).forEach((x: any) => (rowsByReport[x.daily_report_id] ||= []).push(x));
      (rs || []).forEach((x: any) => (staffByReport[x.daily_report_id] ||= []).push(x));
    }

    const orderIds = Array.from(
      new Set(Object.values(rowsByReport).flat().map((x: any) => x.order_id).filter(Boolean)),
    );
    const codeMap: Record<string, string> = {};
    if (orderIds.length) {
      const { data: ords } = await supabase
        .from('projects_v3')
        .select('id, code, customer_name')
        .in('id', orderIds as string[]);
      (ords || []).forEach((o: any) => (codeMap[o.id] = `${o.code || ''} — ${o.customer_name || ''}`));
    }

    for (const r of reports || []) {
      const moduleLabel =
        DAILY_REPORT_MODULES.find((m) => m.key === r.module_key)?.label || r.module_key || 'گزارش روزانه';
      const dateLabel = formatPersianDate(`${r.report_date}T00:00:00`);
      const label = `${dateLabel} ${moduleLabel}`;
      if (s && !label.includes(s)) continue;
      const orderRows = (rowsByReport[r.id] || []).map((x: any) => [
        codeMap[x.order_id] || '-',
        x.activity_description || '-',
        x.service_details || '-',
        x.team_name || '-',
        x.notes || '-',
      ]);
      const staffRows = (staffByReport[r.id] || []).map((x: any) => [
        x.staff_name || '-',
        x.work_status || '-',
        x.overtime_hours ?? '-',
        `${fa(x.amount_received)} تومان`,
        `${fa(x.amount_spent)} تومان`,
        x.notes || '-',
      ]);
      const body =
        summaryBox([
          { label: 'تعداد سفارش', value: fa(orderRows.length) },
          { label: 'تعداد نیرو', value: fa(staffRows.length) },
        ]) +
        `<div style="font-size:13px;font-weight:700;margin:10px 0 6px;">سفارش‌های روز</div>` +
        table(['سفارش', 'فعالیت', 'جزئیات خدمت', 'تیم', 'توضیحات'], orderRows) +
        `<div style="font-size:13px;font-weight:700;margin:14px 0 6px;">نیروها</div>` +
        table(['نام', 'وضعیت کاری', 'اضافه‌کاری', 'دریافتی', 'پرداختی', 'توضیحات'], staffRows) +
        (r.notes
          ? `<div style="margin-top:12px;font-size:12px;"><b>یادداشت گزارش:</b> ${esc(r.notes)}</div>`
          : '');
      docs.push({
        id: `daily-${r.id}`,
        kind: 'daily_report',
        title: `${moduleLabel} — ${dateLabel}`,
        subtitle: `${orderRows.length} سفارش، ${staffRows.length} نیرو`,
        date: `${r.report_date}T00:00:00`,
        html: docShell(moduleLabel, [`تاریخ گزارش: ${dateLabel}`], body),
      });
    }
  }

  return docs;
}

/* ----------------------------------- pdf ---------------------------------- */

export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;top:0;left:-10000px;width:794px;background:#ffffff;z-index:-1;';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let remaining = imgH;
    let offset = 0;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    while (remaining > 0) {
      pdf.addImage(dataUrl, 'JPEG', 0, -offset, pageW, imgH);
      remaining -= pageH;
      offset += pageH;
      if (remaining > 0) pdf.addPage();
    }
    return pdf.output('blob');
  } finally {
    holder.remove();
  }
}

export function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
}

export async function buildArchiveZip(
  docs: ArchiveDoc[],
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const index: string[] = [];
  let done = 0;
  for (const d of docs) {
    onProgress?.(done, docs.length, d.title);
    const blob = await htmlToPdfBlob(d.html);
    const name = `${KIND_FOLDER[d.kind]}/${safeFileName(d.title)}.pdf`;
    zip.file(name, blob);
    index.push(`${DOC_KIND_LABEL[d.kind]} | ${d.title} | ${d.date ? formatPersianDate(d.date) : '-'}`);
    done++;
    onProgress?.(done, docs.length, d.title);
  }
  zip.file('فهرست.txt', index.join('\n'));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
