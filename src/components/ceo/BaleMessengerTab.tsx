import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BaleVideoCompressionPanel from "@/components/ceo/BaleVideoCompressionPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Send, Link2, RefreshCw, Image as ImageIcon, MessageCircle } from "lucide-react";

const db = supabase as any;

interface MessengerSettings {
  id?: string;
  enabled: boolean;
  send_media: boolean;
  notify_ceo: boolean;
  bot_username?: string | null;
}

interface MessengerLog {
  id: string;
  phone: string | null;
  chat_id: string | null;
  kind: string;
  text: string | null;
  media_url: string | null;
  status: string;
  provider_response: string | null;
  order_code: string | null;
  created_at: string;
}

interface MessengerChat {
  id: string;
  phone: string | null;
  chat_id: string;
  username: string | null;
  full_name: string | null;
  updated_at: string;
}

export const BaleMessengerTab = () => {
  const [settings, setSettings] = useState<MessengerSettings>({
    enabled: false,
    send_media: true,
    notify_ceo: true,
    bot_username: "@ahrom_ir_bot",
  });
  const [logs, setLogs] = useState<MessengerLog[]>([]);
  const [chats, setChats] = useState<MessengerChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [testPhone, setTestPhone] = useState("09125511494");
  const [testText, setTestText] = useState(
    "خدمات ساختمانی و منزل اهرم\nگزارش پیشرفت پروژه برای شما ارسال شد.\nahrom.ir",
  );
  const [testMedia, setTestMedia] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "media" | "text">("all");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const resendLog = async (l: MessengerLog) => {
    const target = l.phone || l.chat_id;
    if (!target) {
      toast.error("شماره یا شناسه گیرنده برای ارسال مجدد ثبت نشده است");
      return;
    }
    if (isMediaLog(l) && !l.media_url) {
      toast.error("فایل این ردیف ثبت نشده و ارسال مجدد ممکن نیست");
      return;
    }
    setResendingId(l.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-bale-message", {
        body: {
          phone: l.phone || undefined,
          chatId: l.phone ? undefined : l.chat_id,
          text: isMediaLog(l) ? "" : l.text || "",
          media: l.media_url ? [{ url: l.media_url, kind: l.kind }] : [],
          orderCode: l.order_code || undefined,
          force: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) toast.error("ارسال مجدد موفق نبود");
      else toast.success("ارسال مجدد انجام شد");
      load();
    } catch (e: any) {
      toast.error(e?.message || "خطا در ارسال مجدد");
    } finally {
      setResendingId(null);
    }
  };

  const isMediaLog = (l: MessengerLog) => l.kind === "photo" || l.kind === "video";
  const filteredLogs = logs.filter((l) =>
    logFilter === "all" ? true : logFilter === "media" ? isMediaLog(l) : !isMediaLog(l),
  );
  const mediaSentCount = logs.filter((l) => isMediaLog(l) && l.status === "sent").length;
  const mediaFailedCount = logs.filter((l) => isMediaLog(l) && l.status !== "sent").length;

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: l }, { data: c }] = await Promise.all([
        db.from("messenger_settings").select("*").eq("provider", "bale").maybeSingle(),
        db.from("messenger_logs").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("messenger_chats").select("*").order("updated_at", { ascending: false }).limit(100),
      ]);
      if (s) {
        setSettings({
          id: s.id,
          enabled: !!s.enabled,
          send_media: s.send_media !== false,
          notify_ceo: s.notify_ceo !== false,
          bot_username: s.bot_username,
        });
      }
      setLogs((l as MessengerLog[]) || []);
      setChats((c as MessengerChat[]) || []);
    } catch (e: any) {
      toast.error(e?.message || "خطا در دریافت اطلاعات پیامرسان");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (changes: Partial<MessengerSettings>) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    setSaving(true);
    try {
      const { error } = await db
        .from("messenger_settings")
        .update({
          enabled: next.enabled,
          send_media: next.send_media,
          notify_ceo: next.notify_ceo,
          updated_at: new Date().toISOString(),
        })
        .eq("provider", "bale");
      if (error) throw error;
      toast.success("تنظیمات ذخیره شد");
    } catch (e: any) {
      toast.error(e?.message || "خطا در ذخیره تنظیمات");
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const connectBot = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-bale-message", {
        body: { action: "setup" },
      });
      if (error) throw error;
      toast.success("ربات بله متصل شد");
      console.log("[bale setup]", data);
    } catch (e: any) {
      toast.error(e?.message || "خطا در اتصال ربات بله");
    } finally {
      setConnecting(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const media = testMedia
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url }));
      const { data, error } = await supabase.functions.invoke("send-bale-message", {
        body: { phone: testPhone, text: testText, media, force: true },
      });
      if (error) throw error;
      if ((data as any)?.success) toast.success("پیام در بله ارسال شد");
      else toast.error("ارسال پیام در بله موفق نبود");
      load();
    } catch (e: any) {
      toast.error(e?.message || "خطا در ارسال پیام");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" />
            ارسال پیام در پیامرسان بله ({settings.bot_username || "@ahrom_ir_bot"})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">ارسال پیام از طریق بله</Label>
              <p className="text-xs text-muted-foreground mt-1">
                با فعال بودن این گزینه، همه پیام‌های مراحل سفارش علاوه بر پیامک، در بله هم برای مشتری ارسال می‌شود.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              disabled={saving}
              onCheckedChange={(v) => patch({ enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">ارسال عکس و فیلم پیشرفت پروژه</Label>
              <p className="text-xs text-muted-foreground mt-1">
                آخرین عکس‌ها و فیلم‌های ثبت‌شده روی سفارش همراه گزارش مرحله ارسال می‌شود.
              </p>
            </div>
            <Switch
              checked={settings.send_media}
              disabled={saving || !settings.enabled}
              onCheckedChange={(v) => patch({ send_media: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">اطلاع به مدیرعامل در بله</Label>
              <p className="text-xs text-muted-foreground mt-1">
                پیام‌های مخصوص مدیرعامل هم در بله ارسال شود.
              </p>
            </div>
            <Switch
              checked={settings.notify_ceo}
              disabled={saving || !settings.enabled}
              onCheckedChange={(v) => patch({ notify_ceo: v })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={connectBot} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Link2 className="h-4 w-4 ml-1" />}
              اتصال ربات بله
            </Button>
            <Button size="sm" variant="ghost" onClick={load}>
              <RefreshCw className="h-4 w-4 ml-1" />
              بارگذاری مجدد
            </Button>
            <span className="text-xs text-muted-foreground">
              ارسال پیام‌ها با وب‌سرویس رسمی بله بر پایه شماره موبایل انجام می‌شود؛ نیازی به استارت کردن ربات {settings.bot_username || "@ahrom_ir_bot"} توسط مشتری نیست. خود عکس و فیلم (نه لینک) برای مشتری ارسال می‌شود؛ فایل‌های سنگین‌تر از ۴۵ مگابایت قابل ارسال نیستند و در گزارش پایین علت آن ثبت می‌شود.
            </span>
          </div>
        </CardContent>
      </Card>

      <BaleVideoCompressionPanel />


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ارسال آزمایشی / دستی</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">شماره تماس مشتری</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                لینک عکس یا فیلم (هر خط یک لینک)
              </Label>
              <Input value={testMedia} onChange={(e) => setTestMedia(e.target.value)} dir="ltr" placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">متن پیام</Label>
            <Textarea value={testText} onChange={(e) => setTestText(e.target.value)} rows={4} />
          </div>
          <Button size="sm" onClick={sendTest} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Send className="h-4 w-4 ml-1" />}
            ارسال در بله
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">کاربران متصل به ربات ({chats.length.toLocaleString("fa-IR")})</CardTitle>
        </CardHeader>
        <CardContent>
          {chats.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز کاربری ربات بله را استارت نکرده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>نام کاربری</TableHead>
                  <TableHead>شماره تماس</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.full_name || "—"}</TableCell>
                    <TableCell dir="ltr">{c.username || "—"}</TableCell>
                    <TableCell dir="ltr">{c.phone || "ثبت نشده"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">گزارش ارسال بله ({logs.length.toLocaleString("fa-IR")})</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="default" className="text-xs">
              عکس و فیلم ارسال‌شده: {mediaSentCount.toLocaleString("fa-IR")}
            </Badge>
            <Badge variant={mediaFailedCount > 0 ? "destructive" : "secondary"} className="text-xs">
              عکس و فیلم ناموفق: {mediaFailedCount.toLocaleString("fa-IR")}
            </Badge>
            <div className="flex gap-1 mr-auto">
              {([
                ["all", "همه"],
                ["media", "عکس و فیلم"],
                ["text", "متن"],
              ] as const).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={logFilter === key ? "default" : "outline"}
                  onClick={() => setLogFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">موردی برای نمایش نیست.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>تاریخ</TableHead>
                    <TableHead>گیرنده</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>فایل</TableHead>
                    <TableHead>سفارش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>ارسال مجدد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("fa-IR")}
                      </TableCell>
                      <TableCell dir="ltr" className="text-xs">{l.phone || l.chat_id}</TableCell>
                      <TableCell className="text-xs">
                        {l.kind === "video" ? "فیلم" : l.kind === "photo" ? "عکس" : "متن"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.media_url ? (
                          <a
                            href={l.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            مشاهده فایل
                          </a>
                        ) : (
                          "—"
                        )}
                        {l.text && (
                          <p className="mt-1 max-w-[260px] whitespace-pre-line text-[11px] text-muted-foreground">
                            {l.text}
                          </p>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="text-xs">{l.order_code || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === "sent" ? "default" : "destructive"}>
                          {l.status === "sent"
                            ? l.kind === "text"
                              ? "ارسال شد"
                              : "فایل ارسال شد"
                            : "ناموفق"}
                        </Badge>
                        {l.status !== "sent" && l.provider_response ? (
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-[220px] truncate">
                            {l.provider_response}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendingId === l.id}
                          onClick={() => resendLog(l)}
                        >
                          {resendingId === l.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
                          ) : (
                            <Send className="h-3.5 w-3.5 ml-1" />
                          )}
                          ارسال مجدد
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default BaleMessengerTab;
