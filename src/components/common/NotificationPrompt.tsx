import { Bell, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export function NotificationPrompt() {
  const navigate = useNavigate();

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>دریافت اعلان‌های فوری 🔔</CardTitle>
            <CardDescription className="mt-1">
              از سفارشات جدید و به‌روزرسانی‌ها مطلع شوید
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          با فعال‌سازی اعلان‌ها، از تغییرات مهم در سفارشات، پیام‌های جدید و وضعیت پروژه‌ها بلافاصله مطلع می‌شوید - حتی اگر برنامه بسته باشد!
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={() => navigate('/settings/notifications')}
            className="w-full"
          >
            <Bell className="h-4 w-4 mr-2" />
            فعال‌سازی اعلان‌ها
          </Button>
          
          <Button
            onClick={() => navigate('/settings/install')}
            variant="outline"
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            نصب برنامه
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          💡 برای بهترین تجربه، ابتدا برنامه را نصب کنید
        </p>
      </CardContent>
    </Card>
  );
}
