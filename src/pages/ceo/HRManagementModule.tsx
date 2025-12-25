import { MainLayout } from '@/components/layouts/MainLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HRManagement } from '@/components/ceo/HRManagement';
import { ModuleHeader } from '@/components/common/ModuleHeader';
import { Users } from 'lucide-react';

export default function HRManagementModule() {
  usePageTitle('ماژول مدیریت منابع انسانی');

  return (
    <MainLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <ModuleHeader 
          title="ماژول مدیریت منابع انسانی"
          description="ثبت و مدیریت نیروهای شرکت اهرم"
          icon={<Users className="h-5 w-5" />}
          backTo="/profile?tab=modules"
        />
        
        <HRManagement showAsCard={false} />
      </div>
    </MainLayout>
  );
}
