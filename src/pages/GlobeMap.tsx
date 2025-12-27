import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

const HybridGlobe = lazy(() => import('@/components/globe/HybridGlobe'));

const GlobeMap = () => {
  usePageTitle('نقشه کره زمین');
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/');
  };

  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-lg font-semibold">در حال بارگذاری کره زمین...</p>
        </div>
      </div>
    }>
      <HybridGlobe onClose={handleClose} />
    </Suspense>
  );
};

export default GlobeMap;
