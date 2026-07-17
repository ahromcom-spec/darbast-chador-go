import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, Download, FileText } from 'lucide-react';
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

export interface StatementInvoiceOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  subcategory_name: string | null;
  description?: string | null;
  raw?: any;
}

interface Props {
  statementNumber: number;
  statementStatus: 'open' | 'closed';
  closedAt?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerCode?: string | null;
  serviceType: string | null;
  serviceTypes?: string[];
  address: string | null;
  detailedAddress: string | null;
  addresses?: string[];
  orders: StatementInvoiceOrder[];
}

export const StatementInvoiceDialog = (props: Props) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const totalAmount = props.orders.reduce((a, o) => a + o.total, 0);
  const totalPaid = props.orders.reduce((a, o) => a + o.paid, 0);
  const totalRemaining = Math.max(totalAmount - totalPaid, 0);

  const styles = `
    <style>
      @page { size: A4; margin: 8mm; }
      * { box-sizing: border-box; font-family: 'Vazirmatn','Tahoma',sans-serif; }
      html, body { direction: rtl; padding: 0; margin: 0; font-size: 13px; line-height: 1.6; color: #1a1a1a; background: white; }
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
      .info-table { margin-bottom: 8px; font-size: 13px; border: 1px solid #1e3a5f; }
      .info-table td { border: 1px solid #1e3a5f; padding: 6px 8px; word-break: break-word; line-height: 1.6; }
      .info-table .label-cell { background: #1e3a5f; color: white; font-weight: bold; width: 130px; text-align: right; font-size: 13px; }
      .info-table .value-cell { background: #f8fafc; text-align: right; }
      .orders-table { margin: 8px 0; font-size: 13px; border: 1px solid #1e3a5f; }
      .orders-table thead tr { background: #1e3a5f; }
      .orders-table th { color: white; padding: 6px 5px; border: 1px solid #0f2744; text-align: center; font-weight: bold; font-size: 12.5px; }
      .orders-table td { border: 1px solid #1e3a5f; padding: 6px 5px; text-align: center; background: white; font-size: 13px; word-break: break-word; }
      .orders-table td.nowrap, .orders-table th.nowrap { white-space: nowrap; }
      .info-table td.nowrap { white-space: nowrap; }
      .orders-table tbody tr:nth-child(even) td { background: #f1f5f9; }
      .total-row td { background: #fef3c7 !important; font-weight: bold; font-size: 14px; }
      .summary-section { margin-top: 8px; }
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

  const html = `
    <div class="invoice-container">
      <div class="header-section">
        <div class="header-row">
          <div class="header-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
          <div class="header-center">
            <div class="company-title">صورتحساب مشتری - خدمات داربست فلزی اهرُم</div>
            <div class="company-website">www.ahrom.ir</div>
            <div class="company-contacts">دفتر: <span dir="ltr">025 3886 5040</span> &nbsp;|&nbsp; همراه: <span dir="ltr">0912 551 1494</span> &nbsp;|&nbsp; تلفن گویا: <span dir="ltr">900000319</span></div>
            <div class="company-address">آدرس دفتر: استان قم، شهر قم، خیابان سواران، خیابان معصومیه شمالی، بین کوچه دو چهار دفتر اهرم</div>
            <div class="doc-title">صورتحساب شماره ${fmt(props.statementNumber)}</div>
          </div>
          <div class="header-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
        </div>
      </div>

      <table class="info-table">
        <tr>
          <td class="label-cell" colspan="4" style="text-align:center; font-size:14px;">🧑‍💼 اطلاعات مشتری و خدمات</td>
        </tr>
        <tr>
          <td class="label-cell">نام مشتری:</td>
          <td class="value-cell">${escapeHtml(props.customerName) || '-'}</td>
          <td class="label-cell">شماره تماس:</td>
          <td class="value-cell">${escapeHtml(props.customerPhone) || '-'}</td>
        </tr>
        <tr>
          <td class="label-cell">کد مشتری:</td>
          <td class="value-cell" colspan="3" style="font-family: monospace; font-weight: bold; color: #1e3a5f;">${escapeHtml(props.customerCode) || '-'}</td>
        </tr>
        <tr>
          <td class="label-cell">نوع خدمات:</td>
          <td class="value-cell" colspan="3">${
            (props.serviceTypes && props.serviceTypes.length > 0
              ? props.serviceTypes.map(s => escapeHtml(s)).join('<br/>• ').replace(/^/, '• ')
              : (escapeHtml(props.serviceType) || '-'))
          }</td>
        </tr>
        <tr>
          <td class="label-cell">آدرس:</td>
          <td class="value-cell" colspan="3">${
            (props.addresses && props.addresses.length > 0
              ? props.addresses.map(a => '📍 ' + escapeHtml(a)).join('<br/>')
              : ((escapeHtml(props.address) || '-') + (props.detailedAddress ? ' - ' + escapeHtml(props.detailedAddress) : '')))
          }</td>
        </tr>
      </table>

      <table class="info-table">
        <tr>
          <td class="label-cell">شماره صورتحساب:</td>
          <td class="value-cell nowrap">${fmt(props.statementNumber)}</td>
          <td class="label-cell">وضعیت:</td>
          <td class="value-cell nowrap">${props.statementStatus === 'open' ? '🟢 باز' : '🔒 بسته شده'}</td>
          <td class="label-cell">تاریخ صدور:</td>
          <td class="value-cell nowrap">${formatPersianDate(new Date().toISOString())}</td>
        </tr>
        ${props.closedAt ? `
        <tr>
          <td class="label-cell">تاریخ بستن:</td>
          <td class="value-cell nowrap" colspan="5">${formatPersianDate(props.closedAt)}</td>
        </tr>` : ''}
      </table>

      <table class="orders-table">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>کد فاکتور</th>
            <th class="nowrap">تاریخ</th>
            <th>شرح</th>
            <th>وضعیت</th>
            <th class="nowrap">مبلغ کل (تومان)</th>
            <th class="nowrap">پرداختی (تومان)</th>
            <th class="nowrap">مانده (تومان)</th>
          </tr>
        </thead>
        <tbody>
          ${props.orders.map((o, i) => `
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
          <tr class="total-row">
            <td colspan="5" style="text-align:left; padding-left:15px;">جمع کل صورتحساب:</td>
            <td class="nowrap">${fmt(totalAmount)}</td>
            <td class="nowrap">${fmt(totalPaid)}</td>
            <td class="nowrap">${fmt(totalRemaining)}</td>
          </tr>
        </tbody>
      </table>

      <table class="info-table summary-section">
        <tr>
          <td class="label-cell" colspan="6" style="text-align:center; font-size:14px;">💰 خلاصه مالی</td>
        </tr>
        <tr>
          <td class="label-cell">تعداد فاکتورها:</td>
          <td class="value-cell nowrap">${fmt(props.orders.length)}</td>
          <td class="label-cell">جمع کل:</td>
          <td class="value-cell nowrap" style="font-weight:bold;">${fmt(totalAmount)} تومان</td>
          <td class="label-cell">پرداخت شده:</td>
          <td class="value-cell nowrap" style="color:#16a34a; font-weight:bold;">${fmt(totalPaid)} تومان</td>
        </tr>
        <tr>
          <td class="label-cell">مانده قابل پرداخت:</td>
          <td class="value-cell nowrap" colspan="5" style="color:#dc2626; font-weight:bold; font-size:14px;">${fmt(totalRemaining)} تومان</td>
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
        تاریخ صدور صورتحساب: ${formatPersianDate(new Date().toISOString())}
      </div>
    </div>
  `;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><title>صورتحساب شماره ${props.statementNumber}</title>
      <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
      ${styles}</head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 800);
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
      await new Promise(r => setTimeout(r, 250));
      const target = container.querySelector('.invoice-container') as HTMLElement;
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const imgRatio = canvas.width / canvas.height;
      let drawW = availW;
      let drawH = drawW / imgRatio;
      if (drawH > availH) { drawH = availH; drawW = drawH * imgRatio; }
      const offsetX = (pageW - drawW) / 2;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', offsetX, margin, drawW, drawH);
      pdf.save(`صورتحساب-${props.statementNumber}.pdf`);
      document.body.removeChild(container);
      toast({ title: 'موفق', description: 'PDF صورتحساب دانلود شد' });
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
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 ml-1" />
          مشاهده/پرینت صورتحساب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>پیش‌نمایش صورتحساب شماره {fmt(props.statementNumber)}</span>
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

export default StatementInvoiceDialog;
