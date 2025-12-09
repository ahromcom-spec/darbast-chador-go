import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { parseOrderNotes } from './OrderDetailsView';

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
  const printRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @page { 
          size: A4 landscape; 
          margin: 10mm; 
        }
        * {
          box-sizing: border-box;
          font-family: 'Vazirmatn', 'Tahoma', sans-serif;
        }
        body { 
          direction: rtl; 
          padding: 0;
          margin: 0;
          font-size: 10px;
          line-height: 1.4;
          color: #333;
        }
        .invoice-container {
          max-width: 100%;
        }
        
        /* Header Section */
        .header-box {
          border: 2px solid #f97316;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 10px;
          background: linear-gradient(to bottom, #fff, #fef3e2);
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f97316;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .logo-left, .logo-right {
          width: 80px;
        }
        .logo-left img, .logo-right img {
          height: 50px;
        }
        .header-center {
          text-align: center;
          flex: 1;
        }
        .header-title {
          font-size: 16px;
          font-weight: bold;
          color: #f97316;
        }
        .header-subtitle {
          font-size: 11px;
          color: #333;
        }
        .header-website {
          font-size: 12px;
          color: #3b82f6;
          font-weight: bold;
        }
        
        /* Info Grid */
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        .info-box {
          display: flex;
          border: 1px solid #ddd;
        }
        .info-label {
          background: #1e3a5f;
          color: white;
          padding: 5px 10px;
          min-width: 140px;
          font-weight: bold;
          font-size: 9px;
        }
        .info-value {
          padding: 5px 10px;
          flex: 1;
          background: white;
          font-size: 10px;
        }
        
        /* Order Table */
        .order-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 9px;
        }
        .order-table th {
          background: #3b82f6;
          color: white;
          padding: 6px 4px;
          border: 1px solid #2563eb;
          text-align: center;
          font-weight: bold;
        }
        .order-table td {
          border: 1px solid #ddd;
          padding: 5px 4px;
          text-align: center;
          background: white;
        }
        .order-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .repair-row td {
          background: #fef3c7 !important;
        }
        
        /* Total Row */
        .total-row {
          background: #fef3c7 !important;
          font-weight: bold;
        }
        .total-row td {
          background: #fef3c7 !important;
        }
        
        /* Images Section */
        .images-section {
          margin-top: 10px;
          padding: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        .section-title {
          font-weight: bold;
          font-size: 11px;
          color: #1e3a5f;
          margin-bottom: 8px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
        }
        .images-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .image-thumb {
          width: 100%;
          height: 80px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        /* Messages Section */
        .messages-section {
          margin-top: 10px;
          padding: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        .message-item {
          padding: 5px 8px;
          margin-bottom: 4px;
          border-radius: 4px;
          font-size: 9px;
        }
        .message-customer {
          background: #e2e8f0;
          margin-left: 30%;
        }
        .message-staff {
          background: #dbeafe;
          margin-right: 30%;
        }
        .message-time {
          font-size: 8px;
          color: #64748b;
          margin-top: 2px;
        }
        
        /* Footer */
        .footer-section {
          margin-top: 15px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .signature-box {
          text-align: center;
          padding: 10px;
        }
        .signature-label {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .signature-line {
          border-top: 1px solid #333;
          width: 150px;
          margin: 0 auto;
        }
        .bank-info {
          text-align: center;
          font-size: 9px;
          margin-top: 10px;
          padding: 8px;
          background: #f1f5f9;
          border-radius: 4px;
        }
        .print-date {
          text-align: center;
          font-size: 8px;
          color: #64748b;
          margin-top: 10px;
        }
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>فاکتور سفارش ${order.code}</title>
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
        ${styles}
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
  const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
  const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
  const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || parsedNotes?.locationPurpose;
  // تاریخ‌ها - از هر دو فرمت جدید و قدیم
  const installDate = parsedNotes?.installationDateTime || parsedNotes?.installation_date || parsedNotes?.installDate || parsedNotes?.install_date;
  const dueDate = parsedNotes?.dueDateTime || parsedNotes?.due_date || parsedNotes?.dueDate;
  
  // شرایط اجرا
  const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;

  // Calculate total price including repairs
  const orderPrice = order.payment_amount ? Number(order.payment_amount) : (parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || 0);
  const repairTotal = repairRequests.reduce((sum, r) => sum + (r.final_cost || r.estimated_cost || 0), 0);
  const grandTotal = orderPrice + repairTotal;

  // Get dimension info
  const getDimensionText = () => {
    if (dimensions && Array.isArray(dimensions) && dimensions.length > 0) {
      const dim = dimensions[0];
      return `طول${dim.length || dim.l || '-'}در${dim.width || dim.w || '-'}ارتفاع${dim.height || dim.h || '-'}`;
    }
    if (dimensions && !Array.isArray(dimensions)) {
      return `طول${dimensions.length || '-'}در${dimensions.width || '-'}ارتفاع${dimensions.height || '-'}`;
    }
    return '-';
  };

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 ml-1" />
          پرینت فاکتور
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>پیش‌نمایش فاکتور سفارش</span>
            <div className="flex gap-2">
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 ml-1" />
                پرینت
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Print Content */}
        <div ref={printRef} className="bg-white p-4" dir="rtl">
          <div className="invoice-container">
            
            {/* Top Service Name Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '10px' }}>
              <div style={{ border: '1px solid #ddd', padding: '4px 8px' }}>
                نام خدمات: {subcategoryName || 'داربست، اجرا از مبدا با اجناس، قم'}
              </div>
              <div style={{ border: '1px solid #ddd', padding: '4px 8px', fontWeight: 'bold', fontSize: '12px' }}>
                {order.code}
              </div>
            </div>

            {/* Header Box */}
            <div className="header-box">
              <div className="header-top">
                <div className="logo-left">
                  <img src="/ahrom-logo.png" alt="اهرم" />
                </div>
                <div className="header-center">
                  <div className="header-title">فاکتور نصب و کرایه داربست فلزی اهرُم</div>
                  <div className="header-website">www.ahrom.ir</div>
                  <div className="header-subtitle">
                    دفتر: ۰۲۵ ۳۸۸۶ ۵۰۴۰ &nbsp;&nbsp;&nbsp; همراه محمدی: ۰۹۱۲ ۵۵۱ ۱۴۹۴
                  </div>
                  <div className="header-subtitle">تلفن گویا ۹۰۰۰۰۰۳۱۹</div>
                </div>
                <div className="logo-right">
                  <img src="/ahrom-logo.png" alt="اهرم" />
                </div>
              </div>

              {/* Info Grid */}
              <div className="info-section">
                <div className="info-box">
                  <div className="info-label">نام و شماره تماس هماهنگ کننده:</div>
                  <div className="info-value">{order.customer_name || '-'} {order.customer_phone || ''}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">فاکتور سری:</div>
                  <div className="info-value">اول</div>
                </div>
                <div className="info-box">
                  <div className="info-label">آدرس کارفرما/شرکت:</div>
                  <div className="info-value">{provinceName && `${provinceName}، `}{order.address || '-'}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">شماره فاکتور:</div>
                  <div className="info-value">{order.code}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">آدرس محل نصب:</div>
                  <div className="info-value">{provinceName && `${provinceName}، `}{order.address || '-'}{order.detailed_address ? ` - ${order.detailed_address}` : ''}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">تاریخ تنظیم:</div>
                  <div className="info-value">{order.created_at ? formatPersianDate(order.created_at) : '-'}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">صورت حساب آقای/خانم/شرکت:</div>
                  <div className="info-value">{order.customer_name || '-'}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">پیوست:</div>
                  <div className="info-value">{media.length > 0 ? 'دارد' : 'ندارد'}</div>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>ردیف</th>
                  <th style={{ width: '50px' }}>پیوست</th>
                  <th>محل داربست در پروژه</th>
                  <th>فعالیت مورد نظر با داربست</th>
                  <th>شرح ابعاد</th>
                  <th style={{ width: '50px' }}>شماره خدما</th>
                  <th style={{ width: '40px' }}>طول</th>
                  <th style={{ width: '40px' }}>عرض</th>
                  <th style={{ width: '45px' }}>ارتفاع</th>
                  <th style={{ width: '45px' }}>متراژ</th>
                  <th style={{ width: '45px' }}>تعداد</th>
                  <th style={{ width: '70px' }}>تاریخ شروع</th>
                  <th style={{ width: '70px' }}>تاریخ پایان</th>
                  <th style={{ width: '70px' }}>تاریخ فک</th>
                  <th style={{ width: '50px' }}>تعداد ماه</th>
                  <th style={{ width: '60px' }}>چندمین ماه</th>
                  <th style={{ width: '70px' }}>فی قیمت</th>
                  <th style={{ width: '90px' }}>قیمت کل</th>
                </tr>
              </thead>
              <tbody>
                {/* Main Order Row */}
                <tr>
                  <td>۱</td>
                  <td>{media.length > 0 ? 'دارد' : 'ندارد'}</td>
                  <td>{description || order.detailed_address || order.address || '-'}</td>
                  <td>{scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || '-'}</td>
                  <td>{getDimensionText()}</td>
                  <td>۱</td>
                  <td>{getLength()}</td>
                  <td>{getWidth()}</td>
                  <td>{getHeight()}</td>
                  <td>{totalArea || '-'}</td>
                  <td>۱ عدد</td>
                  <td>{installDate ? formatPersianDate(installDate) : '-'}</td>
                  <td>{dueDate ? formatPersianDate(dueDate) : '-'}</td>
                  <td>نصب مانده</td>
                  <td>-</td>
                  <td>ماه اول</td>
                  <td>-</td>
                  <td>{orderPrice > 0 ? `${orderPrice.toLocaleString('fa-IR')} تومان` : '-'}</td>
                </tr>

                {/* Repair Request Rows */}
                {repairRequests.map((repair, idx) => (
                  <tr key={repair.id} className="repair-row">
                    <td>{(idx + 2).toLocaleString('fa-IR')}</td>
                    <td>ندارد</td>
                    <td>{order.detailed_address || order.address || '-'}</td>
                    <td>تعمیر داربست - {repair.description || 'بدون توضیحات'}</td>
                    <td>-</td>
                    <td>{(idx + 2).toLocaleString('fa-IR')}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>۱ عدد</td>
                    <td>{formatPersianDate(repair.created_at)}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>{(repair.final_cost || repair.estimated_cost || 0).toLocaleString('fa-IR')} تومان</td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr className="total-row">
                  <td colSpan={17} style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                    جمع قیمت کل:
                  </td>
                  <td style={{ fontWeight: 'bold', fontSize: '11px' }}>
                    {grandTotal.toLocaleString('fa-IR')} تومان
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Conditions Section */}
            {conditions && (
              <div className="images-section" style={{ marginTop: '10px' }}>
                <div className="section-title">📋 شرایط اجرا</div>
                <div style={{ fontSize: '10px', lineHeight: '1.6' }}>
                  {conditions.rentalMonthsPlan && (
                    <div>پلان اجاره: {conditions.rentalMonthsPlan === '1' ? 'به شرط یک ماه' : conditions.rentalMonthsPlan === '2' ? 'به شرط دو ماه' : 'به شرط سه ماه و بیشتر'}</div>
                  )}
                  {conditions.totalMonths && <div>مدت قرارداد: {conditions.totalMonths} ماه</div>}
                  {conditions.distanceRange && <div>فاصله از قم: {conditions.distanceRange} کیلومتر</div>}
                  {parsedNotes?.onGround !== undefined && <div>محل نصب: {parsedNotes.onGround ? 'روی زمین' : 'روی سکو/پشت‌بام'}</div>}
                  {parsedNotes?.vehicleReachesSite !== undefined && <div>دسترسی خودرو: {parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}</div>}
                  {conditions.platformHeight && <div>ارتفاع پای کار: {conditions.platformHeight} متر</div>}
                  {conditions.scaffoldHeightFromPlatform && <div>ارتفاع داربست از پای کار: {conditions.scaffoldHeightFromPlatform} متر</div>}
                </div>
              </div>
            )}

            {/* Images Section */}
            {media.length > 0 && (
              <div className="images-section">
                <div className="section-title">🖼️ تصاویر پیوست سفارش ({media.length} تصویر)</div>
                <div className="images-grid">
                  {media.slice(0, 8).map((item) => (
                    <img 
                      key={item.id} 
                      src={mediaUrls[item.id] || ''} 
                      alt="تصویر سفارش"
                      className="image-thumb"
                      crossOrigin="anonymous"
                    />
                  ))}
                </div>
                {media.length > 8 && (
                  <p style={{ fontSize: '9px', color: '#64748b', marginTop: '5px' }}>
                    و {media.length - 8} تصویر دیگر...
                  </p>
                )}
              </div>
            )}

            {/* Messages Section */}
            {messages.length > 0 && (
              <div className="messages-section">
                <div className="section-title">💬 گفتگوها ({messages.length} پیام)</div>
                <div style={{ maxHeight: '120px', overflow: 'hidden' }}>
                  {messages.slice(0, 6).map((msg, idx) => (
                    <div key={idx} className={`message-item ${msg.is_staff ? 'message-staff' : 'message-customer'}`}>
                      <strong>{msg.is_staff ? 'مدیر: ' : 'مشتری: '}</strong>
                      {msg.message}
                      <div className="message-time">{formatPersianDate(msg.created_at)}</div>
                    </div>
                  ))}
                  {messages.length > 6 && (
                    <p style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>
                      و {messages.length - 6} پیام دیگر...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Bank Info */}
            <div className="bank-info">
              <div><strong>شبا ملت محمدی:</strong> IR 280120000000009812328696</div>
              <div><strong>کارت ملت رضا محمدی:</strong> 6104338621521349</div>
            </div>

            {/* Footer Signatures */}
            <div className="footer-section">
              <div className="signature-box">
                <div className="signature-label">امضای کارفرما:</div>
                <div className="signature-line"></div>
              </div>
              <div className="signature-box">
                <div className="signature-label">امضای پیمانکار:</div>
                <div className="signature-line"></div>
              </div>
            </div>

            {/* Print Date */}
            <div className="print-date">
              تاریخ چاپ: {formatPersianDate(new Date().toISOString())}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOrderInvoice;
