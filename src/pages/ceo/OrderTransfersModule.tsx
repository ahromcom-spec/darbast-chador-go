import OrderTransferManagement from '@/pages/admin/OrderTransferManagement';

/**
 * ماژول مستقل «انتقال و همکاری سفارش»
 * این اقدامات از ماژول مدیریت سفارشات خارج شده و به‌صورت یک ماژول مادر مستقل
 * در پروفایل مدیرعامل (بخش ماژول‌ها) قابل دسترسی است.
 */
export default function OrderTransfersModule() {
  return <OrderTransferManagement />;
}
