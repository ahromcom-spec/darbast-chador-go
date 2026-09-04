import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Search, MapPin, ClipboardList, PlusCircle, User, Phone, PackageCheck, Wallet,
} from "lucide-react";
import { useProvinces } from "@/hooks/useProvinces";
import { useDistricts } from "@/hooks/useDistricts";
import { useServiceTypesWithSubcategories, type Subcategory } from "@/hooks/useServiceTypesWithSubcategories";
import { parseLocalizedNumber } from "@/lib/numberParsing";

interface LookupProfile {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  customer_code: string | null;
  cooperation_rank: number | null;
}

interface LookupLocation {
  id: string;
  title: string | null;
  address_line: string;
  lat: number | null;
  lng: number | null;
  is_active: boolean | null;
  created_at: string | null;
  provinces?: { name: string } | null;
  districts?: { name: string } | null;
}

interface LookupOrder {
  id: string;
  code: string | null;
  status: string | null;
  execution_stage: string | null;
  address: string | null;
  detailed_address: string | null;
  total_price: number | null;
  total_paid: number | null;
  payment_amount: number | null;
  created_at: string | null;
  is_archived: boolean | null;
  subcategory_id: string | null;
  subcategories?: { name: string; code: string; service_types_v3?: { name: string } | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار بررسی",
  pending_execution: "در انتظار اجرا",
  approved: "تایید شده",
  rejected: "رد شده",
  in_progress: "در حال اجرا",
  active: "فعال",
  scheduled: "زمان‌بندی شده",
  paid: "پرداخت شده",
  completed: "تکمیل شده",
  closed: "بسته شده",
};

const STAGE_LABELS: Record<string, string> = {
  awaiting_payment: "در انتظار پرداخت",
  order_executed: "سفارش اجرا شد",
  awaiting_collection: "در انتظار جمع‌آوری",
  in_collection: "در حال جمع‌آوری",
  collected: "جمع‌آوری شد",
};

const fmt = (n?: number | null) =>
  n && n > 0 ? new Intl.NumberFormat("fa-IR").format(n) + " تومان" : "—";

const faDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return "—";
  }
};

// همه زیرشاخه‌های برگ (بدون فرزند) را صاف می‌کند
const flattenLeaves = (subs: Subcategory[], prefix = ""): { id: string; label: string }[] => {
  const out: { id: string; label: string }[] = [];
  for (const s of subs) {
    const label = prefix ? `${prefix} › ${s.name}` : s.name;
    if (s.children && s.children.length > 0) {
      out.push(...flattenLeaves(s.children, label));
    } else {
      out.push({ id: s.id, label });
    }
  }
  return out;
};

export default function CustomerOrderEntryModule() {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<LookupProfile | null>(null);
  const [locations, setLocations] = useState<LookupLocation[]>([]);
  const [orders, setOrders] = useState<LookupOrder[]>([]);

  // فرم ثبت سفارش
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [locationMode, setLocationMode] = useState<"existing" | "new">("existing");
  const [locationId, setLocationId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newProvinceId, setNewProvinceId] = useState<string>("");
  const [newDistrictId, setNewDistrictId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationMonths, setDurationMonths] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const { provinces } = useProvinces();
  const { districts } = useDistricts(newProvinceId || undefined);
  const { serviceTypes } = useServiceTypesWithSubcategories();

  const leafOptions = useMemo(() => {
    const st = serviceTypes.find((t) => t.id === serviceTypeId);
    return st ? flattenLeaves(st.subcategories) : [];
  }, [serviceTypes, serviceTypeId]);

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-customer-order", { body: payload });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const search = async () => {
    if (!phone.trim()) {
      toast.error("شماره موبایل مشتری را وارد کنید");
      return;
    }
    setSearching(true);
    setNotFound(false);
    try {
      const data = await call({ action: "lookup", phone });
      if (!data.found) {
        setProfile(null);
        setLocations([]);
        setOrders([]);
        setNotFound(true);
        return;
      }
      setProfile(data.profile);
      setLocations(data.locations || []);
      setOrders(data.orders || []);
      setLocationId((data.locations || [])[0]?.id || "");
      setLocationMode((data.locations || []).length > 0 ? "existing" : "new");
    } catch (e: any) {
      toast.error(
        e?.message === "forbidden"
          ? "شما به این ماژول دسترسی ندارید"
          : "خطا در جستجوی مشتری: " + (e?.message || ""),
      );
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!profile) return;
    if (!subcategoryId) {
      toast.error("نوع خدمت و زیرشاخه را انتخاب کنید");
      return;
    }
    if (locationMode === "existing" && !locationId) {
      toast.error("یک آدرس از آدرس‌های مشتری انتخاب کنید");
      return;
    }
    if (locationMode === "new" && !newAddress.trim()) {
      toast.error("آدرس جدید را وارد کنید");
      return;
    }
    setSubmitting(true);
    try {
      const data = await call({
        action: "create",
        user_id: profile.user_id,
        subcategory_id: subcategoryId,
        location_id: locationMode === "existing" ? locationId : null,
        new_location:
          locationMode === "new"
            ? {
                title: newTitle || null,
                address_line: newAddress.trim(),
                province_id: newProvinceId || null,
                district_id: newDistrictId || null,
              }
            : null,
        description,
        price: price ? parseLocalizedNumber(price) : null,
        duration_months: durationMonths ? parseLocalizedNumber(durationMonths) : 1,
      });
      toast.success(`سفارش با کد ${data.order_code || ""} برای مشتری ثبت شد`);
      setDescription("");
      setPrice("");
      setNewAddress("");
      setNewTitle("");
      await search();
    } catch (e: any) {
      toast.error("خطا در ثبت سفارش: " + (e?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const activeOrders = orders.filter((o) => !o.is_archived);
  const totalUnpaid = activeOrders.reduce(
    (sum, o) => sum + Math.max(0, (o.total_price || 0) - (o.total_paid || 0)),
    0,
  );

  return (
    <div className="container mx-auto px-3 py-6 max-w-5xl" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-emerald-600" />
          ماژول ثبت سفارش برای مشتری
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          با وارد کردن شماره موبایل مشتری، آدرس‌ها و سفارش‌های ثبت‌شده او را ببینید و در صورت نیاز سفارش جدید ثبت کنید.
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" /> شماره موبایل مشتری
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="09xxxxxxxxx"
            className="text-center"
            inputMode="tel"
          />
          <Button onClick={search} disabled={searching} className="gap-2">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            جستجو
          </Button>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="mb-5 border-amber-300">
          <CardContent className="py-4 text-sm text-amber-700">
            کاربری با این شماره در سایت ثبت‌نام نکرده است. ابتدا مشتری باید ثبت‌نام کند یا از ماژول ثبت‌نام برای او حساب بسازید.
          </CardContent>
        </Card>
      )}

      {profile && (
        <>
          <Card className="mb-5">
            <CardContent className="py-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <User className="w-4 h-4" /> {profile.full_name || "بدون نام"}
              </span>
              <Badge variant="secondary">{profile.phone_number}</Badge>
              {profile.customer_code && <Badge variant="outline">کد مشتری: {profile.customer_code}</Badge>}
              {!!profile.cooperation_rank && <Badge variant="outline">رتبه همکاری: {profile.cooperation_rank}</Badge>}
              <Badge variant="outline" className="gap-1">
                <MapPin className="w-3 h-3" /> {locations.length} آدرس
              </Badge>
              <Badge variant="outline" className="gap-1">
                <PackageCheck className="w-3 h-3" /> {activeOrders.length} سفارش فعال
              </Badge>
              {totalUnpaid > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <Wallet className="w-3 h-3" /> مانده: {fmt(totalUnpaid)}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="orders">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="orders">سفارش‌های مشتری</TabsTrigger>
              <TabsTrigger value="addresses">آدرس‌ها</TabsTrigger>
              <TabsTrigger value="new">ثبت سفارش جدید</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4 space-y-3">
              {orders.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground text-center">
                    این مشتری هیچ سفارشی ثبت نکرده است.
                  </CardContent>
                </Card>
              )}
              {orders.map((o) => (
                <Card key={o.id} className={o.is_archived ? "opacity-60" : ""}>
                  <CardContent className="py-3 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{o.code || "بدون کد"}</span>
                      <Badge variant="secondary">{STATUS_LABELS[o.status || ""] || o.status || "—"}</Badge>
                      {o.execution_stage && (
                        <Badge variant="outline">{STAGE_LABELS[o.execution_stage] || o.execution_stage}</Badge>
                      )}
                      {o.is_archived && <Badge variant="outline">بایگانی</Badge>}
                      <span className="text-muted-foreground ms-auto">{faDate(o.created_at)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {o.subcategories?.service_types_v3?.name || "—"}
                      {o.subcategories?.name ? ` › ${o.subcategories.name}` : ""}
                    </div>
                    <div className="flex items-start gap-1 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{o.address || "بدون آدرس"}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <span>مبلغ: {fmt(o.total_price || o.payment_amount)}</span>
                      <span>پرداخت‌شده: {fmt(o.total_paid)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="addresses" className="mt-4 space-y-3">
              {locations.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground text-center">
                    برای این مشتری آدرسی ثبت نشده است. در تب «ثبت سفارش جدید» می‌توانید آدرس جدید وارد کنید.
                  </CardContent>
                </Card>
              )}
              {locations.map((l) => (
                <Card key={l.id} className={l.is_active === false ? "opacity-60" : ""}>
                  <CardContent className="py-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold">{l.title || "بدون عنوان"}</span>
                      {l.is_active === false && <Badge variant="outline">غیرفعال</Badge>}
                    </div>
                    <div className="text-muted-foreground">{l.address_line}</div>
                    <div className="text-xs text-muted-foreground">
                      {[l.provinces?.name, l.districts?.name].filter(Boolean).join(" / ") || "—"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="new" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-emerald-600" /> ثبت سفارش برای {profile.full_name || profile.phone_number}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>نوع خدمت</Label>
                      <Select
                        value={serviceTypeId}
                        onValueChange={(v) => {
                          setServiceTypeId(v);
                          setSubcategoryId("");
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="انتخاب نوع خدمت" /></SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>زیرشاخه خدمت</Label>
                      <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!serviceTypeId}>
                        <SelectTrigger><SelectValue placeholder="انتخاب زیرشاخه" /></SelectTrigger>
                        <SelectContent>
                          {leafOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>آدرس اجرای سفارش</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={locationMode === "existing" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLocationMode("existing")}
                        disabled={locations.length === 0}
                      >
                        از آدرس‌های مشتری
                      </Button>
                      <Button
                        type="button"
                        variant={locationMode === "new" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLocationMode("new")}
                      >
                        آدرس جدید
                      </Button>
                    </div>

                    {locationMode === "existing" ? (
                      <Select value={locationId} onValueChange={setLocationId}>
                        <SelectTrigger><SelectValue placeholder="انتخاب آدرس" /></SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {(l.title ? l.title + " — " : "") + l.address_line}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>عنوان آدرس (اختیاری)</Label>
                          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="مثلاً پروژه خیابان شهید..." />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>آدرس کامل</Label>
                          <Textarea value={newAddress} onChange={(e) => setNewAddress(e.target.value)} rows={2} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>استان</Label>
                          <Select value={newProvinceId} onValueChange={(v) => { setNewProvinceId(v); setNewDistrictId(""); }}>
                            <SelectTrigger><SelectValue placeholder="انتخاب استان" /></SelectTrigger>
                            <SelectContent>
                              {provinces.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>شهر</Label>
                          <Select value={newDistrictId} onValueChange={setNewDistrictId} disabled={!newProvinceId}>
                            <SelectTrigger><SelectValue placeholder="انتخاب شهر" /></SelectTrigger>
                            <SelectContent>
                              {districts.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label>شرح سفارش</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="جزئیات درخواست مشتری، متراژ، ابعاد و توضیحات لازم..."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>مبلغ سفارش (تومان) — اختیاری</Label>
                      <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="مثلاً 50000000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>مدت (ماه)</Label>
                      <Input value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} inputMode="numeric" />
                    </div>
                  </div>

                  <Button onClick={submit} disabled={submitting} className="w-full gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                    ثبت سفارش برای مشتری
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
