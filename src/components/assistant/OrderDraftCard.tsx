import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle2, Film, Loader2, MapPin, MousePointer2, Plus, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { supabase } from '@/integrations/supabase/client';
import { getNeshanTileUrl, NESHAN_ATTRIBUTION } from '@/lib/neshan';
import { notifyManagers } from '@/lib/notifications';
import { sendOrderSms, sendCeoNotificationSms, buildOrderSmsAddress } from '@/lib/orderSms';

export interface ParsedOrderDraft {
  service_type_id?: string;
  subcategory_id?: string;
  service_label?: string;
  subcategory_code?: string;
  dimensions?: Array<{ length?: number; width?: number; height?: number }>;
  duration_months?: number;
  city?: string;
  address_hint?: string;
  defaults?: Record<string, any>;
  calculated_price?: number;
  price_breakdown_short?: string;
}

interface Dim { length: string; width: string; height: string }

interface Props {
  draft: ParsedOrderDraft;
}

const qomCenter: [number, number] = [34.6416, 50.8746];

const pinIcon = new L.DivIcon({
  className: 'ahrom-assistant-map-pin',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const formatToman = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return Math.round(n).toLocaleString('fa-IR') + ' تومان';
};

function ClickableMap({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const OrderDraftCard = ({ draft }: Props) => {
  const { user } = useAuth();
  const { serviceTypes, loading: servicesLoading } = useServiceTypesWithSubcategories();
  const [serviceLabel, setServiceLabel] = useState(draft.service_label || 'داربست فلزی نما با مصالح');
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(draft.service_type_id || null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(draft.subcategory_id || null);
  const [subcategoryCode, setSubcategoryCode] = useState(draft.subcategory_code || '10');
  const [duration, setDuration] = useState<number>(draft.duration_months || 1);
  const [address, setAddress] = useState(draft.address_hint || '');
  const [dimensions, setDimensions] = useState<Dim[]>(() => {
    if (Array.isArray(draft.dimensions) && draft.dimensions.length > 0) {
      return draft.dimensions.map((d) => ({
        length: String(d.length ?? ''),
        width: String(d.width ?? 1),
        height: String(d.height ?? ''),
      }));
    }
    return [{ length: '', width: '1', height: '' }];
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string; id: string } | null>(null);

  useEffect(() => {
    if (serviceTypeId || serviceTypes.length === 0) return;
    const defaultType = serviceTypes.find((s) => s.name.includes('داربست')) || serviceTypes[0];
    const defaultSub = defaultType?.subcategories.find((s) => s.code === subcategoryCode)
      || defaultType?.subcategories[0];
    if (!defaultType) return;
    setServiceTypeId(defaultType.id);
    if (defaultSub) {
      setSubcategoryId(defaultSub.id);
      setSubcategoryCode(defaultSub.code);
      setServiceLabel(draft.service_label || defaultSub.name);
    }
  }, [draft.service_label, serviceTypeId, serviceTypes, subcategoryCode]);

  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === serviceTypeId) || null,
    [serviceTypeId, serviceTypes],
  );

  const calculatedPrice = useMemo(() => {
    const baseArea = (draft.dimensions || []).reduce(
      (a, d) => a + (Number(d.length || 0) * Number(d.height || 0)),
      0,
    );
    const newArea = dimensions.reduce(
      (a, d) => a + (Number(d.length || 0) * Number(d.height || 0)),
      0,
    );
    const baseMonths = draft.duration_months || 1;
    const basePrice = draft.calculated_price || 0;
    if (basePrice <= 0 || baseArea <= 0 || newArea <= 0) return basePrice;
    const ratio = (newArea / baseArea) * (duration / baseMonths);
    return Math.round(basePrice * ratio);
  }, [dimensions, duration, draft]);

  const selectServiceType = (id: string) => {
    const st = serviceTypes.find((s) => s.id === id);
    if (!st) return;
    const preferredSub = st.subcategories.find((s) => s.code === '10') || st.subcategories[0];
    setServiceTypeId(st.id);
    setServiceLabel(preferredSub?.name || st.name);
    setSubcategoryId(preferredSub?.id || null);
    setSubcategoryCode(preferredSub?.code || '10');
  };

  const selectSubcategory = (id: string) => {
    const sub = selectedService?.subcategories.find((s) => s.id === id);
    if (!sub) return;
    setSubcategoryId(sub.id);
    setSubcategoryCode(sub.code);
    setServiceLabel(sub.name);
  };

  const addDimension = () => setDimensions((p) => [...p, { length: '', width: '1', height: '' }]);
  const removeDimension = (i: number) => setDimensions((p) => p.filter((_, idx) => idx !== i));

  const pickLocation = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('این مرورگر از مکان‌یابی پشتیبانی نمی‌کند');
      return;
    }
    toast.info('در حال دریافت موقعیت...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setShowMap(true);
        toast.success('موقعیت ثبت شد ✅');
      },
      () => toast.error('دریافت موقعیت ناموفق بود'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setMediaFiles((p) => [...p, ...arr].slice(0, 5));
  };

  const uploadMedia = async (): Promise<string[]> => {
    if (!user || mediaFiles.length === 0) return [];
    const paths: string[] = [];
    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/assistant/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('project-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (!error) paths.push(path);
    }
    return paths;
  };

  const submit = async () => {
    if (!user) {
      toast.error('برای ثبت سفارش ابتدا وارد حساب کاربری شوید');
      return;
    }
    if (!dimensions.some((d) => Number(d.length) > 0 && Number(d.height) > 0)) {
      toast.error('حداقل ابعاد یک داربست (طول و ارتفاع) را وارد کنید');
      return;
    }
    setSubmitting(true);
    try {
      const mediaPaths = await uploadMedia();
      const finalAddress = address || draft.address_hint || '';
      const payload = {
        service_type_id: serviceTypeId,
        subcategory_id: subcategoryId,
        subcategory_code: subcategoryCode,
        service_label: serviceLabel,
        dimensions: dimensions.map((d) => ({
          length: Number(d.length) || 0,
          width: Number(d.width) || 1,
          height: Number(d.height) || 0,
        })),
        duration_months: duration,
        defaults: draft.defaults || {},
        address: finalAddress,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        media_paths: mediaPaths,
        calculated_price: calculatedPrice,
        notes_extra: { price_breakdown_short: draft.price_breakdown_short || '' },
      };
      const { data, error } = await supabase.functions.invoke('assistant-create-order', { body: payload });
      if (error || !(data as any)?.success) {
        throw new Error((data as any)?.detail || error?.message || 'ثبت سفارش ناموفق بود');
      }
      const ret = data as { project_id: string; order_code: string };
      setResult({ code: ret.order_code, id: ret.project_id });
      toast.success(`سفارش با کد ${ret.order_code} ثبت شد ✅`);

      // Fire-and-forget SMS + push notifications (matching standard order flow)
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('phone_number, full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const customerName = prof?.full_name || (user.user_metadata as any)?.full_name || 'مشتری';
        const customerPhone = prof?.phone_number || (user as any)?.phone || '';
        const smsAddress = buildOrderSmsAddress(finalAddress, '');
        if (customerPhone) {
          sendOrderSms(customerPhone, ret.order_code, 'submitted', {
            orderId: ret.project_id,
            serviceType: serviceLabel,
            address: smsAddress,
            customerName,
          }).catch((err) => console.error('assistant SMS customer error', err));
        }
        sendCeoNotificationSms(ret.order_code, 'submitted', {
          orderId: ret.project_id,
          serviceType: serviceLabel,
          address: smsAddress,
          customerName,
        }).catch((err) => console.error('assistant SMS CEO error', err));
        notifyManagers({
          order_code: ret.order_code,
          order_id: ret.project_id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_user_id: user.id,
          service_type: serviceLabel,
        }).catch((err) => console.error('assistant notifyManagers error', err));
      } catch (notifyErr) {
        console.warn('assistant post-submit notifications failed', notifyErr);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'خطا در ثبت سفارش');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mt-3 rounded-xl border-2 border-green-500/40 bg-green-50 p-4 text-right">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h4 className="font-bold text-green-700">سفارش شما با موفقیت ثبت شد</h4>
        </div>
        <p className="text-sm mb-3">
          کد پیگیری سفارش: <span className="font-mono font-bold">{result.code}</span>
        </p>
        <Link to={`/user/orders/${result.id}`} className="inline-block text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg">
          مشاهده سفارش
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 text-right space-y-3 shadow-sm">
      <h4 className="font-bold text-orange-700 flex items-center gap-2">📋 پیش‌نویس سفارش</h4>

      <div className="space-y-2">
        <Label className="text-xs">نوع خدمات</Label>
        {servicesLoading ? (
          <div className="text-xs text-muted-foreground">در حال دریافت خدمات...</div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {serviceTypes.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => selectServiceType(service.id)}
                className={`rounded-md border px-2 py-2 text-xs transition-colors ${serviceTypeId === service.id ? 'border-orange-500 bg-orange-100 text-orange-800' : 'border-orange-200 bg-white/70 hover:bg-orange-50'}`}
              >
                {service.name}
              </button>
            ))}
          </div>
        )}
        {selectedService && selectedService.subcategories.length > 0 && (
          <select value={subcategoryId || ''} onChange={(e) => selectSubcategory(e.target.value)} className="h-8 text-xs w-full rounded-md border border-input bg-background px-2">
            {selectedService.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
          </select>
        )}
        <Input value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} className="h-8 text-sm" compactFocus />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">ابعاد داربست‌ها (متر)</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addDimension} className="h-6 px-2 text-xs">
            <Plus className="w-3 h-3 ml-1" /> افزودن
          </Button>
        </div>
        {dimensions.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
            <Input placeholder="طول" value={d.length} onChange={(e) => setDimensions((p) => p.map((x, idx) => (idx === i ? { ...x, length: e.target.value } : x)))} className="h-8 text-xs" inputMode="decimal" compactFocus />
            <Input placeholder="عرض" value={d.width} onChange={(e) => setDimensions((p) => p.map((x, idx) => (idx === i ? { ...x, width: e.target.value } : x)))} className="h-8 text-xs" inputMode="decimal" compactFocus />
            <Input placeholder="ارتفاع" value={d.height} onChange={(e) => setDimensions((p) => p.map((x, idx) => (idx === i ? { ...x, height: e.target.value } : x)))} className="h-8 text-xs" inputMode="decimal" compactFocus />
            {dimensions.length > 1 && (
              <button type="button" onClick={() => removeDimension(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">مدت اجاره (ماه)</Label>
        <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 text-sm" compactFocus />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">آدرس (اختیاری)</Label>
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="مثلاً: قم، خیابان امام، کوچه ۱۲، پلاک ۵" className="min-h-[50px] text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((p) => !p)} className="h-8 text-xs">
          <MapPin className="w-3 h-3 ml-1" />
          {showMap ? 'بستن نقشه' : (lat ? 'ویرایش لوکیشن' : 'انتخاب لوکیشن روی نقشه')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={pickLocation} className="h-8 text-xs">
          <MousePointer2 className="w-3 h-3 ml-1" />
          موقعیت فعلی من
        </Button>
        <label className="cursor-pointer">
          <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="inline-flex items-center gap-1 h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-muted">
            <Upload className="w-3 h-3" />
            {mediaFiles.length > 0 ? `افزودن بیشتر (${mediaFiles.length})` : 'افزودن عکس/فیلم'}
          </span>
        </label>
      </div>

      {showMap && (
        <div className="rounded-lg border border-orange-200 overflow-hidden bg-white/80">
          <div className="px-3 py-2 text-xs text-muted-foreground">روی نقشه دقیقاً محل پروژه را لمس کنید.</div>
          <div className="h-72 w-full">
            <MapContainer center={lat && lng ? [lat, lng] : qomCenter} zoom={lat && lng ? 16 : 13} style={{ height: '100%', width: '100%' }} className="z-0">
              <TileLayer attribution={NESHAN_ATTRIBUTION} url={getNeshanTileUrl('standard-day')} />
              <ClickableMap onPick={(pickedLat, pickedLng) => { setLat(pickedLat); setLng(pickedLng); toast.success('لوکیشن ثبت شد ✅'); }} />
              {lat && lng && <Marker position={[lat, lng]} icon={pinIcon} />}
            </MapContainer>
          </div>
          {lat && lng && (
            <div className="px-3 py-1.5 text-[10px] text-green-700 bg-green-50 border-t border-green-100">
              مختصات: {lat.toFixed(5)} , {lng.toFixed(5)}
            </div>
          )}
        </div>
      )}

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {mediaFiles.map((f, i) => {
            const url = URL.createObjectURL(f);
            const isVideo = f.type.startsWith('video/');
            return (
              <div key={i} className="relative rounded-md overflow-hidden border border-orange-200 bg-white aspect-square group">
                {isVideo ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white text-[10px] gap-1">
                    <Film className="w-6 h-6" />
                    <span className="px-1 truncate max-w-full">{f.name}</span>
                  </div>
                ) : (
                  <img src={url} alt={f.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                )}
                <button
                  type="button"
                  onClick={() => setMediaFiles((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute top-1 left-1 bg-red-600 text-white rounded-full p-0.5 opacity-90"
                  aria-label="حذف"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white/70 rounded-lg p-3 border border-orange-200">
        <div className="text-xs text-muted-foreground">قیمت تخمینی:</div>
        <div className="text-lg font-bold text-orange-700">{formatToman(calculatedPrice)}</div>
        {draft.price_breakdown_short && <div className="text-[10px] text-muted-foreground mt-1">{draft.price_breakdown_short}</div>}
        <div className="text-[10px] text-muted-foreground mt-1">⚠️ قیمت قطعی پس از بازدید کارشناس اعلام می‌شود.</div>
      </div>

      <Button onClick={submit} disabled={submitting || !user} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
        {submitting ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />در حال ثبت...</> : !user ? 'برای ثبت ابتدا وارد شوید' : '✅ ثبت نهایی سفارش'}
      </Button>
    </div>
  );
};

export function parseOrderDraft(content: string): { cleanText: string; draft: ParsedOrderDraft | null } {
  const re = /<<AHROM_ORDER_DRAFT>>([\s\S]*?)<<END_ORDER>>/;
  const m = content.match(re);
  if (!m) return { cleanText: content, draft: null };
  let draft: ParsedOrderDraft | null = null;
  try {
    draft = JSON.parse(m[1].trim());
  } catch {
    draft = null;
  }
  const cleanText = content.replace(re, '').trim();
  return { cleanText, draft };
}