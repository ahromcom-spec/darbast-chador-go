import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Power, LogOut, Clock, Pencil, Plus, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ContractorOrdersV3 } from '@/components/contractor/ContractorOrdersV3';
import { NewContractorForm } from '@/components/profile/NewContractorForm';

interface Props {
  userId: string;
  onContractorFound?: (found: boolean) => void;
  refreshKey?: number;
}

interface Self {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  experience_years: number | null;
  is_active: boolean;
  is_approved: boolean;
  service_category_id: string | null;
  activity_type_id: string | null;
  region_id: string | null;
  exit_requested_at: string | null;
  exit_request_reason: string | null;
  pending_edits: any | null;
  pending_edits_at: string | null;
  deactivated_by_admin: boolean;
  reactivation_requested_at: string | null;
  reactivation_request_reason: string | null;
  has_contractor_role?: boolean;
}

interface ServiceItem {
  id: string;
  service_type_name: string;
  sub_name: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'exited';
  rejection_reason: string | null;
  exit_requested_at: string | null;
  exit_request_reason: string | null;
  exit_approved_at: string | null;
}

interface ActivityEntry {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  metadata: any;
}

export function ContractorQuickActions({ userId, onContractorFound, refreshKey = 0 }: Props) {
  const [self, setSelf] = useState<Self | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceExitTarget, setServiceExitTarget] = useState<ServiceItem | null>(null);
  const [serviceExitReason, setServiceExitReason] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_person: '',
    address: '',
    description: '',
    experience_years: '',
  });


  useEffect(() => {
    void load();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ''));
  }, [userId, refreshKey]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: roleData }] = await Promise.all([
      supabase
        .from('contractors')
        .select('id,company_name,contact_person,phone_number,email,address,description,experience_years,is_active,is_approved,service_category_id,activity_type_id,region_id,exit_requested_at,exit_request_reason,pending_edits,pending_edits_at,deactivated_by_admin,reactivation_requested_at,reactivation_request_reason')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'contractor')
        .maybeSingle(),
    ]);
    setSelf(data ? ({ ...(data as Self), has_contractor_role: !!roleData } as Self) : null);
    onContractorFound?.(!!data);

    if (data) {
      const { data: srv } = await supabase
        .from('contractor_services')
        .select('id, service_type, sub_type, status, rejection_reason, exit_requested_at, exit_request_reason, exit_approved_at')
        .eq('contractor_id', (data as any).id)
        .order('created_at', { ascending: false });
      const list = (srv || []) as Array<{ id: string; service_type: string; sub_type: string | null; status: 'pending' | 'approved' | 'rejected' | 'exited'; rejection_reason: string | null; exit_requested_at: string | null; exit_request_reason: string | null; exit_approved_at: string | null }>;
      const stIds = [...new Set(list.map((s) => s.service_type))];
      const subCodes = [...new Set(list.map((s) => s.sub_type).filter(Boolean) as string[])];
      const [{ data: stRows }, { data: subRows }] = await Promise.all([
        supabase.from('service_types_v3').select('id,name').in('id', stIds.length ? stIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('subcategories').select('code,name,service_type_id').in('code', subCodes.length ? subCodes : ['__none__']),
      ]);
      const stMap = new Map((stRows || []).map((r: any) => [r.id, r.name]));
      const subMap = new Map((subRows || []).map((r: any) => [`${r.service_type_id}|${r.code}`, r.name]));
      setServices(
        list.map((s) => ({
          id: s.id,
          service_type_name: stMap.get(s.service_type) || s.service_type,
          sub_name: s.sub_type ? subMap.get(`${s.service_type}|${s.sub_type}`) || s.sub_type : null,
          status: s.status,
          rejection_reason: s.rejection_reason,
          exit_requested_at: s.exit_requested_at,
          exit_request_reason: s.exit_request_reason,
          exit_approved_at: s.exit_approved_at,
        }))
      );
    } else {
      setServices([]);
    }

    // Activity log for the user (visible whether contractor row exists or not)
    const { data: logRows } = await supabase
      .from('contractor_activity_log')
      .select('id,event_type,message,created_at,metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setActivity((logRows || []) as ActivityEntry[]);

    setLoading(false);
  }

  async function logSelfEvent(event_type: string, message: string, metadata: Record<string, any> = {}) {
    if (!self) return;
    try {
      await supabase.from('contractor_activity_log').insert({
        contractor_id: self.id,
        user_id: userId,
        event_type,
        message,
        performed_by: userId,
        metadata,
      } as any);
    } catch (e) {
      console.error('Failed to log contractor event:', e);
    }
  }

  async function toggleActive() {
    if (!self) return;
    // If currently inactive AND the deactivation was done by admin, contractor cannot self-reactivate.
    if (!self.is_active && self.deactivated_by_admin) {
      toast({
        title: 'فعال‌سازی نیازمند تأیید مدیریت است',
        description: 'پیمانکاری شما توسط مدیریت غیرفعال شده است. برای فعال‌سازی مجدد باید درخواست بفرستید.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    const willBeActive = !self.is_active;
    const updates: any = { is_active: willBeActive };
    if (!willBeActive) {
      // Self-deactivation by contractor
      updates.deactivated_by_admin = false;
      updates.reactivation_requested_at = null;
      updates.reactivation_request_reason = null;
    }
    const { error } = await supabase
      .from('contractors')
      .update(updates)
      .eq('id', self.id);
    setBusy(false);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      await logSelfEvent(
        willBeActive ? 'self_reactivated' : 'self_deactivated',
        willBeActive
          ? 'پیمانکار فعالیت خود را مجدداً فعال کرد.'
          : 'پیمانکار فعالیت خود را موقتاً غیرفعال کرد.'
      );
      toast({
        title: self.is_active ? 'فعالیت پیمانکاری شما موقتاً متوقف شد' : 'فعالیت پیمانکاری شما فعال شد',
      });
      void load();
    }
  }

  async function requestReactivation() {
    if (!self) return;
    const reason = window.prompt('در صورت تمایل، دلیل درخواست فعال‌سازی مجدد را بنویسید (اختیاری):', '') || '';
    setBusy(true);
    const { error } = await supabase
      .from('contractors')
      .update({
        reactivation_requested_at: new Date().toISOString(),
        reactivation_request_reason: reason || null,
      } as any)
      .eq('id', self.id);
    setBusy(false);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      await logSelfEvent(
        'reactivation_requested',
        'پیمانکار درخواست فعال‌سازی مجدد را به مدیریت ارسال کرد.',
        reason ? { reason } : {}
      );
      toast({
        title: 'درخواست فعال‌سازی ارسال شد',
        description: 'درخواست شما برای تأیید به مدیران اهرم ارسال شد.',
      });
      void load();
    }
  }

  async function cancelReactivationRequest() {
    if (!self) return;
    setBusy(true);
    const { error } = await supabase
      .from('contractors')
      .update({ reactivation_requested_at: null, reactivation_request_reason: null } as any)
      .eq('id', self.id);
    setBusy(false);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'درخواست فعال‌سازی لغو شد' });
      void load();
    }
  }

  async function submitExitRequest() {
    if (!self) return;
    setBusy(true);
    const { error } = await supabase
      .from('contractors')
      .update({
        exit_requested_at: new Date().toISOString(),
        exit_request_reason: exitReason || null,
      })
      .eq('id', self.id);
    setBusy(false);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'درخواست خروج از پیمانکاری ارسال شد',
        description: 'درخواست شما برای تأیید به مدیران اهرم ارسال شد.',
      });
      setExitOpen(false);
      setExitReason('');
      void load();
    }
  }

  async function cancelExitRequest() {
    if (!self) return;
    setBusy(true);
    const { error } = await supabase
      .from('contractors')
      .update({ exit_requested_at: null, exit_request_reason: null })
      .eq('id', self.id);
    setBusy(false);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'درخواست خروج لغو شد' });
      void load();
    }
  }

  async function submitServiceExitRequest() {
    if (!serviceExitTarget) return;
    setBusy(true);
    const { error } = await supabase.rpc('request_contractor_service_exit' as any, {
      _service_id: serviceExitTarget.id,
      _reason: serviceExitReason || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'درخواست خروج از این خدمت ارسال شد',
        description: 'پس از تأیید مدیریت، این خدمت از پیمانکاری شما حذف خواهد شد.',
      });
      setServiceExitTarget(null);
      setServiceExitReason('');
      void load();
    }
  }

  async function cancelServiceExitRequest(serviceId: string) {
    setBusy(true);
    const { error } = await supabase.rpc('cancel_contractor_service_exit' as any, { _service_id: serviceId });
    setBusy(false);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'درخواست خروج از خدمت لغو شد' });
      void load();
    }
  }

  function openEdit() {
    if (!self) return;
    const src = (self.pending_edits || {}) as any;
    setEditForm({
      company_name: src.company_name ?? self.company_name ?? '',
      contact_person: src.contact_person ?? self.contact_person ?? '',
      address: src.address ?? self.address ?? '',
      description: src.description ?? self.description ?? '',
      experience_years: String(src.experience_years ?? self.experience_years ?? ''),
    });
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!self) return;
    setBusy(true);
    const payload: any = {
      company_name: editForm.company_name.trim() || null,
      contact_person: editForm.contact_person.trim() || null,
      address: editForm.address.trim() || null,
      description: editForm.description.trim() || null,
      experience_years: editForm.experience_years ? Number(editForm.experience_years) : null,
    };
    const { error } = await supabase.rpc('submit_contractor_edit' as any, {
      _contractor_id: self.id,
      _edits: payload,
    });
    setBusy(false);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({
        title: 'ویرایش ارسال شد',
        description: 'تغییرات شما برای تأیید به مدیریت اهرم ارسال شد و پس از تأیید اعمال می‌شود.',
      });
      setEditOpen(false);
      void load();
    }
  }

  async function cancelPendingEdit() {
    if (!self) return;
    setBusy(true);
    const { error } = await supabase
      .from('contractors')
      .update({ pending_edits: null, pending_edits_at: null, pending_edits_by: null })
      .eq('id', self.id);
    setBusy(false);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'درخواست ویرایش لغو شد' });
      void load();
    }
  }


  if (loading) return null;
  if (!self && activity.length === 0) return null;

  const hasPendingExit = !!self?.exit_requested_at;
  const isFullyApproved = !!self?.is_approved && !!self?.has_contractor_role;
  const isRejected = !!self && !self.is_approved && !self.is_active;

  const eventBadge = (t: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      approved: { text: 'تأیید', cls: 'bg-green-100 text-green-700' },
      rejected: { text: 'رد', cls: 'bg-red-100 text-red-700' },
      deleted: { text: 'حذف کامل', cls: 'bg-red-100 text-red-700' },
      service_removed: { text: 'حذف خدمت', cls: 'bg-orange-100 text-orange-700' },
      deactivated: { text: 'غیرفعال‌سازی توسط مدیریت', cls: 'bg-gray-100 text-gray-700' },
      reactivated: { text: 'فعال‌سازی توسط مدیریت', cls: 'bg-blue-100 text-blue-700' },
      self_deactivated: { text: 'غیرفعال‌سازی خودکار', cls: 'bg-gray-100 text-gray-700' },
      self_reactivated: { text: 'فعال‌سازی خودکار', cls: 'bg-blue-100 text-blue-700' },
      reactivation_requested: { text: 'درخواست فعال‌سازی', cls: 'bg-orange-100 text-orange-700' },
      reactivation_rejected: { text: 'رد درخواست فعال‌سازی', cls: 'bg-red-100 text-red-700' },
      exit_approved: { text: 'تأیید خروج', cls: 'bg-red-100 text-red-700' },
      edit_submitted: { text: 'ارسال ویرایش', cls: 'bg-amber-100 text-amber-700' },
      edit_approved: { text: 'تأیید ویرایش', cls: 'bg-green-100 text-green-700' },
      edit_rejected: { text: 'رد ویرایش', cls: 'bg-red-100 text-red-700' },
    };
    return map[t] || { text: t, cls: 'bg-muted text-foreground' };
  };

  const pendingEdits = self?.pending_edits as any | null;
  const pendingEditFields = pendingEdits ? ([
    ['نام شرکت', self?.company_name, pendingEdits.company_name],
    ['نام تماس', self?.contact_person, pendingEdits.contact_person],
    ['آدرس', self?.address, pendingEdits.address],
    ['توضیحات', self?.description, pendingEdits.description],
    ['سابقه (سال)', self?.experience_years, pendingEdits.experience_years],
  ] as Array<[string, any, any]>).filter(([, oldV, newV]) => newV !== undefined && newV !== null && String(newV ?? '') !== String(oldV ?? '')) : [];


  const activityBlock = activity.length > 0 && (
    <div className="space-y-2 pt-2 border-t">
      <div className="text-xs font-semibold text-muted-foreground">تاریخچه تصمیمات مدیریت:</div>
      <div className="space-y-1.5 max-h-64 overflow-auto">
        {activity.map((a) => {
          const b = eventBadge(a.event_type);
          return (
            <div key={a.id} className="text-xs p-2 rounded border bg-muted/20 flex items-start gap-2">
              <Badge className={`${b.cls} shrink-0`}>{b.text}</Badge>
              <div className="flex-1">
                <div>{a.message}</div>
                {a.metadata?.reason && (
                  <div className="text-muted-foreground mt-0.5">دلیل: {a.metadata.reason}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(a.created_at).toLocaleString('fa-IR')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // If contractor record no longer exists but we have history, show only history
  if (!self) {
    return (
      <div className="space-y-3 pt-6 border-t">
        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <span>تاریخچه پیمانکاری</span>
        </h3>
        <Card><CardContent className="py-4">{activityBlock}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-6 border-t">
      <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
        <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
        <span>پنل پیمانکاری</span>
      </h3>

      <Tabs defaultValue="panel" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="panel" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            پروفایل و خدمات
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            سفارش‌های پیشنهادی
          </TabsTrigger>
        </TabsList>

        <TabsContent value="panel" className="mt-4">
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold text-sm">{self.company_name}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isFullyApproved ? (
                  <Badge className="bg-green-100 text-green-700">پیمانکار تأیید شده</Badge>
                ) : isRejected ? (
                  <Badge className="bg-red-100 text-red-700">درخواست پیمانکاری رد شده</Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">در انتظار تأیید مدیران</Badge>
                )}
                <Badge variant="outline" className={self.is_active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}>
                  {self.is_active ? 'فعال' : 'غیرفعال'}
                </Badge>
                {hasPendingExit && (
                  <Badge className="bg-orange-100 text-orange-700">
                    <Clock className="h-3 w-3 ml-1" />درخواست خروج در انتظار تأیید
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!isFullyApproved && !hasPendingExit && (
            <div className={`rounded-lg border p-3 flex items-start gap-2 ${isRejected ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
              <Clock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isRejected ? 'text-red-600' : 'text-yellow-600'}`} />
              <div className={`text-xs sm:text-sm leading-relaxed ${isRejected ? 'text-red-900' : 'text-yellow-900'}`}>
                <div className="font-semibold mb-1">
                  {isRejected ? 'درخواست پیمانکاری شما رد شده است' : 'درخواست پیمانکاری شما در دست بررسی است'}
                </div>
                <p>
                  {isRejected
                    ? 'در حال حاضر امکان فعالیت پیمانکاری برای شما فعال نیست. برای بررسی دوباره می‌توانید با مدیریت اهرم هماهنگ کنید.'
                    : 'تیم مدیریت اهرم در حال بررسی درخواست شماست. پس از تأیید، می‌توانید سفارش‌های ارجاع‌شده را در داشبورد پیمانکاری مشاهده و قبول کنید.'}
                </p>
              </div>
            </div>
          )}

          <div className="text-xs bg-muted/30 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {self.contact_person && (
              <div><span className="text-muted-foreground">نام تماس: </span>{self.contact_person}</div>
            )}
            {self.phone_number && (
              <div><span className="text-muted-foreground">شماره تماس: </span>{self.phone_number}</div>
            )}
            {self.email && (
              <div><span className="text-muted-foreground">ایمیل: </span>{self.email}</div>
            )}
            {self.experience_years !== null && self.experience_years !== undefined && (
              <div><span className="text-muted-foreground">سابقه کار: </span>{self.experience_years} سال</div>
            )}
            {self.address && (
              <div className="sm:col-span-2"><span className="text-muted-foreground">آدرس: </span>{self.address}</div>
            )}
            {self.description && (
              <div className="sm:col-span-2"><span className="text-muted-foreground">توضیحات: </span>{self.description}</div>
            )}
          </div>

          {(() => {
            const approvedSvc = services.filter(s => s.status === 'approved');
            const pendingSvc = services.filter(s => s.status === 'pending');
            const rejectedSvc = services.filter(s => s.status === 'rejected');
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">خدمات ثبت‌شده شما:</div>
                  <Button size="sm" variant="outline" onClick={() => setAddServiceOpen(true)} className="gap-1 h-7">
                    <Plus className="h-3.5 w-3.5" /> افزودن خدمت جدید
                  </Button>
                </div>

                {services.length === 0 && (
                  <div className="text-xs text-muted-foreground">هنوز خدمتی ثبت نشده است. با دکمهٔ بالا خدمت جدیدی اضافه کنید.</div>
                )}

                {approvedSvc.length > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-2.5 space-y-2">
                    <div className="text-[11px] font-semibold text-green-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> خدمات تأیید‌شده ({approvedSvc.length})
                    </div>
                    <div className="space-y-1.5">
                      {approvedSvc.map((s) => {
                        const hasPendingExit = !!s.exit_requested_at;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-2 flex-wrap rounded-md bg-white/70 border border-green-100 px-2 py-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="text-xs bg-green-100 text-green-800 border border-green-200">
                                {s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}
                              </Badge>
                              {hasPendingExit && (
                                <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-300">
                                  <Clock className="h-3 w-3 ml-1" /> درخواست خروج از این خدمت در انتظار تأیید
                                </Badge>
                              )}
                            </div>
                            {hasPendingExit ? (
                              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => cancelServiceExitRequest(s.id)}>
                                لغو درخواست خروج
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-red-700 border-red-200 hover:bg-red-50"
                                onClick={() => { setServiceExitTarget(s); setServiceExitReason(''); }}
                              >
                                <LogOut className="h-3 w-3 ml-1" /> درخواست خروج از این خدمت
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-green-800/80 leading-relaxed">
                      می‌توانید برای هر خدمت به‌صورت جداگانه درخواست خروج ثبت کنید بدون آنکه از سایر خدمات پیمانکاری خارج شوید.
                    </p>
                  </div>
                )}

                {pendingSvc.length > 0 && (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2.5 space-y-1.5">
                    <div className="text-[11px] font-semibold text-yellow-800 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> در انتظار تأیید مدیریت ({pendingSvc.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingSvc.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs bg-white text-yellow-800 border-yellow-300">
                          {s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-yellow-700 leading-relaxed">
                      این خدمات پس از تأیید مدیریت اهرم فعال می‌شوند و از آن پس سفارش‌های مربوطه به شما ارجاع داده می‌شود.
                    </p>
                  </div>
                )}

                {rejectedSvc.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-1.5">
                    <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> خدمات رد‌شده ({rejectedSvc.length})
                    </div>
                    <div className="space-y-1">
                      {rejectedSvc.map((s) => (
                        <div key={s.id} className="text-xs">
                          <Badge variant="outline" className="text-xs bg-white text-red-700 border-red-300">
                            {s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}
                          </Badge>
                          {s.rejection_reason && (
                            <span className="text-[11px] text-red-700 mr-2">دلیل: {s.rejection_reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {pendingEdits && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                <Clock className="h-4 w-4" />
                <span>ویرایش پروفایل شما در انتظار تأیید مدیریت است</span>
              </div>
              {pendingEditFields.length > 0 ? (
                <div className="space-y-1 text-xs">
                  {pendingEditFields.map(([label, oldV, newV]) => (
                    <div key={label as string} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-start">
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="line-through text-red-600 break-words">{String(oldV ?? '—')}</span>
                      <span className="text-green-700 font-medium break-words">{String(newV ?? '—')}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-[11px] text-amber-700">
                مقادیر جدید پس از تأیید مدیریت روی پروفایل شما اعمال می‌شود. فعلاً مقادیر قدیمی نمایش داده می‌شوند.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={openEdit} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" /> اصلاح مجدد
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={cancelPendingEdit}>
                  لغو درخواست ویرایش
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openEdit} className="gap-1">
              <Pencil className="h-3.5 w-3.5" />
              {pendingEdits ? 'اصلاح اطلاعات (ویرایش در انتظار)' : 'ویرایش اطلاعات پروفایل پیمانکاری'}
            </Button>
          </div>


          {!isFullyApproved && !hasPendingExit ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              تا زمان تأیید مدیریت، فقط وضعیت درخواست پیمانکاری شما نمایش داده می‌شود و امکان دریافت سفارش فعال نیست.
            </p>
          ) : hasPendingExit ? (
            <div className="space-y-2">
              <p className="text-xs text-orange-700 bg-orange-50 rounded p-2">
                درخواست خروج شما در تاریخ {new Date(self.exit_requested_at!).toLocaleDateString('fa-IR')} ارسال شد و در انتظار تأیید مدیران اهرم است.
              </p>
              <Button variant="outline" size="sm" disabled={busy} onClick={cancelExitRequest}>
                لغو درخواست خروج
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                می‌توانید فعالیت خود را موقتاً غیرفعال کنید تا سفارش جدیدی دریافت نکنید، یا درخواست خروج کامل از پیمانکاری را به مدیران اهرم ارسال کنید.
              </p>

              {!self.is_active && self.deactivated_by_admin && (
                <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 space-y-2 text-xs">
                  <div className="font-semibold text-red-800">
                    پیمانکاری شما توسط مدیریت غیرفعال شده است.
                  </div>
                  <p className="text-red-700 leading-relaxed">
                    شما اجازهٔ فعال‌سازی مستقیم را ندارید. برای فعال‌سازی مجدد می‌توانید درخواست خود را برای مدیریت ارسال کنید و پس از تأیید، پیمانکاری شما دوباره فعال خواهد شد.
                  </p>
                  {self.reactivation_requested_at ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-orange-800">
                        <Clock className="h-3.5 w-3.5" />
                        <span>درخواست فعال‌سازی شما در تاریخ {new Date(self.reactivation_requested_at).toLocaleString('fa-IR')} ارسال شد و در انتظار تأیید مدیریت است.</span>
                      </div>
                      {self.reactivation_request_reason && (
                        <div className="text-muted-foreground">دلیل: {self.reactivation_request_reason}</div>
                      )}
                      <Button variant="outline" size="sm" disabled={busy} onClick={cancelReactivationRequest} className="w-fit">
                        لغو درخواست فعال‌سازی
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={requestReactivation} className="gap-2 w-fit">
                      <Power className="h-4 w-4" />
                      ارسال درخواست فعال‌سازی به مدیریت
                    </Button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={self.is_active ? 'outline' : 'default'}
                  size="sm"
                  disabled={busy || (!self.is_active && self.deactivated_by_admin)}
                  onClick={toggleActive}
                  className="gap-2"
                  title={!self.is_active && self.deactivated_by_admin ? 'فعال‌سازی پس از غیرفعال‌سازی توسط مدیریت نیازمند تأیید است' : undefined}
                >
                  <Power className="h-4 w-4" />
                  {self.is_active ? 'غیرفعال‌سازی موقت' : 'فعال‌سازی مجدد'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setExitOpen(true)}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  درخواست خروج از پیمانکاری
                </Button>
              </div>
            </>
          )}
          {activityBlock}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          {isFullyApproved && self.is_active ? (
            <ContractorOrdersV3 contractorId={self.id} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {!isFullyApproved
                  ? 'پس از تأیید پیمانکاری توسط مدیریت اهرم، سفارش‌های پیشنهادی در این بخش نمایش داده می‌شود.'
                  : 'برای دریافت سفارش‌های جدید، ابتدا پیمانکاری خود را از تب «پروفایل و خدمات» فعال کنید.'}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>


      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>درخواست خروج از پیمانکاری</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            با ارسال این درخواست، مدیران اهرم آن را بررسی می‌کنند و در صورت تأیید، نقش پیمانکاری شما به کلی حذف خواهد شد.
          </p>
          <Label htmlFor="exit-reason">دلیل (اختیاری)</Label>
          <Textarea
            id="exit-reason"
            value={exitReason}
            onChange={(e) => setExitReason(e.target.value)}
            rows={3}
            placeholder="دلیل خروج خود را بنویسید..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>انصراف</Button>
            <Button variant="destructive" disabled={busy} onClick={submitExitRequest}>ارسال درخواست</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!serviceExitTarget} onOpenChange={(open) => { if (!open) { setServiceExitTarget(null); setServiceExitReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>درخواست خروج از خدمت</DialogTitle></DialogHeader>
          {serviceExitTarget && (
            <p className="text-sm text-muted-foreground">
              می‌خواهید از خدمت «{serviceExitTarget.service_type_name}{serviceExitTarget.sub_name ? ` · ${serviceExitTarget.sub_name}` : ''}» خارج شوید؟ سایر خدمات شما دست‌نخورده باقی می‌مانند و پس از تأیید مدیریت فقط همین خدمت از پیمانکاری شما حذف می‌شود.
            </p>
          )}
          <Label htmlFor="svc-exit-reason">دلیل (اختیاری)</Label>
          <Textarea
            id="svc-exit-reason"
            value={serviceExitReason}
            onChange={(e) => setServiceExitReason(e.target.value)}
            rows={3}
            placeholder="دلیل خروج از این خدمت را بنویسید..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setServiceExitTarget(null); setServiceExitReason(''); }}>انصراف</Button>
            <Button variant="destructive" disabled={busy} onClick={submitServiceExitRequest}>ارسال درخواست خروج</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ویرایش اطلاعات پروفایل پیمانکاری</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            تغییرات شما پس از تأیید مدیریت اعمال می‌شود. تا آن زمان مقادیر فعلی پروفایل تغییری نمی‌کند.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ce-company">نام شرکت / مجموعه</Label>
              <Input id="ce-company" value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="ce-contact">نام تماس</Label>
              <Input id="ce-contact" value={editForm.contact_person}
                onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="ce-exp">سابقه کار (سال)</Label>
              <Input id="ce-exp" type="number" min={0} max={80} value={editForm.experience_years}
                onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ce-addr">آدرس</Label>
              <Textarea id="ce-addr" rows={2} value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} maxLength={500} />
            </div>
            <div>
              <Label htmlFor="ce-desc">توضیحات</Label>
              <Textarea id="ce-desc" rows={3} value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} maxLength={1000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>انصراف</Button>
            <Button disabled={busy} onClick={submitEdit}>ارسال برای تأیید مدیریت</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>افزودن خدمت جدید به پیمانکاری</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            خدمت جدیدی که در اینجا اضافه می‌کنید پس از تأیید مدیریت اهرم فعال می‌شود و از آن پس سفارش‌های مربوطه به شما ارجاع خواهد شد.
          </p>
          <NewContractorForm
            userId={userId}
            userEmail={userEmail}
            onSuccess={() => {
              setAddServiceOpen(false);
              void load();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
