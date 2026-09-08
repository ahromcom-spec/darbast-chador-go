import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingRule, RuleCondition, RuleActionType } from '@/lib/pricingRules';
import type { PricingConfigTable } from './useScaffoldingPricingConditions';

const TABLE = 'scaffolding_pricing_rules';

const normalize = (row: any): PricingRule => ({
  id: row.id,
  config_table: row.config_table,
  category: row.category,
  title: row.title || '',
  is_enabled: row.is_enabled !== false,
  conditions: Array.isArray(row.conditions) ? (row.conditions as RuleCondition[]) : [],
  action_type: (row.action_type || 'increase_percent') as RuleActionType,
  action_value: Number(row.action_value) || 0,
  sort_order: Number(row.sort_order) || 0,
});

/**
 * شرط‌های ساختاریافته قیمت‌گذاری (قابل ساخت مرحله‌ای توسط مدیر ارشد)
 * که مستقیماً در محاسبه قیمت فرم سفارش اعمال می‌شوند.
 */
export const useScaffoldingPricingRules = (configTable: PricingConfigTable) => {
  const queryClient = useQueryClient();
  const QUERY_KEY = ['scaffolding-pricing-rules', configTable];

  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<PricingRule[]> => {
      const { data, error } = await supabase
        .from(TABLE as any)
        .select('*')
        .eq('config_table', configTable)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map(normalize);
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`scaffolding-pricing-rules-${configTable}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, configTable]);

  const byCategory = (category: string) => rules.filter((r) => r.category === category);

  const createRule = async (input: Omit<PricingRule, 'id' | 'config_table'>) => {
    const { error } = await supabase.from(TABLE as any).insert({
      config_table: configTable,
      category: input.category,
      title: input.title,
      is_enabled: input.is_enabled,
      conditions: input.conditions as any,
      action_type: input.action_type,
      action_value: input.action_value,
      sort_order: input.sort_order,
    } as any);
    if (error) throw error;
    await refetch();
  };

  const updateRule = async (id: string, patch: Partial<PricingRule>) => {
    const payload: Record<string, any> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.is_enabled !== undefined) payload.is_enabled = patch.is_enabled;
    if (patch.conditions !== undefined) payload.conditions = patch.conditions;
    if (patch.action_type !== undefined) payload.action_type = patch.action_type;
    if (patch.action_value !== undefined) payload.action_value = patch.action_value;
    if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
    const { error } = await supabase.from(TABLE as any).update(payload as any).eq('id', id);
    if (error) throw error;
    await refetch();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from(TABLE as any).delete().eq('id', id);
    if (error) throw error;
    await refetch();
  };

  /**
   * شرط‌های متنی هر بخش را به قوانین قابل‌اجرا تبدیل می‌کند تا مستقیماً
   * روی قیمت فرم سفارش اثر بگذارند. متن حذف‌شده، قانون تولیدشده‌اش هم حذف می‌شود.
   */
  const syncRulesFromTexts = async (
    category: string,
    texts: string[],
    categoryLabel?: string,
  ): Promise<{ created: number; removed: number; skipped: string[] }> => {
    const wanted = texts.map((t) => t.trim()).filter(Boolean);

    const { data: existingRows, error: exErr } = await supabase
      .from(TABLE as any)
      .select('id, source_text')
      .eq('config_table', configTable)
      .eq('category', category)
      .not('source_text', 'is', null);
    if (exErr) throw exErr;

    const existing = ((existingRows || []) as unknown) as { id: string; source_text: string }[];
    const stale = existing.filter((r) => !wanted.includes((r.source_text || '').trim()));
    if (stale.length) {
      const { error } = await supabase
        .from(TABLE as any)
        .delete()
        .in('id', stale.map((r) => r.id));
      if (error) throw error;
    }

    const alreadyCovered = new Set(
      existing
        .filter((r) => wanted.includes((r.source_text || '').trim()))
        .map((r) => (r.source_text || '').trim()),
    );
    const missing = wanted.filter((t) => !alreadyCovered.has(t));

    let created = 0;
    const skipped: string[] = [];

    for (const text of missing) {
      const { data, error } = await supabase.functions.invoke('parse-pricing-condition', {
        body: { text, categoryLabel },
      });
      if (error) {
        skipped.push(text);
        continue;
      }
      const generated = Array.isArray((data as any)?.rules) ? (data as any).rules : [];
      if (!generated.length) {
        skipped.push(text);
        continue;
      }
      const payload = generated.map((r: any, idx: number) => ({
        config_table: configTable,
        category,
        title: r.title,
        is_enabled: true,
        conditions: r.conditions,
        action_type: r.action_type,
        action_value: r.action_value,
        sort_order: 100 + idx,
        source_text: text,
      }));
      const { error: insErr } = await supabase.from(TABLE as any).insert(payload as any);
      if (insErr) {
        skipped.push(text);
        continue;
      }
      created += payload.length;
    }

    await refetch();
    return { created, removed: stale.length, skipped };
  };

  return {
    rules,
    byCategory,
    isLoading,
    refetch,
    createRule,
    updateRule,
    deleteRule,
    syncRulesFromTexts,
  };
};
