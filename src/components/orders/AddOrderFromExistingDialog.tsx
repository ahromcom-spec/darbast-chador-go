import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalizedNumber } from "@/lib/numberParsing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: { id: string; code?: string; customer_name?: string; customer_phone?: string; address?: string; subcategory_name?: string } | null;
  onCreated?: () => void;
}

export function AddOrderFromExistingDialog({ open, onOpenChange, order, onCreated }: Props) {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("1");
  const [busy, setBusy] = useState(false);

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
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت سفارش برای مشتری
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
