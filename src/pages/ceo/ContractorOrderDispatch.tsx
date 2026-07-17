import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/errorHandler";
import { Loader2, Send, UserPlus, MapPin, User, Phone } from "lucide-react";

interface OrderRow {
  id: string;
  code: number | string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  detailed_address: string | null;
  total_price: number | null;
  created_at: string;
  contractor_id: string | null;
  subcategory_id: string | null;
  subcategory?: { name: string | null; code: string | null; service_type_id: string | null } | null;
  assignments?: AssignmentRow[];
}
interface AssignmentRow {
  id: string;
  contractor_id: string;
  status: string;
  assignment_type: string;
  assigned_at: string;
  contractor?: { id: string; company_name: string; phone_number: string | null } | null;
}
interface ContractorOpt {
  id: string; company_name: string; phone_number: string | null; auto_assign_enabled: boolean | null;
}

export default function ContractorOrderDispatch() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchOrder, setDispatchOrder] = useState<OrderRow | null>(null);
  const [eligibleContractors, setEligibleContractors] = useState<ContractorOpt[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects_v3")
        .select(`
          id, code, status, customer_name, customer_phone, address, detailed_address,
          total_price, created_at, contractor_id, subcategory_id,
          subcategory:subcategories ( name, code, service_type_id ),
          assignments:project_v3_assignments (
            id, contractor_id, status, assignment_type, assigned_at,
            contractor:contractors ( id, company_name, phone_number )
          )
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setOrders((data || []) as any);
    } catch (e: any) {
      toast(toastError(e, "خطا در بارگذاری سفارش‌ها"));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openDispatch = async (order: OrderRow) => {
    setDispatchOrder(order);
    setSelected(new Set());
    try {
      const stId = order.subcategory?.service_type_id;
      const subCode = order.subcategory?.code;
      if (!stId || !subCode) { setEligibleContractors([]); return; }
      const { data: services } = await supabase
        .from("contractor_services")
        .select("contractor_id")
        .eq("service_type", stId)
        .eq("sub_type", subCode)
        .eq("status", "approved");
      const ids = Array.from(new Set((services || []).map((s: any) => s.contractor_id)));
      if (ids.length === 0) { setEligibleContractors([]); return; }
      const { data: cs } = await supabase
        .from("contractors")
        .select("id, company_name, phone_number, auto_assign_enabled, is_active, is_approved")
        .in("id", ids)
        .eq("is_active", true)
        .eq("is_approved", true);
      setEligibleContractors((cs || []) as any);
    } catch (e: any) {
      toast(toastError(e, "خطا در بارگذاری پیمانکاران"));
    }
  };

  const submitDispatch = async () => {
    if (!dispatchOrder || selected.size === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("manual_dispatch_v3", {
        _project_id: dispatchOrder.id,
        _contractor_ids: Array.from(selected),
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) {
        toast({ title: "ارجاع انجام نشد", description: res?.error, variant: "destructive" });
      } else {
        toast({ title: `سفارش به ${selected.size} پیمانکار ارجاع شد` });
        setDispatchOrder(null);
        load();
      }
    } catch (e: any) {
      toast(toastError(e, "خطا در ارجاع"));
    } finally {
      setBusy(false);
    }
  };

  const cancelAssignment = async (id: string) => {
    if (!confirm("این ارجاع لغو شود؟")) return;
    const { error } = await supabase.from("project_v3_assignments").update({ status: "cancelled" }).eq("id", id);
    if (error) toast(toastError(error, "خطا")); else { toast({ title: "ارجاع لغو شد" }); load(); }
  };

  if (loading) {
    return <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  const unassigned = orders.filter(o => !o.contractor_id && (o.assignments || []).every(a => a.status !== "accepted"));
  const inProgress = orders.filter(o => o.contractor_id || (o.assignments || []).some(a => a.status === "accepted"));

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> ارجاع سفارشات به پیمانکاران</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unassigned">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="unassigned">در انتظار ارجاع ({unassigned.length})</TabsTrigger>
              <TabsTrigger value="active">ارجاع‌شده ({inProgress.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="unassigned" className="space-y-3">
              {unassigned.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">سفارشی برای ارجاع وجود ندارد</div>}
              {unassigned.map(o => <OrderCard key={o.id} o={o} onDispatch={() => openDispatch(o)} onCancel={cancelAssignment} />)}
            </TabsContent>
            <TabsContent value="active" className="space-y-3">
              {inProgress.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">موردی وجود ندارد</div>}
              {inProgress.map(o => <OrderCard key={o.id} o={o} onDispatch={() => openDispatch(o)} onCancel={cancelAssignment} />)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!dispatchOrder} onOpenChange={(v) => !v && setDispatchOrder(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ارجاع سفارش {dispatchOrder?.code} به پیمانکاران</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {eligibleContractors.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                هیچ پیمانکار فعال و تأیید شده‌ای با این خدمت یافت نشد.
              </div>
            ) : eligibleContractors.map(c => (
              <label key={c.id} className="flex items-center justify-between gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => {
                    const ns = new Set(selected);
                    if (v) ns.add(c.id); else ns.delete(c.id);
                    setSelected(ns);
                  }} />
                  <div>
                    <div className="font-medium text-sm">{c.company_name}</div>
                    {c.phone_number && <div className="text-xs text-muted-foreground" dir="ltr">{c.phone_number}</div>}
                  </div>
                </div>
                {c.auto_assign_enabled && <Badge variant="outline" className="text-xs">ارجاع خودکار</Badge>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOrder(null)}>انصراف</Button>
            <Button disabled={busy || selected.size === 0} onClick={submitDispatch}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 ml-1" />} ارجاع به {selected.size} پیمانکار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({ o, onDispatch, onCancel }: { o: OrderRow; onDispatch: () => void; onCancel: (id: string) => void }) {
  const accepted = (o.assignments || []).find(a => a.status === "accepted");
  const pending = (o.assignments || []).filter(a => a.status === "pending");
  const others = (o.assignments || []).filter(a => !["accepted","pending"].includes(a.status));

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold">سفارش {o.code}</span>
            <Badge variant="outline">{o.subcategory?.name || "—"}</Badge>
            <Badge variant="secondary">{o.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fa-IR")}</div>
        </div>
        <Button size="sm" onClick={onDispatch}><UserPlus className="h-4 w-4 ml-1" /> ارجاع دستی</Button>
      </div>

      <div className="grid gap-1 text-sm">
        {o.customer_name && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{o.customer_name}</div>}
        {o.customer_phone && <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" />{o.customer_phone}</div>}
        {(o.address || o.detailed_address) && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{[o.address, o.detailed_address].filter(Boolean).join(" - ")}</div>}
      </div>

      {accepted && (
        <div className="text-sm bg-green-50 border border-green-200 rounded-md p-2">
          <span className="font-medium text-green-800">پذیرفته‌شده توسط: </span>
          {accepted.contractor?.company_name}
          {accepted.contractor?.phone_number && <span className="text-xs text-muted-foreground ml-2" dir="ltr">{accepted.contractor.phone_number}</span>}
        </div>
      )}

      {pending.length > 0 && (
        <div className="text-sm">
          <div className="text-xs text-muted-foreground mb-1">در انتظار پاسخ ({pending.length}):</div>
          <div className="flex flex-wrap gap-1">
            {pending.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-yellow-50 border border-yellow-200 rounded-full px-2 py-1">
                {a.contractor?.company_name || "—"}
                <button onClick={() => onCancel(a.id)} className="text-red-500 hover:text-red-700">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="text-xs text-muted-foreground">
          سابقه: {others.map(a => `${a.contractor?.company_name || "—"} (${a.status})`).join("، ")}
        </div>
      )}
    </div>
  );
}
