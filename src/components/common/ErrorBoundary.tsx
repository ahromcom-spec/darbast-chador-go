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
}

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>مشکلی پیش آمده است</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                متأسفانه خطایی رخ داده است. لطفاً صفحه را مجدداً بارگذاری کنید.
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
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                بارگذاری مجدد صفحه
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
