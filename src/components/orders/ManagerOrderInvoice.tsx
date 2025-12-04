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

export const ManagerOrderInvoice = ({ order }: ManagerOrderInvoiceProps) => {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string }>>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{ message: string; is_staff: boolean; created_at: string; user_id: string }>>([]);
  const [provinceName, setProvinceName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
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
          size: A4; 
          margin: 15mm; 
        }
        * {
          box-sizing: border-box;
          font-family: 'Vazirmatn', 'Tahoma', sans-serif;
        }
        body { 
          direction: rtl; 
          padding: 0;
          margin: 0;
          font-size: 11px;
          line-height: 1.6;
          color: #333;
        }
        .invoice-container {
          max-width: 100%;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-section img {
          height: 40px;
        }
        .company-name {
          font-size: 18px;
          font-weight: bold;
          color: #2563eb;
        }
        .invoice-title {
          font-size: 14px;
          color: #666;
        }
        .order-code {
          background: #f1f5f9;
          padding: 8px 15px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        .section {
          margin-bottom: 15px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .section-title {
          font-weight: bold;
          font-size: 12px;
          color: #1e40af;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          font-size: 10px;
          color: #64748b;
        }
        .info-value {
          font-weight: 500;
        }
        .full-width {
          grid-column: span 2;
        }
        .dimensions-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .dimensions-table th,
        .dimensions-table td {
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
          text-align: center;
          font-size: 10px;
        }
        .dimensions-table th {
          background: #e2e8f0;
          font-weight: bold;
        }
        .conditions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 5px;
        }
        .condition-badge {
          background: #dbeafe;
          color: #1e40af;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 9px;
        }
        .price-box {
          background: #dcfce7;
          border: 1px solid #86efac;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }
        .price-value {
          font-size: 18px;
          font-weight: bold;
          color: #166534;
        }
        .images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 8px;
        }
        .image-thumb {
          width: 100%;
          height: 80px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        .messages-list {
          max-height: 150px;
          overflow: hidden;
          margin-top: 8px;
        }
        .message-item {
          padding: 6px 8px;
          margin-bottom: 5px;
          border-radius: 6px;
          font-size: 10px;
        }
        .message-customer {
          background: #f1f5f9;
          margin-left: 20%;
        }
        .message-staff {
          background: #dbeafe;
          margin-right: 20%;
        }
        .message-time {
          font-size: 8px;
          color: #94a3b8;
          margin-top: 3px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
        }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-in_progress { background: #dbeafe; color: #1e40af; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-paid { background: #dcfce7; color: #166534; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .footer {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 9px;
          color: #64748b;
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
    
    // Wait for fonts and images to load
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
  const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
  const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
  const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
  const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes;
  const installDate = parsedNotes?.installDate || parsedNotes?.install_date;
  const dueDate = parsedNotes?.dueDate || parsedNotes?.due_date;
  const rentalDuration = parsedNotes?.rentalDuration;
  const distance = parsedNotes?.distance;
  const vehicleAccess = parsedNotes?.vehicleAccess;
  const groundCondition = parsedNotes?.groundCondition;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 ml-1" />
          پرینت فاکتور
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
        <div ref={printRef} className="bg-white p-6" dir="rtl">
          <div className="invoice-container">
            {/* Header */}
            <div className="header">
              <div className="logo-section">
                <img src="/ahrom-logo.png" alt="اهرم" />
                <div>
                  <div className="company-name">خدمات ساختمان و منزل اهرم</div>
                  <div className="invoice-title">فاکتور سفارش</div>
                </div>
              </div>
              <div className="order-code">
                کد سفارش: {order.code}
              </div>
            </div>

            {/* Order Status & Date */}
            <div className="section">
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">وضعیت سفارش</span>
                  <span className={`status-badge status-${order.status || 'pending'}`}>
                    {statusLabels[order.status || 'pending'] || order.status}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">تاریخ ثبت</span>
                  <span className="info-value">{order.created_at ? formatPersianDate(order.created_at) : '-'}</span>
                </div>
                {subcategoryName && (
                  <div className="info-item full-width">
                    <span className="info-label">نوع خدمات</span>
                    <span className="info-value">{subcategoryName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="section">
              <div className="section-title">👤 اطلاعات مشتری</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">نام مشتری</span>
                  <span className="info-value">{order.customer_name || 'نامشخص'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">شماره تماس</span>
                  <span className="info-value" dir="ltr">{order.customer_phone || '-'}</span>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">آدرس</span>
                  <span className="info-value">
                    {provinceName && `${provinceName} - `}{order.address || '-'}
                    {order.detailed_address && ` (${order.detailed_address})`}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Specs */}
            <div className="section">
              <div className="section-title">📐 مشخصات فنی سفارش</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">نوع داربست</span>
                  <span className="info-value">{scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || '-'}</span>
                </div>
                {ceilingSubtype && (
                  <div className="info-item">
                    <span className="info-label">زیرنوع سقف</span>
                    <span className="info-value">{ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype}</span>
                  </div>
                )}
                {totalArea && (
                  <div className="info-item">
                    <span className="info-label">مساحت کل</span>
                    <span className="info-value">{totalArea} متر مربع</span>
                  </div>
                )}
              </div>

              {/* Dimensions Table */}
              {dimensions && Array.isArray(dimensions) && dimensions.length > 0 && (
                <table className="dimensions-table">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>طول (متر)</th>
                      <th>عرض (متر)</th>
                      <th>ارتفاع (متر)</th>
                      <th>تعداد یونیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dim: any, idx: number) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{dim.length || dim.l || '-'}</td>
                        <td>{dim.width || dim.w || '-'}</td>
                        <td>{dim.height || dim.h || '-'}</td>
                        <td>{dim.unitCount || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {dimensions && !Array.isArray(dimensions) && (
                <div className="info-grid" style={{ marginTop: '8px' }}>
                  <div className="info-item">
                    <span className="info-label">طول</span>
                    <span className="info-value">{dimensions.length || '-'} متر</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">عرض</span>
                    <span className="info-value">{dimensions.width || '-'} متر</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">ارتفاع</span>
                    <span className="info-value">{dimensions.height || '-'} متر</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {description && (
              <div className="section">
                <div className="section-title">📝 شرح محل نصب و فعالیت</div>
                <p style={{ margin: 0, fontSize: '11px' }}>{description}</p>
              </div>
            )}

            {/* Service Conditions */}
            {conditions && Array.isArray(conditions) && conditions.length > 0 && (
              <div className="section">
                <div className="section-title">⚙️ شرایط سرویس</div>
                <div className="info-grid">
                  {rentalDuration && (
                    <div className="info-item">
                      <span className="info-label">مدت اجاره</span>
                      <span className="info-value">{rentalDuration}</span>
                    </div>
                  )}
                  {distance && (
                    <div className="info-item">
                      <span className="info-label">فاصله</span>
                      <span className="info-value">{distance}</span>
                    </div>
                  )}
                  {vehicleAccess !== undefined && (
                    <div className="info-item">
                      <span className="info-label">دسترسی ماشین</span>
                      <span className="info-value">{vehicleAccess ? 'بله' : 'خیر'}</span>
                    </div>
                  )}
                  {groundCondition && (
                    <div className="info-item">
                      <span className="info-label">وضعیت زمین</span>
                      <span className="info-value">{groundCondition}</span>
                    </div>
                  )}
                </div>
                <div className="conditions-list">
                  {conditions.map((cond: string, i: number) => (
                    <span key={i} className="condition-badge">{cond}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            {(installDate || dueDate) && (
              <div className="section">
                <div className="section-title">📅 تاریخ‌ها</div>
                <div className="info-grid">
                  {installDate && (
                    <div className="info-item">
                      <span className="info-label">تاریخ نصب</span>
                      <span className="info-value">{formatPersianDate(installDate)}</span>
                    </div>
                  )}
                  {dueDate && (
                    <div className="info-item">
                      <span className="info-label">تاریخ سررسید</span>
                      <span className="info-value">{formatPersianDate(dueDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price */}
            {order.payment_amount && (
              <div className="price-box">
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '5px' }}>مبلغ کل سفارش</div>
                <div className="price-value">{Number(order.payment_amount).toLocaleString('fa-IR')} تومان</div>
              </div>
            )}

            {/* Images */}
            {media.length > 0 && (
              <div className="section">
                <div className="section-title">🖼️ تصاویر سفارش ({media.length} تصویر)</div>
                <div className="images-grid">
                  {media.slice(0, 6).map((item) => (
                    <img 
                      key={item.id} 
                      src={mediaUrls[item.id] || ''} 
                      alt="تصویر سفارش"
                      className="image-thumb"
                      crossOrigin="anonymous"
                    />
                  ))}
                </div>
                {media.length > 6 && (
                  <p style={{ fontSize: '9px', color: '#64748b', marginTop: '5px' }}>
                    و {media.length - 6} تصویر دیگر...
                  </p>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.length > 0 && (
              <div className="section">
                <div className="section-title">💬 گفتگوها ({messages.length} پیام)</div>
                <div className="messages-list">
                  {messages.slice(0, 5).map((msg, idx) => (
                    <div key={idx} className={`message-item ${msg.is_staff ? 'message-staff' : 'message-customer'}`}>
                      <div>{msg.message}</div>
                      <div className="message-time">{formatPersianDate(msg.created_at)}</div>
                    </div>
                  ))}
                  {messages.length > 5 && (
                    <p style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>
                      و {messages.length - 5} پیام دیگر...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="footer">
              <p>خدمات ساختمان و منزل اهرم | تماس: ۰۲۵-۳۲۹۱۰۰۰۰</p>
              <p>تاریخ چاپ: {formatPersianDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerOrderInvoice;
