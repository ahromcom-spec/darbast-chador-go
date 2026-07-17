import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/errorHandler";
import { CheckCircle2, Clock, MapPin, User, Phone, FileText, Loader2, Eye, Ruler, ImageIcon, ExternalLink, Calendar, Banknote, Info, Layers, Wrench, Truck, Home, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import StaticLocationMap from "@/components/locations/StaticLocationMap";
import { parseOrderNotes } from "@/components/orders/OrderDetailsView";

interface V3Assignment {
  id: string;
  project_id: string;
  status: string;
  assignment_type: string;
  assigned_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  notes: string | null;
  project: {
    id: string;
    code: number | string;
    customer_name: string | null;
    customer_phone: string | null;
    address: string | null;
    detailed_address: string | null;
    total_price: number | null;
    status: string;
    created_at: string;
    notes: string | null;
    subcategory: { name: string | null } | null;
  } | null;
}

interface ProjectDetail {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  detailed_address: string | null;
  total_price: number | null;
  total_paid: number | null;
  payment_amount: number | null;
  status: string;
  execution_stage: string | null;
  execution_start_date: string | null;
  execution_end_date: string | null;
  rental_start_date: string | null;
  created_at: string;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_confirmed_by_customer: boolean | null;
  subcategory: { name: string | null; code: string | null } | null;
}

interface ProjectMedia {
  id: string;
  file_path: string;
  mime_type: string;
  created_at: string;
}

interface NotesData {
  service_type?: string;
  dimensions?: Array<{ length: number; width: number; height: number }>;
  isFacadeWidth2m?: boolean;
  conditions?: {
    totalMonths?: number;
    currentMonth?: number;
    distanceRange?: string;
    platformHeight?: number | null;
    scaffoldHeightFromPlatform?: number | null;
    vehicleDistance?: number | null;
    rentalMonthsPlan?: string;
  };
  onGround?: boolean;
  vehicleReachesSite?: boolean;
  locationPurpose?: string;
  totalArea?: number;
  estimated_price?: number;
  price_breakdown?: string[];
  installationDateTime?: string;
  customerName?: string;
  phoneNumber?: string;
}

export function ContractorOrdersV3({ contractorId }: { contractorId: string }) {
  const [items, setItems] = useState<V3Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewAssignment, setViewAssignment] = useState<V3Assignment | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_v3_assignments")
        .select(`
          id, project_id, status, assignment_type, assigned_at, accepted_at, rejected_at, notes,
          project:projects_v3 (
            id, code, customer_name, customer_phone, address, detailed_address,
            total_price, status, created_at, notes,
            subcategory:subcategories ( name )
          )
        `)
        .eq("contractor_id", contractorId)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      setItems((data || []) as any);
    } catch (e: any) {
      toast(toastError(e, "خطا در بارگذاری ارجاعات"));
    } finally {
      setLoading(false);
    }
  }, [contractorId, toast]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`pv3a-${contractorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_v3_assignments", filter: `contractor_id=eq.${contractorId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contractorId, load]);

  // Sync open dialog's assignment status with latest items
  useEffect(() => {
    if (!viewAssignment) return;
    const fresh = items.find(i => i.id === viewAssignment.id);
    if (fresh && fresh.status !== viewAssignment.status) setViewAssignment(fresh);
  }, [items, viewAssignment]);

  const accept = async (id: string) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc("accept_v3_assignment", { _assignment_id: id });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) {
        const map: Record<string, string> = {
          taken_by_other: "این سفارش توسط پیمانکار دیگری پذیرفته شد",
          already_processed: "این سفارش قبلاً پردازش شده است",
          not_authorized: "دسترسی غیرمجاز",
          not_found: "سفارش یافت نشد",
        };
        toast({ title: "پذیرش انجام نشد", description: map[res?.error || ""] || res?.error, variant: "destructive" });
      } else {
        toast({ title: "✓ سفارش پذیرفته شد" });
      }
      load();
    } catch (e: any) {
      toast(toastError(e, "خطا در پذیرش"));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    if (!confirm("این سفارش رد شود؟")) return;
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc("reject_v3_assignment", { _assignment_id: id, _reason: null });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) {
        toast({ title: "رد انجام نشد", description: res?.error, variant: "destructive" });
      } else {
        toast({ title: "سفارش رد شد" });
      }
      load();
    } catch (e: any) {
      toast(toastError(e, "خطا در رد سفارش"));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("از لغو این سفارش پذیرفته‌شده مطمئن هستید؟")) return;
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc("cancel_v3_assignment" as any, { _assignment_id: id, _reason: null });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) {
        toast({ title: "لغو انجام نشد", description: res?.error, variant: "destructive" });
      } else {
        toast({ title: "سفارش لغو شد" });
      }
      load();
    } catch (e: any) {
      toast(toastError(e, "خطا در لغو سفارش"));
    } finally {
      setBusy(null);
    }
  };

  const pending = items.filter(i => i.status === "pending");
  const accepted = items.filter(i => i.status === "accepted");
  const history = items.filter(i => ["rejected", "cancelled"].includes(i.status));

  if (loading) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> در حال بارگذاری ارجاعات...
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          سفارش‌های پیشنهادی به شما
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="pending">پیشنهاد جدید ({pending.length})</TabsTrigger>
            <TabsTrigger value="accepted">پذیرفته شده ({accepted.length})</TabsTrigger>
            <TabsTrigger value="history">سابقه ({history.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-3">
            {pending.length === 0 ? <Empty text="پیشنهادی وجود ندارد" /> :
              pending.map(a => <AssignmentCard key={a.id} a={a} busy={busy === a.id} onAccept={() => accept(a.id)} onReject={() => reject(a.id)} onView={() => setViewAssignment(a)} />)}
          </TabsContent>
          <TabsContent value="accepted" className="space-y-3">
            {accepted.length === 0 ? <Empty text="هنوز سفارشی نپذیرفته‌اید" /> :
              accepted.map(a => <AssignmentCard key={a.id} a={a} onView={() => setViewAssignment(a)} />)}
          </TabsContent>
          <TabsContent value="history" className="space-y-3">
            {history.length === 0 ? <Empty text="سابقه‌ای وجود ندارد" /> :
              history.map(a => <AssignmentCard key={a.id} a={a} onView={() => setViewAssignment(a)} />)}
          </TabsContent>
        </Tabs>
      </CardContent>
      {viewAssignment && (
        <OrderDetailDialog
          assignment={viewAssignment}
          busy={busy === viewAssignment.id}
          onAccept={() => accept(viewAssignment.id)}
          onReject={() => reject(viewAssignment.id)}
          onCancel={() => cancel(viewAssignment.id)}
          onClose={() => setViewAssignment(null)}
        />
      )}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-muted-foreground text-sm">{text}</div>;
}

function AssignmentCard({ a, busy, onAccept, onReject, onView }: { a: V3Assignment; busy?: boolean; onAccept?: () => void; onReject?: () => void; onView?: () => void }) {
  const p = a.project;
  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500", accepted: "bg-green-600", rejected: "bg-red-500", cancelled: "bg-gray-500",
  };
  const statusLabel: Record<string, string> = {
    pending: "در انتظار پاسخ", accepted: "پذیرفته شده", rejected: "رد شده", cancelled: "لغو شده",
  };
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold">سفارش: {p?.code ?? "-"}</span>
            <Badge variant="outline">{a.assignment_type === "manual" ? "ارجاع دستی" : "ارجاع خودکار"}</Badge>
            <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
          </div>
          {p?.subcategory?.name && <div className="text-sm text-muted-foreground">{p.subcategory.name}</div>}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(a.assigned_at).toLocaleDateString("fa-IR")}
        </div>
      </div>

      {(p?.address || p?.detailed_address) && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <span>{[p?.address, p?.detailed_address].filter(Boolean).join(" - ")}</span>
        </div>
      )}

      {a.status === "accepted" && (
        <div className="grid gap-1 text-sm border-t pt-3">
          {p?.customer_name && (
            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {p.customer_name}</div>
          )}
          {p?.customer_phone && (
            <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" /> {p.customer_phone}</div>
          )}
        </div>
      )}

      {(() => {
        const parsedNotes = p?.notes ? (parseOrderNotes(p.notes as any) as any) : null;
        const estimated = typeof parsedNotes?.estimated_price === 'number' ? parsedNotes.estimated_price : null;
        const price = (p?.total_price && p.total_price > 0) ? p.total_price : estimated;
        if (!price || price <= 0) return null;
        const isEstimated = !(p?.total_price && p.total_price > 0);
        return (
          <div className="text-sm">
            <span className="text-muted-foreground">{isEstimated ? 'قیمت پیشنهادی سفارش: ' : 'هزینه قرارداد: '}</span>
            <span className="font-semibold">{Number(price).toLocaleString("fa-IR")} تومان</span>
            {isEstimated && <span className="text-xs text-muted-foreground mr-2">(محاسبه‌شده توسط سیستم)</span>}
          </div>
        );
      })()}

      <div className="flex gap-2 pt-2 border-t flex-wrap">
        {onView && (
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="h-4 w-4 ml-1" /> مشاهده سفارش
          </Button>
        )}
        {onAccept && (
          <>
            <Button size="sm" onClick={onAccept} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />} پذیرش سفارش
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>رد کردن</Button>
          </>
        )}
      </div>
    </div>
  );
}

interface OrderDetailDialogProps {
  assignment: V3Assignment;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function OrderDetailDialog({ assignment, busy, onAccept, onReject, onCancel, onClose }: OrderDetailDialogProps) {
  const projectId = assignment.project_id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [media, setMedia] = useState<ProjectMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      setLoading(true);
      try {
        const [projRes, mediaRes] = await Promise.all([
          supabase
            .from("projects_v3")
            .select(`
              id, code, customer_name, customer_phone, address, detailed_address,
              total_price, total_paid, payment_amount, status, execution_stage,
              execution_start_date, execution_end_date, rental_start_date,
              created_at, notes,
              location_lat, location_lng, location_confirmed_by_customer,
              subcategory:subcategories ( name, code )
            `)
            .eq("id", projectId)
            .single(),
          supabase
            .from("project_media")
            .select("id, file_path, mime_type, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        if (projRes.error) throw projRes.error;
        if (mediaRes.error) throw mediaRes.error;
        setProject(projRes.data as any);
        setMedia((mediaRes.data || []) as any);
      } catch (e: any) {
        toast(toastError(e, "خطا در بارگذاری جزئیات سفارش"));
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
    return () => { cancelled = true; };
  }, [projectId, toast]);

  const notes: NotesData = (() => {
    if (!project?.notes) return {};
    const parsed = parseOrderNotes(project.notes as any);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as NotesData;
  })();

  const imageUrls = media
    .filter(m => m.mime_type?.startsWith("image/"))
    .map(m => {
      const { data } = supabase.storage.from("project-media").getPublicUrl(m.file_path);
      return data?.publicUrl || "";
    })
    .filter(Boolean);

  const mapUrl = project?.location_lat && project?.location_lng
    ? `https://www.google.com/maps?q=${project.location_lat},${project.location_lng}`
    : null;

  const serviceTypeLabels: Record<string, string> = {
    facade: "داربست نما",
    rental: "اجاره داربست",
    scaffolding: "داربست",
  };

  const stageLabels: Record<string, string> = {
    pending: 'در انتظار تایید مدیران',
    approved: 'تایید شده',
    pending_execution: 'آماده اجرا',
    in_progress: 'در حال اجرا',
    completed: 'اتمام',
    paid: 'پرداخت شده',
    closed: 'بسته شده',
    rejected: 'رد شده',
  };

  const description =
    (notes as any)?.description ||
    (notes as any)?.installationDescription ||
    (notes as any)?.additional_notes ||
    '';

  // قیمت نمایش‌داده‌شده به پیمانکار: اگر قیمت نهایی قرارداد ثبت نشده (یا صفر است)،
  // قیمت تخمینی خودکار سایت (estimated_price از notes) ملاک خواهد بود.
  const pickPositive = (v: number | null | undefined) =>
    typeof v === 'number' && v > 0 ? v : null;
  const displayPrice =
    pickPositive(project?.total_price) ??
    pickPositive(project?.payment_amount) ??
    pickPositive(notes.estimated_price as number | undefined) ??
    null;

  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
  const zoomReset = () => setZoom(1);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col" dir="rtl">
        {/* Zoom toolbar - فقط این بخش ثابت می‌ماند */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={zoomOut} disabled={zoom <= 0.5} className="h-8 w-8 p-0" title="کوچک‌نمایی">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="outline" size="sm" onClick={zoomIn} disabled={zoom >= 2} className="h-8 w-8 p-0" title="بزرگ‌نمایی">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={zoomReset} className="h-8 w-8 p-0" title="بازنشانی">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">برای کنترل بهتر داده‌ها از زوم استفاده کنید</span>
        </div>

        <div className="overflow-y-auto flex-1">
          <div
            className="origin-top-right transition-transform"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
          >
            <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b text-right">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                مشاهده سفارش {project?.code ? `(${project.code})` : ""}
              </DialogTitle>
              <DialogDescription>
                جزئیات کامل سفارش شامل ابعاد، عکس‌ها، قیمت و موقعیت روی نقشه
              </DialogDescription>
              {project && (
                <div className="flex items-center gap-2 flex-wrap pt-2">
                  {project.subcategory?.name && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">{project.subcategory.name}</Badge>
                  )}
                  {notes.service_type && (
                    <Badge variant="outline">{serviceTypeLabels[notes.service_type] || notes.service_type}</Badge>
                  )}
                  {project.execution_stage && (
                    <Badge variant="secondary">{stageLabels[project.execution_stage] || project.execution_stage}</Badge>
                  )}
                  {!project.execution_stage && project.status && (
                    <Badge variant="secondary">{stageLabels[project.status] || project.status}</Badge>
                  )}
                </div>
              )}
            </DialogHeader>

            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <span className="text-muted-foreground text-sm">در حال بارگذاری...</span>
              </div>
            ) : !project ? (
              <div className="py-16 text-center text-muted-foreground">سفارش یافت نشد</div>
            ) : (
              <div className="space-y-5 px-6 py-5">



            <AssignmentStatusBanner
              assignment={assignment}
              busy={busy}
              onAccept={onAccept}
              onReject={onReject}
              onCancel={onCancel}
            />


            {/* Price highlight card */}
            <Card className="border-green-200 bg-gradient-to-l from-green-50 to-emerald-50/40 dark:from-green-950/20 dark:to-emerald-950/10">
              <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2.5">
                    <Banknote className="h-5 w-5 text-green-700 dark:text-green-300" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">قیمت سفارش</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {displayPrice !== null ? `${Number(displayPrice).toLocaleString("fa-IR")} تومان` : 'تعیین نشده'}
                    </div>
                  </div>
                </div>
                {project.total_paid !== null && project.total_paid !== undefined && project.total_paid > 0 && (
                  <div className="text-sm text-muted-foreground">
                    پرداخت‌شده: <strong className="text-foreground">{Number(project.total_paid).toLocaleString("fa-IR")} تومان</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Basic Info */}
            <section className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                اطلاعات پایه
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-card border rounded-lg p-4">
                {project.customer_name && (
                  <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">نام مشتری:</span> <span className="font-medium">{project.customer_name}</span></div>
                )}
                {project.customer_phone && (
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">تلفن:</span> <span dir="ltr" className="font-medium">{project.customer_phone}</span></div>
                )}
                {project.subcategory?.name && (
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">نوع خدمت:</span> <span className="font-medium">{project.subcategory.name}</span></div>
                )}
                {notes.service_type && (
                  <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">نوع سرویس:</span> <span className="font-medium">{serviceTypeLabels[notes.service_type] || notes.service_type}</span></div>
                )}
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">تاریخ ثبت:</span> <span className="font-medium">{new Date(project.created_at).toLocaleDateString("fa-IR")}</span></div>
                {project.rental_start_date && (
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="text-muted-foreground">شروع کرایه:</span> <span className="font-medium">{new Date(project.rental_start_date).toLocaleDateString("fa-IR")}</span></div>
                )}
              </div>
            </section>

            {/* Service description */}
            {description && (
              <section className="rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 p-3">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 mb-1.5">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">شرح محل نصب و نوع فعالیت</span>
                </div>
                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">{description}</p>
              </section>
            )}

            {/* Address & Location */}
            <section className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                آدرس و موقعیت روی نقشه
              </h3>
              <div className="bg-card border rounded-lg p-4 space-y-3">
                {(project.address || project.detailed_address) && (
                  <div className="text-sm flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{[project.address, project.detailed_address].filter(Boolean).join(" - ")}</span>
                  </div>
                )}
                {notes.locationPurpose && (
                  <div className="text-sm text-muted-foreground">هدف استفاده: {notes.locationPurpose}</div>
                )}
                {project.location_lat && project.location_lng ? (
                  <div className="rounded-lg overflow-hidden border" style={{ height: 280 }}>
                    <StaticLocationMap
                      lat={project.location_lat}
                      lng={project.location_lng}
                      address={project.address || undefined}
                      detailedAddress={project.detailed_address || undefined}
                      showNavigationButton={true}
                    />
                  </div>
                ) : mapUrl ? (
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    مشاهده روی نقشه
                  </a>
                ) : (
                  <div className="text-xs text-muted-foreground">موقعیت ثبت نشده است</div>
                )}
              </div>
            </section>

            {/* Dimensions */}
            {notes.dimensions && notes.dimensions.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <Ruler className="h-4 w-4" />
                  ابعاد
                </h3>
                <div className="bg-card border rounded-lg p-4 space-y-2">
                  {notes.dimensions.map((dim, idx) => (
                    <div key={idx} className="text-sm flex items-center gap-3 flex-wrap">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">بخش {idx + 1}</span>
                      <span>طول: <strong>{dim.length.toLocaleString("fa-IR")}</strong> متر</span>
                      <span>عرض: <strong>{dim.width.toLocaleString("fa-IR")}</strong> متر</span>
                      <span>ارتفاع: <strong>{dim.height.toLocaleString("fa-IR")}</strong> متر</span>
                    </div>
                  ))}
                  {notes.totalArea !== undefined && (
                    <div className="text-sm pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">مساحت کل: </span>
                      <strong>{notes.totalArea.toLocaleString("fa-IR")} متر مربع</strong>
                    </div>
                  )}
                  {notes.isFacadeWidth2m && (
                    <div className="text-sm text-muted-foreground">عرض نما: ۲ متری</div>
                  )}
                </div>
              </section>
            )}

            {/* Conditions */}
            {notes.conditions && Object.values(notes.conditions).some(v => v !== undefined && v !== null && v !== '') && (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <Wrench className="h-4 w-4" />
                  شرایط اجرا
                </h3>
                <div className="bg-card border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {notes.conditions.totalMonths !== undefined && (
                    <div><span className="text-muted-foreground">تعداد ماه‌ها:</span> {Number(notes.conditions.totalMonths).toLocaleString("fa-IR")}</div>
                  )}
                  {notes.conditions.distanceRange && (
                    <div><span className="text-muted-foreground">بُعد مسافت:</span> {notes.conditions.distanceRange}</div>
                  )}
                  {notes.conditions.platformHeight !== undefined && notes.conditions.platformHeight !== null && (
                    <div><span className="text-muted-foreground">ارتفاع سکو:</span> {Number(notes.conditions.platformHeight).toLocaleString("fa-IR")} متر</div>
                  )}
                  {notes.conditions.scaffoldHeightFromPlatform !== undefined && notes.conditions.scaffoldHeightFromPlatform !== null && (
                    <div><span className="text-muted-foreground">ارتفاع از سکو:</span> {Number(notes.conditions.scaffoldHeightFromPlatform).toLocaleString("fa-IR")} متر</div>
                  )}
                  {notes.onGround !== undefined && (
                    <div className="flex items-center gap-1"><Home className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">اجرا روی زمین:</span> {notes.onGround ? "بله" : "خیر"}</div>
                  )}
                  {notes.vehicleReachesSite !== undefined && (
                    <div className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">دسترسی خودرو:</span> {notes.vehicleReachesSite ? "بله" : "خیر"}</div>
                  )}
                </div>
              </section>
            )}

            {/* Price breakdown */}
            {(notes.price_breakdown && notes.price_breakdown.length > 0) || notes.estimated_price !== undefined ? (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <Banknote className="h-4 w-4" />
                  جزئیات قیمت‌گذاری
                </h3>
                <div className="bg-card border rounded-lg p-4 space-y-2">
                  {notes.estimated_price !== undefined && (
                    <div className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">قیمت تخمینی</span>
                      <strong>{Number(notes.estimated_price).toLocaleString("fa-IR")} تومان</strong>
                    </div>
                  )}
                  {project.total_price !== null && project.total_price !== undefined && project.total_price > 0 && (
                    <div className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">قیمت نهایی قرارداد</span>
                      <strong>{Number(project.total_price).toLocaleString("fa-IR")} تومان</strong>
                    </div>
                  )}
                  {notes.price_breakdown && notes.price_breakdown.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        {notes.price_breakdown.map((line, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">• {line}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            ) : null}

            {/* Photos */}
            {imageUrls.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <ImageIcon className="h-4 w-4" />
                  تصاویر سفارش ({imageUrls.length.toLocaleString("fa-IR")} عدد)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {imageUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
                      <img src={url} alt={`تصویر ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Installation Date */}
            {notes.installationDateTime && (
              <div className="text-sm bg-primary/5 rounded-lg p-3 flex items-center gap-2 border">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">تاریخ نصب درخواستی:</span>
                <strong>{new Date(notes.installationDateTime).toLocaleDateString("fa-IR")}</strong>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </DialogContent>

    </Dialog>
  );
}

function AssignmentStatusBanner({
  assignment,
  busy,
  onAccept,
  onReject,
  onCancel,
}: {
  assignment: V3Assignment;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const status = assignment.status;

  const meta: Record<string, { label: string; desc: string; box: string; chip: string; icon: JSX.Element }> = {
    pending: {
      label: "در انتظار پاسخ شما",
      desc: "این سفارش به شما پیشنهاد شده است. لطفاً پس از بررسی، آن را بپذیرید یا رد کنید.",
      box: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900/40",
      chip: "bg-yellow-500 text-white",
      icon: <Clock className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />,
    },
    accepted: {
      label: "پذیرفته شده توسط شما",
      desc: "شما این سفارش را پذیرفته‌اید. می‌توانید اجرای آن را پیگیری کنید یا در صورت نیاز پذیرش را لغو کنید.",
      box: "border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-900/40",
      chip: "bg-green-600 text-white",
      icon: <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-300" />,
    },
    rejected: {
      label: "رد شده",
      desc: "شما این سفارش را رد کرده‌اید و دیگر امکان تغییر وضعیت آن وجود ندارد.",
      box: "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40",
      chip: "bg-red-500 text-white",
      icon: <Info className="h-5 w-5 text-red-700 dark:text-red-300" />,
    },
    cancelled: {
      label: "لغو شده",
      desc: "این ارجاع لغو شده است.",
      box: "border-gray-300 bg-gray-50 dark:bg-gray-950/30 dark:border-gray-800",
      chip: "bg-gray-500 text-white",
      icon: <Info className="h-5 w-5 text-gray-700 dark:text-gray-300" />,
    },
  };

  const m = meta[status] || meta.pending;

  return (
    <div className={`rounded-lg border p-4 ${m.box}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="mt-0.5">{m.icon}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs ${m.chip}`}>{m.label}</span>
            {assignment.accepted_at && status === "accepted" && (
              <span className="text-xs text-muted-foreground">
                تاریخ پذیرش: {new Date(assignment.accepted_at).toLocaleDateString("fa-IR")}
              </span>
            )}
            {assignment.rejected_at && status === "rejected" && (
              <span className="text-xs text-muted-foreground">
                تاریخ رد: {new Date(assignment.rejected_at).toLocaleDateString("fa-IR")}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/80 leading-6">{m.desc}</p>
        </div>
      </div>

      {(status === "pending" || status === "accepted") && (
        <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/50">
          {status === "pending" && (
            <>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
                پذیرش سفارش
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
                رد سفارش
              </Button>
            </>
          )}
          {status === "accepted" && (
            <Button size="sm" variant="destructive" onClick={onCancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              لغو پذیرش
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

