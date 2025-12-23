import { MainLayout } from '@/components/layouts/MainLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HRManagement } from '@/components/ceo/HRManagement';

export default function HRManagementModule() {
  usePageTitle('ماژول مدیریت منابع انسانی');

  return (
    <MainLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PageHeader 
          title="ماژول مدیریت منابع انسانی"
          description="ثبت و مدیریت نیروهای شرکت اهرم"
          showBackButton
        />
        
        <HRManagement showAsCard={false} />
      </div>
    </MainLayout>
  );
}
