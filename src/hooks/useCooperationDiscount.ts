import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { rankToDiscountPercent } from '@/lib/cooperationDiscount';

/**
 * دریافت رتبه همکاری کاربر فعلی و درصد تخفیف معادل.
 */
export const useCooperationDiscount = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['cooperation-rank', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('cooperation_rank')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.cooperation_rank as number | null) ?? 1;
    },
    staleTime: 5 * 60 * 1000,
  });

  const rank = data ?? 1;
  const discountPercent = rankToDiscountPercent(rank);

  return { rank, discountPercent, isLoading };
};
