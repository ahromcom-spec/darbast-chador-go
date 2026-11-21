import { PageHeader } from '@/components/common/PageHeader';
import { CustomerProjectsTab } from '@/components/executive/CustomerProjectsTab';

export default function ExecutiveCustomerProjects() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="پروژه‌های مشتریان"
        description="همه آدرس‌ها و پروژه‌های مشتریان؛ انتقال یا افزودن همکار برای یک آدرس کامل یا پروژه‌های انتخابی"
        showBackButton
        backTo="/executive"
      />
      <CustomerProjectsTab />
    </div>
  );
}
