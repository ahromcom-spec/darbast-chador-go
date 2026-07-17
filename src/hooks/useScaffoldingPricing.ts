import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PricingItem {
  id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  description: string | null;
  sort_order: number;
}

const QUERY_KEY = ['scaffolding-pricing-config'];

/**
 * Hook برای خواندن تنظیمات قیمت‌گذاری داربست
 * مقادیر در دیتابیس قابل تغییر هستند و فرم بر اساس آن‌ها قیمت می‌دهد.
 * با realtime به‌روزرسانی می‌شود تا تغییرات CEO بلافاصله در فرم سفارش اعمال شود.
 */
export const useScaffoldingPricing = () => {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<PricingItem[]> => {
      const { data, error } = await supabase
        .from('scaffolding_pricing_config')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as PricingItem[];
    },
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Realtime: هر تغییر در جدول قیمت‌گذاری بلافاصله در همه فرم‌ها اعمال شود
  useEffect(() => {
    const channel = supabase
      .channel('scaffolding-pricing-config-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scaffolding_pricing_config' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const map = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.key] = Number(it.value) || 0;
    return acc;
  }, {});

  const get = (key: string, fallback: number): number => {
    return key in map ? map[key] : fallback;
  };

  return { items, map, get, isLoading, refetch };
};
