/**
 * ساخت فاکتور/گزارش قابل پرینت و اشتراک‌گذاری برای یک سفارش
 * شامل: مشخصات سفارش، مراحل طی‌شده و مراحل باقی‌مانده، ابعاد، شرح فعالیت‌ها و تاریخ‌ها
 */
import { formatPersianDate } from './dateUtils';
import { calculateTotalFromDimensions } from './dimensionCalculations';

export interface DailyLogEntry {
  report_date?: string | null;
  activity_description?: string | null;
  team_name?: string | null;
}

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (v: any) =>
  v == null || isNaN(Number(v)) ? '—' : `${Number(v).toLocaleString('fa-IR')} تومان`;

const dateOrDash = (v: any) => (v ? formatPersianDate(v) : '—');

interface StageRow {
  label: string;
  done: boolean;
  date?: string | null;
}

export function buildOrderStages(order: any): StageRow[] {
  const totalPrice = Number(order?.total_price) || 0;
  const totalPaid = Number(order?.total_paid) || 0;
  const stage = order?.execution_stage;
  const status = order?.status;

  const executed = !!order?.execution_start_date || ['order_executed', 'awaiting_collection', 'in_collection', 'collected'].includes(stage) || ['completed', 'paid', 'closed'].includes(status);
  const collected = stage === 'collected' || status === 'closed';
  const inCollection = collected || stage === 'in_collection';
  const awaitingCollection = inCollection || stage === 'awaiting_collection';
  const fullyPaid = !!order?.payment_confirmed_at || (totalPrice > 0 && totalPaid >= totalPrice);

  return [
    { label: 'ثبت سفارش', done: !!order?.created_at, date: order?.created_at },
    { label: 'تایید سفارش', done: !!order?.approved_at || executed, date: order?.approved_at },
    { label: 'اجرای سفارش', done: executed, date: order?.execution_start_date },
    { label: 'پرداخت کامل', done: fullyPaid, date: order?.payment_confirmed_at },
    { label: 'در انتظار جمع‌آوری', done: awaitingCollection, date: order?.approved_collection_date },
    { label: 'جمع‌آوری کامل', done: collected, date: collected ? order?.execution_stage_updated_at : null },
  ];
}

export interface OrderSheetOptions {
  hidePrices?: boolean;
}

export function buildOrderSheetHtml(order: any, logs: DailyLogEntry[] = [], notes?: any, options: OrderSheetOptions = {}): string {
  const hidePrices = !!options.hidePrices;
  const dims: any[] = Array.isArray(notes?.dimensions) ? notes.dimensions : [];
  const calc = calculateTotalFromDimensions(dims, notes?.columnHeight);
  const stages = buildOrderStages(order);

  const dimRows = dims
    .map((d, i) => {
      const l = d?.length ?? d?.l ?? '';
      const w = d?.width ?? d?.w ?? '';
      const h = d?.height ?? d?.h ?? '';
      return `<tr><td>${i + 1}</td><td>${esc(l || '—')}</td><td>${esc(w || '—')}</td><td>${esc(h || '—')}</td></tr>`;
    })
    .join('');

  const logRows = logs
    .map(
      (l) =>
        `<tr><td>${esc(dateOrDash(l.report_date))}</td><td>${esc(l.activity_description || '—').replace(/\n/g, '<br/>')}</td><td>${esc(l.team_name || '—')}</td></tr>`
    )
    .join('');

  const stageRows = stages
    .map(
      (s) =>
        `<tr class="${s.done ? 'done' : 'pending'}"><td>${s.done ? '✔ انجام شده' : '⏳ باقی‌مانده'}</td><td>${esc(s.label)}</td><td>${esc(s.done ? dateOrDash(s.date) : '—')}</td></tr>`
    )
    .join('');

  const serviceName = order?.subcategories?.name || notes?.subcategory_name || '—';
  const serviceType = order?.subcategories?.service_types_v3?.name || order?.subcategories?.service_types?.name || '';
  const customer = order?.customer_name || order?.profiles?.full_name || notes?.customerName || '—';
  const phone = order?.customer_phone || order?.profiles?.phone_number || notes?.phoneNumber || '—';
  const address = [order?.address || order?.locations?.address_line, order?.detailed_address].filter(Boolean).join(' - ') || '—';
  const description = notes?.description || notes?.installationDescription || notes?.locationPurpose || '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>فاکتور سفارش ${esc(order?.code || '')}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Vazirmatn,Tahoma,system-ui,sans-serif;margin:0;padding:16px;background:#f4f5f7;color:#111}
  .sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 4px}
  .muted{color:#666;font-size:12px}
  .bar{display:flex;gap:8px;justify-content:flex-end;max-width:820px;margin:0 auto 12px}
  button{font-family:inherit;font-size:14px;padding:8px 16px;border-radius:8px;border:0;cursor:pointer;color:#fff}
  .print{background:#1d4ed8}.share{background:#16a34a}
  section{margin-top:18px}
  h2{font-size:15px;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:right;vertical-align:top}
  th{background:#f3f4f6}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
  .grid div{border:1px solid #e5e7eb;border-radius:8px;padding:8px}
  .grid b{display:block;color:#666;font-weight:400;font-size:11px;margin-bottom:2px}
  tr.done td{background:#f0fdf4}
  tr.pending td{background:#fff7ed;color:#9a3412}
  @media print{body{background:#fff;padding:0}.bar{display:none}.sheet{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="bar">
  <button class="print" onclick="window.print()">پرینت فاکتور</button>
  <button class="share" onclick="shareSheet()">اشتراک‌گذاری</button>
</div>
<div class="sheet">
  <h1>فاکتور و گزارش اجرای سفارش ${esc(order?.code || '')}</h1>
  <div class="muted">تاریخ صدور: ${esc(formatPersianDate(new Date()))} — شرکت اهرم</div>

  <section>
    <h2>مشخصات سفارش</h2>
    <div class="grid">
      <div><b>کد سفارش</b>${esc(order?.code || '—')}</div>
      <div><b>نوع خدمات</b>${esc(serviceName)}${serviceType ? ` (${esc(serviceType)})` : ''}</div>
      <div><b>مشتری</b>${esc(customer)}</div>
      <div><b>شماره تماس</b>${esc(phone)}</div>
      <div style="grid-column:1/-1"><b>آدرس</b>${esc(address)}</div>
      ${hidePrices ? '' : `<div><b>مبلغ کل</b>${esc(money(order?.total_price))}</div>
      <div><b>مبلغ پرداخت‌شده</b>${esc(money(order?.total_paid))}</div>`}
    </div>
  </section>

  <section>
    <h2>مراحل سفارش (طی‌شده / باقی‌مانده)</h2>
    <table><thead><tr><th>وضعیت</th><th>مرحله</th><th>تاریخ</th></tr></thead><tbody>${stageRows}</tbody></table>
  </section>

  <section>
    <h2>ابعاد پروژه</h2>
    ${dimRows
      ? `<table><thead><tr><th>#</th><th>طول</th><th>عرض</th><th>ارتفاع</th></tr></thead><tbody>${dimRows}</tbody></table>
         <div class="muted" style="margin-top:6px">مجموع: ${esc(calc.total.toLocaleString('fa-IR'))} ${esc(calc.unit)}</div>`
      : '<div class="muted">ابعادی ثبت نشده است.</div>'}
  </section>

  ${description ? `<section><h2>شرح سفارش</h2><div style="font-size:13px;white-space:pre-wrap">${esc(description)}</div></section>` : ''}

  <section>
    <h2>شرح فعالیت‌ها و تاریخ‌های اجرا</h2>
    ${logRows
      ? `<table><thead><tr><th style="width:120px">تاریخ</th><th>شرح فعالیت</th><th style="width:160px">اکیپ</th></tr></thead><tbody>${logRows}</tbody></table>`
      : '<div class="muted">فعالیتی ثبت نشده است.</div>'}
  </section>
</div>
<script>
  async function shareSheet(){
    const text = document.querySelector('.sheet').innerText;
    try{
      if(navigator.share){ await navigator.share({ title: document.title, text }); }
      else { await navigator.clipboard.writeText(text); alert('متن فاکتور در حافظه کپی شد.'); }
    }catch(e){}
  }
</script>
</body></html>`;
}

export function openOrderSheet(order: any, logs: DailyLogEntry[] = [], notes?: any, options: OrderSheetOptions = {}) {
  const html = buildOrderSheetHtml(order, logs, notes, options);
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
