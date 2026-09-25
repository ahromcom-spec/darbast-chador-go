import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { MediaUploader } from '@/components/orders/MediaUploader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { createProjectV3Schema } from '@/lib/rpcValidation';
import { sanitizeHtml } from '@/lib/security';
import { notifyManagers } from '@/lib/notifications';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { compressImages, isImageFile } from '@/lib/imageOptimizer';
import { buildMediaFingerprint, findDuplicateProjectMedia } from '@/lib/mediaFingerprint';
import { computeEstimate, getFormSchema, Rate } from '@/lib/serviceFormSchemas';
import { MapPin, Calculator, UserCheck, Send } from 'lucide-react';

export default function GenericServiceForm() {
  const navigate = useNavigate();
  const { state: rs } = useLocation();
  const state = (rs || {}) as Record<string, any>;
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId, loading: customerLoading } = useCustomer();

  const subcategoryId: string | null = state.subcategoryId ?? null;
  const [stored, setStored] = useState<unknown>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<false | 'order' | 'expert'>(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!subcategoryId) return;
    supabase.from('subcategories').select('form_schema').eq('id', subcategoryId).maybeSingle()
      .then(({ data }) => setStored((data as any)?.form_schema ?? null));
    supabase.from('service_pricing_rates' as any).select('field_key, option_value, unit_price').eq('subcategory_id', subcategoryId)
      .then(({ data }) => setRates(((data as any) || []) as Rate[]));
  }, [subcategoryId]);

  const fields = useMemo(() => getFormSchema(state.serviceName, state.subcategoryName, stored), [state.serviceName, state.subcategoryName, stored]);
  const numericValues = useMemo(() => {
    const o: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.key];
      o[f.key] = f.type === 'number' ? (v ? parseLocalizedNumber(String(v)) : null) : v;
    }
    return o;
  }, [values, fields]);
  const estimate = useMemo(() => computeEstimate(fields, numericValues, rates), [fields, numericValues, rates]);

  if (!subcategoryId) {
    return (
      <div className="p-6 text-center space-y-3" dir="rtl">
        <p>اطلاعات خدمت یافت نشد. لطفاً از صفحه نخست دوباره انتخاب کنید.</p>
        <Button onClick={() => navigate('/')}>صفحه نخست</Button>
      </div>
    );
  }
  if (customerLoading) return <LoadingSpinner />;

  const uploadMedia = async (projectId: string) => {
    if (!user || files.length === 0) return;
    const imgs = await compressImages(files.filter(isImageFile));
    const all = [...imgs, ...files.filter(f => !isImageFile(f))];
    let i = 0;
    for (const file of all) {
      i++;
      setStatus(`در حال آپلود فایل ${i} از ${all.length}...`);
      try {
        const isVideo = file.type?.startsWith('video/');
        const path = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('project-media').upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (error) throw error;
        const fp = await buildMediaFingerprint(file, isVideo ? 'video' : 'image');
        const dup = await findDuplicateProjectMedia(projectId, { contentHash: fp.contentHash, durationSeconds: fp.durationSeconds, fileSize: file.size, fileType: isVideo ? 'video' : 'image' });
        if (dup) continue;
        await supabase.from('project_media').insert({
          project_id: projectId, user_id: user.id, file_path: path, file_type: isVideo ? 'video' : 'image',
          file_size: file.size, mime_type: file.type, content_hash: fp.contentHash, duration_seconds: fp.durationSeconds,
        });
      } catch (e) { console.error('upload failed', e); }
    }
    setStatus('');
  };

  const submit = async (mode: 'order' | 'expert') => {
    if (!user) { navigate('/auth/register'); return; }
    if (!customerId || !state.provinceId || !state.locationAddress) {
      toast({ title: 'اطلاعات ناقص', description: 'آدرس یافت نشد، لطفاً دوباره از ابتدا انتخاب کنید.', variant: 'destructive' });
      return;
    }
    const missing = fields.find(f => f.required && (numericValues[f.key] === null || numericValues[f.key] === undefined || numericValues[f.key] === ''));
    if (missing) { toast({ title: 'تکمیل فرم', description: `«${missing.label}» را وارد کنید`, variant: 'destructive' }); return; }

    setBusy(mode);
    try {
      const answers = fields.map(f => ({ key: f.key, label: f.label, unit: f.unit || '', value: numericValues[f.key] ?? null }))
        .filter(a => a.value !== null && a.value !== '' && a.value !== undefined);
      const details = answers.map(a => `${a.label}: ${a.value === true ? 'بله' : a.value} ${a.unit}`.trim()).join('\n');
      const useEstimate = mode === 'order' && estimate.hasPricing && estimate.total > 0;
      const notes = {
        service_type: 'generic',
        is_generic_service_form: true,
        form_answers: answers,
        description: sanitizeHtml(description),
        service_details: sanitizeHtml(details + (description ? `\nتوضیحات: ${description}` : '')),
        estimated_price: useEstimate ? estimate.total : null,
        estimated_price_lines: useEstimate ? estimate.lines : [],
        totalPrice: useEstimate ? estimate.total : undefined,
        estimatedPrice: useEstimate ? estimate.total : undefined,
        awaiting_manual_pricing: !useEstimate,
        expert_pricing_requested: mode === 'expert',
        customerName: user.user_metadata?.full_name || '',
        phoneNumber: user.user_metadata?.phone_number || user.phone || '',
      };
      const addr = sanitizeHtml(state.locationAddress);
      const validated = createProjectV3Schema.parse({
        _customer_id: customerId, _province_id: state.provinceId, _district_id: state.districtId || null,
        _subcategory_id: subcategoryId, _hierarchy_project_id: state.hierarchyProjectId || null,
        _address: addr, _detailed_address: addr, _location_lat: state.lat ?? null, _location_lng: state.lng ?? null,
        _notes: JSON.stringify(notes),
      });
      const { data, error } = await supabase.rpc('create_project_v3', validated as any);
      if (error) throw error;
      const created = (data as any[])?.[0];
      if (!created) throw new Error('خطا در ایجاد سفارش');

      if (useEstimate) {
        await supabase.from('projects_v3').update({ payment_amount: estimate.total } as any).eq('id', created.id);
      }
      if (mode === 'expert') {
        await supabase.from('expert_pricing_requests').insert({
          customer_id: customerId, subcategory_id: subcategoryId, province_id: state.provinceId, district_id: state.districtId || null,
          address: addr, location_lat: state.lat ?? null, location_lng: state.lng ?? null,
          description: sanitizeHtml(details + (description ? `\n${description}` : '')),
          dimensions: answers as any, status: 'pending',
        } as any);
      }
      await uploadMedia(created.id);
      try {
        await notifyManagers({
          title: mode === 'expert' ? '🧮 درخواست قیمت‌گذاری کارشناسی' : '📦 سفارش جدید',
          body: `سفارش ${created.code} - ${state.subcategoryName || state.serviceName || ''}`,
          link: `/executive/orders`,
        } as any);
      } catch { /* optional */ }
      toast({ title: 'ثبت شد', description: `سفارش با کد ${created.code} ثبت و برای بررسی به مدیریت ارسال شد.` });
      navigate(`/user/orders/${created.id}`);
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'خطا در ثبت سفارش', variant: 'destructive' });
    } finally { setBusy(false); setStatus(''); }
  };

  const set = (k: string, v: any) => setValues(p => ({ ...p, [k]: v }));

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{state.subcategoryName || 'فرم خدمات'}</CardTitle>
            <p className="text-sm text-muted-foreground">{state.serviceName}</p>
            {state.locationAddress && (
              <p className="text-xs flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{state.locationAddress}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}{f.unit ? ` (${f.unit})` : ''}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.type === 'number' && <Input inputMode="decimal" value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />}
                {f.type === 'text' && <Input value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} />}
                {f.type === 'boolean' && <div><Switch checked={!!values[f.key]} onCheckedChange={v => set(f.key, v)} /></div>}
                {f.type === 'select' && (
                  <Select value={values[f.key] ?? ''} onValueChange={v => set(f.key, v)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
                    <SelectContent>{(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
            <div className="space-y-1">
              <Label>توضیحات تکمیلی</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="هر توضیحی درباره محل و نوع کار..." />
            </div>
            <div className="space-y-1">
              <Label>عکس و فیلم محل کار (اختیاری)</Label>
              <MediaUploader disableAutoUpload onFilesChange={setFiles} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />قیمت تقریبی</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!estimate.hasPricing ? (
              <p className="text-muted-foreground">برای این خدمت هنوز قیمت‌گذاری خودکار تعریف نشده است. سفارش را ثبت کنید یا درخواست قیمت‌گذاری کارشناسی بدهید.</p>
            ) : estimate.total > 0 ? (
              <>
                {estimate.lines.map((l, i) => (
                  <div key={i} className="flex justify-between"><span>{l.label}</span><span>{l.amount.toLocaleString('fa-IR')}</span></div>
                ))}
                {estimate.multiplier > 1 && <div className="flex justify-between text-muted-foreground"><span>ضریب مدت</span><span>× {estimate.multiplier.toLocaleString('fa-IR')}</span></div>}
                <div className="flex justify-between font-bold border-t pt-2"><span>جمع تقریبی</span><span>{estimate.total.toLocaleString('fa-IR')} تومان</span></div>
                <p className="text-xs text-muted-foreground">قیمت نهایی پس از بررسی مدیریت ممکن است تغییر کند.</p>
              </>
            ) : <p className="text-muted-foreground">فرم را پر کنید تا قیمت تقریبی نمایش داده شود.</p>}
          </CardContent>
        </Card>

        {status && <p className="text-sm text-center text-muted-foreground">{status}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button disabled={!!busy} onClick={() => submit('order')} className="gap-2"><Send className="h-4 w-4" />{busy === 'order' ? 'در حال ثبت...' : 'ثبت سفارش'}</Button>
          <Button disabled={!!busy} variant="outline" onClick={() => submit('expert')} className="gap-2"><UserCheck className="h-4 w-4" />{busy === 'expert' ? 'در حال ارسال...' : 'درخواست قیمت‌گذاری کارشناسی'}</Button>
        </div>
      </div>
    </div>
  );
}
