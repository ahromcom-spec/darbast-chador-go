import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Database, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Temporary export page — used to generate a full ZIP of the database
 * for the self-hosted Supabase migration. Restricted server-side to
 * `ceo` / `general_manager` / `admin` roles via the edge function.
 */
const AdminExport = () => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("ابتدا وارد حساب کاربری خود شوید");
        return;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/export-database`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `ahrom-db-export-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("فایل پشتیبان با موفقیت دانلود شد");
    } catch (err: any) {
      console.error("export failed", err);
      toast.error(err.message || "خطا در دریافت پشتیبان");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">صادرات کامل دیتابیس</h1>
          <p className="text-muted-foreground text-sm">
            دانلود فایل ZIP حاوی تمامی جداول public و auth برای مهاجرت به سرور Self-Hosted
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            دریافت فایل پشتیبان
          </CardTitle>
          <CardDescription>
            خروجی شامل تمامی جداول schema عمومی + کاربران auth.users و auth.identities است.
            جداول خالی در فایل قرار نمی‌گیرند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>دسترسی محدود</AlertTitle>
            <AlertDescription>
              فقط مدیرعامل، مدیران ارشد و ادمین مجاز به استفاده از این قابلیت هستند.
              عملیات صادرات از سمت سرور و با کلید service_role انجام می‌شود.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>توجه</AlertTitle>
            <AlertDescription>
              این صفحه موقتی است و پس از پایان عملیات مهاجرت باید حذف شود.
              فایل خروجی شامل اطلاعات حساس کاربران است؛ آن را در محل امن نگهداری کنید.
            </AlertDescription>
          </Alert>

          <Button
            size="lg"
            className="w-full"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                در حال تهیه فایل... (ممکن است چند دقیقه طول بکشد)
              </>
            ) : (
              <>
                <Download className="ml-2 h-5 w-5" />
                دانلود فایل ZIP کامل دیتابیس
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>محتوای ZIP:</p>
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li><code>public/*.json</code> — یک فایل به ازای هر جدول</li>
              <li><code>auth/users.json</code> — کاربران احراز هویت</li>
              <li><code>auth/identities.json</code> — اتصالات OAuth</li>
              <li><code>MANIFEST.json</code> — تعداد ردیف هر جدول و زمان صادرات</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminExport;
