import { useEffect, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useContractorVerificationRequests } from '@/hooks/useContractorVerificationRequests';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useActivityTypes } from '@/hooks/useActivityTypes';
import { useRegions } from '@/hooks/useRegions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import ContractorV3AssignmentsInfo from '@/components/contractor/ContractorV3AssignmentsInfo';
import { Check, X, Clock, Power, Send, Briefcase, Search, Trash2, LogOut } from 'lucide-react';

interface ContractorService {
  id: string;
  contractor_id?: string;
  contractor_company_name?: string;
  service_type_name: string;
  sub_name: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'exited';
  rejection_reason: string | null;
  exit_requested_at: string | null;
  exit_request_reason: string | null;
}

interface ContractorRow {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  service_category_id: string | null;
  activity_type_id: string | null;
  region_id: string | null;
  exit_requested_at: string | null;
  exit_request_reason: string | null;
  has_contractor_role?: boolean;
  services?: ContractorService[];
  experience_years?: number | null;
  description?: string | null;
  address?: string | null;
  email?: string | null;
  pending_edits?: any | null;
  pending_edits_at?: string | null;
  deactivated_by_admin?: boolean;
  reactivation_requested_at?: string | null;
  reactivation_request_reason?: string | null;
  auto_assign_enabled?: boolean;
}

interface AssignmentRow {
  id: string;
  status: string;
  assigned_at: string;
  contractor_id: string;
  service_request_id: string;
  contractor?: { company_name: string; phone_number: string } | null;
  service_request?: { service_type: string; sub_type: string | null; location_address: string | null } | null;
}

const AUTO_ASSIGN_KEY = 'ahrom.contractors.autoAssign';

export default function ContractorsModule() {
  usePageTitle('مدیریت پیمانکاران');

  const {
    pendingRequests,
    rejectedRequests,
    loading: reqLoading,
    approveRequest,
    rejectRequest,
    refetch: refetchRequests,
  } = useContractorVerificationRequests();

  const { categories } = useServiceCategories();
  const { activityTypes } = useActivityTypes();
  const { provinces } = useRegions();

  const nameOf = (list: any[], id: string | null | undefined) =>
    (id && list.find((x) => x.id === id)?.name) || '—';

  const renderPendingEdits = (c: ContractorRow) => {
    if (!c.pending_edits) return null;
    const fields = ([
      ['نام شرکت', 'company_name', c.company_name, c.pending_edits?.company_name],
      ['نام تماس', 'contact_person', c.contact_person, c.pending_edits?.contact_person],
      ['آدرس', 'address', c.address, c.pending_edits?.address],
      ['توضیحات', 'description', c.description, c.pending_edits?.description],
      ['سابقه (سال)', 'experience_years', c.experience_years, c.pending_edits?.experience_years],
    ] as Array<[string, string, any, any]>).filter(([, , oldV, newV]) => newV !== undefined && newV !== null && String(newV ?? '') !== String(oldV ?? ''));
    if (!fields.length) return null;
    return (
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
          <Clock className="h-4 w-4" /> ویرایش پیشنهادی پیمانکار در انتظار تأیید
          {c.pending_edits_at && (
            <span className="text-[10px] text-amber-700 font-normal">
              ({new Date(c.pending_edits_at).toLocaleString('fa-IR')})
            </span>
          )}
        </div>
        <div className="space-y-1 text-xs">
          {fields.map(([label, , oldV, newV]) => (
            <div key={label as string} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-1 sm:gap-2 items-start">
              <span className="text-muted-foreground">{label}:</span>
              <span className="line-through text-red-600 break-words">{String(oldV ?? '—')}</span>
              <span className="text-green-700 font-medium break-words">{String(newV ?? '—')}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => approveContractorEdit(c)}>
            <Check className="h-3.5 w-3.5" /> تأیید ویرایش
          </Button>
          <Button size="sm" variant="destructive" className="gap-1" onClick={() => rejectContractorEdit(c)}>
            <X className="h-3.5 w-3.5" /> رد ویرایش
          </Button>
        </div>
      </div>
    );
  };

  const [contractors, setContractors] = useState<ContractorRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [historyLog, setHistoryLog] = useState<Array<{ id: string; contractor_id: string | null; user_id: string; event_type: string; message: string; created_at: string; metadata: any; contractor_name?: string; user_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoAssign, setAutoAssign] = useState(
    typeof window !== 'undefined' && localStorage.getItem(AUTO_ASSIGN_KEY) === 'true'
  );

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Dispatch dialog
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [pendingServiceRequests, setPendingServiceRequests] = useState<any[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTO_ASSIGN_KEY, autoAssign ? 'true' : 'false');
  }, [autoAssign]);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: cData }, { data: aData }, { data: srData }] = await Promise.all([
        supabase
          .from('contractors')
          .select('id,user_id,company_name,contact_person,phone_number,email,address,experience_years,description,is_approved,is_active,created_at,service_category_id,activity_type_id,region_id,exit_requested_at,exit_request_reason,pending_edits,pending_edits_at,deactivated_by_admin,reactivation_requested_at,reactivation_request_reason,auto_assign_enabled')
          .order('created_at', { ascending: false }),
        supabase
          .from('project_assignments')
          .select('id,status,assigned_at,contractor_id,service_request_id')
          .order('assigned_at', { ascending: false })
          .limit(100),
        supabase
          .from('service_requests')
          .select('id,service_type,sub_type,location_address,length,width,height,created_at,status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const contractorRows = ((cData as ContractorRow[]) || []);
      if (contractorRows.length) {
        const userIds = [...new Set(contractorRows.map((c) => c.user_id))];
        const cIds = contractorRows.map((c) => c.id);
        const [{ data: roleData }, { data: srvData }] = await Promise.all([
          supabase.from('user_roles').select('user_id,role').in('user_id', userIds).eq('role', 'contractor'),
          supabase.from('contractor_services').select('id,contractor_id,service_type,sub_type,status,rejection_reason,exit_requested_at,exit_request_reason').in('contractor_id', cIds),
        ]);
        const roleUserIds = new Set((roleData || []).map((r: any) => r.user_id));
        const allSrv = (srvData || []) as Array<{ id: string; contractor_id: string; service_type: string; sub_type: string | null; status: 'pending' | 'approved' | 'rejected' | 'exited'; rejection_reason: string | null; exit_requested_at: string | null; exit_request_reason: string | null }>;
        const stIds = [...new Set(allSrv.map((s) => s.service_type))];
        const subCodes = [...new Set(allSrv.map((s) => s.sub_type).filter(Boolean) as string[])];
        const [{ data: stRows }, { data: subRows }] = await Promise.all([
          supabase.from('service_types_v3').select('id,name').in('id', stIds.length ? stIds : ['00000000-0000-0000-0000-000000000000']),
          supabase.from('subcategories').select('code,name,service_type_id').in('code', subCodes.length ? subCodes : ['__none__']),
        ]);
        const stMap = new Map((stRows || []).map((r: any) => [r.id, r.name]));
        const subMap = new Map((subRows || []).map((r: any) => [`${r.service_type_id}|${r.code}`, r.name]));
        const cNameMap = new Map(contractorRows.map((c) => [c.id, c.company_name]));
        const srvByContractor = new Map<string, ContractorService[]>();
        allSrv.forEach((s) => {
          const list = srvByContractor.get(s.contractor_id) || [];
          list.push({
            id: s.id,
            contractor_id: s.contractor_id,
            contractor_company_name: cNameMap.get(s.contractor_id) || '',
            service_type_name: stMap.get(s.service_type) || s.service_type,
            sub_name: s.sub_type ? subMap.get(`${s.service_type}|${s.sub_type}`) || s.sub_type : null,
            status: s.status,
            rejection_reason: s.rejection_reason,
            exit_requested_at: s.exit_requested_at,
            exit_request_reason: s.exit_request_reason,
          });
          srvByContractor.set(s.contractor_id, list);
        });
        contractorRows.forEach((c) => {
          c.has_contractor_role = roleUserIds.has(c.user_id);
          c.services = srvByContractor.get(c.id) || [];
        });
      }
      setContractors(contractorRows);
      setPendingServiceRequests(srData || []);

      const aList = (aData || []) as AssignmentRow[];
      if (aList.length) {
        const cIds = [...new Set(aList.map((a) => a.contractor_id))];
        const sIds = [...new Set(aList.map((a) => a.service_request_id))];
        const [{ data: cInfo }, { data: sInfo }] = await Promise.all([
          supabase.from('contractors').select('id,company_name,phone_number').in('id', cIds),
          supabase.from('service_requests').select('id,service_type,sub_type,location_address').in('id', sIds),
        ]);
        const cMap = new Map((cInfo || []).map((c: any) => [c.id, c]));
        const sMap = new Map((sInfo || []).map((s: any) => [s.id, s]));
        aList.forEach((a) => {
          a.contractor = cMap.get(a.contractor_id) || null;
          a.service_request = sMap.get(a.service_request_id) || null;
        });
      }
      setAssignments(aList);

      // Load history of approve/reject events (contractor + services + exits)
      const historyEventTypes = [
        'approved', 'rejected',
        'service_approved', 'service_rejected',
        'service_exit_approved', 'service_exit_rejected',
        'reactivation_approved', 'reactivation_rejected',
      ];
      const { data: logData } = await supabase
        .from('contractor_activity_log')
        .select('id,contractor_id,user_id,event_type,message,created_at,metadata')
        .in('event_type', historyEventTypes)
        .order('created_at', { ascending: false })
        .limit(500);
      const logRows = (logData || []) as any[];
      if (logRows.length) {
        const hcIds = [...new Set(logRows.map((l) => l.contractor_id).filter(Boolean))] as string[];
        const huIds = [...new Set(logRows.map((l) => l.user_id).filter(Boolean))] as string[];
        const [{ data: hcData }, { data: hpData }] = await Promise.all([
          hcIds.length ? supabase.from('contractors').select('id,company_name').in('id', hcIds) : Promise.resolve({ data: [] as any[] }),
          huIds.length ? supabase.from('profiles').select('user_id,full_name,phone_number').in('user_id', huIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const hcMap = new Map((hcData || []).map((c: any) => [c.id, c.company_name]));
        const hpMap = new Map((hpData || []).map((p: any) => [p.user_id, p.full_name || p.phone_number]));
        logRows.forEach((l) => {
          l.contractor_name = hcMap.get(l.contractor_id) || null;
          l.user_name = hpMap.get(l.user_id) || null;
        });
      }
      setHistoryLog(logRows);
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'بارگذاری اطلاعات با مشکل مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function logContractorEvent(
    c: ContractorRow,
    event_type: string,
    message: string,
    metadata: Record<string, any> = {}
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('contractor_activity_log').insert({
        contractor_id: c.id,
        user_id: c.user_id,
        event_type,
        message,
        performed_by: user?.id || null,
        metadata,
      });
    } catch (e) {
      console.error('Failed to log contractor event:', e);
    }
  }

  async function approveContractorEdit(c: ContractorRow) {
    const { error } = await supabase.rpc('approve_contractor_edit' as any, { _contractor_id: c.id });
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'ویرایش اعمال شد', description: `اطلاعات پروفایل «${c.company_name}» به‌روزرسانی شد.` });
      void loadAll();
    }
  }

  async function rejectContractorEdit(c: ContractorRow) {
    const reason = prompt('دلیل رد ویرایش (اختیاری):', '') || '';
    const { error } = await supabase.rpc('reject_contractor_edit' as any, { _contractor_id: c.id, _reason: reason });
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'ویرایش رد شد' });
      void loadAll();
    }
  }


  async function toggleContractorActive(c: ContractorRow) {
    const willBeActive = !c.is_active;
    const updates: any = { is_active: willBeActive };
    if (willBeActive) {
      // Admin approves activation: clear admin-lock and any pending request
      updates.deactivated_by_admin = false;
      updates.reactivation_requested_at = null;
      updates.reactivation_request_reason = null;
    } else {
      // Admin deactivates: lock so contractor cannot self-reactivate
      updates.deactivated_by_admin = true;
      updates.reactivation_requested_at = null;
      updates.reactivation_request_reason = null;
    }
    const { error } = await supabase
      .from('contractors')
      .update(updates)
      .eq('id', c.id);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      const wasReactivationRequest = !!c.reactivation_requested_at && willBeActive;
      await logContractorEvent(
        c,
        willBeActive ? 'reactivated' : 'deactivated',
        willBeActive
          ? (wasReactivationRequest
              ? 'مدیریت درخواست فعال‌سازی مجدد شما را تأیید کرد و پیمانکاری شما فعال شد.'
              : 'مدیریت پیمانکاری شما را مجدداً فعال کرد.')
          : 'مدیریت پیمانکاری شما را موقتاً غیرفعال کرد. برای فعال‌سازی مجدد باید درخواست فعال‌سازی به مدیریت بفرستید.'
      );
      toast({ title: c.is_active ? 'پیمانکار غیرفعال شد' : 'پیمانکار فعال شد' });
      void loadAll();
    }
  }

  async function rejectReactivationRequest(c: ContractorRow) {
    const reason = prompt('دلیل رد درخواست فعال‌سازی (اختیاری):', '') || '';
    const { error } = await supabase
      .from('contractors')
      .update({ reactivation_requested_at: null, reactivation_request_reason: null } as any)
      .eq('id', c.id);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    } else {
      await logContractorEvent(
        c,
        'reactivation_rejected',
        'مدیریت درخواست فعال‌سازی مجدد شما را رد کرد. پیمانکاری شما همچنان غیرفعال است.',
        reason ? { reason } : {}
      );
      toast({ title: 'درخواست فعال‌سازی رد شد' });
      void loadAll();
    }
  }

  async function toggleAutoAssign(c: ContractorRow, value: boolean) {
    // Optimistic update
    setContractors((prev) => prev.map((x) => (x.id === c.id ? { ...x, auto_assign_enabled: value } : x)));
    const { error } = await supabase
      .from('contractors')
      .update({ auto_assign_enabled: value } as any)
      .eq('id', c.id);
    if (error) {
      toast({ title: 'خطا', description: error.message, variant: 'destructive' });
      // Revert
      setContractors((prev) => prev.map((x) => (x.id === c.id ? { ...x, auto_assign_enabled: !value } : x)));
    } else {
      toast({
        title: value
          ? `ارجاع خودکار سفارش به «${c.company_name}» فعال شد`
          : `ارجاع خودکار سفارش به «${c.company_name}» خاموش شد`,
        description: value
          ? 'سفارش‌های جدید منطبق به‌طور خودکار به این پیمانکار ارجاع می‌شوند.'
          : 'سفارش‌ها فقط در صورت انتخاب دستی مدیر به این پیمانکار ارسال خواهند شد.',
      });
    }
  }

  async function deleteContractorCompletely(c: ContractorRow) {
    if (!confirm(`با حذف کامل، نقش پیمانکار «${c.company_name}» و پروفایل پیمانکاری وی به طور کامل حذف می‌شود. ادامه می‌دهید؟`)) return;
    try {
      await logContractorEvent(
        c,
        'deleted',
        `پیمانکاری «${c.company_name}» توسط مدیریت به طور کامل حذف شد و نقش پیمانکاری شما برداشته شد.`
      );
      const { error } = await supabase.rpc('delete_contractor_completely', { _contractor_id: c.id });
      if (error) throw error;
      toast({ title: 'پیمانکار به طور کامل حذف شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'حذف انجام نشد', variant: 'destructive' });
    }
  }

  async function approveContractorDirect(c: ContractorRow) {
    try {
      const { error } = await supabase.rpc('approve_contractor', { _contractor_id: c.id });
      if (error) throw error;
      await logContractorEvent(
        c,
        'approved',
        `درخواست پیمانکاری «${c.company_name}» توسط مدیریت تأیید شد. اکنون می‌توانید سفارش‌های ارجاع‌شده را مشاهده کنید.`
      );
      toast({ title: 'پیمانکار تأیید شد', description: `${c.company_name} اکنون فعال است.` });
      void refetchRequests();
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'تأیید انجام نشد', variant: 'destructive' });
    }
  }

  async function rejectContractorDirect(c: ContractorRow) {
    const reason = prompt(`دلیل رد درخواست «${c.company_name}» را وارد کنید:`, 'رد شده توسط مدیریت');
    if (reason === null) return;
    const trimmed = reason.trim() || 'رد شده توسط مدیریت';
    try {
      const { error } = await supabase.rpc('reject_contractor', {
        _contractor_id: c.id,
        _reason: trimmed,
      });
      if (error) throw error;
      await logContractorEvent(
        c,
        'rejected',
        `درخواست پیمانکاری «${c.company_name}» توسط مدیریت رد شد.`,
        { reason: trimmed }
      );
      toast({ title: 'درخواست پیمانکار رد شد' });
      void refetchRequests();
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انجام نشد', variant: 'destructive' });
    }
  }

  async function removeContractorService(c: ContractorRow, service: ContractorService, _index?: number) {
    const label = `${service.service_type_name}${service.sub_name ? ' · ' + service.sub_name : ''}`;
    if (!confirm(`خدمت «${label}» از پیمانکار «${c.company_name}» حذف شود؟`)) return;
    try {
      const { error } = await supabase
        .from('contractor_services')
        .delete()
        .eq('id', service.id);
      if (error) throw error;
      await logContractorEvent(
        c,
        'service_removed',
        `خدمت «${label}» از پیمانکاری شما توسط مدیریت حذف شد.`,
        { service: label }
      );
      toast({ title: 'خدمت حذف شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'حذف خدمت انجام نشد', variant: 'destructive' });
    }
  }

  async function approveContractorService(c: ContractorRow, service: ContractorService) {
    const label = `${service.service_type_name}${service.sub_name ? ' · ' + service.sub_name : ''}`;
    try {
      const { data, error } = await supabase.rpc('approve_contractor_service' as any, { _service_id: service.id });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error || 'انجام نشد');
      await logContractorEvent(c, 'service_approved' as any, `خدمت «${label}» توسط مدیریت تأیید شد.`, { service: label });
      toast({ title: 'خدمت تأیید شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'تأیید انجام نشد', variant: 'destructive' });
    }
  }

  async function rejectContractorService(c: ContractorRow, service: ContractorService) {
    const label = `${service.service_type_name}${service.sub_name ? ' · ' + service.sub_name : ''}`;
    const reason = prompt(`دلیل رد خدمت «${label}» را وارد کنید:`, 'رد شده توسط مدیریت');
    if (reason === null) return;
    try {
      const { data, error } = await supabase.rpc('reject_contractor_service' as any, { _service_id: service.id, _reason: reason.trim() || 'رد شده توسط مدیریت' });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error || 'انجام نشد');
      await logContractorEvent(c, 'service_rejected' as any, `خدمت «${label}» توسط مدیریت رد شد.`, { service: label, reason });
      toast({ title: 'خدمت رد شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انجام نشد', variant: 'destructive' });
    }
  }

  async function approveExitRequest(c: ContractorRow) {
    if (!confirm(`با تأیید درخواست خروج، کاربر «${c.company_name}» به کلی از پیمانکاری خارج می‌شود. تأیید می‌کنید؟`)) return;
    try {
      await logContractorEvent(
        c,
        'exit_approved',
        `درخواست خروج شما از پیمانکاری توسط مدیریت تأیید شد و نقش پیمانکاری شما حذف گردید.`
      );
      const { error } = await supabase.rpc('delete_contractor_completely', { _contractor_id: c.id });
      if (error) throw error;
      toast({ title: 'درخواست خروج تأیید شد', description: 'کاربر از پیمانکاری مجموعه خارج شد.' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انجام نشد', variant: 'destructive' });
    }
  }

  async function rejectExitRequest(c: ContractorRow) {
    const { error } = await supabase
      .from('contractors')
      .update({ exit_requested_at: null, exit_request_reason: null })
      .eq('id', c.id);
    if (error) toast({ title: 'خطا', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'درخواست خروج رد شد' });
      void loadAll();
    }
  }

  async function approveServiceExit(c: ContractorRow, service: ContractorService) {
    const label = `${service.service_type_name}${service.sub_name ? ' · ' + service.sub_name : ''}`;
    if (!confirm(`با تأیید، خدمت «${label}» از پیمانکاری «${c.company_name}» حذف می‌شود اما بقیهٔ خدمات او فعال می‌ماند. تأیید می‌کنید؟`)) return;
    try {
      const { error } = await supabase.rpc('approve_contractor_service_exit' as any, { _service_id: service.id });
      if (error) throw error;
      await logContractorEvent(c, 'service_exit_approved' as any, `درخواست خروج شما از خدمت «${label}» تأیید شد و این خدمت از پیمانکاری شما حذف گردید.`, { service: label });
      toast({ title: 'درخواست خروج از خدمت تأیید شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انجام نشد', variant: 'destructive' });
    }
  }

  async function rejectServiceExit(c: ContractorRow, service: ContractorService) {
    const label = `${service.service_type_name}${service.sub_name ? ' · ' + service.sub_name : ''}`;
    const reason = prompt(`دلیل رد درخواست خروج از خدمت «${label}» (اختیاری):`, '');
    if (reason === null) return;
    try {
      const { error } = await supabase.rpc('reject_contractor_service_exit' as any, { _service_id: service.id, _reason: reason.trim() || null });
      if (error) throw error;
      await logContractorEvent(c, 'service_exit_rejected' as any, `درخواست خروج شما از خدمت «${label}» توسط مدیریت رد شد.`, { service: label, reason });
      toast({ title: 'درخواست خروج از خدمت رد شد' });
      void loadAll();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'انجام نشد', variant: 'destructive' });
    }
  }

  async function handleApprove(r: any) {
    if (!confirm('با تأیید این درخواست، کاربر به عنوان پیمانکار رسمی ثبت می‌شود. ادامه می‌دهید؟')) return;
    try {
      // 1) approve request
      const res = await approveRequest(r.id);
      if (!res.success) return;

      // 2) upsert contractors row
      const { data: existing } = await supabase
        .from('contractors')
        .select('id')
        .eq('user_id', r.user_id)
        .maybeSingle();

      const payload = {
        user_id: r.user_id,
        company_name: r.company_name,
        contact_person: r.profiles?.full_name || r.company_name,
        phone_number: r.phone_number,
        is_approved: true,
        is_active: true,
        service_category_id: r.service_category_id,
        activity_type_id: r.activity_type_id,
        region_id: r.region_id,
        email: `phone-${r.phone_number}@ahrom.example.com`,
      };

      let contractorId = existing?.id;
      if (contractorId) {
        await supabase.from('contractors').update(payload).eq('id', contractorId);
      } else {
        const { data: created, error: createError } = await supabase
          .from('contractors')
          .insert(payload)
          .select('id')
          .single();
        if (createError) throw createError;
        contractorId = created.id;
      }

      // 3) approve contractor and assign role through secure management RPC
      const { error: approveError } = await supabase.rpc('approve_contractor', { _contractor_id: contractorId });
      if (approveError) throw approveError;

      // 4) log for the contractor user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('contractor_activity_log').insert({
          contractor_id: contractorId,
          user_id: r.user_id,
          event_type: 'approved',
          message: `درخواست پیمانکاری «${r.company_name}» توسط مدیریت تأیید شد.`,
          performed_by: user?.id || null,
        });
      } catch (e) { console.error(e); }

      toast({ title: 'پیمانکار با موفقیت تأیید و فعال شد' });
      void loadAll();
      void refetchRequests();
    } catch (e: any) {
      toast({ title: 'خطا', description: e.message || 'تأیید کامل نشد', variant: 'destructive' });
    }
  }

  function openReject(req: any) {
    setRejectTarget(req);
    setRejectReason('');
    setRejectOpen(true);
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    const res = await rejectRequest(rejectTarget.id, rejectReason);
    if (res.success) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('contractor_activity_log').insert({
          contractor_id: null,
          user_id: rejectTarget.user_id,
          event_type: 'rejected',
          message: `درخواست پیمانکاری «${rejectTarget.company_name}» توسط مدیریت رد شد.`,
          performed_by: user?.id || null,
          metadata: { reason: rejectReason },
        });
      } catch (e) { console.error(e); }
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason('');
    }
  }

  function openDispatch() {
    setSelectedRequestId('');
    setSelectedContractorIds([]);
    setDispatchOpen(true);
  }

  async function dispatchOrder() {
    if (!selectedRequestId || selectedContractorIds.length === 0) {
      toast({ title: 'لطفاً سفارش و حداقل یک پیمانکار را انتخاب کنید', variant: 'destructive' });
      return;
    }
    const rows = selectedContractorIds.map((cid) => ({
      service_request_id: selectedRequestId,
      contractor_id: cid,
      status: 'pending',
    }));
    const { error } = await supabase.from('project_assignments').insert(rows);
    if (error) {
      toast({ title: 'خطا در ارسال', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'سفارش با موفقیت ارسال شد', description: `به ${rows.length} پیمانکار ارسال شد` });
    setDispatchOpen(false);
    void loadAll();
  }

  const isFullyApprovedContractor = (c: ContractorRow) => c.is_approved && !!c.has_contractor_role;
  const pendingContractorRows = contractors.filter((c) => !c.exit_requested_at && !isFullyApprovedContractor(c) && c.is_active);
  const rejectedContractorRows = contractors.filter((c) => !c.exit_requested_at && !isFullyApprovedContractor(c) && !c.is_active);

  const filteredContractors = contractors.filter((c) => {
    if (c.exit_requested_at) return false; // moved to exit tab
    if (!isFullyApprovedContractor(c)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(s) ||
      c.contact_person?.toLowerCase().includes(s) ||
      c.phone_number?.includes(s)
    );
  });

  const exitRequests = contractors.filter((c) => !!c.exit_requested_at);
  const pendingServiceExits: Array<{ contractor: ContractorRow; service: ContractorService }> = [];
  contractors.forEach((c) => {
    (c.services || []).forEach((s) => {
      if (s.exit_requested_at && s.status === 'approved') {
        pendingServiceExits.push({ contractor: c, service: s });
      }
    });
  });

  const statusLabel: Record<string, { text: string; cls: string }> = {
    pending: { text: 'در انتظار', cls: 'bg-yellow-100 text-yellow-700' },
    accepted: { text: 'پذیرفته شده', cls: 'bg-blue-100 text-blue-700' },
    rejected: { text: 'رد شده', cls: 'bg-red-100 text-red-700' },
    cancelled: { text: 'لغو شده', cls: 'bg-gray-100 text-gray-600' },
    completed: { text: 'تکمیل شده', cls: 'bg-green-100 text-green-700' },
    in_progress: { text: 'در حال اجرا', cls: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            مدیریت پیمانکاران
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            تأیید، نظارت، فعال/غیرفعال‌سازی پیمانکاران و ارسال سفارش به آن‌ها
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted/30 border rounded-lg px-3 py-2">
          <Switch id="auto-assign" checked={autoAssign} onCheckedChange={setAutoAssign} />
          <Label htmlFor="auto-assign" className="cursor-pointer text-sm">
            ارجاع خودکار سفارش‌های جدید به پیمانکاران منطبق
          </Label>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="pending">در انتظار تأیید ({pendingRequests.length + pendingContractorRows.length})</TabsTrigger>
          <TabsTrigger value="active">پیمانکاران ({filteredContractors.length})</TabsTrigger>
          <TabsTrigger value="exits">درخواست خروج ({exitRequests.length + pendingServiceExits.length})</TabsTrigger>
          <TabsTrigger value="assignments">ارسال‌ها ({assignments.length})</TabsTrigger>
          <TabsTrigger value="rejected">رد شده ({rejectedRequests.length + rejectedContractorRows.length})</TabsTrigger>
          <TabsTrigger value="history">تاریخچه ({historyLog.length})</TabsTrigger>
        </TabsList>

        {/* ============ Pending verification ============ */}
        <TabsContent value="pending" className="space-y-3">
          {reqLoading || loading ? (
            <p className="text-center text-muted-foreground py-8">در حال بارگذاری...</p>
          ) : pendingRequests.length === 0 && pendingContractorRows.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">درخواست جدیدی وجود ندارد</CardContent></Card>
          ) : (
            <>
            {pendingRequests.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.company_name}</CardTitle>
                    <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 ml-1" />در انتظار</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/30 rounded-lg p-3">
                    <div><span className="text-muted-foreground">نام کاربر: </span>{r.profiles?.full_name || '—'}</div>
                    <div><span className="text-muted-foreground">شماره: </span><span className="direction-ltr inline-block">{r.phone_number}</span></div>
                    <div><span className="text-muted-foreground">دسته خدمات: </span>{nameOf(categories as any, r.service_category_id)}</div>
                    <div><span className="text-muted-foreground">نوع فعالیت: </span>{nameOf(activityTypes as any, r.activity_type_id)}</div>
                    <div><span className="text-muted-foreground">استان: </span>{nameOf(provinces as any, r.region_id)}</div>
                    <div><span className="text-muted-foreground">تاریخ ثبت: </span>{new Date(r.created_at).toLocaleDateString('fa-IR')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleApprove(r)} className="flex-1 gap-2"><Check className="h-4 w-4" />تأیید پیمانکار</Button>
                    <Button onClick={() => openReject(r)} variant="destructive" className="flex-1 gap-2"><X className="h-4 w-4" />رد درخواست</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {pendingContractorRows.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{c.company_name}</CardTitle>
                    <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 ml-1" />در انتظار تأیید</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/30 rounded-lg p-3">
                    <div><span className="text-muted-foreground">نام کاربر: </span>{c.contact_person || '—'}</div>
                    <div><span className="text-muted-foreground">شماره: </span><span className="direction-ltr inline-block">{c.phone_number}</span></div>
                    <div><span className="text-muted-foreground">ایمیل: </span><span className="direction-ltr inline-block">{c.email || '—'}</span></div>
                    <div><span className="text-muted-foreground">سابقه کار: </span>{c.experience_years ? `${c.experience_years} سال` : '—'}</div>
                    <div><span className="text-muted-foreground">دسته خدمات: </span>{nameOf(categories as any, c.service_category_id)}</div>
                    <div><span className="text-muted-foreground">نوع فعالیت: </span>{nameOf(activityTypes as any, c.activity_type_id)}</div>
                    <div><span className="text-muted-foreground">استان: </span>{nameOf(provinces as any, c.region_id)}</div>
                    <div><span className="text-muted-foreground">تاریخ ثبت: </span>{new Date(c.created_at).toLocaleDateString('fa-IR')}</div>
                    {c.address && <div className="sm:col-span-2"><span className="text-muted-foreground">آدرس: </span>{c.address}</div>}
                    {c.description && <div className="sm:col-span-2"><span className="text-muted-foreground">توضیحات: </span>{c.description}</div>}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">خدمات پیمانکاری درخواست‌شده:</div>
                    {c.services && c.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {c.services.map((s) => {
                          const cls = s.status === 'approved'
                            ? (s.exit_requested_at ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-green-100 text-green-800 border-green-300')
                            : s.status === 'rejected'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : s.status === 'exited'
                                ? 'bg-gray-100 text-gray-600 border-gray-300 line-through'
                                : 'bg-yellow-100 text-yellow-800 border-yellow-300';
                          const label = s.status === 'approved'
                            ? (s.exit_requested_at ? 'درخواست خروج' : 'تأیید‌شده')
                            : s.status === 'rejected' ? 'رد‌شده'
                            : s.status === 'exited' ? 'خارج‌شده'
                            : 'در انتظار تأیید';
                          return (
                            <Badge key={s.id} variant="outline" className={`text-xs gap-1 pr-1 ${cls}`} title={s.rejection_reason || s.exit_request_reason || undefined}>
                              <span>{s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}</span>
                              <span className="text-[10px] opacity-75">· {label}</span>
                              {s.status === 'pending' && (
                                <>
                                  <button type="button" onClick={() => approveContractorService(c, s)} className="hover:bg-green-200 rounded p-0.5" title="تأیید این خدمت">
                                    <Check className="h-3 w-3 text-green-700" />
                                  </button>
                                  <button type="button" onClick={() => rejectContractorService(c, s)} className="hover:bg-red-200 rounded p-0.5" title="رد این خدمت">
                                    <X className="h-3 w-3 text-red-700" />
                                  </button>
                                </>
                              )}
                              {s.status === 'approved' && s.exit_requested_at && (
                                <>
                                  <button type="button" onClick={() => approveServiceExit(c, s)} className="hover:bg-orange-200 rounded p-0.5" title="تأیید خروج از این خدمت">
                                    <Check className="h-3 w-3 text-orange-700" />
                                  </button>
                                  <button type="button" onClick={() => rejectServiceExit(c, s)} className="hover:bg-red-200 rounded p-0.5" title="رد درخواست خروج">
                                    <X className="h-3 w-3 text-red-700" />
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => removeContractorService(c, s, 0)} className="hover:bg-destructive/20 rounded p-0.5" title="حذف این خدمت">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">هیچ خدمتی ثبت نشده است</div>
                    )}
                  </div>
                  {renderPendingEdits(c)}
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => approveContractorDirect(c)} className="flex-1 gap-2"><Check className="h-4 w-4" />تأیید پیمانکار</Button>
                    <Button onClick={() => rejectContractorDirect(c)} variant="destructive" className="flex-1 gap-2"><X className="h-4 w-4" />رد درخواست</Button>
                    <Button onClick={() => deleteContractorCompletely(c)} variant="outline" className="gap-2"><Trash2 className="h-4 w-4" />حذف کامل</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
          )}
        </TabsContent>

        {/* ============ Active contractors ============ */}
        <TabsContent value="active" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس نام شرکت، نام تماس یا شماره..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button onClick={openDispatch} className="gap-2"><Send className="h-4 w-4" />ارسال سفارش به پیمانکاران</Button>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">در حال بارگذاری...</p>
          ) : filteredContractors.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">پیمانکاری یافت نشد</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredContractors.map((c) => {
                const isFullyApproved = c.is_approved && c.has_contractor_role;
                const isRejected = !c.is_approved && !c.is_active;
                return (
                <Card key={c.id} className={!c.is_active ? 'opacity-70' : ''}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{c.company_name}</span>
                          {isFullyApproved ? (
                            <Badge className="bg-green-100 text-green-700">تأییدشده</Badge>
                          ) : isRejected ? (
                            <Badge className="bg-red-100 text-red-700">رد شده</Badge>
                          ) : c.is_approved ? (
                            <Badge className="bg-yellow-100 text-yellow-700">نیازمند تکمیل تأیید</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">در انتظار تأیید</Badge>
                          )}
                          {!c.is_active && <Badge variant="outline" className="bg-gray-100">غیرفعال{c.deactivated_by_admin ? ' (توسط مدیریت)' : ' (توسط خود پیمانکار)'}</Badge>}
                          {c.reactivation_requested_at && (
                            <Badge className="bg-orange-100 text-orange-700">
                              <Clock className="h-3 w-3 ml-1" />درخواست فعال‌سازی در انتظار تأیید
                            </Badge>
                          )}
                          {isFullyApproved && c.is_active && (
                            <div className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${c.auto_assign_enabled ? 'border-green-300 bg-green-50 text-green-800' : 'border-border bg-muted/40 text-muted-foreground'}`}>
                              <Switch
                                id={`auto-${c.id}`}
                                checked={!!c.auto_assign_enabled}
                                onCheckedChange={(v) => toggleAutoAssign(c, v)}
                                className="scale-75"
                              />
                              <Label htmlFor={`auto-${c.id}`} className="cursor-pointer text-[11px]">
                                ارجاع خودکار سفارش {c.auto_assign_enabled ? '(فعال)' : '(دستی)'}
                              </Label>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {c.contact_person} · <span className="direction-ltr inline-block">{c.phone_number}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {nameOf(categories as any, c.service_category_id)} · {nameOf(activityTypes as any, c.activity_type_id)} · {nameOf(provinces as any, c.region_id)}
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs bg-muted/30 rounded p-2">
                          <div><span className="text-muted-foreground">ایمیل: </span><span className="direction-ltr inline-block">{c.email || '—'}</span></div>
                          <div><span className="text-muted-foreground">سابقه کار: </span>{c.experience_years ? `${c.experience_years} سال` : '—'}</div>
                          {c.address && <div className="sm:col-span-2"><span className="text-muted-foreground">آدرس: </span>{c.address}</div>}
                          {c.description && <div className="sm:col-span-2"><span className="text-muted-foreground">توضیحات: </span>{c.description}</div>}
                          <div className="sm:col-span-2"><span className="text-muted-foreground">تاریخ ثبت: </span>{new Date(c.created_at).toLocaleDateString('fa-IR')}</div>
                        </div>
                        {c.services && c.services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.services.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                                <span>{s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}</span>
                                <button
                                  type="button"
                                  onClick={() => removeContractorService(c, s, i)}
                                  className="hover:bg-destructive/20 rounded p-0.5"
                                  title="حذف این خدمت"
                                >
                                  <X className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {!isFullyApproved && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveContractorDirect(c)}
                              className="gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                              تأیید پیمانکار
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectContractorDirect(c)}
                              className="gap-1"
                            >
                              <X className="h-3.5 w-3.5" />
                              رد درخواست
                            </Button>
                          </>
                        )}
                        {isFullyApproved && (
                          <Button
                            size="sm"
                            variant={c.is_active ? 'outline' : 'default'}
                            onClick={() => toggleContractorActive(c)}
                            className={`gap-1 ${!c.is_active && c.reactivation_requested_at ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {c.is_active
                              ? 'غیرفعال‌سازی'
                              : c.reactivation_requested_at
                                ? 'تأیید فعال‌سازی'
                                : 'فعال‌سازی'}
                          </Button>
                        )}
                        {isFullyApproved && !c.is_active && c.reactivation_requested_at && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectReactivationRequest(c)}
                            className="gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            رد درخواست فعال‌سازی
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteContractorCompletely(c)}
                          className="gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف کامل
                        </Button>
                      </div>
                    </div>
                    <ContractorV3AssignmentsInfo contractorId={c.id} />
                    {renderPendingEdits(c)}
                    {c.reactivation_requested_at && (
                      <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-orange-800 text-sm font-semibold">
                          <Clock className="h-4 w-4" /> درخواست فعال‌سازی مجدد از سوی پیمانکار
                          <span className="text-[10px] text-orange-700 font-normal">
                            ({new Date(c.reactivation_requested_at).toLocaleString('fa-IR')})
                          </span>
                        </div>
                        {c.reactivation_request_reason && (
                          <div className="text-xs text-orange-900">دلیل: {c.reactivation_request_reason}</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============ Exit requests ============ */}
        <TabsContent value="exits" className="space-y-4">
          {/* Per-service exit requests */}
          {pendingServiceExits.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                <LogOut className="h-4 w-4" /> درخواست خروج از یک خدمت خاص ({pendingServiceExits.length})
              </h3>
              {pendingServiceExits.map(({ contractor: c, service: s }) => (
                <Card key={s.id} className="border-orange-200">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm">
                        <span className="font-semibold">{c.company_name}</span>
                        <span className="text-muted-foreground mx-2">·</span>
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-800 border-orange-300">
                          خدمت: {s.service_type_name}{s.sub_name ? ` · ${s.sub_name}` : ''}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.exit_requested_at ? new Date(s.exit_requested_at).toLocaleString('fa-IR') : ''}
                      </div>
                    </div>
                    {s.exit_request_reason && (
                      <div className="text-xs bg-orange-50 border border-orange-200 rounded p-2">
                        دلیل: {s.exit_request_reason}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => approveServiceExit(c, s)}>
                        <Check className="h-4 w-4" /> تأیید خروج از این خدمت
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => rejectServiceExit(c, s)}>
                        <X className="h-4 w-4" /> رد درخواست
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Full contractor exit requests */}
          {exitRequests.length === 0 && pendingServiceExits.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">درخواست خروجی ثبت نشده است</CardContent></Card>
          ) : exitRequests.length > 0 && (
            exitRequests.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LogOut className="h-4 w-4 text-destructive" />
                      {c.company_name}
                    </CardTitle>
                    <Badge className="bg-orange-100 text-orange-700">در انتظار تأیید خروج</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div>{c.contact_person} · <span className="direction-ltr inline-block">{c.phone_number}</span></div>
                    <div className="text-xs text-muted-foreground">
                      تاریخ درخواست: {c.exit_requested_at ? new Date(c.exit_requested_at).toLocaleDateString('fa-IR') : '—'}
                    </div>
                    {c.exit_request_reason && (
                      <div className="p-2 bg-orange-50 rounded text-orange-900 text-xs">
                        دلیل: {c.exit_request_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => approveExitRequest(c)} variant="destructive" className="flex-1 gap-2">
                      <Check className="h-4 w-4" />تأیید خروج (حذف کامل)
                    </Button>
                    <Button onClick={() => rejectExitRequest(c)} variant="outline" className="flex-1 gap-2">
                      <X className="h-4 w-4" />رد درخواست خروج
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ============ Assignments ============ */}
        <TabsContent value="assignments" className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">در حال بارگذاری...</p>
          ) : assignments.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">هنوز سفارشی ارسال نشده است</CardContent></Card>
          ) : (
            assignments.map((a) => {
              const st = statusLabel[a.status] || { text: a.status, cls: 'bg-gray-100 text-gray-700' };
              return (
                <Card key={a.id}>
                  <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium text-sm">
                        {a.contractor?.company_name || '—'}
                        <span className="text-muted-foreground mx-1">←</span>
                        {a.service_request?.service_type === 'scaffolding' ? 'داربست' : a.service_request?.service_type || 'سفارش'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.service_request?.location_address || 'بدون آدرس'} · {new Date(a.assigned_at).toLocaleDateString('fa-IR')}
                      </div>
                    </div>
                    <Badge className={st.cls}>{st.text}</Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ============ Rejected ============ */}
        <TabsContent value="rejected" className="space-y-3">
          {rejectedRequests.length === 0 && rejectedContractorRows.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">درخواست رد شده‌ای وجود ندارد</CardContent></Card>
          ) : (
            <>
            {rejectedRequests.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.company_name}</CardTitle>
                    <Badge className="bg-red-100 text-red-700"><X className="h-3 w-3 ml-1" />رد شده</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="text-muted-foreground">شماره: <span className="direction-ltr inline-block">{r.phone_number}</span></div>
                  {r.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-red-800 text-xs">
                      دلیل: {r.rejection_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {rejectedContractorRows.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{c.company_name}</CardTitle>
                    <Badge className="bg-red-100 text-red-700"><X className="h-3 w-3 ml-1" />رد شده</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-muted-foreground">
                    {c.contact_person} · شماره: <span className="direction-ltr inline-block">{c.phone_number}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => approveContractorDirect(c)} size="sm" className="gap-2"><Check className="h-4 w-4" />تأیید مجدد</Button>
                    <Button onClick={() => deleteContractorCompletely(c)} size="sm" variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" />حذف کامل</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
          )}
        </TabsContent>
        {/* ============ History ============ */}
        <TabsContent value="history" className="space-y-2">
          {historyLog.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">تاریخچه‌ای ثبت نشده است</CardContent></Card>
          ) : (
            historyLog.map((h) => {
              const isApprove = h.event_type.endsWith('approved');
              const cls = isApprove ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
              const label: Record<string, string> = {
                approved: 'تأیید پیمانکار',
                rejected: 'رد پیمانکار',
                service_approved: 'تأیید خدمت',
                service_rejected: 'رد خدمت',
                service_exit_approved: 'تأیید خروج از خدمت',
                service_exit_rejected: 'رد خروج از خدمت',
                reactivation_approved: 'تأیید فعال‌سازی مجدد',
                reactivation_rejected: 'رد فعال‌سازی مجدد',
              };
              return (
                <Card key={h.id}>
                  <CardContent className="py-3 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cls}>{label[h.event_type] || h.event_type}</Badge>
                        <span className="font-medium">{h.contractor_name || h.user_name || '—'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">{h.message}</div>
                    {h.metadata?.reason && (
                      <div className="text-xs text-red-700 bg-red-50 rounded p-1.5">دلیل: {h.metadata.reason}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>رد درخواست پیمانکاری</DialogTitle></DialogHeader>
          <Label htmlFor="reason">دلیل رد</Label>
          <Textarea id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="دلیل را وارد کنید..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>انصراف</Button>
            <Button variant="destructive" onClick={submitReject} disabled={!rejectReason.trim()}>تأیید رد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ارسال سفارش به پیمانکاران</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>انتخاب سفارش</Label>
              <Select value={selectedRequestId} onValueChange={setSelectedRequestId}>
                <SelectTrigger><SelectValue placeholder="یک سفارش در انتظار را انتخاب کنید..." /></SelectTrigger>
                <SelectContent>
                  {pendingServiceRequests.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">سفارشی در وضعیت در انتظار یافت نشد</div>
                  )}
                  {pendingServiceRequests.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.service_type === 'scaffolding' ? 'داربست' : s.service_type} · {s.location_address || 'بدون آدرس'} · {new Date(s.created_at).toLocaleDateString('fa-IR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>انتخاب پیمانکاران (پیمانکاران فعال)</Label>
              <div className="border rounded-lg max-h-60 overflow-auto divide-y">
                {contractors.filter((c) => c.is_active && c.is_approved && !c.exit_requested_at).map((c) => {
                  const checked = selectedContractorIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedContractorIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          );
                        }}
                      />
                      <span className="text-sm">{c.company_name}</span>
                      <span className="text-xs text-muted-foreground direction-ltr">{c.phone_number}</span>
                    </label>
                  );
                })}
                {contractors.filter((c) => c.is_active && c.is_approved && !c.exit_requested_at).length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground text-center">پیمانکار فعالی وجود ندارد</div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedContractorIds(contractors.filter((c) => c.is_active && c.is_approved && !c.exit_requested_at).map((c) => c.id))}>
                  انتخاب همه
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedContractorIds([])}>پاک کردن</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>انصراف</Button>
            <Button onClick={dispatchOrder} className="gap-2"><Send className="h-4 w-4" />ارسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
