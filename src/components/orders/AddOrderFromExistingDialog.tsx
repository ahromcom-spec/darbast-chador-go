import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, MapPin, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalizedNumber } from "@/lib/numberParsing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: { id: string; code?: string; customer_name?: string; customer_phone?: string; address?: string; subcategory_name?: string } | null;
  onCreated?: () => void;
}

const FORM_ROUTES: Record<string, string> = { "30": "/scaffolding/rental-form" };
const COMPREHENSIVE_CODES = new Set(["10", "15", "20"]);

export function AddOrderFromExistingDialog({ open, onOpenChange, order, onCreated }: Props) {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("1");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  // باز کردن همان فرم کامل مشتری، با مشتری سفارش به‌عنوان گیرنده (ثبت برای دیگری)
  const openFullForm = async () => {
    if (!order) return;
    setOpening(true);
    try {
      const { data: src, error } = await supabase
        .from("projects_v3")
        .select("id, hierarchy_project_id, subcategory_id, province_id, district_id, address, detailed_address, customer_id, customer_name, customer_phone, subcategories(code, name, service_type_id), projects_hierarchy:hierarchy_project_id(location_id, locations(title))")
        .eq("id", order.id)
        .maybeSingle();
      if (error || !src) throw error || new Error("سفارش یافت نشد");
      const s: any = src;
      let userId: string | null = null;
      if (s.customer_id) {
        const { data: c } = await supabase.from("customers").select("user_id").eq("id", s.customer_id).maybeSingle();
        userId = (c as any)?.user_id ?? null;
      }
      const phone = s.customer_phone || order.customer_phone || "";
      if (!phone) throw new Error("شماره مشتری این سفارش مشخص نیست");
      const code = s.subcategories?.code || "";
      const locationId = s.projects_hierarchy?.location_id;
      const state = {
        fromManager: true,
        hierarchyProjectId: s.hierarchy_project_id,
        projectId: s.hierarchy_project_id,
        locationId,
        serviceTypeId: s.subcategories?.service_type_id,
        subcategoryId: s.subcategory_id,
        subcategoryCode: code,
        subcategoryName: s.subcategories?.name,
        locationAddress: s.address,
        detailedAddress: s.detailed_address || s.address,
        locationTitle: s.projects_hierarchy?.locations?.title,
        provinceId: s.province_id,
        districtId: s.district_id,
        presetRecipient: {
          phoneNumber: phone,
          userId,
          fullName: s.customer_name || order.customer_name || null,
          isRegistered: !!userId,
        },
      };
      onOpenChange(false);
      if (COMPREHENSIVE_CODES.has(code) && s.hierarchy_project_id) {
        navigate(`/scaffolding/form/${s.hierarchy_project_id}`, { state });
      } else {
        navigate(FORM_ROUTES[code] || "/scaffolding/form", { state });
      }
    } catch (e: any) {
      toast.error("باز کردن فرم ممکن نشد: " + (e?.message || ""));
    } finally {
      setOpening(false);
    }
  };


  const submit = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-customer-order", {
        body: {
          action: "create",
          source_order_id: order.id,
          description,
          price: price ? parseLocalizedNumber(price) : null,
          duration_months: months ? parseLocalizedNumber(months) : 1,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`سفارش جدید با کد ${(data as any).order_code || ""} برای مشتری ثبت شد`);
      setDescription("");
      setPrice("");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message === "forbidden" ? "شما اجازه ثبت سفارش ندارید" : "خطا در ثبت سفارش: " + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>افزودن سفارش جدید</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center gap-2"><User className="h-4 w-4" />{order.customer_name || "—"} {order.customer_phone ? `(${order.customer_phone})` : ""}</div>
              <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" />{order.address || "—"}</div>
              <div className="text-muted-foreground">نوع خدمت: همانند سفارش {order.code}{order.subcategory_name ? ` — ${order.subcategory_name}` : ""}</div>
            </div>
            <div>
              <Label>شرح سفارش</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح محل نصب و نوع فعالیت" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>مبلغ (تومان، اختیاری)</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <Label>مدت (ماه)</Label>
                <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={openFullForm} disabled={busy || opening} className="gap-2 w-full">
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            باز کردن فرم کامل سفارش (با قیمت‌گذاری کارشناسی)
          </Button>
          <Button variant="outline" onClick={submit} disabled={busy || opening} className="gap-2 w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت سریع سفارش برای مشتری
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
