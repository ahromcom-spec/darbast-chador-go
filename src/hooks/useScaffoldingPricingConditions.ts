import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PricingConfigTable =
  | 'scaffolding_pricing_config'
  | 'scaffolding_no_materials_pricing_config';

export interface PricingConditionRow {
  id: string;
  config_table: PricingConfigTable;
  category: string;
  conditions: string;
}

/**
 * شروط و «اگر و اما»های قیمت‌گذاری برای هر بخش (category) ماژول قیمت‌گذاری داربست.
 * این متن‌ها در محاسبه/پاسخ قیمت به کاربران (دستیار اهرم) استفاده می‌شوند.
 */
export const useScaffoldingPricingConditions = (configTable: PricingConfigTable) => {
  const queryClient = useQueryClient();
  const QUERY_KEY = ['scaffolding-pricing-conditions', configTable];

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<PricingConditionRow[]> => {
      const { data, error } = await supabase
        .from('scaffolding_pricing_conditions' as any)
        .select('*')
        .eq('config_table', configTable);
      if (error) throw error;
      return ((data || []) as unknown) as PricingConditionRow[];
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`scaffolding-pricing-conditions-${configTable}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scaffolding_pricing_conditions' },
        () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, configTable]);

  const map = rows.reduce<Record<string, string>>((acc, r) => {
    acc[r.category] = r.conditions || '';
    return acc;
  }, {});

  const saveCondition = async (category: string, conditions: string) => {
    const { error } = await supabase
      .from('scaffolding_pricing_conditions' as any)
      .upsert(
        { config_table: configTable, category, conditions },
        { onConflict: 'config_table,category' }
      );
    if (error) throw error;
    await refetch();
  };

  return { rows, map, isLoading, refetch, saveCondition };
};
