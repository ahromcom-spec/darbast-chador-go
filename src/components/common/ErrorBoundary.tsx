import { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { getSafeErrorMessage } from '@/lib/security';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack?: string;
}

const isChunkLoadLikeError = (error: unknown): boolean => {
  const msg = (error as any)?.message || String(error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
};

const clearBrowserCachesAndReload = async () => {
  // Avoid infinite loops
  const FLAG = '__ahrom_cache_clear_attempted__';
  try {
    if (sessionStorage.getItem(FLAG) === '1') {
      window.location.reload();
      return;
    }
    sessionStorage.setItem(FLAG, '1');

    // Clear Cache Storage (PWA caches)
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Force a fresh navigation (bust potential HTML cache)
    const url = new URL(window.location.href);
    url.searchParams.set('__reload', Date.now().toString());
    window.location.replace(url.toString());
  } catch (e) {
    // Fallback
    console.error('Cache clear failed:', e);
    window.location.reload();
  }
};

const copyErrorDetails = async (error: Error, componentStack?: string) => {
  const payload = [
    `Message: ${error.message || ''}`,
    error.stack ? `\nStack:\n${error.stack}` : '',
    componentStack ? `\nComponentStack:\n${componentStack}` : '',
    `\nURL: ${window.location.href}`,
    `\nTime: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await navigator.clipboard.writeText(payload);
  } catch {
    // Clipboard may be blocked; do nothing.
  }
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
}

componentDidCatch(error: Error, errorInfo: any) {
  console.error('Error caught by boundary:', error, errorInfo);
  this.setState({ componentStack: errorInfo?.componentStack });
}

  render() {
    if (this.state.hasError) {
      const chunky = isChunkLoadLikeError(this.state.error);
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>مشکلی پیش آمده است</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                {chunky
                  ? 'به‌نظر می‌رسد فایل‌های برنامه از کش قدیمی بارگذاری شده‌اند. لطفاً با پاکسازی کش، صفحه را مجدداً بارگذاری کنید.'
                  : 'متأسفانه خطایی رخ داده است. لطفاً صفحه را مجدداً بارگذاری کنید.'}
              </p>
              {this.state.error && (
                <div className="text-xs mb-4 opacity-75 space-y-2">
                  <p>{getSafeErrorMessage(this.state.error)}</p>
                  {this.state.error.message && (
                    <details className="mt-2">
                      <summary>جزئیات خطا</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words">
                        {this.state.error.message}
                        {this.state.error.stack ? `\n\n${this.state.error.stack.split('\n').slice(0,5).join('\n')}` : ''}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  بارگذاری مجدد صفحه
                </Button>

                <Button
                  onClick={() => clearBrowserCachesAndReload()}
                  variant="default"
                >
                  پاکسازی کش و بارگذاری مجدد
                </Button>

                {this.state.error && (
                  <Button
                    onClick={() => copyErrorDetails(this.state.error as Error, this.state.componentStack)}
                    variant="secondary"
                  >
                    کپی جزئیات خطا
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
