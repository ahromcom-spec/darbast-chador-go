import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NoMaterialsPricingItem {
  id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  description: string | null;
  sort_order: number;
}

const QUERY_KEY = ['scaffolding-no-materials-pricing-config'];

/**
 * قیمت‌گذاری «خدمات اجرای داربست بدون اجناس» (subcategory code = 20).
 * مستقل از قیمت‌گذاری اجرای همراه اجناس. با realtime همگام می‌شود.
 */
export const useScaffoldingNoMaterialsPricing = () => {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<NoMaterialsPricingItem[]> => {
      const { data, error } = await supabase
        .from('scaffolding_no_materials_pricing_config' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as NoMaterialsPricingItem[];
    },
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel('scaffolding-no-materials-pricing-config-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scaffolding_no_materials_pricing_config' },
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
