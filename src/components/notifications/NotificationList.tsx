import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { Check, Info, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

interface NotificationListProps {
  onClose?: () => void;
}

export const NotificationList = ({ onClose }: NotificationListProps) => {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    
    // اگر لینک به سفارش است، اطلاعات پروژه را بگیر و به پروژه‌های من هدایت کن
    if (notification.link && notification.link.startsWith('/orders/')) {
      const orderId = notification.link.split('/orders/')[1]?.split(/[?#]/)[0];
      
      try {
        // دریافت اطلاعات سفارش
        const { data: order, error } = await supabase
          .from('projects_v3')
          .select('id, hierarchy_project_id')
          .eq('id', orderId)
          .maybeSingle();
        
        if (error) throw error;
        
        if (order?.hierarchy_project_id) {
          // دریافت اطلاعات پروژه برای location_id
          const { data: project, error: projError } = await supabase
            .from('projects_hierarchy')
            .select('id, location_id')
            .eq('id', order.hierarchy_project_id)
            .maybeSingle();
          
          if (projError) throw projError;
          
          if (project) {
            onClose?.();
            // هدایت به پروژه‌های من با باز کردن خودکار آدرس، پروژه و هایلایت سفارش
            setTimeout(() => navigate('/user/projects', {
              state: {
                expandLocationId: project.location_id,
                expandProjectId: project.id,
                highlightOrderId: orderId
              }
            }), 50);
            return;
          }
        }
      } catch (error) {
        console.error('خطا در دریافت اطلاعات سفارش:', error);
      }
    }

    // تلاش برای استخراج کد سفارش از عنوان/متن اعلان و هدایت به پروژه‌ها (پوشه آدرس/نوع خدمت)
    try {
      const mergedText = `${notification.title ?? ''} ${notification.body ?? ''}`;
      const match = mergedText.match(/\b(\d{6,8})\b/);
      if (match) {
        const orderCode = match[1];
        const { data: orderByCode, error: orderByCodeErr } = await supabase
          .from('projects_v3')
          .select('id, hierarchy_project_id')
          .eq('code', orderCode)
          .maybeSingle();

        if (!orderByCodeErr && orderByCode) {
          if (orderByCode.hierarchy_project_id) {
            const { data: project2, error: projErr2 } = await supabase
              .from('projects_hierarchy')
              .select('id, location_id')
              .eq('id', orderByCode.hierarchy_project_id)
              .maybeSingle();

            if (!projErr2 && project2) {
              onClose?.();
              setTimeout(() => navigate('/user/projects', {
                state: {
                  expandLocationId: project2.location_id,
                  expandProjectId: project2.id,
                  highlightOrderId: orderByCode.id
                }
              }), 50);
              return;
            }
          }
        }
      }
    } catch (e) {
      console.error('خطا در مسیریابی بر اساس کد سفارش:', e);
    }
    
    // اگر notification لینک دیگری دارد، آن را نرمال‌سازی کن (لینک‌های لیست سفارش‌ها -> پروژه‌های من)
    if (notification.link) {
      const ordersList = /^\/user\/(orders|my-orders)/.test(notification.link) || notification.link === '/projects';
      onClose?.();
      setTimeout(() => navigate(ordersList ? '/user/projects' : notification.link), 50);
      return;
    }
    
    // هدایت به صفحه پروژه‌های من
    onClose?.();
    setTimeout(() => navigate('/user/projects'), 50);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        در حال بارگذاری...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">اعلانی وجود ندارد</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">اعلانات</h3>
        {notifications.some(n => !n.read_at) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="h-auto p-1 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            همه را خوانده شده
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="divide-y">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={cn(
                'p-4 hover:bg-accent cursor-pointer transition-colors',
                !notification.read_at && 'bg-muted/50'
              )}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    {!notification.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.body}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: faIR,
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const Bell = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
