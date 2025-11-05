import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCEORole } from './useCEORole';

export const useCEOPendingCount = () => {
  const { isCEO } = useCEORole();

  return useQuery({
    queryKey: ['ceo-pending-count'],
    queryFn: async () => {
      if (!isCEO) return 0;

      // دریافت سفارشات pending که هنوز توسط CEO تایید نشده‌اند
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('id')
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching CEO pending count:', error);
        return 0;
      }

      if (!orders || orders.length === 0) return 0;

      // بررسی کنیم کدام سفارشات هنوز approval CEO ندارند
      const pendingPromises = orders.map(async (order) => {
        const { data: approval } = await supabase
          .from('order_approvals')
          .select('approved_at')
          .eq('order_id', order.id)
          .eq('approver_role', 'ceo')
          .maybeSingle();
        
        // اگر approval وجود داشته باشد و approved_at خالی باشد، پس منتظر تایید است
        return approval && !approval.approved_at ? 1 : 0;
      });

      const results = await Promise.all(pendingPromises);
      return results.reduce((sum, val) => sum + val, 0);
    },
    enabled: isCEO,
    refetchInterval: 30000, // به‌روزرسانی هر 30 ثانیه
    staleTime: 20000, // داده‌ها تا 20 ثانیه fresh محسوب می‌شوند
  });
};
