import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, X, Download, Share2 } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { parseOrderNotes } from './OrderDetailsView';
import { useToast } from '@/hooks/use-toast';

const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'داربست حجمی کفراژ',
  ceiling: 'داربست زیربتن سقف',
  column: 'داربست ستونی',
  pipe_length: 'داربست به طول لوله مصرفی'
};

const ceilingSubtypeLabels: Record<string, string> = {
  yonolit: 'تیرچه یونولیت',
  ceramic: 'تیرچه سفال',
  slab: 'دال و وافل'
};

const statusLabels: Record<string, string> = {
  pending: 'در انتظار تایید',
  approved: 'تایید شده',
  in_progress: 'در حال اجرا',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
  draft: 'پیش‌نویس'
};

interface ManagerOrderInvoiceProps {
  order: {
    id: string;
    code: string;
    customer_name?: string;
    customer_phone?: string;
    address?: string;
    detailed_address?: string | null;
    created_at?: string;
    notes?: any;
    payment_amount?: number | null;
    status?: string;
    province_id?: string;
    subcategory_id?: string;
  };
}

interface RepairRequest {
  id: string;
  description: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  status: string;
  created_at: string;
}

export const ManagerOrderInvoice = ({ order }: ManagerOrderInvoiceProps) => {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string }>>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{ message: string; is_staff: boolean; created_at: string; user_id: string }>>([]);
  const [provinceName, setProvinceName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      // Fetch media
      const { data: mediaData } = await supabase
        .from('project_media')
        .select('id, file_path, file_type')
        .eq('project_id', order.id)
        .order('created_at', { ascending: true });
      
      if (mediaData) {
        setMedia(mediaData);
        
        // Fetch media URLs
        const urls: Record<string, string> = {};
        for (const item of mediaData) {
          try {
            const { data: signedData } = await supabase.storage
              .from('project-media')
              .createSignedUrl(item.file_path, 3600);
            if (signedData?.signedUrl) {
              urls[item.id] = signedData.signedUrl;
            }
          } catch (err) {
            console.error('Error getting URL:', err);
          }
        }
        setMediaUrls(urls);
      }

      // Fetch messages
      const { data: msgData } = await supabase
        .from('order_messages')
        .select('message, is_staff, created_at, user_id')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true })
        .limit(20);
      
      if (msgData) setMessages(msgData);

      // Fetch province name
      if (order.province_id) {
        const { data: province } = await supabase
          .from('provinces')
          .select('name')
          .eq('id', order.province_id)
          .single();
        if (province) setProvinceName(province.name);
      }

      // Fetch subcategory name
      if (order.subcategory_id) {
        const { data: subcategory } = await supabase
          .from('subcategories')
          .select('name')
          .eq('id', order.subcategory_id)
          .single();
        if (subcategory) setSubcategoryName(subcategory.name);
      }

      // Fetch repair requests
      const { data: repairData } = await supabase
        .from('repair_requests')
        .select('id, description, estimated_cost, final_cost, status, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      
      if (repairData) setRepairRequests(repairData);
    };

    fetchData();
  }, [open, order.id, order.province_id, order.subcategory_id]);

  const getInvoiceStyles = () => `
    <style>
      @page { 
        size: A4; 
        margin: 5mm; 
      }
      * {
        box-sizing: border-box;
        font-family: 'Vazirmatn', 'Tahoma', sans-serif;
      }
      body { 
        direction: rtl; 
        padding: 0;
        margin: 0;
        font-size: 9px;
        line-height: 1.4;
        color: #1a1a1a;
        background: white;
      }
      .invoice-container {
        max-width: 100%;
        padding: 8px;
        border: 2px solid #1e3a5f;
        border-radius: 6px;
        margin: 3px;
        min-height: 277mm;
        max-height: 277mm;
        overflow: hidden;
      }
      
      /* Header Section */
      .header-section {
        text-align: center;
        margin-bottom: 8px;
        border-bottom: 2px solid #1e3a5f;
        padding-bottom: 8px;
      }
      .logo-container {
        display: flex;
        justify-content: center;
        margin-bottom: 5px;
      }
      .logo-container img {
        height: 50px;
      }
      .company-title {
        font-size: 13px;
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 3px;
      }
      .company-website {
        font-size: 11px;
        color: #2563eb;
        font-weight: bold;
        margin-bottom: 3px;
      }
      .company-contacts {
        font-size: 9px;
        color: #374151;
      }
      
      /* Order Code Badge */
      .order-code-badge {
        display: inline-block;
        background: #1e3a5f;
        color: white;
        padding: 4px 15px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: bold;
        margin: 6px 0;
      }
      
      /* Main Info Table - Professional Style */
      .main-info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
        font-size: 8px;
        border: 1.5px solid #1e3a5f;
      }
      .main-info-table td {
        border: 1px solid #1e3a5f;
        padding: 4px 6px;
        vertical-align: middle;
      }
      .main-info-table .label-cell {
        background: #1e3a5f;
        color: white;
        font-weight: bold;
        width: 100px;
        text-align: right;
        border: 1px solid #0f2744;
        font-size: 8px;
      }
      .main-info-table .value-cell {
        background: #f8fafc;
        text-align: right;
        border: 1px solid #1e3a5f;
      }
      
      /* Order Details Table - Main Professional Table */
      .order-details-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 8px;
        border: 1.5px solid #1e3a5f;
      }
      .order-details-table thead tr {
        background: #1e3a5f;
      }
      .order-details-table th {
        color: white;
        padding: 5px 3px;
        border: 1px solid #0f2744;
        text-align: center;
        font-weight: bold;
        font-size: 7px;
        white-space: nowrap;
      }
      .order-details-table td {
        border: 1px solid #1e3a5f;
        padding: 5px 3px;
        text-align: center;
        background: white;
        font-size: 8px;
      }
      .order-details-table tbody tr:nth-child(even) td {
        background: #f1f5f9;
        border: 1px solid #1e3a5f;
      }
      .repair-row td {
        background: #fef3c7 !important;
        border: 1px solid #1e3a5f !important;
      }
      .total-row td {
        background: #fef3c7 !important;
        font-weight: bold;
        font-size: 10px;
        border: 1.5px solid #1e3a5f !important;
      }
      
      /* Bank Info */
      .bank-section {
        margin: 8px 0;
        padding: 8px;
        border: 1.5px solid #1e3a5f;
        border-radius: 4px;
        background: #f1f5f9;
      }
      .bank-title {
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 5px;
        font-size: 9px;
        text-align: center;
      }
      .bank-info-table {
        width: 100%;
        font-size: 8px;
        border-collapse: collapse;
        border: 1px solid #1e3a5f;
      }
      .bank-info-table td {
        padding: 4px 6px;
        border: 1px solid #1e3a5f;
      }
      .bank-info-table .label-cell {
        background: #1e3a5f;
        color: white;
        font-weight: bold;
        width: 100px;
      }
      .bank-info-table .value-cell {
        background: #f8fafc;
      }
      
      /* Signatures */
      .signatures-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 15px;
        padding: 10px 0;
      }
      .signature-box {
        text-align: center;
      }
      .signature-label {
        font-size: 9px;
        font-weight: bold;
        margin-bottom: 25px;
        color: #1e3a5f;
      }
      .signature-line {
        border-top: 1px solid #1e3a5f;
        width: 120px;
        margin: 0 auto;
      }
      
      /* Print Date */
      .print-date {
        text-align: center;
        font-size: 8px;
        color: #64748b;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
      }
      
      /* Images */
      .images-section {
        margin: 8px 0;
        padding: 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
      }
      .images-title {
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 5px;
        font-size: 9px;
      }
      .images-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
      }
      .image-thumb {
        width: 100%;
        height: 50px;
        object-fit: cover;
        border-radius: 3px;
        border: 1px solid #e2e8f0;
      }
      
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        .invoice-container { border: none; margin: 0; }
      }
    </style>
  `;

  const getInvoiceHTML = () => {
    const dimensions = parsedNotes?.dimensions;
    const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
    const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
    const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
    const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || parsedNotes?.locationPurpose;
    const installDate = parsedNotes?.installationDateTime || parsedNotes?.installation_date || parsedNotes?.installDate || parsedNotes?.install_date;
    const dueDate = parsedNotes?.dueDateTime || parsedNotes?.due_date || parsedNotes?.dueDate;
    const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
    
    const orderPrice = order.payment_amount ? Number(order.payment_amount) : (parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || 0);
    const repairTotal = repairRequests.reduce((sum, r) => sum + (r.final_cost || r.estimated_cost || 0), 0);
    const grandTotal = orderPrice + repairTotal;

    const getLength = () => {
      if (dimensions && Array.isArray(dimensions) && dimensions.length > 0) {
        return dimensions[0].length || dimensions[0].l || '-';
      }
      if (dimensions && !Array.isArray(dimensions)) {
        return dimensions.length || '-';
      }
      return '-';
    };

    const getWidth = () => {
      if (dimensions && Array.isArray(dimensions) && dimensions.length > 0) {
        return dimensions[0].width || dimensions[0].w || '-';
      }
      if (dimensions && !Array.isArray(dimensions)) {
        return dimensions.width || '-';
      }
      return '-';
    };

    const getHeight = () => {
      if (dimensions && Array.isArray(dimensions) && dimensions.length > 0) {
        return dimensions[0].height || dimensions[0].h || '-';
      }
      if (dimensions && !Array.isArray(dimensions)) {
        return dimensions.height || '-';
      }
      return '-';
    };

    const scaffoldTypeName = scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || subcategoryName || '-';
    const subtypeName = ceilingSubtype ? ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype : scaffoldTypeName;

    return `
      <div class="invoice-container">
        <!-- Header -->
        <div class="header-section">
          <div class="logo-container">
            <img src="/ahrom-logo.png" alt="اهرم" />
          </div>
          <div class="company-title">فاکتور نصب و کرایه داربست فلزی اهرُم</div>
          <div class="company-website">www.ahrom.ir</div>
          <div class="company-contacts">
            دفتر: ۰۲۵ ۳۸۸۶ ۵۰۴۰ &nbsp;|&nbsp; همراه محمدی: ۰۹۱۲ ۵۵۱ ۱۴۹۴ &nbsp;|&nbsp; تلفن گویا: ۹۰۰۰۰۰۳۱۹
          </div>
        </div>

        <!-- Invoice Info Row -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell">شماره فاکتور:</td>
            <td class="value-cell">${order.code}</td>
            <td class="label-cell">تاریخ صدور:</td>
            <td class="value-cell">${order.created_at ? formatPersianDate(order.created_at) : '-'}</td>
            <td class="label-cell">سری فاکتور:</td>
            <td class="value-cell">اول</td>
          </tr>
        </table>

        <!-- Customer Info Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:12px;">🧑‍💼 اطلاعات مشتری</td>
          </tr>
          <tr>
            <td class="label-cell">نام کارفرما:</td>
            <td class="value-cell">${order.customer_name || '-'}</td>
            <td class="label-cell">شماره تماس:</td>
            <td class="value-cell">${order.customer_phone || '-'}</td>
            <td class="label-cell">وضعیت سفارش:</td>
            <td class="value-cell">${statusLabels[order.status || ''] || order.status || '-'}</td>
          </tr>
        </table>

        <!-- Address Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="4" style="text-align:center; font-size:12px;">📍 اطلاعات آدرس</td>
          </tr>
          <tr>
            <td class="label-cell">استان/شهر:</td>
            <td class="value-cell">${provinceName || '-'}</td>
            <td class="label-cell">آدرس کارفرما:</td>
            <td class="value-cell">${order.address || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">آدرس محل نصب:</td>
            <td class="value-cell" colspan="3">${provinceName ? `${provinceName}، ` : ''}${order.address || '-'}${order.detailed_address ? ` - ${order.detailed_address}` : ''}</td>
          </tr>
          ${description ? `
          <tr>
            <td class="label-cell">توضیحات محل نصب:</td>
            <td class="value-cell" colspan="3">${description}</td>
          </tr>
          ` : ''}
        </table>

        <!-- Scaffolding Details Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:12px;">🏗️ مشخصات داربست</td>
          </tr>
          <tr>
            <td class="label-cell">نوع داربست:</td>
            <td class="value-cell">${scaffoldTypeName}</td>
            <td class="label-cell">زیرنوع:</td>
            <td class="value-cell">${subtypeName}</td>
            <td class="label-cell">متراژ کل:</td>
            <td class="value-cell">${totalArea || '-'} متر مربع</td>
          </tr>
          <tr>
            <td class="label-cell">طول (متر):</td>
            <td class="value-cell">${getLength()}</td>
            <td class="label-cell">عرض (متر):</td>
            <td class="value-cell">${getWidth()}</td>
            <td class="label-cell">ارتفاع (متر):</td>
            <td class="value-cell">${getHeight()}</td>
          </tr>
        </table>

        <!-- Dates Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="4" style="text-align:center; font-size:12px;">📅 تاریخ‌های مهم</td>
          </tr>
          <tr>
            <td class="label-cell">تاریخ نصب:</td>
            <td class="value-cell">${installDate ? formatPersianDate(installDate) : '-'}</td>
            <td class="label-cell">تاریخ پایان:</td>
            <td class="value-cell">${dueDate ? formatPersianDate(dueDate) : '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">مدت قرارداد:</td>
            <td class="value-cell">${conditions?.totalMonths || '۱'} ماه</td>
            <td class="label-cell">پیوست:</td>
            <td class="value-cell">${media.length > 0 ? `دارد (${media.length} فایل)` : 'ندارد'}</td>
          </tr>
        </table>

        ${conditions ? `
        <!-- Conditions Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:12px;">📋 شرایط اجرا</td>
          </tr>
          <tr>
            ${conditions.rentalMonthsPlan ? `<td class="label-cell">پلان اجاره:</td><td class="value-cell">${conditions.rentalMonthsPlan === '1' ? 'به شرط یک ماه' : conditions.rentalMonthsPlan === '2' ? 'به شرط دو ماه' : 'سه ماه و بیشتر'}</td>` : '<td class="label-cell">پلان اجاره:</td><td class="value-cell">-</td>'}
            ${conditions.distanceRange ? `<td class="label-cell">فاصله از قم:</td><td class="value-cell">${conditions.distanceRange} کیلومتر</td>` : '<td class="label-cell">فاصله از قم:</td><td class="value-cell">-</td>'}
            <td class="label-cell">محل نصب:</td>
            <td class="value-cell">${parsedNotes?.onGround !== undefined ? (parsedNotes.onGround ? 'روی زمین' : 'روی سکو/پشت‌بام') : '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">دسترسی خودرو:</td>
            <td class="value-cell">${parsedNotes?.vehicleReachesSite !== undefined ? (parsedNotes.vehicleReachesSite ? 'می‌رسد' : 'نمی‌رسد') : '-'}</td>
            ${parsedNotes?.facadeWidth ? `<td class="label-cell">عرض داربست نما:</td><td class="value-cell">${parsedNotes.facadeWidth} متر</td>` : '<td class="label-cell">-</td><td class="value-cell">-</td>'}
            <td class="label-cell">-</td>
            <td class="value-cell">-</td>
          </tr>
        </table>
        ` : ''}

        <!-- Pricing Table -->
        <table class="order-details-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>شرح خدمات</th>
              <th>متراژ/تعداد</th>
              <th>مدت (ماه)</th>
              <th>قیمت واحد</th>
              <th>مبلغ کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>۱</td>
              <td>${scaffoldTypeName} - ${subtypeName}</td>
              <td>${totalArea || '-'} متر</td>
              <td>${conditions?.totalMonths || '۱'}</td>
              <td>${totalArea && orderPrice > 0 ? Math.round(orderPrice / Number(totalArea)).toLocaleString('fa-IR') : '-'}</td>
              <td>${orderPrice > 0 ? orderPrice.toLocaleString('fa-IR') : '-'}</td>
            </tr>
            ${repairRequests.map((repair, idx) => `
              <tr class="repair-row">
                <td>${(idx + 2).toLocaleString('fa-IR')}</td>
                <td>تعمیر داربست${repair.description ? ` - ${repair.description}` : ''}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${(repair.final_cost || repair.estimated_cost || 0).toLocaleString('fa-IR')}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5" style="text-align:left; padding-left:15px; font-size:12px;">جمع کل:</td>
              <td style="font-size:13px;">${grandTotal.toLocaleString('fa-IR')} تومان</td>
            </tr>
          </tbody>
        </table>

        ${media.length > 0 ? `
          <div class="images-section">
            <div class="images-title">🖼️ تصاویر پیوست (${media.length} تصویر)</div>
            <div class="images-grid">
              ${media.slice(0, 12).map(item => `
                <img src="${mediaUrls[item.id] || ''}" alt="تصویر" class="image-thumb" crossorigin="anonymous" />
              `).join('')}
            </div>
            ${media.length > 12 ? `<p style="font-size:7px;color:#64748b;margin-top:4px;">و ${media.length - 12} تصویر دیگر...</p>` : ''}
          </div>
        ` : ''}

        <!-- Bank Info -->
        <div class="bank-section">
          <div class="bank-title">💳 اطلاعات حساب بانکی</div>
          <table class="bank-info-table">
            <tr>
              <td class="label-cell">شماره شبا ملت:</td>
              <td class="value-cell">IR 280120000000009812328696</td>
              <td class="label-cell">شماره کارت ملت:</td>
              <td class="value-cell">6104-3386-2152-1349</td>
            </tr>
            <tr>
              <td class="label-cell">به نام:</td>
              <td class="value-cell" colspan="3">رضا محمدی</td>
            </tr>
          </table>
        </div>

        <!-- Signatures -->
        <div class="signatures-section">
          <div class="signature-box">
            <div class="signature-label">امضای کارفرما:</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <div class="signature-label">امضای پیمانکار:</div>
            <div class="signature-line"></div>
          </div>
        </div>

        <!-- Print Date -->
        <div class="print-date">
          تاریخ صدور فاکتور: ${formatPersianDate(new Date().toISOString())}
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>فاکتور سفارش ${order.code}</title>
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
        ${getInvoiceStyles()}
      </head>
      <body>
        ${getInvoiceHTML()}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      // Dynamic import for html2pdf
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = `
        <style>
          ${getInvoiceStyles().replace(/<\/?style>/g, '')}
        </style>
        ${getInvoiceHTML()}
      `;
      container.style.direction = 'rtl';
      container.style.fontFamily = 'Tahoma, Arial, sans-serif';
      document.body.appendChild(container);
      
      const options = {
        margin: 10,
        filename: `فاکتور-سفارش-${order.code}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const 
        }
      };

      await html2pdf().set(options).from(container).save();
      
      document.body.removeChild(container);
      
      toast({
        title: 'موفق',
        description: 'فایل PDF با موفقیت دانلود شد',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ایجاد فایل PDF',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setIsDownloading(true);
    try {
      // Dynamic import for html2pdf
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = `
        <style>
          ${getInvoiceStyles().replace(/<\/?style>/g, '')}
        </style>
        ${getInvoiceHTML()}
      `;
      container.style.direction = 'rtl';
      container.style.fontFamily = 'Tahoma, Arial, sans-serif';
      document.body.appendChild(container);
      
      const options = {
        margin: 10,
        filename: `فاکتور-سفارش-${order.code}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const 
        }
      };

      // Generate PDF as Blob
      const pdfBlob = await html2pdf().set(options).from(container).outputPdf('blob');
      
      document.body.removeChild(container);
      
      // Create a File from Blob for sharing
      const pdfFile = new File([pdfBlob], `فاکتور-سفارش-${order.code}.pdf`, { type: 'application/pdf' });
      
      // Check if Web Share API supports file sharing
      if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `فاکتور سفارش ${order.code}`,
          text: `فاکتور سفارش شماره ${order.code}`,
        });
        toast({
          title: 'موفق',
          description: 'فاکتور با موفقیت به اشتراک گذاشته شد',
        });
      } else {
        // Fallback: Download PDF if sharing not supported
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `فاکتور-سفارش-${order.code}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        toast({
          title: 'دانلود شد',
          description: 'فایل PDF دانلود شد (اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود)',
        });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing PDF:', error);
        toast({
          title: 'خطا',
          description: 'خطا در اشتراک‌گذاری فاکتور',
          variant: 'destructive',
        });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 ml-1" />
          پرینت فاکتور
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>پیش‌نمایش فاکتور سفارش {order.code}</span>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleShare} variant="outline" size="sm">
                <Share2 className="h-4 w-4 ml-1" />
                اشتراک‌گذاری
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={isDownloading}>
                <Download className="h-4 w-4 ml-1" />
                {isDownloading ? 'در حال دانلود...' : 'دانلود PDF'}
              </Button>
              <Button onClick={handlePrint} size="sm">
                <Printer className="h-4 w-4 ml-1" />
                پرینت
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Preview Content - با استایل‌های PDF */}
        <div 
          ref={printRef} 
          className="bg-white rounded-lg border" 
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: `${getInvoiceStyles()}${getInvoiceHTML()}` }}
          style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOrderInvoice;
