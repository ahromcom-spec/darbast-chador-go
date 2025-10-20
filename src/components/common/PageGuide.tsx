import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useGuide } from '@/contexts/GuideContext';
import { getGuideForPage } from '@/data/pageGuides';
import { useContractorRole } from '@/hooks/useContractorRole';
import { useCEORole } from '@/hooks/useCEORole';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { useSalesManagerRole } from '@/hooks/useSalesManagerRole';
import { useFinanceManagerRole } from '@/hooks/useFinanceManagerRole';
import { useExecutiveManagerRole } from '@/hooks/useExecutiveManagerRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PageGuide = () => {
  const { isGuideEnabled } = useGuide();
  const location = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { isContractor } = useContractorRole();
  const { isCEO } = useCEORole();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const { isSalesManager } = useSalesManagerRole();
  const { isFinanceManager } = useFinanceManagerRole();
  const { isExecutiveManager } = useExecutiveManagerRole();

  const isCustomer = !isContractor && !isCEO && !isAdmin && !isGeneralManager && 
                     !isSalesManager && !isFinanceManager && !isExecutiveManager;

  useEffect(() => {
    setIsDismissed(false);
  }, [location.pathname]);

  if (!isGuideEnabled || isDismissed) return null;

  const guideText = getGuideForPage(location.pathname, {
    isCustomer,
    isContractor,
    isAdmin,
    isCEO,
    isGeneralManager,
    isSalesManager,
    isFinanceManager,
    isExecutiveManager,
  });

  if (!guideText) return null;

  return (
    <Alert className="mb-4 bg-primary/5 border-primary/20">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <AlertDescription className="flex-1 text-sm leading-relaxed">
          {guideText}
        </AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-6 w-6 p-0 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};
