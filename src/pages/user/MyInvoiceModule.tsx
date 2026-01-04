import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { CustomerInvoice } from '@/components/profile/CustomerInvoice';

export default function MyInvoiceModule() {
  return (
    <ModuleLayout
      defaultModuleKey="my_invoice"
      defaultTitle="صورتحساب من"
      defaultDescription="مشاهده صورتحساب جامع سفارشات و پرداخت‌ها"
    >
      <CustomerInvoice />
    </ModuleLayout>
  );
}
