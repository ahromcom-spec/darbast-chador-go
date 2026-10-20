// Shared printable-invoice builder for orders.
// Extracted from ManagerOrderInvoice so the documents archive can generate
// exactly the same printable invoice (tables + full details) for each order.
import { isBillableRepair } from '@/lib/repairBilling';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import { parseOrderNotes } from '@/components/orders/OrderDetailsView';
import { isScaffoldingNoMaterials } from '@/lib/scaffoldingSubtype';

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

const invoiceTitleByServiceType: Record<string, string> = {
  carpet_cleaning: 'فاکتور خدمات قالی‌شویی و موکت‌شویی اهرُم',
  facade: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  formwork: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  ceiling: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  column: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  pipe_length: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  scaffolding: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  facade_with_materials: 'فاکتور نصب و کرایه داربست فلزی اهرُم',
  tarpaulin: 'فاکتور چادر برزنتی اهرُم',
  'کرایه اجناس داربست': 'فاکتور کرایه اجناس داربست اهرُم',
};

function resolveInvoiceTitle(serviceType?: string, subcategoryName?: string): string {
  if (serviceType && invoiceTitleByServiceType[serviceType]) {
    return invoiceTitleByServiceType[serviceType];
  }
  if (subcategoryName && subcategoryName.trim()) {
    return `فاکتور خدمات ${subcategoryName.trim()} اهرُم`;
  }
  return 'فاکتور خدمات اهرُم';
}

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

export interface InvoiceOrderLike {
  id: string;
  code: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  detailed_address?: string | null;
  created_at?: string;
  notes?: any;
  payment_amount?: number | null;
  total_price?: number | null;
  total_paid?: number | null;
  status?: string;
  customer_completion_date?: string | null;
  province_id?: string;
  subcategory_id?: string;
  rental_start_date?: string | null;
  execution_end_date?: string | null;
  execution_stage_updated_at?: string | null;
}

export interface InvoiceExtras {
  media: Array<{ id: string; file_path: string; file_type?: string | null; mime_type?: string | null }>;
  mediaUrls: Record<string, string>;
  provinceName: string;
  subcategoryName: string;
  subcategoryCode?: string | null;
  repairRequests: Array<{ id: string; description: string | null; estimated_cost: number | null; final_cost: number | null; status: string; created_at: string }>;
  renewals: Array<{ id: string; renewal_number: number | null; status: string | null; renewal_price: number | null; new_start_date: string | null; new_end_date: string | null; manager_notes?: string | null; part_id?: string | null }>;
  parts?: Array<{
    id: string;
    part_number: number;
    title: string | null;
    description: string | null;
    dimensions: any;
    total_area: number | null;
    price: number | null;
    rental_start_date: string | null;
    rental_end_date: string | null;
    status: string;
  }>;
  freshFinancials: { payment_amount: number | null; total_price: number | null; total_paid: number | null } | null;
  collectionRequestDate: string | null;
  collectionConfirmedDate: string | null;
  customerCode: string;
  payments: Array<{ id: string; amount: number; payment_method: string | null; receipt_number: string | null; notes: string | null; payment_date: string | null; created_at: string }>;
}

export const emptyInvoiceExtras = (): InvoiceExtras => ({
  media: [],
  mediaUrls: {},
  provinceName: '',
  subcategoryName: '',
  repairRequests: [],
  renewals: [],
  parts: [],
  freshFinancials: null,
  collectionRequestDate: null,
  collectionConfirmedDate: null,
  customerCode: '',
  payments: [],
});

export const getInvoiceStyles = () => `
    <style>
      @page { 
        size: A4; 
        margin: 8mm; 
      }
      * {
        box-sizing: border-box;
        font-family: 'Vazirmatn', 'Tahoma', sans-serif;
      }
      html, body { 
        direction: rtl; 
        padding: 0;
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: #1a1a1a;
        background: white;
      }
      .invoice-container {
        width: 194mm;
        max-width: 100%;
        margin: 0 auto;
        padding: 10px 12px;
        border: 1.5px solid #1e3a5f;
        border-radius: 4px;
        overflow: visible;
      }
      @media screen and (max-width: 820px) {
        .invoice-container { width: 100%; }
      }
      
      /* Header Section */
      .header-section {
        text-align: center;
        margin-bottom: 10px;
        border-bottom: 1.5px solid #1e3a5f;
        padding-bottom: 8px;
      }
      .header-flank {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .header-flank .side-logo {
        flex: 0 0 auto;
      }
      .header-flank .side-logo img {
        height: 56px;
        width: auto;
      }
      .header-flank .header-center {
        flex: 1 1 auto;
        text-align: center;
      }
      .company-title {
        font-size: 17px;
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 3px;
      }
      .company-website {
        font-size: 14px;
        color: #2563eb;
        font-weight: bold;
        margin-bottom: 3px;
      }
      .company-contacts {
        font-size: 12px;
        color: #374151;
      }
      .company-address {
        font-size: 12px;
        color: #4b5563;
        margin-top: 3px;
        line-height: 1.6;
      }
      
      /* Order Code Badge */
      .order-code-badge {
        display: inline-block;
        background: #1e3a5f;
        color: white;
        padding: 4px 18px;
        border-radius: 14px;
        font-size: 14px;
        font-weight: bold;
        margin: 6px 0;
      }
      
      /* Main Info Table */
      .main-info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
        font-size: 13px;
        border: 1px solid #1e3a5f;
      }
      .main-info-table td {
        border: 1px solid #1e3a5f;
        padding: 6px 8px;
        vertical-align: middle;
        word-break: break-word;
        white-space: normal;
        line-height: 1.6;
      }
      .main-info-table .label-cell {
        background: #1e3a5f;
        color: white;
        font-weight: bold;
        width: 110px;
        text-align: right;
        border: 1px solid #0f2744;
        font-size: 13px;
      }
      .main-info-table .value-cell {
        background: #f8fafc;
        text-align: right;
        border: 1px solid #1e3a5f;
      }
      
      /* Order Details Table */
      .order-details-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 13px;
        border: 1px solid #1e3a5f;
      }
      .order-details-table thead tr {
        background: #1e3a5f;
      }
      .order-details-table th {
        color: white;
        padding: 6px 5px;
        border: 1px solid #0f2744;
        text-align: center;
        font-weight: bold;
        font-size: 12.5px;
        white-space: normal;
        word-break: break-word;
        line-height: 1.4;
      }
      .order-details-table td {
        border: 1px solid #1e3a5f;
        padding: 6px 5px;
        text-align: center;
        background: white;
        font-size: 13px;
        white-space: nowrap;
        line-height: 1.5;
      }
      .order-details-table td:nth-child(2),
      .order-details-table td.desc-cell {
        white-space: normal;
        word-break: break-word;
        text-align: right;
      }
      .order-details-table tbody tr:nth-child(even) td {
        background: #f1f5f9;
        border: 1px solid #1e3a5f;
      }
      .renewal-row td {
        background: #e0f2fe !important;
        border: 1px solid #1e3a5f !important;
      }
      .repair-row td {
        background: #fef3c7 !important;
        border: 1px solid #1e3a5f !important;
      }
      .total-row td {
        background: #fef3c7 !important;
        font-weight: bold;
        font-size: 14.5px;
        border: 1.2px solid #1e3a5f !important;
      }

      /* Payments history table */
      .payments-table { table-layout: fixed; width: 100%; }
      .payments-table th, .payments-table td {
        white-space: normal !important;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .payments-table th.col-row, .payments-table td.col-row { width: 34px; }
      .payments-table th.col-date, .payments-table td.col-date { width: 108px; }
      .payments-table th.col-amount, .payments-table td.col-amount { width: 92px; }
      .payments-table th.col-receipt, .payments-table td.col-receipt { width: 96px; }
      .payments-table td.col-date, .payments-table td.col-receipt { font-size: 11.5px; line-height: 1.45; }
      

      
      /* Bank Info */
      .bank-section {
        margin: 10px 0;
        padding: 9px;
        border: 1px solid #1e3a5f;
        border-radius: 3px;
        background: #f1f5f9;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .bank-title {
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 6px;
        font-size: 13.5px;
        text-align: center;
      }
      .bank-info-table {
        width: 100%;
        font-size: 13px;
        border-collapse: collapse;
        border: 1px solid #1e3a5f;
      }
      .bank-info-table td {
        padding: 5px 8px;
        border: 1px solid #1e3a5f;
        word-break: break-word;
        white-space: normal;
      }
      .bank-info-table .label-cell {
        background: #1e3a5f;
        color: white;
        font-weight: bold;
        width: 110px;
      }
      .bank-info-table .value-cell {
        background: #f8fafc;
      }
      
      /* Signatures */
      .signatures-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 22px;
        margin-top: 14px;
        padding: 8px 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .signature-box {
        text-align: center;
      }
      .signature-label {
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 24px;
        color: #1e3a5f;
      }
      .signature-line {
        border-top: 1px solid #1e3a5f;
        width: 130px;
        margin: 0 auto;
      }
      
      /* Print Date */
      .print-date {
        text-align: center;
        font-size: 11px;
        color: #64748b;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
      }
      
      /* Images */
      .images-section {
        margin: 8px 0;
        padding: 7px;
        border: 1px solid #d1d5db;
        border-radius: 3px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .images-title {
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 5px;
        font-size: 12.5px;
      }
      .images-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
      }
      .image-thumb {
        width: 100%;
        height: 48px;
        object-fit: cover;
        border-radius: 3px;
        border: 1px solid #e2e8f0;
      }
      
      .payment-status-section {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      @media print {
        html, body { 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
          font-size: 13px;
        }
        .no-print { display: none !important; }
        .invoice-container { 
          border: 1.5px solid #1e3a5f; 
          margin: 0 auto;
          width: 194mm;
          max-width: 194mm;
          padding: 8px 10px !important;
          page-break-inside: avoid;
          break-inside: avoid;
        }
      }
    </style>
  `;

export function buildOrderInvoiceHtml(
  order: InvoiceOrderLike,
  extras: InvoiceExtras,
  hidePrice = false,
): string {
  const {
    media,
    mediaUrls,
    provinceName,
    subcategoryName,
    subcategoryCode,
    repairRequests,
    renewals,
    freshFinancials,
    collectionRequestDate,
    collectionConfirmedDate,
    customerCode,
    payments,
  } = extras;
  const orderParts = (extras.parts || []).filter((p) => p.status !== 'cancelled');
  const partOrdinals = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
  const partTitle = (partNumber: number, title?: string | null) => {
    const base = `قسمت ${partOrdinals[partNumber - 1] || partNumber} سفارش`;
    const extra = (title || '').trim();
    return extra ? `${base} - ${extra}` : base;
  };
  const partById = new Map(orderParts.map((p) => [p.id, p]));
  const parsedNotes = order.notes && typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);
    // ارقام فارسی/عربی ابعاد به عدد انگلیسی تبدیل می‌شوند تا متراژ همیشه در فاکتور بیاید
    const normDigit = (v: any) => {
      if (typeof v !== 'string') return v;
      const s = v.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
        .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
        .replace(/[٫,]/g, '.').trim();
      return s;
    };
    const normDim = (d: any) => d && typeof d === 'object'
      ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, normDigit(v)]))
      : d;
    const rawDimensions = parsedNotes?.dimensions;
    const dimensions = Array.isArray(rawDimensions) ? rawDimensions.map(normDim) : normDim(rawDimensions);
    const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
    const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
    const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || parsedNotes?.locationPurpose;
    const installDate = parsedNotes?.installationDateTime || parsedNotes?.installation_date || parsedNotes?.installDate || parsedNotes?.install_date;
    const isNoMaterialsScaffold = isScaffoldingNoMaterials({ subcategory_code: subcategoryCode, subcategoryName, notes: order.notes }, parsedNotes);
    const invoiceStartDate = isNoMaterialsScaffold ? installDate : order.rental_start_date;
    const invoiceEndDate = isNoMaterialsScaffold
      ? (order.execution_end_date || order.execution_stage_updated_at)
      : (order.rental_start_date ? new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null);
    const dueDate = parsedNotes?.dueDateTime || parsedNotes?.due_date || parsedNotes?.dueDate;
    const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
    
    const basePrice =
      freshFinancials?.payment_amount !== null && freshFinancials?.payment_amount !== undefined
        ? Number(freshFinancials.payment_amount)
        : order.payment_amount !== null && order.payment_amount !== undefined
          ? Number(order.payment_amount)
          : (parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || 0);

    const renewalTotal = renewals.reduce((sum, r) => sum + Number(r.renewal_price || 0), 0);
    const renewalCount = renewals.length;
    const renewalUnitPrice = renewalCount > 0 ? Math.round(renewalTotal / renewalCount) : 0;

    const repairTotal = repairRequests.reduce((sum, r) => sum + (r.final_cost || r.estimated_cost || 0), 0);
    const computedTotal = basePrice + renewalTotal + repairTotal;

    const totalFromDb = Number(freshFinancials?.total_price ?? order.total_price ?? 0);
    const grandTotal = Math.max(totalFromDb, computedTotal);

    const paidTotal = Number(freshFinancials?.total_paid ?? order.total_paid ?? parsedNotes?.total_paid ?? 0);

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

    // Calculate total area/volume from dimensions - always recalculate from dimensions
    const calculateTotalMeasurement = () => {
      // Calculate from dimensions first
      const lengthVal = getLength();
      const widthVal = getWidth();
      const heightVal = getHeight();
      
      const l = parseFloat(String(lengthVal).replace(/[^\d.]/g, ''));
      const w = parseFloat(String(widthVal).replace(/[^\d.]/g, ''));
      const h = parseFloat(String(heightVal).replace(/[^\d.]/g, ''));
      
      if (!isNaN(l) && !isNaN(h)) {
        // If width exists, calculate volume (L × W × H)
        if (!isNaN(w) && w > 0) {
          const volume = l * w * h;
          return volume > 0 ? parseFloat(volume.toFixed(2)).toLocaleString('fa-IR') : '-';
        }
        // Otherwise calculate area (L × H)
        const area = l * h;
        return area > 0 ? parseFloat(area.toFixed(2)).toLocaleString('fa-IR') : '-';
      }
      
      // Fallback to stored value only if dimensions not available
      const storedArea = parsedNotes?.totalArea || parsedNotes?.total_area;
      if (storedArea && storedArea !== '-') {
        return typeof storedArea === 'number' ? parseFloat(storedArea.toFixed(2)).toLocaleString('fa-IR') : storedArea;
      }
      
      return '-';
    };

    // همه ابعاد سفارش (نه فقط ابعاد اول) — هر ابعاد با متراژ خودش
    const allDimRows: any[] = Array.isArray(dimensions) ? dimensions : (dimensions ? [dimensions] : []);
    const allDimsHasW = allDimRows.some((d: any) => Number(d?.width ?? d?.w) > 0);
    const allDimsValid = allDimRows
      .map((d: any) => ({ l: Number(d?.length ?? d?.l) || 0, w: Number(d?.width ?? d?.w) || 0, h: Number(d?.height ?? d?.h) || 0 }))
      .filter((d) => d.l > 0 && d.h > 0);
    const allDimsTotal = allDimsValid.reduce((s, d) => s + (allDimsHasW ? d.l * (d.w > 0 ? d.w : 1) * d.h : d.l * d.h), 0);
    const allDimsUnit = allDimsHasW ? 'متر مکعب' : 'متر مربع';
    const allDimsLines = (withIndex: boolean) => allDimsValid.map((d, i) => {
      const v = allDimsHasW ? d.l * (d.w > 0 ? d.w : 1) * d.h : d.l * d.h;
      const expr = allDimsHasW
        ? `${d.l.toLocaleString('fa-IR')} × ${(d.w > 0 ? d.w : 1).toLocaleString('fa-IR')} × ${d.h.toLocaleString('fa-IR')}`
        : `${d.l.toLocaleString('fa-IR')} × ${d.h.toLocaleString('fa-IR')}`;
      const prefix = withIndex && allDimsValid.length > 1 ? `ابعاد ${(i + 1).toLocaleString('fa-IR')}: ` : '';
      return `<div style="font-size:11.5px;color:#475569;">${prefix}${expr} = ${parseFloat(v.toFixed(2)).toLocaleString('fa-IR')}</div>`;
    }).join('');

    const totalArea = allDimsTotal > 0
      ? parseFloat(allDimsTotal.toFixed(2)).toLocaleString('fa-IR')
      : calculateTotalMeasurement();
    const invoiceImages = media.filter((item) => Boolean(mediaUrls[item.id]));
    
    // Determine if measurement is volume (cubic) or area (square)
    const getMeasurementUnit = () => {
      const widthVal = getWidth();
      const w = parseFloat(String(widthVal).replace(/[^\d.]/g, ''));
      return (!isNaN(w) && w > 0) ? 'متر مکعب' : 'متر مربع';
    };

    // ===== خدمات سفارشی: اطلاعات دستی ثبت‌شده در فرم =====
    const isCustomService = Boolean(parsedNotes?.is_custom_service);
    const customServiceType = (parsedNotes?.custom_service_type || '').toString().trim();
    const customSubcategory = (parsedNotes?.custom_subcategory || '').toString().trim();
    const customActivity = (parsedNotes?.activity_description || '').toString().trim();
    const customSite = (parsedNotes?.site_description || '').toString().trim();
    const customMaterials = (parsedNotes?.materials || '').toString().trim();
    const customQuantity = Number(parsedNotes?.quantity) || 0;
    const customWeight = Number(parsedNotes?.weight) || 0;

    const scaffoldTypeName = isCustomService
      ? (customServiceType || subcategoryName || 'خدمات سفارشی')
      : (scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || subcategoryName || '-');
    const subtypeName = isCustomService
      ? (customSubcategory || subcategoryName || scaffoldTypeName)
      : (ceilingSubtype ? ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype : (subcategoryName || scaffoldTypeName));

    // شرح خدمات کامل برای خدمات سفارشی
    const customServiceCell = (() => {
      const parts: string[] = [];
      parts.push(`<strong>${escapeHtml(scaffoldTypeName)}${customSubcategory ? ` - ${escapeHtml(customSubcategory)}` : ''}</strong>`);
      if (customActivity) parts.push(`<div style="font-size:11.5px;color:#334155;margin-top:2px;">شرح خدمات: ${escapeHtml(customActivity)}</div>`);
      if (customSite) parts.push(`<div style="font-size:11.5px;color:#475569;margin-top:2px;">محل خدمات: ${escapeHtml(customSite)}</div>`);
      if (customMaterials) parts.push(`<div style="font-size:11.5px;color:#475569;margin-top:2px;">مصالح/ابزار: ${escapeHtml(customMaterials)}</div>`);
      return parts.join('');
    })();

    // ستون متراژ/تعداد برای خدمات سفارشی (همه ابعاد + تعداد + وزن)
    const customMeasureCell = (() => {
      const rows = Array.isArray(dimensions) ? dimensions : (dimensions ? [dimensions] : []);
      const lines: string[] = [];
      rows.forEach((d: any) => {
        const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
        const nums = [l, w, h].filter((n) => n > 0);
        if (nums.length === 0) return;
        const expr = nums.map((n) => n.toLocaleString('fa-IR')).join(' × ');
        const product = nums.reduce((a, b) => a * b, 1);
        const unit = nums.length >= 3 ? 'متر مکعب' : nums.length === 2 ? 'متر مربع' : 'متر';
        lines.push(`<div style="font-size:11.5px;color:#475569;">${expr}${nums.length > 1 ? ` = ${parseFloat(product.toFixed(2)).toLocaleString('fa-IR')} ${unit}` : ` ${unit}`}</div>`);
      });
      if (customQuantity > 0) lines.push(`<strong style="font-size:12px;">تعداد: ${customQuantity.toLocaleString('fa-IR')}</strong>`);
      if (customWeight > 0) lines.push(`<div style="font-size:11.5px;color:#475569;">وزن: ${customWeight.toLocaleString('fa-IR')} کیلوگرم</div>`);
      return lines.length > 0 ? lines.join('') : '-';
    })();


    return `
      <div class="invoice-container">
        <!-- Header -->
        <div class="header-section">
          <div class="header-flank">
            <div class="side-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
            <div class="header-center">
              <div class="company-title">${escapeHtml(isNoMaterialsScaffold ? 'فاکتور اجرای داربست فلزی بدون اجناس اهرُم' : resolveInvoiceTitle(scaffoldingType, subcategoryName))}</div>
              <div class="company-website">www.ahrom.ir</div>
              <div class="company-contacts">
                دفتر: <span dir="ltr">025 3886 5040</span> &nbsp;|&nbsp; همراه محمدی: <span dir="ltr">0912 551 1494</span> &nbsp;|&nbsp; تلفن گویا: <span dir="ltr">900000319</span>
              </div>
              <div class="company-address">
                آدرس دفتر: استان قم، شهر قم، خیابان سواران، خیابان معصومیه شمالی، بین کوچه دو چهار دفتر اهرم
              </div>
            </div>
            <div class="side-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
          </div>
        </div>


        <!-- Customer Info Section -->
        ${(() => {
          const override = parsedNotes?.invoice_override;
          const employerName = override?.employer_name || order.customer_name || '';
          const employerPhone = override?.employer_phone || order.customer_phone || '';
          const hasOverride = !!override?.employer_name;
          const coordinatorRow = hasOverride
            ? `<tr>
                 <td class="label-cell" style="font-size:11.5px; white-space:nowrap;">هماهنگ‌کننده:</td>
                 <td class="value-cell" style="font-size:12px; white-space:nowrap;">${escapeHtml(override?.coordinator_name || order.customer_name) || '-'}</td>
                 <td class="label-cell" style="font-size:11.5px; white-space:nowrap;">شماره هماهنگ‌کننده:</td>
                 <td class="value-cell" style="font-size:12px; white-space:nowrap;" dir="ltr">${escapeHtml(override?.coordinator_phone || order.customer_phone) || '-'}</td>
                 <td class="label-cell" colspan="4"></td>
               </tr>`
            : '';
          return `
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="8" style="text-align:center; font-size:14px;">🧑‍💼 اطلاعات مشتری</td>
          </tr>
          <tr>
            <td class="label-cell" style="font-size:11.5px; width:90px; white-space:nowrap;">نام کارفرما:</td>
            <td class="value-cell" style="font-size:12px; white-space:nowrap;">${escapeHtml(employerName) || '-'}</td>
            <td class="label-cell" style="font-size:11.5px; width:80px; white-space:nowrap;">شماره تماس:</td>
            <td class="value-cell" style="font-size:12px; white-space:nowrap;" dir="ltr">${escapeHtml(employerPhone) || '-'}</td>
            <td class="label-cell" style="font-size:11.5px; width:80px; white-space:nowrap;">کد مشتری:</td>
            <td class="value-cell" style="font-family: monospace; font-weight: bold; color: #1e3a5f; font-size:12px; white-space:nowrap;" dir="ltr">${escapeHtml(customerCode) || '-'}</td>
            <td class="label-cell" style="font-size:11.5px; width:90px; white-space:nowrap;">وضعیت سفارش:</td>
            <td class="value-cell" style="font-size:12px; white-space:nowrap;">${statusLabels[order.status || ''] || escapeHtml(order.status) || '-'}</td>
          </tr>
          ${coordinatorRow}
        </table>`;
        })()}


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

        <!-- Address Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell">استان/شهر:</td>
            <td class="value-cell">${escapeHtml(provinceName) || '-'}</td>
            <td class="label-cell">آدرس محل نصب:</td>
            <td class="value-cell">${(() => {
              const a = (order.address || '').trim();
              const d = (order.detailed_address || '').trim();
              if (a && d) {
                if (a === d || a.includes(d) || d.includes(a)) return escapeHtml(a.length >= d.length ? a : d);
                return `${escapeHtml(a)} - ${escapeHtml(d)}`;
              }
              return escapeHtml(a || d) || '-';
            })()}</td>
          </tr>
        </table>

        <!-- Scaffolding Details Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell">${isCustomService ? 'نوع خدمات:' : 'نوع داربست:'}</td>
            <td class="value-cell">${escapeHtml(scaffoldTypeName)}</td>

            <td class="label-cell">زیرنوع:</td>
            <td class="value-cell">${subtypeName}</td>
          </tr>
        </table>

        <!-- Dates Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:14px;">📅 تاریخ‌های مهم</td>
          </tr>
          ${isNoMaterialsScaffold ? `<tr>
            <td class="label-cell" style="white-space:nowrap;">تاریخ درخواست نصب یا فک داربست فلزی:</td>
            <td class="value-cell" colspan="2" style="white-space:nowrap;">${installDate ? formatPersianDateTime(installDate) : '-'}</td>
            <td class="label-cell" style="white-space:nowrap;">تاریخ نصب یا فک داربست فلزی:</td>
            <td class="value-cell" colspan="2" style="white-space:nowrap;">${order.execution_end_date || order.execution_stage_updated_at ? formatPersianDateTime(order.execution_end_date || order.execution_stage_updated_at || '') : '-'}</td>
          </tr>` : `<tr>
            <td class="label-cell" style="white-space:nowrap;">تاریخ شروع کرایه:</td>
            <td class="value-cell" style="white-space:nowrap;">${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
            <td class="label-cell" style="white-space:nowrap;">تاریخ درخواست جمع‌آوری:</td>
            <td class="value-cell" style="white-space:nowrap;">${collectionRequestDate ? formatPersianDateTime(collectionRequestDate) : '-'}</td>
            <td class="label-cell" style="white-space:nowrap;">تاریخ جمع‌آوری شده:</td>
            <td class="value-cell" style="white-space:nowrap;">${collectionConfirmedDate ? formatPersianDate(collectionConfirmedDate) : '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">مدت قرارداد:</td>
            <td class="value-cell">${conditions?.totalMonths || '۱'} ماه</td>
            <td class="label-cell">پیوست:</td>
            <td class="value-cell" colspan="3">${invoiceImages.length > 0 ? `دارد (${invoiceImages.length} تصویر)` : 'ندارد'}</td>
          </tr>`}
        </table>

        ${conditions ? `
        <!-- Conditions Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:14px;">📋 شرایط اجرا</td>
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

        ${!hidePrice ? `
        <!-- Pricing Table -->
        <table class="order-details-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>شرح خدمات</th>
              <th>${isNoMaterialsScaffold ? 'تاریخ درخواست نصب یا فک' : 'تاریخ شروع'}</th>
              <th>${isNoMaterialsScaffold ? 'تاریخ نصب یا فک' : 'تاریخ پایان'}</th>
              <th>متراژ/تعداد</th>
              <th>مبلغ کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              // قسمت‌های سفارش: هر قسمت یک ردیف جدا در فاکتور
              if (orderParts.length > 0) {
                return orderParts.map((p, i) => {
                  const dims = Array.isArray(p.dimensions) ? p.dimensions : [];
                  const hasW = dims.some((d: any) => Number(d?.width) > 0);
                  const unit = hasW ? 'متر مکعب' : 'متر مربع';
                  const validDims = dims.filter((d: any) => Number(d?.length) > 0 && Number(d?.height) > 0);
                  const computedArea = validDims.reduce((s: number, d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    return s + (hasW ? l * (w > 0 ? w : 1) * h : l * h);
                  }, 0);
                  const areaNum = computedArea > 0 ? computedArea : Number(p.total_area || 0);
                  const dimLines = validDims.map((d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    const v = hasW ? l * (w > 0 ? w : 1) * h : l * h;
                    const expr = hasW
                      ? `${l.toLocaleString('fa-IR')} × ${(w > 0 ? w : 1).toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`
                      : `${l.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`;
                    return `<div style="font-size:11.5px;color:#475569;">${expr} = ${v.toLocaleString('fa-IR')}</div>`;
                  }).join('');
                  const areaCell = areaNum > 0
                    ? `${dimLines}<strong>${parseFloat(areaNum.toFixed(2)).toLocaleString('fa-IR')} ${unit}</strong>`
                    : (dimLines || '-');
                  const price = Number(p.price || 0);
                  const start = p.rental_start_date || order.rental_start_date || null;
                  const end = p.rental_end_date
                    || (start ? new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null);
                  const descLine = p.description
                    ? `<div style="font-size:11.5px;color:#334155;margin-top:2px;">${escapeHtml(p.description)}</div>`
                    : '';
                  const statusLine = p.status === 'collected'
                    ? `<div style="font-size:11px;color:#16a34a;margin-top:2px;">فک و جمع‌آوری شد</div>`
                    : p.status === 'awaiting_collection'
                      ? `<div style="font-size:11px;color:#ca8a04;margin-top:2px;">در انتظار فک</div>`
                      : '';
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;"><strong>${escapeHtml(partTitle(p.part_number, p.title))}</strong>${descLine}${statusLine}</td>
                      <td>${start ? formatPersianDate(start) : '-'}</td>
                      <td>${end ? formatPersianDate(end) : '-'}</td>
                      <td>${areaCell}</td>
                      <td>${price > 0 ? `<strong>${price.toLocaleString('fa-IR')}</strong>` : '-'}</td>
                    </tr>
                  `;
                }).join('');
              }
              // Expert pricing multi-scaffold support
              const expertScaffolds = (parsedNotes?.is_multi_scaffold && Array.isArray(parsedNotes?.scaffolds)) ? parsedNotes.scaffolds : [];
              const scaffoldPrices = Array.isArray(parsedNotes?.scaffold_prices) ? parsedNotes.scaffold_prices : [];
              if (expertScaffolds.length > 0) {
                return expertScaffolds.map((sc: any, i: number) => {
                  const dims = Array.isArray(sc?.dimensions) ? sc.dimensions : [];
                  const hasW = dims.some((d: any) => Number(d?.width) > 0);
                  const unit = hasW ? 'متر مکعب' : 'متر مربع';
                  const validDims = dims.filter((d: any) => Number(d?.length) > 0 && Number(d?.height) > 0);
                  const area = validDims.reduce((s: number, d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    return s + (hasW ? l * (w > 0 ? w : 1) * h : l * h);
                  }, 0);
                  const dimLines = validDims.map((d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    const v = hasW ? l * (w > 0 ? w : 1) * h : l * h;
                    const expr = hasW ? `${l.toLocaleString('fa-IR')} × ${(w > 0 ? w : 1).toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}` : `${l.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`;
                    return `<div style="font-size:11.5px;color:#475569;">${expr} = ${v.toLocaleString('fa-IR')}</div>`;
                  }).join('');
                  const areaCell = `${dimLines}<strong>${area > 0 ? area.toLocaleString('fa-IR') : '-'} ${unit}</strong>`;
                  const price = Number(scaffoldPrices[i]?.total || 0);
                  const unitPrice = (price > 0 && area >= 100) ? Math.round(price / area) : 0;
                  const priceCell = price > 0
                    ? `<strong>${price.toLocaleString('fa-IR')}</strong>${unitPrice > 0 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">فی: ${unitPrice.toLocaleString('fa-IR')} تومان / ${unit}</div>` : ''}`
                    : '-';
                  const label = escapeHtml(sc.label || `داربست ${i + 1}`);
                  const desc = sc.description ? ` - ${escapeHtml(sc.description)}` : '';
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${label}${desc}</td>
                      <td>${invoiceStartDate ? formatPersianDate(invoiceStartDate) : '-'}</td>
                      <td>${invoiceEndDate ? formatPersianDate(invoiceEndDate) : '-'}</td>
                      <td>${areaCell}</td>
                      <td>${priceCell}</td>
                    </tr>
                  `;
                }).join('');
              }
              const multi = parsedNotes?.multi_scaffolds;
              if (Array.isArray(multi) && multi.length > 0) {
                return multi.map((it: any, i: number) => {
                  const snap = it.snapshot || {};
                  const sType = snap.activeService || snap.scaffoldType;
                  const typeName = scaffoldingTypeLabels[sType] || sType || scaffoldTypeName;
                  const dims = Array.isArray(snap.dimensions) ? snap.dimensions : [];
                  const hasWidth = dims.some((d: any) => Number(d?.width) > 0);
                  const unit = hasWidth ? 'متر مکعب' : 'متر مربع';
                  const validDims = dims.filter((d: any) => Number(d?.length) > 0 && Number(d?.height) > 0);
                  const dimLines = validDims.map((d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    const v = hasWidth ? l * (w > 0 ? w : 1) * h : l * h;
                    const expr = hasWidth ? `${l.toLocaleString('fa-IR')} × ${(w > 0 ? w : 1).toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}` : `${l.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`;
                    return `<div style="font-size:11.5px;color:#475569;">${expr} = ${v.toLocaleString('fa-IR')}</div>`;
                  }).join('');
                  const areaNum = typeof it.totalArea === 'number' ? it.totalArea : Number(it.totalArea) || 0;
                  const areaDisplay = areaNum > 0 ? parseFloat(areaNum.toFixed(2)).toLocaleString('fa-IR') : '-';
                  const areaCell = `${dimLines}<strong>${areaDisplay} ${unit}</strong>`;
                  const price = Number(it.finalPrice || 0);
                  const unitPrice = (price > 0 && areaNum >= 100) ? Math.round(price / areaNum) : 0;
                  const priceCell = price > 0
                    ? `<strong>${price.toLocaleString('fa-IR')}</strong>${unitPrice > 0 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">فی: ${unitPrice.toLocaleString('fa-IR')} تومان / ${unit}</div>` : ''}`
                    : '-';
                  const label = escapeHtml(it.label || `داربست #${i + 1}`);
                  const itemDesc = snap.locationPurpose || description || '';
                  const serviceText = itemDesc
                    ? `${label} - ${escapeHtml(itemDesc)}`
                      : `${label} - ${isNoMaterialsScaffold ? 'اجرای' : 'کرایه ماه اول'} - ${escapeHtml(typeName)}`;
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${serviceText}</td>
                      <td>${invoiceStartDate ? formatPersianDate(invoiceStartDate) : '-'}</td>
                      <td>${invoiceEndDate ? formatPersianDate(invoiceEndDate) : '-'}</td>
                      <td>${areaCell}</td>
                      <td>${priceCell}</td>
                    </tr>
                  `;
                }).join('');
              }
              const areaCell = allDimsTotal > 0
                ? `${allDimsLines(true)}${allDimsValid.length > 1 ? `<div style="font-size:11px;color:#334155;margin-top:2px;">متراژ کل:</div>` : ''}<strong>${totalArea} ${allDimsUnit}</strong>`
                : (totalArea && totalArea !== '-' ? `<strong>${totalArea} ${getMeasurementUnit()}</strong>` : '-');
              const areaNumeric = allDimsTotal > 0 ? allDimsTotal : (Number(totalArea) || 0);
              const unitPrice = (basePrice > 0 && areaNumeric >= 100) ? Math.round(basePrice / areaNumeric) : 0;
              const unitLabel = allDimsTotal > 0 ? allDimsUnit : getMeasurementUnit();
              const priceCell = basePrice > 0
                ? `<strong>${basePrice.toLocaleString('fa-IR')}</strong>${unitPrice > 0 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">فی: ${unitPrice.toLocaleString('fa-IR')} تومان / ${unitLabel}</div>` : ''}`
                : '-';
              return `
            <tr>
              <td>۱</td>
              <td style="text-align:right;">${isCustomService ? customServiceCell : (description ? escapeHtml(description) : `${isNoMaterialsScaffold ? 'اجرای' : 'کرایه ماه اول -'} ${scaffoldTypeName} - ${subtypeName}`)}</td>
              <td>${isNoMaterialsScaffold ? (installDate ? formatPersianDate(installDate) : '-') : (order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-')}</td>
              <td>${isNoMaterialsScaffold ? (order.execution_end_date || order.execution_stage_updated_at ? formatPersianDate(order.execution_end_date || order.execution_stage_updated_at || '') : '-') : (order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-')}</td>
              <td>${isCustomService ? customMeasureCell : areaCell}</td>

              <td>${priceCell}</td>
            </tr>
              `;
            })()}

            ${(() => {
              const baseCount = orderParts.length > 0
                ? orderParts.length
                : Array.isArray(parsedNotes?.multi_scaffolds) && parsedNotes.multi_scaffolds.length > 0
                  ? parsedNotes.multi_scaffolds.length
                  : 1;
              const baseDescText = description
                ? escapeHtml(description)
                : escapeHtml(`${scaffoldTypeName} - ${subtypeName}`);
              const dimLine = allDimsTotal > 0
                ? `<div style="font-size:11px;color:#475569;margin-top:2px;">ابعاد:</div>${allDimsLines(true)}<div style="font-size:11px;color:#475569;">متراژ کل: ${totalArea} ${allDimsUnit}</div>`
                : '';
              const renewalRows = renewals.map((renewal, idx) => {
                const linkedPart = renewal.part_id ? partById.get(renewal.part_id) : undefined;
                const renewalDesc = linkedPart
                  ? escapeHtml(partTitle(linkedPart.part_number, linkedPart.title)) + (linkedPart.description ? ` - ${escapeHtml(linkedPart.description)}` : '')
                  : baseDescText;
                 const renewalNote = renewal.manager_notes?.trim()
                   ? `<div style="font-size:12px;color:#0f172a;margin-top:3px;white-space:pre-line;"><strong>شرح تمدید:</strong> ${escapeHtml(renewal.manager_notes.trim())}</div>`
                   : '';
                const renewalDims = linkedPart ? '' : dimLine;
                return `
                <tr class="renewal-row">
                  <td>${(idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                   <td style="text-align:right;"><strong>تمدید ماه ${(renewal.renewal_number + 1)?.toLocaleString('fa-IR') || (idx + baseCount + 1).toLocaleString('fa-IR')}</strong>${renewalNote}<div style="font-size:11.5px;color:#334155;margin-top:2px;">${renewalDesc}</div>${renewalDims}</td>
                  <td>${renewal.new_start_date ? formatPersianDate(renewal.new_start_date) : '-'}</td>
                  <td>${renewal.new_end_date ? formatPersianDate(renewal.new_end_date) : '-'}</td>
                  <td>-</td>
                  <td>${Number(renewal.renewal_price || 0).toLocaleString('fa-IR')}</td>
                </tr>
              `;
              }).join('');
              const repairRows = repairRequests.map((repair, idx) => `
                <tr class="repair-row">
                  <td>${(idx + baseCount + renewals.length + 1).toLocaleString('fa-IR')}</td>
                  <td style="text-align:right;">تعمیر داربست${repair.description ? ` - ${escapeHtml(repair.description)}` : ''}</td>
                  <td>${repair.created_at ? formatPersianDate(repair.created_at) : '-'}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>${(repair.final_cost || repair.estimated_cost || 0).toLocaleString('fa-IR')}</td>
                </tr>
              `).join('');
              return renewalRows + repairRows;
            })()}

            <tr class="total-row">
              <td colspan="5" style="text-align:left; padding-left:15px; font-size:14px;">جمع کل:</td>
              <td style="font-size:15px;">${grandTotal.toLocaleString('fa-IR')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Payment Status Section -->
        <div style="page-break-inside: avoid; break-inside: avoid;">
        <table class="main-info-table" style="margin-top: 8px;">
          <tr>
            <td class="label-cell">وضعیت پرداخت:</td>
            <td class="value-cell" style="font-weight:bold; ${paidTotal >= grandTotal ? 'color:#16a34a;' : paidTotal > 0 ? 'color:#ca8a04;' : 'color:#dc2626;'}">
              ${paidTotal >= grandTotal ? '✅ پرداخت کامل' : paidTotal > 0 ? '⏳ علی‌الحساب پرداخت شده' : '❌ پرداخت نشده'}
            </td>
            <td class="label-cell">مبلغ پرداخت شده:</td>
            <td class="value-cell" style="color:#16a34a; font-weight:bold;">${paidTotal.toLocaleString('fa-IR')} تومان</td>
            <td class="label-cell">مانده:</td>
            <td class="value-cell" style="color:#dc2626; font-weight:bold;">${Math.max(0, grandTotal - paidTotal).toLocaleString('fa-IR')} تومان</td>
          </tr>
        </table>
        </div>

        ${payments.length > 0 ? `
        <div style="page-break-inside: avoid; break-inside: avoid;">
        <table class="order-details-table payments-table" style="margin-top: 8px;">
          <thead>
            <tr>
              <th colspan="5" style="text-align:center; font-size:14px;">🧾 تاریخچه پرداخت‌ها (${payments.length.toLocaleString('fa-IR')})</th>
            </tr>
            <tr>
              <th class="col-row">ردیف</th>
              <th class="col-date">تاریخ و ساعت پرداخت</th>
              <th class="col-amount">مبلغ (تومان)</th>
              <th class="col-receipt">شماره رسید</th>
              <th>توضیحات</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((p, idx) => `
              <tr>
                <td class="col-row">${(idx + 1).toLocaleString('fa-IR')}</td>
                <td class="col-date">${formatPersianDateTime(p.payment_date || p.created_at)}</td>
                <td class="col-amount" style="color:#16a34a; font-weight:bold;">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
                <td class="col-receipt">${p.receipt_number ? escapeHtml(p.receipt_number) : '-'}</td>
                <td style="text-align:right;">${p.notes ? escapeHtml(p.notes) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        </div>
        ` : ''}
        ` : `
        <!-- Pricing Table without prices -->
        <table class="order-details-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>شرح خدمات</th>
              <th>${isNoMaterialsScaffold ? 'تاریخ درخواست نصب یا فک' : 'تاریخ شروع'}</th>
              <th>${isNoMaterialsScaffold ? 'تاریخ نصب یا فک' : 'تاریخ پایان'}</th>
              <th>متراژ/تعداد</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const expertScaffolds = (parsedNotes?.is_multi_scaffold && Array.isArray(parsedNotes?.scaffolds)) ? parsedNotes.scaffolds : [];
              if (expertScaffolds.length > 0) {
                return expertScaffolds.map((sc: any, i: number) => {
                  const dims = Array.isArray(sc?.dimensions) ? sc.dimensions : [];
                  const hasW = dims.some((d: any) => Number(d?.width) > 0);
                  const unit = hasW ? 'متر مکعب' : 'متر مربع';
                  const validDims = dims.filter((d: any) => Number(d?.length) > 0 && Number(d?.height) > 0);
                  const area = validDims.reduce((s: number, d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    return s + (hasW ? l * (w > 0 ? w : 1) * h : l * h);
                  }, 0);
                  const dimLines = validDims.map((d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    const v = hasW ? l * (w > 0 ? w : 1) * h : l * h;
                    const expr = hasW ? `${l.toLocaleString('fa-IR')} × ${(w > 0 ? w : 1).toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}` : `${l.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`;
                    return `<div style="font-size:11.5px;color:#475569;">${expr} = ${v.toLocaleString('fa-IR')}</div>`;
                  }).join('');
                  const areaCell = `${dimLines}<strong>${area > 0 ? area.toLocaleString('fa-IR') : '-'} ${unit}</strong>`;
                  const label = escapeHtml(sc.label || `داربست ${i + 1}`);
                  const desc = sc.description ? ` - ${escapeHtml(sc.description)}` : '';
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${label}${desc}</td>
                      <td>${invoiceStartDate ? formatPersianDate(invoiceStartDate) : '-'}</td>
                      <td>${invoiceEndDate ? formatPersianDate(invoiceEndDate) : '-'}</td>
                      <td>${areaCell}</td>
                    </tr>
                  `;
                }).join('');
              }
              const multi = parsedNotes?.multi_scaffolds;
              if (Array.isArray(multi) && multi.length > 0) {
                return multi.map((it: any, i: number) => {
                  const snap = it.snapshot || {};
                  const sType = snap.activeService || snap.scaffoldType;
                  const typeName = scaffoldingTypeLabels[sType] || sType || scaffoldTypeName;
                  const dims = Array.isArray(snap.dimensions) ? snap.dimensions : [];
                  const hasWidth = dims.some((d: any) => Number(d?.width) > 0);
                  const unit = hasWidth ? 'متر مکعب' : 'متر مربع';
                  const validDims = dims.filter((d: any) => Number(d?.length) > 0 && Number(d?.height) > 0);
                  const dimLines = validDims.map((d: any) => {
                    const l = Number(d?.length) || 0, w = Number(d?.width) || 0, h = Number(d?.height) || 0;
                    const v = hasWidth ? l * (w > 0 ? w : 1) * h : l * h;
                    const expr = hasWidth ? `${l.toLocaleString('fa-IR')} × ${(w > 0 ? w : 1).toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}` : `${l.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')}`;
                    return `<div style="font-size:11.5px;color:#475569;">${expr} = ${v.toLocaleString('fa-IR')}</div>`;
                  }).join('');
                  const areaNum = typeof it.totalArea === 'number' ? it.totalArea : Number(it.totalArea) || 0;
                  const areaDisplay = areaNum > 0 ? parseFloat(areaNum.toFixed(2)).toLocaleString('fa-IR') : '-';
                  const areaCell = `${dimLines}<strong>${areaDisplay} ${unit}</strong>`;
                  const label = escapeHtml(it.label || `داربست #${i + 1}`);
                  const itemDesc = snap.locationPurpose || description || '';
                  const serviceText = itemDesc
                    ? `${label} - ${escapeHtml(itemDesc)}`
                      : `${label} - ${isNoMaterialsScaffold ? 'اجرای' : 'کرایه ماه اول'} - ${escapeHtml(typeName)}`;
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${serviceText}</td>
                      <td>${invoiceStartDate ? formatPersianDate(invoiceStartDate) : '-'}</td>
                      <td>${invoiceEndDate ? formatPersianDate(invoiceEndDate) : '-'}</td>
                      <td>${areaCell}</td>
                    </tr>
                  `;
                }).join('');
              }
              const L = getLength(), W = getWidth(), H = getHeight();
              const lN = Number(L) || 0, wN = Number(W) || 0, hN = Number(H) || 0;
              const productParts: string[] = [];
              if (lN > 0) productParts.push(lN.toLocaleString('fa-IR'));
              if (wN > 0) productParts.push(wN.toLocaleString('fa-IR'));
              if (hN > 0) productParts.push(hN.toLocaleString('fa-IR'));
              const product = productParts.length >= 2 ? productParts.join(' × ') : '';
              const computed = (lN > 0 && hN > 0) ? (wN > 0 ? lN * wN * hN : lN * hN) : 0;
              const areaCellNoPrice = `${product ? `<div style="font-size:11.5px;color:#475569;">${product} = ${computed > 0 ? computed.toLocaleString('fa-IR') : '-'}</div>` : ''}<strong>${totalArea || '-'} ${getMeasurementUnit()}</strong>`;
              return `
            <tr>
              <td>۱</td>
              <td style="text-align:right;">${isCustomService ? customServiceCell : (description ? escapeHtml(description) : `${isNoMaterialsScaffold ? 'اجرای' : 'کرایه ماه اول -'} ${scaffoldTypeName} - ${subtypeName}`)}</td>
              <td>${isNoMaterialsScaffold ? (installDate ? formatPersianDate(installDate) : '-') : (order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-')}</td>
              <td>${isNoMaterialsScaffold ? (order.execution_end_date || order.execution_stage_updated_at ? formatPersianDate(order.execution_end_date || order.execution_stage_updated_at || '') : '-') : (order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-')}</td>
              <td>${isCustomService ? customMeasureCell : areaCellNoPrice}</td>

            </tr>
              `;
            })()}
            ${(() => {
              const baseCount = Array.isArray(parsedNotes?.multi_scaffolds) && parsedNotes.multi_scaffolds.length > 0
                ? parsedNotes.multi_scaffolds.length
                : 1;
              const baseDescText = description
                ? escapeHtml(description)
                : escapeHtml(`${scaffoldTypeName} - ${subtypeName}`);
              const lN = Number(getLength()) || 0, wN = Number(getWidth()) || 0, hN = Number(getHeight()) || 0;
              const dimParts: string[] = [];
              if (lN > 0) dimParts.push(lN.toLocaleString('fa-IR'));
              if (wN > 0) dimParts.push(wN.toLocaleString('fa-IR'));
              if (hN > 0) dimParts.push(hN.toLocaleString('fa-IR'));
              const dimProduct = dimParts.length >= 2 ? dimParts.join(' × ') : '';
              const dimComputed = (lN > 0 && hN > 0) ? (wN > 0 ? lN * wN * hN : lN * hN) : 0;
              const dimLine = dimProduct
                ? `<div style="font-size:11px;color:#475569;margin-top:2px;">ابعاد: ${dimProduct}${dimComputed > 0 ? ` = ${dimComputed.toLocaleString('fa-IR')} ${getMeasurementUnit()}` : ''}</div>`
                : '';
              const renewalRows = renewals.map((renewal, idx) => {
                const renewalNote = renewal.manager_notes?.trim()
                  ? `<div style="font-size:12px;color:#0f172a;margin-top:3px;white-space:pre-line;"><strong>شرح تمدید:</strong> ${escapeHtml(renewal.manager_notes.trim())}</div>`
                  : '';
                return `
                  <tr class="renewal-row">
                    <td>${(idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                    <td style="text-align:right;"><strong>تمدید ماه ${(renewal.renewal_number + 1)?.toLocaleString('fa-IR') || (idx + baseCount + 1).toLocaleString('fa-IR')}</strong>${renewalNote}<div style="font-size:11.5px;color:#334155;margin-top:2px;">${baseDescText}</div>${dimLine}</td>
                    <td>${renewal.new_start_date ? formatPersianDate(renewal.new_start_date) : '-'}</td>
                    <td>${renewal.new_end_date ? formatPersianDate(renewal.new_end_date) : '-'}</td>
                    <td>-</td>
                  </tr>
                `;
              }).join('');
              const repairRows = repairRequests.map((repair, idx) => `
                <tr class="repair-row">
                  <td>${(idx + baseCount + renewals.length + 1).toLocaleString('fa-IR')}</td>
                  <td style="text-align:right;">تعمیر داربست${repair.description ? ` - ${escapeHtml(repair.description)}` : ''}</td>
                  <td>${repair.created_at ? formatPersianDate(repair.created_at) : '-'}</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              `).join('');
              return renewalRows + repairRows;
            })()}
          </tbody>

        </table>
        `}

        ${invoiceImages.length > 0 ? `
          <div class="images-section">
            <div class="images-title">🖼️ تصاویر پیوست (${invoiceImages.length} تصویر)</div>
            <div class="images-grid">
              ${invoiceImages.slice(0, 12).map(item => `
                <img src="${mediaUrls[item.id]}" alt="تصویر" class="image-thumb" crossorigin="anonymous" />
              `).join('')}
            </div>
            ${invoiceImages.length > 12 ? `<p style="font-size:10px;color:#64748b;margin-top:4px;">و ${invoiceImages.length - 12} تصویر دیگر...</p>` : ''}
          </div>
        ` : ''}


        <!-- Bank Info -->
        <div class="bank-section">
          <div class="bank-title">💳 اطلاعات حساب برای واریز</div>
          <table class="bank-info-table">
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
}

export function buildOrderInvoiceDocument(order: InvoiceOrderLike, extras: InvoiceExtras, hidePrice = false): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`فاکتور سفارش ${order.code}`)}</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap" rel="stylesheet">
${getInvoiceStyles()}
</head><body>${buildOrderInvoiceHtml(order, extras, hidePrice)}</body></html>`;
}

/** Fetch every related record needed to print one order invoice. */
export async function fetchInvoiceExtras(order: InvoiceOrderLike): Promise<InvoiceExtras> {
  const extras = emptyInvoiceExtras();
  const [prov, sub, repairs, renewals, fin, collection, pays, profile] = await Promise.all([
    order.province_id ? supabase.from('provinces').select('name').eq('id', order.province_id).maybeSingle() : Promise.resolve({ data: null } as any),
    order.subcategory_id ? supabase.from('subcategories').select('name, code').eq('id', order.subcategory_id).maybeSingle() : Promise.resolve({ data: null } as any),
    supabase.from('repair_requests').select('id, description, estimated_cost, final_cost, status, created_at').eq('order_id', order.id).order('created_at', { ascending: true }),
    supabase.from('order_renewals').select('id, renewal_number, status, renewal_price, new_start_date, new_end_date, manager_notes, part_id').eq('order_id', order.id).eq('status', 'approved').order('renewal_number', { ascending: true }),
    supabase.from('projects_v3').select('payment_amount, total_price, total_paid').eq('id', order.id).maybeSingle(),
    supabase.from('collection_requests').select('requested_date, confirmed_date, completed_at, status').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('order_payments').select('id, amount, payment_method, receipt_number, notes, payment_date, created_at').eq('order_id', order.id).order('payment_date', { ascending: true }),
    order.customer_phone ? supabase.from('profiles').select('customer_code').eq('phone_number', order.customer_phone).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  extras.provinceName = (prov as any)?.data?.name || '';
  extras.subcategoryName = (sub as any)?.data?.name || '';
  extras.subcategoryCode = (sub as any)?.data?.code || null;
  extras.repairRequests = (((repairs as any)?.data || []) as any[]).filter(isBillableRepair) as any;
  extras.renewals = ((renewals as any)?.data || []) as any;
  extras.freshFinancials = ((fin as any)?.data || null) as any;
  const c = (collection as any)?.data;
  extras.collectionRequestDate = c?.requested_date || null;
  // تاریخ تثبیت شده مستقل است و هرگز از تاریخ درخواست پر نمی‌شود
  extras.collectionConfirmedDate = c?.confirmed_date || null;

  extras.payments = ((pays as any)?.data || []) as any;
  extras.customerCode = (profile as any)?.data?.customer_code || '';
  return extras;
}
