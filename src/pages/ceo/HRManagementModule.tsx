import { MainLayout } from '@/components/layouts/MainLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSearchParams } from 'react-router-dom';
import { HRManagement } from '@/components/ceo/HRManagement';
import { ModuleHeader } from '@/components/common/ModuleHeader';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import { Users } from 'lucide-react';

const DEFAULT_TITLE = 'ماژول مدیریت منابع انسانی';
const DEFAULT_DESCRIPTION = 'ثبت و مدیریت نیروهای شرکت اهرم';

export default function HRManagementModule() {
  usePageTitle('ماژول مدیریت منابع انسانی');
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || 'hr_management';
  const { moduleName, moduleDescription } = useModuleAssignmentInfo(activeModuleKey, DEFAULT_TITLE, DEFAULT_DESCRIPTION);

  return (
    <MainLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <ModuleHeader 
          title={moduleName}
          description={moduleDescription}
          icon={<Users className="h-5 w-5" />}
          backTo="/profile?tab=modules"
        />
        
        <HRManagement showAsCard={false} />
      </div>
    </MainLayout>
  );
}
