import React, { Component, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MapErrorBoundary] Map error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-full h-full flex items-center justify-center p-8 bg-muted/30">
          <div className="text-center space-y-4 max-w-md">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                نقشه قابل نمایش نیست
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                متأسفانه نقشه در مرورگر شما قابل اجرا نیست. لطفاً:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 text-right list-disc list-inside">
                <li>مرورگر خود را به آخرین نسخه به‌روزرسانی کنید</li>
                <li>از مرورگرهای مدرن مثل Chrome، Edge یا Safari استفاده کنید</li>
                <li>صفحه را رفرش کنید (F5)</li>
                <li>Cache مرورگر را پاک کنید</li>
              </ul>
            </div>
            <div className="pt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                رفرش صفحه
              </button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
