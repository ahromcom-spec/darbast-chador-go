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

import { getInvoiceStyles, buildOrderInvoiceHtml, escapeHtml } from '@/lib/orderInvoicePrint';

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
  className?: string;
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

export const ManagerOrderInvoice = ({ order, hidePrice = false, className }: ManagerOrderInvoiceProps) => {
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

    // Auto-fit zoom to viewport width on open (mobile/tablet get a smaller initial zoom)
    const INVOICE_WIDTH = 794;
    const available = Math.min(window.innerWidth * 0.92, 1024) - 24;
    const fit = Math.min(1, Math.max(0.35, +(available / INVOICE_WIDTH).toFixed(2)));
    setZoom(fit);


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

  const getInvoiceHTML = () => buildOrderInvoiceHtml(order as any, {
    media,
    mediaUrls,
    provinceName,
    subcategoryName,
    repairRequests,
    renewals,
    freshFinancials,
    collectionRequestDate,
    collectionConfirmedDate,
    customerCode,
    payments,
  }, hidePrice);

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
        <Button variant="outline" size="sm" className={className}>
          <Printer className="h-4 w-4 ml-1" />
          پرینت فاکتور
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] sm:w-auto max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
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
              zoom: zoom,
              width: '794px',
              margin: '0 auto',
            } as React.CSSProperties}
          >
            <div
              ref={printRef}
              className="bg-white rounded-lg border"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: `${getInvoiceStyles()}${getInvoiceHTML()}` }}
              style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif', width: '794px' }}
            />
          </div>


        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOrderInvoice;
