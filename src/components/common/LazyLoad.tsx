import { Suspense, lazy } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface LazyLoadProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyLoad({ children, fallback }: LazyLoadProps) {
  const defaultFallback = (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="در حال بارگذاری..." />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

// Helper function to create lazy-loaded routes
export function lazyLoad<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);
  
  return (props: any) => (
    <LazyLoad>
      <LazyComponent {...props} />
    </LazyLoad>
  );
}
