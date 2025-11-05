import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSalesManagerRole } from './useSalesManagerRole';

export const useSalesPendingCount = () => {
  const { isSalesManager } = useSalesManagerRole();

  return useQuery({
    queryKey: ['sales-pending-count'],
    queryFn: async () => {
      if (!isSalesManager) return 0;

      // تلاش برای استفاده از RPC اگر موجود باشد
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_sales_pending_orders');

      if (!rpcError && rpcData) {
        return rpcData.length;
      }

      // در غیر این صورت، کوئری مستقیم با اتکا به RLS
      const { count, error } = await supabase
        .from('projects_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching sales pending count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: isSalesManager,
    refetchInterval: 30000, // به‌روزرسانی هر 30 ثانیه
    staleTime: 20000, // داده‌ها تا 20 ثانیه fresh محسوب می‌شوند
  });
};
