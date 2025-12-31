import { MainLayout } from '@/components/layouts/MainLayout';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HRManagement } from '@/components/ceo/HRManagement';
import { Users } from 'lucide-react';

const DEFAULT_TITLE = 'ماژول مدیریت منابع انسانی';
const DEFAULT_DESCRIPTION = 'ثبت و مدیریت نیروهای شرکت اهرم';

export default function HRManagementModule() {
  usePageTitle('ماژول مدیریت منابع انسانی');

  return (
    <MainLayout>
      <ModuleLayout
        defaultModuleKey="hr_management"
        defaultTitle={DEFAULT_TITLE}
        defaultDescription={DEFAULT_DESCRIPTION}
        icon={<Users className="h-5 w-5 text-primary" />}
      >
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
          <HRManagement showAsCard={false} />
        </div>
      </ModuleLayout>
    </MainLayout>
  );
}
