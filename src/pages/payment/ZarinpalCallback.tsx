import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

/**
 * صفحه بازگشت از زرین‌پال
 * این صفحه توسط زرین‌پال صدا زده می‌شود (callback_url)
 * و بلافاصله وضعیت پرداخت را از بک‌اند استعلام می‌کند.
 */
const ZarinpalCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleVerify = async () => {
      const params = new URLSearchParams(location.search);
      const authority = params.get("Authority");
      const status = params.get("Status");
      const orderId = params.get("order_id");

      if (!authority || !orderId) {
        toast({
          title: "خطا در بازگشت از درگاه",
          description: "اطلاعات پرداخت نامعتبر است. لطفاً با پشتیبانی تماس بگیرید.",
          variant: "destructive",
        });
        navigate("/user/my-orders");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("zarinpal-verify", {
          body: {
            Authority: authority,
            Status: status,
            order_id: orderId,
          },
        });

        if (error) {
          console.error("ZarinPal verify function error:", error);
          toast({
            title: "خطا در تایید پرداخت",
            description: "لطفاً وضعیت سفارش را در صفحه سفارش‌ها بررسی کنید.",
            variant: "destructive",
          });
          navigate(`/orders/${orderId}?payment=failed`);
          return;
        }

        const paymentStatus = data?.status ?? "failed";

        if (paymentStatus === "success" || paymentStatus === "already_verified") {
          toast({
            title: "پرداخت با موفقیت انجام شد",
            description: "وضعیت سفارش شما به‌روزرسانی شد.",
          });
        } else {
          toast({
            title: "پرداخت ناموفق بود",
            description: "در صورت کسر وجه، لطفاً با پشتیبانی در تماس باشید.",
            variant: "destructive",
          });
        }

        navigate(`/orders/${orderId}?payment=${paymentStatus}`);
      } catch (err) {
        console.error("ZarinPal verify error:", err);
        toast({
          title: "خطای غیرمنتظره در تایید پرداخت",
          description: "لطفاً مجدداً تلاش کنید یا با پشتیبانی تماس بگیرید.",
          variant: "destructive",
        });
        navigate("/user/my-orders");
      }
    };

    handleVerify();
  }, [location.search, navigate, toast]);

  return (
    <MainLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="در حال تایید پرداخت..." />
      </div>
    </MainLayout>
  );
};

export default ZarinpalCallback;
