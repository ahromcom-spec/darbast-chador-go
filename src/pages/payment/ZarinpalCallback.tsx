import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { sendPushNotification, notifyCEOPayment } from "@/lib/notifications";

/**
 * صفحه بازگشت از زرین‌پال
 * این صفحه توسط زرین‌پال صدا زده می‌شود (callback_url)
 * و بلافاصله وضعیت پرداخت را از بک‌اند استعلام می‌کند.
 */
const ZarinpalCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const handleVerify = async () => {
      const params = new URLSearchParams(location.search);
      const authority = params.get("Authority");
      const status = params.get("Status");
      const orderId = params.get("order_id");
      const statementId = params.get("statement_id");
      const payAll = params.get("pay_all") === "1";

      const successRedirect = (statementId || payAll)
        ? `/my-invoice?payment=success`
        : `/user/orders/${orderId}?payment=success`;
      const failureRedirect = (statementId || payAll)
        ? `/my-invoice?payment=failed`
        : `/user/orders/${orderId}?payment=failed`;


      if (!authority || !orderId) {
        toast({
          title: "خطا در بازگشت از درگاه",
          description: "اطلاعات پرداخت نامعتبر است. لطفاً با پشتیبانی تماس بگیرید.",
          variant: "destructive",
        });
        navigate("/profile?tab=orders");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("zarinpal-verify", {
          body: {
            Authority: authority,
            Status: status,
            order_id: orderId,
            statement_id: statementId,
            pay_all: payAll,
          },

        });

        if (error) {
          console.error("ZarinPal verify function error:", error);
          toast({
            title: "خطا در تایید پرداخت",
            description: "لطفاً وضعیت سفارش را در صفحه سفارش‌ها بررسی کنید.",
            variant: "destructive",
          });
          navigate(failureRedirect);
          return;
        }

        const paymentStatus = data?.status ?? "failed";

        if (paymentStatus === "success" || paymentStatus === "already_verified") {
          toast({
            title: "پرداخت با موفقیت انجام شد",
            description: statementId
              ? "صورتحساب شما به‌روزرسانی شد."
              : "وضعیت سفارش شما به‌روزرسانی شد.",
          });

          // Najva push: CEO + customer
          try {
            const paidAmount = Number(data?.amount || 0);
            let orderCode = '';
            let customerName = '';
            let customerPhone = '';
            if (orderId) {
              const { data: ord } = await supabase
                .from('projects_v3')
                .select('code, customer_name, customer_phone')
                .eq('id', orderId)
                .maybeSingle();
              orderCode = ord?.code || '';
              customerName = ord?.customer_name || '';
              customerPhone = ord?.customer_phone || '';
            }
            if (paymentStatus === 'success' && paidAmount > 0) {
              notifyCEOPayment({
                orderCode,
                orderId: orderId || undefined,
                amount: paidAmount,
                customerName,
                customerPhone,
                method: 'zarinpal',
              }).catch(() => {});
              try {
                const { sendOrderSms, sendCeoNotificationSms } = await import('@/lib/orderSms');
                if (customerPhone && orderCode) {
                  sendOrderSms(customerPhone, orderCode, 'paid', {
                    orderId: orderId || undefined,
                    serviceType: 'سفارش',
                    amount: paidAmount,
                  }).catch(() => {});
                }
                if (orderCode) {
                  sendCeoNotificationSms(orderCode, 'paid', {
                    orderId: orderId || undefined,
                    amount: paidAmount,
                    customerName,
                  }).catch(() => {});
                }
              } catch {}
            }
            if (user?.id && paidAmount > 0) {
              sendPushNotification({
                user_id: user.id,
                title: 'پرداخت موفق ✓',
                body: `پرداخت ${paidAmount.toLocaleString('fa-IR')} تومان برای سفارش ${orderCode} با موفقیت انجام شد.`,
                link: orderId ? `/user/orders/${orderId}` : '/user/my-orders',
                type: 'payment_success',
              }).catch(() => {});
            }
          } catch (e) {
            console.error('ZarinPal post-verify notification error:', e);
          }

          navigate(successRedirect);
        } else {
          toast({
            title: "پرداخت ناموفق بود",
            description: "در صورت کسر وجه، لطفاً با پشتیبانی در تماس باشید.",
            variant: "destructive",
          });
          navigate(failureRedirect);
        }
      } catch (err) {
        console.error("ZarinPal verify error:", err);
        toast({
          title: "خطای غیرمنتظره در تایید پرداخت",
          description: "لطفاً مجدداً تلاش کنید یا با پشتیبانی تماس بگیرید.",
          variant: "destructive",
        });
        navigate("/profile?tab=orders");
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
