import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, AlertCircle } from 'lucide-react';
import HybridGlobe from '@/components/globe/HybridGlobe';

// Error boundary برای مدیریت خطاهای Globe
class GlobeErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobeMap] Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
          <Card className="p-8 max-w-md text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">خطا در بارگذاری نقشه</h2>
            <p className="text-muted-foreground mb-4">
              نقشه نتوانست بارگذاری شود. لطفاً دوباره تلاش کنید.
            </p>
            <Button onClick={this.props.onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              تلاش مجدد
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

const GlobeMap = () => {
  usePageTitle('نقشه کره زمین');
  const navigate = useNavigate();
  const [retryKey, setRetryKey] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // تاخیر کوتاه برای اطمینان از mount شدن کامل DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [retryKey]);

  const handleClose = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setIsReady(false);
    setRetryKey(prev => prev + 1);
  }, []);

  if (!isReady) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-lg font-semibold">در حال آماده‌سازی نقشه...</p>
        </div>
      </div>
    );
  }

  return (
    <GlobeErrorBoundary key={retryKey} onRetry={handleRetry}>
      <HybridGlobe onClose={handleClose} />
    </GlobeErrorBoundary>
  );
};

export default GlobeMap;
