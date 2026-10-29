import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, Download, FileStack } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0));

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  pending_execution: 'در انتظار اجرا',
  approved: 'تایید شده',
  scheduled: 'زمان‌بندی',
  in_progress: 'در حال اجرا',
  pending_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'جمع‌آوری شد',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
};

export interface AllStatementsOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  subcategory_name: string | null;
  description?: string | null;
}

export interface AllStatementsItem {
  statement_number: number;
  total_paid?: number;
  status: 'open' | 'closed';
  addresses: string[];
  serviceTypes: string[];
  discount_amount: number;
  discount_note: string | null;
  cheque_total: number;
  cheque_cleared: number;
  cheque_pending: number;
  cheque_bounced: number;
  orders: AllStatementsOrder[];
}

interface Props {
  customerName: string | null;
  customerPhone: string | null;
  customerCode?: string | null;
  statements: AllStatementsItem[];
  globalDiscount: number;
  globalDiscountNote?: string | null;
}

export const AllStatementsInvoiceDialog = (props: Props) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const totalAmount = props.statements.reduce((a, s) => a + s.orders.reduce((x, o) => x + o.total, 0), 0);
  const totalPaid = props.statements.reduce((a, s) => a + (s.total_paid ?? s.orders.reduce((x, o) => x + o.paid, 0)), 0);
  const statementDiscounts = props.statements.reduce((a, s) => a + (s.discount_amount || 0), 0);
  const totalDiscount = statementDiscounts + (props.globalDiscount || 0);
  const totalRemaining = Math.max(totalAmount - totalPaid - totalDiscount, 0);
  const chequeTotal = props.statements.reduce((a, s) => a + (s.cheque_total || 0), 0);
  const chequeCleared = props.statements.reduce((a, s) => a + (s.cheque_cleared || 0), 0);
  const chequePending = props.statements.reduce((a, s) => a + (s.cheque_pending || 0), 0);
  const chequeBounced = props.statements.reduce((a, s) => a + (s.cheque_bounced || 0), 0);
  const ordersCount = props.statements.reduce((a, s) => a + s.orders.length, 0);

  const styles = `
    <style>
      @page { size: A4; margin: 8mm; }
      * { box-sizing: border-box; font-family: 'Vazirmatn','Tahoma',sans-serif; }
      html, body { direction: rtl; padding: 0; margin: 0; font-size: 12.5px; line-height: 1.6; color: #1a1a1a; background: white; }
      .invoice-container { width: 194mm; max-width: 194mm; margin: 0 auto; padding: 10px 12px; border: 1.5px solid #1e3a5f; border-radius: 4px; }
      .header-section { margin-bottom: 10px; border-bottom: 1.5px solid #1e3a5f; padding-bottom: 8px; }
      .header-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .header-center { flex: 1; text-align: center; }
      .header-logo { flex: 0 0 auto; width: 90px; display: flex; align-items: center; justify-content: center; }
      .header-logo img { max-width: 90px; max-height: 90px; object-fit: contain; }
      .company-title { font-size: 17px; font-weight: bold; color: #1e3a5f; margin: 4px 0 3px; }
      .company-website { font-size: 14px; color: #2563eb; font-weight: bold; margin-bottom: 3px; }
      .company-contacts { font-size: 12px; color: #374151; }
      .company-address { font-size: 12px; color: #4b5563; margin-top: 3px; }
      .doc-title { display: inline-block; background: #1e3a5f; color: white; padding: 5px 22px; border-radius: 14px; font-size: 15px; font-weight: bold; margin: 8px 0 4px; }
      table { width: 100%; border-collapse: collapse; }
      .info-table { margin-bottom: 8px; font-size: 12.5px; border: 1px solid #1e3a5f; }
      .info-table td { border: 1px solid #1e3a5f; padding: 6px 8px; word-break: break-word; }
      .info-table .label-cell { background: #1e3a5f; color: white; font-weight: bold; width: 130px; text-align: right; }
      .info-table .value-cell { background: #f8fafc; text-align: right; }
      .info-table td.nowrap { white-space: nowrap; }
      .stmt-title { background: #e2e8f0; border: 1px solid #1e3a5f; border-bottom: none; padding: 5px 8px; font-weight: bold; color: #1e3a5f; margin-top: 10px; font-size: 13px; }
      .orders-table { margin: 0 0 6px; font-size: 12.5px; border: 1px solid #1e3a5f; }
      .orders-table thead tr { background: #1e3a5f; }
      .orders-table th { color: white; padding: 5px 4px; border: 1px solid #0f2744; text-align: center; font-weight: bold; font-size: 12px; }
      .orders-table td { border: 1px solid #1e3a5f; padding: 5px 4px; text-align: center; background: white; word-break: break-word; }
      .orders-table td.nowrap, .orders-table th.nowrap { white-space: nowrap; }
      .orders-table tbody tr:nth-child(even) td { background: #f1f5f9; }
      .sub-row td { background: #f8fafc !important; font-weight: bold; }
      .discount-row td { background: #dcfce7 !important; color: #15803d; font-weight: bold; }
      .total-row td { background: #fef3c7 !important; font-weight: bold; font-size: 13.5px; }
      .signatures-section { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 18px; padding: 8px 0; }
      .signature-box { text-align: center; }
      .signature-label { font-size: 13px; font-weight: bold; margin-bottom: 28px; color: #1e3a5f; }
      .signature-line { border-top: 1px solid #1e3a5f; width: 130px; margin: 0 auto; }
      .print-date { text-align: center; font-size: 11px; color: #64748b; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #d1d5db; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
      }
    </style>
  `;

  const statementBlocks = props.statements.map(s => {
    const sTotal = s.orders.reduce((a, o) => a + o.total, 0);
    const sPaid = s.total_paid ?? s.orders.reduce((a, o) => a + o.paid, 0);
    const sRemaining = Math.max(sTotal - sPaid - (s.discount_amount || 0), 0);
    return `
      <div class="stmt-title">
        📄 صورتحساب شماره ${fmt(s.statement_number)} — ${s.status === 'open' ? '🟢 باز' : '🔒 بسته شده'}
        ${s.serviceTypes.length ? ` — ${s.serviceTypes.map(t => escapeHtml(t)).join(' / ')}` : ''}
        ${s.addresses.length ? `<div style="font-weight:normal; font-size:11.5px; color:#475569; margin-top:3px;">${s.addresses.map(a => '📍 ' + escapeHtml(a)).join('<br/>')}</div>` : ''}
      </div>
      <table class="orders-table">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>کد فاکتور</th>
            <th class="nowrap">تاریخ</th>
            <th>شرح</th>
            <th>وضعیت</th>
            <th class="nowrap">مبلغ کل</th>
            <th class="nowrap">پرداختی</th>
            <th class="nowrap">مانده</th>
          </tr>
        </thead>
        <tbody>
          ${s.orders.map((o, i) => `
            <tr>
              <td>${fmt(i + 1)}</td>
              <td class="nowrap" style="font-family: monospace;">${escapeHtml(o.code)}</td>
              <td class="nowrap">${formatPersianDate(o.created_at)}</td>
              <td style="text-align:right;">${escapeHtml(o.description || o.subcategory_name || '-')}</td>
              <td>${escapeHtml(statusLabels[o.status] || o.status)}</td>
              <td class="nowrap">${fmt(o.total)}</td>
              <td class="nowrap">${fmt(o.paid)}</td>
              <td class="nowrap">${fmt(o.remaining)}</td>
            </tr>
          `).join('')}
          <tr class="sub-row">
            <td colspan="5" style="text-align:left; padding-left:15px;">جمع صورتحساب شماره ${fmt(s.statement_number)}:</td>
            <td class="nowrap">${fmt(sTotal)}</td>
            <td class="nowrap">${fmt(sPaid)}</td>
            <td class="nowrap">${fmt(Math.max(sTotal - sPaid, 0))}</td>
          </tr>
          ${s.discount_amount > 0 ? `
          <tr class="discount-row">
            <td colspan="7" style="text-align:left; padding-left:15px;">تخفیف این صورتحساب${s.discount_note ? ` (${escapeHtml(s.discount_note)})` : ''}:</td>
            <td class="nowrap">− ${fmt(s.discount_amount)}</td>
          </tr>
          <tr class="sub-row">
            <td colspan="7" style="text-align:left; padding-left:15px;">مانده صورتحساب شماره ${fmt(s.statement_number)} پس از تخفیف:</td>
            <td class="nowrap">${fmt(sRemaining)}</td>
          </tr>` : ''}
          ${sPaid + s.discount_amount > sTotal ? `<tr class="discount-row"><td colspan="7">بستانکاری مشتری:</td><td class="nowrap">${fmt(sPaid + s.discount_amount - sTotal)}</td></tr>` : ''}
        </tbody>
      </table>
    `;
  }).join('');

  const html = `
    <div class="invoice-container">
      <div class="header-section">
        <div class="header-row">
          <div class="header-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
          <div class="header-center">
            <div class="company-title">صورتحساب کل مشتری - خدمات داربست فلزی اهرُم</div>
            <div class="company-website">www.ahrom.ir</div>
            <div class="company-contacts">دفتر: <span dir="ltr">025 3886 5040</span> &nbsp;|&nbsp; همراه: <span dir="ltr">0912 551 1494</span> &nbsp;|&nbsp; تلفن گویا: <span dir="ltr">900000319</span></div>
            <div class="company-address">آدرس دفتر: استان قم، شهر قم، خیابان سواران، خیابان معصومیه شمالی، بین کوچه دو چهار دفتر اهرم</div>
            <div class="doc-title">صورتحساب کل (${fmt(props.statements.length)} صورتحساب)</div>
          </div>
          <div class="header-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
        </div>
      </div>

      <table class="info-table">
        <tr>
          <td class="label-cell" colspan="4" style="text-align:center; font-size:14px;">🧑‍💼 اطلاعات مشتری</td>
        </tr>
        <tr>
          <td class="label-cell">نام مشتری:</td>
          <td class="value-cell">${escapeHtml(props.customerName) || '-'}</td>
          <td class="label-cell">شماره تماس:</td>
          <td class="value-cell">${escapeHtml(props.customerPhone) || '-'}</td>
        </tr>
        <tr>
          <td class="label-cell">کد مشتری:</td>
          <td class="value-cell" style="font-family: monospace; font-weight: bold; color:#1e3a5f;">${escapeHtml(props.customerCode) || '-'}</td>
          <td class="label-cell">تاریخ صدور:</td>
          <td class="value-cell nowrap">${formatPersianDate(new Date().toISOString())}</td>
        </tr>
      </table>

      ${statementBlocks}

      <table class="orders-table">
        <tbody>
          <tr class="${totalDiscount > 0 ? 'sub-row' : 'total-row'}">
            <td colspan="5" style="text-align:left; padding-left:15px;">جمع کل همه صورتحساب‌ها (${fmt(ordersCount)} فاکتور):</td>
            <td class="nowrap">${fmt(totalAmount)}</td>
            <td class="nowrap">${fmt(totalPaid)}</td>
            <td class="nowrap">${fmt(Math.max(totalAmount - totalPaid, 0))}</td>
          </tr>
          ${statementDiscounts > 0 ? `
          <tr class="discount-row">
            <td colspan="7" style="text-align:left; padding-left:15px;">جمع تخفیف صورتحساب‌ها:</td>
            <td class="nowrap">− ${fmt(statementDiscounts)}</td>
          </tr>` : ''}
          ${props.globalDiscount > 0 ? `
          <tr class="discount-row">
            <td colspan="7" style="text-align:left; padding-left:15px;">تخفیف کلی${props.globalDiscountNote ? ` (${escapeHtml(props.globalDiscountNote)})` : ''}:</td>
            <td class="nowrap">− ${fmt(props.globalDiscount)}</td>
          </tr>` : ''}
          ${totalDiscount > 0 ? `
          <tr class="total-row">
            <td colspan="7" style="text-align:left; padding-left:15px;">مانده قابل پرداخت پس از تخفیف:</td>
            <td class="nowrap">${fmt(totalRemaining)}</td>
          </tr>` : ''}
        </tbody>
      </table>

      <table class="info-table">
        <tr>
          <td class="label-cell" colspan="6" style="text-align:center; font-size:14px;">💰 خلاصه مالی کل</td>
        </tr>
        <tr>
          <td class="label-cell">تعداد صورتحساب‌ها:</td>
          <td class="value-cell nowrap">${fmt(props.statements.length)}</td>
          <td class="label-cell">جمع کل:</td>
          <td class="value-cell nowrap" style="font-weight:bold;">${fmt(totalAmount)} تومان</td>
          <td class="label-cell">پرداخت شده:</td>
          <td class="value-cell nowrap" style="color:#16a34a; font-weight:bold;">${fmt(totalPaid)} تومان</td>
        </tr>
        ${statementDiscounts > 0 ? `
        <tr>
          <td class="label-cell">جمع تخفیف صورتحساب‌ها:</td>
          <td class="value-cell nowrap" colspan="5" style="color:#15803d; font-weight:bold;">− ${fmt(statementDiscounts)} تومان</td>
        </tr>` : ''}
        ${props.globalDiscount > 0 ? `
        <tr>
          <td class="label-cell">تخفیف کلی:</td>
          <td class="value-cell nowrap" colspan="5" style="color:#15803d; font-weight:bold;">− ${fmt(props.globalDiscount)} تومان${props.globalDiscountNote ? ` (${escapeHtml(props.globalDiscountNote)})` : ''}</td>
        </tr>` : ''}
        ${totalDiscount > 0 ? `
        <tr>
          <td class="label-cell">جمع کل تخفیف:</td>
          <td class="value-cell nowrap" colspan="5" style="color:#15803d; font-weight:bold; font-size:14px;">− ${fmt(totalDiscount)} تومان</td>
        </tr>` : ''}
        <tr>
          <td class="label-cell">مانده قابل پرداخت:</td>
          <td class="value-cell nowrap" colspan="5" style="color:#dc2626; font-weight:bold; font-size:14px;">${fmt(totalRemaining)} تومان</td>
        </tr>
      </table>

      ${chequeTotal > 0 ? `
      <table class="info-table">
        <tr>
          <td class="label-cell" colspan="4" style="text-align:center; font-size:14px;">🧾 وضعیت چک‌ها</td>
        </tr>
        <tr>
          <td class="label-cell">جمع چک‌ها:</td>
          <td class="value-cell nowrap">${fmt(chequeTotal)} تومان</td>
          <td class="label-cell">وصول شده:</td>
          <td class="value-cell nowrap" style="color:#16a34a;">${fmt(chequeCleared)} تومان</td>
        </tr>
        <tr>
          <td class="label-cell">در جریان:</td>
          <td class="value-cell nowrap" style="color:#b45309;">${fmt(chequePending)} تومان</td>
          <td class="label-cell">برگشتی:</td>
          <td class="value-cell nowrap" style="color:#dc2626;">${fmt(chequeBounced)} تومان</td>
        </tr>
      </table>` : ''}

      <table class="info-table">
        <tr>
          <td class="label-cell" colspan="4" style="text-align:center; font-size:14px;">💳 اطلاعات حساب برای واریز</td>
        </tr>
        <tr>
          <td class="label-cell">بانک:</td>
          <td class="value-cell">ملت</td>
          <td class="label-cell">به نام:</td>
          <td class="value-cell">رضا محمدی</td>
        </tr>
        <tr>
          <td class="label-cell">شماره کارت:</td>
          <td class="value-cell" dir="ltr" style="font-family: monospace; font-weight: bold; letter-spacing: 1px;">6104 3386 2152 1349</td>
          <td class="label-cell">شماره شبا:</td>
          <td class="value-cell" dir="ltr" style="font-family: monospace; font-weight: bold;">IR280120000000009812328696</td>
        </tr>
      </table>

      <div class="signatures-section">
        <div class="signature-box">
          <div class="signature-label">امضای مشتری:</div>
          <div class="signature-line"></div>
        </div>
        <div class="signature-box">
          <div class="signature-label">امضای پیمانکار:</div>
          <div class="signature-line"></div>
        </div>
      </div>

      <div class="print-date">
        تاریخ صدور صورتحساب کل: ${formatPersianDate(new Date().toISOString())}
      </div>
    </div>
  `;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><title>صورتحساب کل ${props.customerName || ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap" rel="stylesheet">
      ${styles}</head><body>${html}</body></html>`);
    w.document.close();
    (w.document as any).fonts?.ready ? (w.document as any).fonts.ready.then(() => setTimeout(() => w.print(), 300)) : setTimeout(() => w.print(), 1200);
  };

  const handleDownloadPDF = async () => {
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const container = document.createElement('div');
      container.innerHTML = `<style>${styles.replace(/<\/?style>/g, '')}</style>${html}`;
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.background = 'white';
      container.style.direction = 'rtl';
      document.body.appendChild(container);
      await new Promise(r => setTimeout(r, 300));
      const target = container.querySelector('.invoice-container') as HTMLElement;
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageW - margin * 2;
      const imgW = availW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageAvailH = pageH - margin * 2;
      let remainingH = imgH;
      let offset = 0;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      while (remainingH > 0) {
        pdf.addImage(dataUrl, 'JPEG', margin, margin - offset, imgW, imgH);
        remainingH -= pageAvailH;
        offset += pageAvailH;
        if (remainingH > 0) pdf.addPage();
      }
      pdf.save(`صورتحساب-کل-${props.customerName || 'مشتری'}.pdf`);
      document.body.removeChild(container);
      toast({ title: 'موفق', description: 'PDF صورتحساب کل دانلود شد' });
    } catch (e) {
      console.error(e);
      toast({ title: 'خطا', description: 'دریافت PDF با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 border-indigo-400 text-indigo-700 hover:bg-indigo-50">
          <FileStack className="h-4 w-4" />
          مشاهده/پرینت صورتحساب کل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>پیش‌نمایش صورتحساب کل — {props.customerName || ''}</span>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={busy}>
                <Download className="h-4 w-4 ml-1" />
                {busy ? 'در حال دانلود...' : 'دانلود PDF'}
              </Button>
              <Button onClick={handlePrint} size="sm">
                <Printer className="h-4 w-4 ml-1" />
                پرینت
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="bg-white rounded-lg border" dir="rtl"
          dangerouslySetInnerHTML={{ __html: `${styles}${html}` }}
          style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }} />
      </DialogContent>
    </Dialog>
  );
};

export default AllStatementsInvoiceDialog;
