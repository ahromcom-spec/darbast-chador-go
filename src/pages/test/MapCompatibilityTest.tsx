import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface CompatibilityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export default function MapCompatibilityTest() {
  const [checks, setChecks] = useState<CompatibilityCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runChecks = () => {
      const results: CompatibilityCheck[] = [];

      // Check 1: Leaflet library
      try {
        if (typeof window !== 'undefined' && (window as any).L) {
          results.push({
            name: 'کتابخانه Leaflet',
            status: 'pass',
            message: 'Leaflet با موفقیت بارگذاری شد'
          });
        } else {
          results.push({
            name: 'کتابخانه Leaflet',
            status: 'fail',
            message: 'Leaflet بارگذاری نشد'
          });
        }
      } catch (err) {
        results.push({
          name: 'کتابخانه Leaflet',
          status: 'fail',
          message: 'خطا در بررسی Leaflet'
        });
      }

      // Check 2: Browser compatibility
      const userAgent = navigator.userAgent;
      const isOldBrowser = /MSIE|Trident/.test(userAgent);
      
      if (isOldBrowser) {
        results.push({
          name: 'سازگاری مرورگر',
          status: 'fail',
          message: 'مرورگر شما قدیمی است و پشتیبانی نمی‌شود'
        });
      } else {
        results.push({
          name: 'سازگاری مرورگر',
          status: 'pass',
          message: 'مرورگر شما پشتیبانی می‌شود'
        });
      }

      // Check 3: Canvas support
      const canvas = document.createElement('canvas');
      const hasCanvas = !!(canvas.getContext && canvas.getContext('2d'));
      
      results.push({
        name: 'پشتیبانی Canvas',
        status: hasCanvas ? 'pass' : 'fail',
        message: hasCanvas ? 'Canvas پشتیبانی می‌شود' : 'Canvas پشتیبانی نمی‌شود'
      });

      // Check 4: CSS support
      const supportsCSSVariables = window.CSS && window.CSS.supports && window.CSS.supports('--test', '0');
      
      results.push({
        name: 'متغیرهای CSS',
        status: supportsCSSVariables ? 'pass' : 'warn',
        message: supportsCSSVariables ? 'CSS Variables پشتیبانی می‌شود' : 'CSS Variables پشتیبانی نمی‌شود (ممکن است مشکلاتی داشته باشید)'
      });

      // Check 5: Internet connection
      results.push({
        name: 'اتصال اینترنت',
        status: navigator.onLine ? 'pass' : 'fail',
        message: navigator.onLine ? 'آنلاین هستید' : 'آفلاین هستید'
      });

      setChecks(results);
      setLoading(false);
    };

    runChecks();
  }, []);

  const getIcon = (status: 'pass' | 'fail' | 'warn') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warn':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">تست سازگاری نقشه</h1>
        
        {loading ? (
          <p>در حال بررسی...</p>
        ) : (
          <div className="space-y-4">
            {checks.map((check, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card"
              >
                <div className="mt-0.5">{getIcon(check.status)}</div>
                <div className="flex-1">
                  <h3 className="font-semibold">{check.name}</h3>
                  <p className="text-sm text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">اطلاعات مرورگر:</h3>
              <p className="text-xs text-muted-foreground break-all">
                {navigator.userAgent}
              </p>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold mb-2 text-blue-900 dark:text-blue-100">توصیه‌ها:</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>از آخرین نسخه مرورگر خود استفاده کنید</li>
                <li>مرورگرهای پیشنهادی: Chrome، Firefox، Safari، Edge</li>
                <li>اتصال اینترنت پایدار داشته باشید</li>
                <li>Cache مرورگر را پاک کنید اگر مشکل دارید</li>
              </ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
