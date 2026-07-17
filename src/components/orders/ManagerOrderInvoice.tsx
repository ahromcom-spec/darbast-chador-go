import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, X, Download, Share2 } from 'lucide-react';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import { parseOrderNotes } from './OrderDetailsView';
import { useToast } from '@/hooks/use-toast';

// Escape user-controlled values before they are interpolated into raw HTML
// strings (which are later rendered via dangerouslySetInnerHTML / innerHTML /
// document.write). Prevents stored XSS via fields such as customer name,
// address, repair description, etc.
function escapeHtml(value: unknown): string {
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
    total_price?: number | null;
    total_paid?: number | null;
    status?: string;
    customer_completion_date?: string | null;
    province_id?: string;
    subcategory_id?: string;
    rental_start_date?: string | null;
  };
  hidePrice?: boolean; // Hide price/financial information in invoice
}

interface RepairRequest {
  id: string;
  description: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  status: string;
  created_at: string;
}

interface OrderRenewal {
  id: string;
  renewal_number: number | null;
  status: string | null;
  renewal_price: number | null;
  new_start_date: string | null;
  new_end_date: string | null;
}

interface FreshFinancials {
  payment_amount: number | null;
  total_price: number | null;
  total_paid: number | null;
}

const isInvoiceImage = (item: { file_path?: string | null; file_type?: string | null; mime_type?: string | null }) => {
  const type = (item.file_type || '').toLowerCase();
  const mime = (item.mime_type || '').toLowerCase();
  const path = (item.file_path || '').toLowerCase().split('?')[0];

  if (type.startsWith('video') || mime.startsWith('video/')) return false;
  if (type.startsWith('image') || mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(path);
};

export const ManagerOrderInvoice = ({ order, hidePrice = false }: ManagerOrderInvoiceProps) => {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string | null; mime_type?: string | null }>>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{ message: string; is_staff: boolean; created_at: string; user_id: string }>>([]);
  const [provinceName, setProvinceName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [renewals, setRenewals] = useState<OrderRenewal[]>([]);
  const [freshFinancials, setFreshFinancials] = useState<FreshFinancials | null>(null);
  const [collectionRequestDate, setCollectionRequestDate] = useState<string | null>(null);
  const [collectionConfirmedDate, setCollectionConfirmedDate] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState<string>('');
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; payment_method: string | null; receipt_number: string | null; notes: string | null; payment_date: string | null; created_at: string }>>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setIsLoading(true);
      setMedia([]);
      setMediaUrls({});
      setCollectionRequestDate(null);
      setCollectionConfirmedDate(null);
      setPayments([]);

      // Fetch media
      const { data: mediaData } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type')
        .eq('project_id', order.id)
        .order('created_at', { ascending: true });
      
      if (mediaData) {
        // Only include images in the invoice (videos can't be rendered as images)
        const imagesOnly = mediaData.filter(isInvoiceImage);
        setMedia(imagesOnly);
        
        // Fetch media URLs
        const urls: Record<string, string> = {};
        for (const item of imagesOnly) {
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

      // Fetch approved renewals (additional monthly costs)
      const { data: renewalData } = await supabase
        .from('order_renewals')
        .select('id, renewal_number, status, renewal_price, new_start_date, new_end_date')
        .eq('order_id', order.id)
        .eq('status', 'approved')
        .order('renewal_number', { ascending: true });

      if (renewalData) setRenewals(renewalData as OrderRenewal[]);

      // Fetch latest financial snapshot (avoid stale values in printed invoice)
      const { data: financialData } = await supabase
        .from('projects_v3')
        .select('payment_amount, total_price, total_paid')
        .eq('id', order.id)
        .maybeSingle();

      if (financialData) setFreshFinancials(financialData as FreshFinancials);

      // Fetch collection request date (latest approved or pending)
      const { data: collectionData } = await supabase
        .from('collection_requests')
        .select('requested_date, confirmed_date, completed_at, status')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setCollectionRequestDate(collectionData?.requested_date || null);
      const confirmed = collectionData?.confirmed_date || collectionData?.completed_at || order.customer_completion_date || (
        ['approved', 'completed'].includes(collectionData?.status || '') ? collectionData?.requested_date : null
      );
      setCollectionConfirmedDate(confirmed || null);

      // Fetch payment history
      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('id, amount, payment_method, receipt_number, notes, payment_date, created_at')
        .eq('order_id', order.id)
        .order('payment_date', { ascending: true });
      if (paymentsData) setPayments(paymentsData as any);

      // Fetch customer code
      if (order.customer_phone) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('customer_code')
          .eq('phone_number', order.customer_phone)
          .maybeSingle();
        if (profileData?.customer_code) setCustomerCode(profileData.customer_code);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [open, order.id, order.province_id, order.subcategory_id, order.customer_completion_date]);

  const getInvoiceStyles = () => `
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

  const getInvoiceHTML = () => {
    const dimensions = parsedNotes?.dimensions;
    const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
    const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
    const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || parsedNotes?.locationPurpose;
    const installDate = parsedNotes?.installationDateTime || parsedNotes?.installation_date || parsedNotes?.installDate || parsedNotes?.install_date;
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

    const totalArea = calculateTotalMeasurement();
    const invoiceImages = media.filter((item) => Boolean(mediaUrls[item.id]));
    
    // Determine if measurement is volume (cubic) or area (square)
    const getMeasurementUnit = () => {
      const widthVal = getWidth();
      const w = parseFloat(String(widthVal).replace(/[^\d.]/g, ''));
      return (!isNaN(w) && w > 0) ? 'متر مکعب' : 'متر مربع';
    };

    const scaffoldTypeName = scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || subcategoryName || '-';
    const subtypeName = ceilingSubtype ? ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype : (subcategoryName || scaffoldTypeName);

    return `
      <div class="invoice-container">
        <!-- Header -->
        <div class="header-section">
          <div class="header-flank">
            <div class="side-logo"><img src="/ahrom-logo.png" alt="اهرم" /></div>
            <div class="header-center">
              <div class="company-title">${escapeHtml(resolveInvoiceTitle(scaffoldingType, subcategoryName))}</div>
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
            <td class="label-cell">نوع داربست:</td>
            <td class="value-cell">${scaffoldTypeName}</td>
            <td class="label-cell">زیرنوع:</td>
            <td class="value-cell">${subtypeName}</td>
          </tr>
        </table>

        <!-- Dates Section -->
        <table class="main-info-table">
          <tr>
            <td class="label-cell" colspan="6" style="text-align:center; font-size:14px;">📅 تاریخ‌های مهم</td>
          </tr>
          <tr>
            <td class="label-cell" style="white-space:nowrap;">تاریخ شروع کرایه:</td>
            <td class="value-cell" style="white-space:nowrap;">${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
            <td class="label-cell" style="white-space:nowrap;">تاریخ درخواست جمع‌آوری:</td>
            <td class="value-cell" style="white-space:nowrap;">${collectionRequestDate ? formatPersianDateTime(collectionRequestDate) : '-'}</td>
            <td class="label-cell" style="white-space:nowrap;">تاریخ جمع‌آوری تثبیت‌شده:</td>
            <td class="value-cell" style="white-space:nowrap;">${collectionConfirmedDate ? formatPersianDate(collectionConfirmedDate) : '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">مدت قرارداد:</td>
            <td class="value-cell">${conditions?.totalMonths || '۱'} ماه</td>
            <td class="label-cell">پیوست:</td>
            <td class="value-cell" colspan="3">${invoiceImages.length > 0 ? `دارد (${invoiceImages.length} تصویر)` : 'ندارد'}</td>
          </tr>
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
              <th>تاریخ شروع</th>
              <th>تاریخ پایان</th>
              <th>متراژ/تعداد</th>
              <th>مبلغ کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
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
                      <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
                      <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
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
                    : `${label} - کرایه ماه اول - ${escapeHtml(typeName)}`;
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${serviceText}</td>
                      <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
                      <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
                      <td>${areaCell}</td>
                      <td>${priceCell}</td>
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
              const areaCell = `${product ? `<div style="font-size:11.5px;color:#475569;">${product} = ${computed > 0 ? computed.toLocaleString('fa-IR') : '-'}</div>` : ''}${totalArea && totalArea !== '-' ? `<strong>${totalArea} ${getMeasurementUnit()}</strong>` : '-'}`;
              const areaNumeric = computed > 0 ? computed : (Number(totalArea) || 0);
              const unitPrice = (basePrice > 0 && areaNumeric >= 100) ? Math.round(basePrice / areaNumeric) : 0;
              const unitLabel = getMeasurementUnit();
              const priceCell = basePrice > 0
                ? `<strong>${basePrice.toLocaleString('fa-IR')}</strong>${unitPrice > 0 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">فی: ${unitPrice.toLocaleString('fa-IR')} تومان / ${unitLabel}</div>` : ''}`
                : '-';
              return `
            <tr>
              <td>۱</td>
              <td style="text-align:right;">${description ? escapeHtml(description) : `کرایه ماه اول - ${scaffoldTypeName} - ${subtypeName}`}</td>
              <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
              <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
              <td>${areaCell}</td>
              <td>${priceCell}</td>
            </tr>
              `;
            })()}

            ${(() => {
              const baseCount = Array.isArray(parsedNotes?.multi_scaffolds) && parsedNotes.multi_scaffolds.length > 0
                ? parsedNotes.multi_scaffolds.length
                : 1;
              const renewalRows = renewals.map((renewal, idx) => `
                <tr class="renewal-row">
                  <td>${(idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                  <td>تمدید ماه ${(renewal.renewal_number + 1)?.toLocaleString('fa-IR') || (idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                  <td>${renewal.new_start_date ? formatPersianDate(renewal.new_start_date) : '-'}</td>
                  <td>${renewal.new_end_date ? formatPersianDate(renewal.new_end_date) : '-'}</td>
                  <td>-</td>
                  <td>${Number(renewal.renewal_price || 0).toLocaleString('fa-IR')}</td>
                </tr>
              `).join('');
              const repairRows = repairRequests.map((repair, idx) => `
                <tr class="repair-row">
                  <td>${(idx + baseCount + renewals.length + 1).toLocaleString('fa-IR')}</td>
                  <td>تعمیر داربست${repair.description ? ` - ${escapeHtml(repair.description)}` : ''}</td>
                  <td>-</td>
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
        <table class="order-details-table" style="margin-top: 8px;">
          <thead>
            <tr>
              <th colspan="5" style="text-align:center; font-size:14px;">🧾 تاریخچه پرداخت‌ها (${payments.length.toLocaleString('fa-IR')})</th>
            </tr>
            <tr>
              <th>ردیف</th>
              <th>تاریخ و ساعت پرداخت</th>
              <th>مبلغ (تومان)</th>
              <th>شماره رسید</th>
              <th>توضیحات</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((p, idx) => `
              <tr>
                <td>${(idx + 1).toLocaleString('fa-IR')}</td>
                <td>${formatPersianDateTime(p.payment_date || p.created_at)}</td>
                <td style="color:#16a34a; font-weight:bold;">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
                <td>${p.receipt_number ? escapeHtml(p.receipt_number) : '-'}</td>
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
              <th>تاریخ شروع</th>
              <th>تاریخ پایان</th>
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
                      <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
                      <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
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
                    : `${label} - کرایه ماه اول - ${escapeHtml(typeName)}`;
                  return `
                    <tr>
                      <td>${(i + 1).toLocaleString('fa-IR')}</td>
                      <td style="text-align:right;">${serviceText}</td>
                      <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
                      <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
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
              <td style="text-align:right;">${description ? escapeHtml(description) : `کرایه ماه اول - ${scaffoldTypeName} - ${subtypeName}`}</td>
              <td>${order.rental_start_date ? formatPersianDate(order.rental_start_date) : '-'}</td>
              <td>${order.rental_start_date ? formatPersianDate(new Date(new Date(order.rental_start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()) : '-'}</td>
              <td>${areaCellNoPrice}</td>
            </tr>
              `;
            })()}
            ${(() => {
              const baseCount = Array.isArray(parsedNotes?.multi_scaffolds) && parsedNotes.multi_scaffolds.length > 0
                ? parsedNotes.multi_scaffolds.length
                : 1;
              const renewalRows = renewals.map((renewal, idx) => `
                <tr class="renewal-row">
                  <td>${(idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                  <td>تمدید ماه ${(renewal.renewal_number + 1)?.toLocaleString('fa-IR') || (idx + baseCount + 1).toLocaleString('fa-IR')}</td>
                  <td>${renewal.new_start_date ? formatPersianDate(renewal.new_start_date) : '-'}</td>
                  <td>${renewal.new_end_date ? formatPersianDate(renewal.new_end_date) : '-'}</td>
                  <td>-</td>
                </tr>
              `).join('');
              const repairRows = repairRequests.map((repair, idx) => `
                <tr class="repair-row">
                  <td>${(idx + baseCount + renewals.length + 1).toLocaleString('fa-IR')}</td>
                  <td>تعمیر داربست${repair.description ? ` - ${escapeHtml(repair.description)}` : ''}</td>
                  <td>-</td>
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

  // Render the invoice HTML to a single A4 page PDF (scales to fit)
  const renderInvoicePdfBlob = async (): Promise<Blob> => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    // Off-screen container with fixed A4 width so layout matches print
    const container = document.createElement('div');
    container.innerHTML = `
      <style>${getInvoiceStyles().replace(/<\/?style>/g, '')}</style>
      ${getInvoiceHTML()}
    `;
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = 'white';
    container.style.direction = 'rtl';
    container.style.fontFamily = 'Vazirmatn, Tahoma, Arial, sans-serif';
    document.body.appendChild(container);

    try {
      // Wait for fonts/images
      await new Promise((r) => setTimeout(r, 250));

      const target = container.querySelector('.invoice-container') as HTMLElement || container;
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();   // 210
      const pageH = pdf.internal.pageSize.getHeight();  // 297
      const margin = 6; // mm
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      // Fit width to page; if height overflows, scale down to fit on a single A4 page
      const imgRatio = canvas.width / canvas.height;
      let drawW = availW;
      let drawH = drawW / imgRatio;
      if (drawH > availH) {
        drawH = availH;
        drawW = drawH * imgRatio;
      }
      const offsetX = (pageW - drawW) / 2;
      const offsetY = margin; // anchor to top so content doesn't float in the middle

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
      return pdf.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const blob = await renderInvoicePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `فاکتور-سفارش-${order.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
      const pdfBlob = await renderInvoicePdfBlob();
      const pdfFile = new File([pdfBlob], `فاکتور-سفارش-${order.code}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>پیش‌نمایش فاکتور سفارش {order.code}</span>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-1 border rounded-md px-1 py-0.5 bg-slate-50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                  title="کوچک‌نمایی (Ctrl + -)"
                >−</Button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="text-xs font-bold w-12 text-center hover:underline"
                  title="بازنشانی زوم (Ctrl + 0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))}
                  title="بزرگ‌نمایی (Ctrl + +)"
                >+</Button>
              </div>
              <Button onClick={handleShare} variant="outline" size="sm" disabled={isLoading || isDownloading}>
                <Share2 className="h-4 w-4 ml-1" />
                اشتراک‌گذاری
              </Button>
              <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={isLoading || isDownloading}>
                <Download className="h-4 w-4 ml-1" />
                {isLoading ? 'در حال بارگذاری...' : isDownloading ? 'در حال دانلود...' : 'دانلود PDF'}
              </Button>
              <Button onClick={handlePrint} size="sm" disabled={isLoading}>
                <Printer className="h-4 w-4 ml-1" />
                {isLoading ? 'در حال بارگذاری...' : 'پرینت'}
              </Button>
            </div>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            میانبرهای زوم: <kbd className="px-1 border rounded">Ctrl</kbd> + <kbd className="px-1 border rounded">+</kbd> /
            <kbd className="px-1 border rounded">−</kbd> /
            <kbd className="px-1 border rounded">0</kbd> — یا با چرخ ماوس همراه <kbd className="px-1 border rounded">Ctrl</kbd>
          </p>
        </DialogHeader>

        {/* Scrollable zoom-aware preview */}
        <div
          className="flex-1 overflow-auto bg-slate-100 rounded-lg p-2"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(3, +(z + 0.1).toFixed(2))); }
            else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2))); }
            else if (e.key === '0') { e.preventDefault(); setZoom(1); }
          }}
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setZoom(z => {
              const next = e.deltaY < 0 ? z + 0.1 : z - 0.1;
              return Math.min(3, Math.max(0.5, +next.toFixed(2)));
            });
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              width: zoom >= 1 ? `${100 / zoom}%` : '100%',
              margin: '0 auto',
            }}
          >
            <div
              ref={printRef}
              className="bg-white rounded-lg border"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: `${getInvoiceStyles()}${getInvoiceHTML()}` }}
              style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOrderInvoice;
