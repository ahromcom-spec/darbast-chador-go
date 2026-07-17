import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CARPET_CLEANING_SUBCATEGORY_ID = 'da5fb7be-e703-4dc1-87e8-2386eb1697b9';

export interface CarpetPricingItem {
  id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  description: string | null;
  sort_order: number;
}

const QUERY_KEY = ['carpet-cleaning-pricing-config'];

/**
 * پیکربندی قیمت خدمات قالی‌شویی از جدول subcategory_pricing_items خوانده می‌شود
 * تا CEO از ماژول «قیمت‌گذاری خدمت» بتواند قیمت‌ها را تغییر دهد و بلافاصله
 * در فرم سفارش مشتریان اعمال شود.
 */
export const useCarpetCleaningPricing = () => {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<CarpetPricingItem[]> => {
      const { data, error } = await supabase
        .from('subcategory_pricing_items' as any)
        .select('id, key, category, label, value, unit, description, sort_order')
        .eq('subcategory_id', CARPET_CLEANING_SUBCATEGORY_ID)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as CarpetPricingItem[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel('carpet-cleaning-pricing-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subcategory_pricing_items',
          filter: `subcategory_id=eq.${CARPET_CLEANING_SUBCATEGORY_ID}`,
        },
        () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
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

  const get = (key: string, fallback: number): number =>
    key in map ? map[key] : fallback;

  return { items, map, get, isLoading };
};
