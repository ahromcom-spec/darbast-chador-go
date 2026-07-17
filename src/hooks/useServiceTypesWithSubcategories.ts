import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheSet, cacheGet } from '@/lib/offlineDb';

export interface Subcategory {
  id: string;
  service_type_id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_service_active?: boolean;
  parent_id?: string | null;
  form_path?: string | null;
  sort_order?: number | null;
  children?: Subcategory[];
}

export interface ServiceTypeWithSubcategories {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  sort_order?: number | null;
  subcategories: Subcategory[];
}

const CACHE_KEY = 'service_types_with_subcategories';

export const useServiceTypesWithSubcategories = () => {
  const { data: serviceTypes = [], isLoading: loading } = useQuery({
    queryKey: ['service-types-with-subcategories'],
    queryFn: async (): Promise<ServiceTypeWithSubcategories[]> => {
      try {
        const [typesRes, subsRes] = await Promise.all([
          supabase
            .from('service_types_v3')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name'),
          supabase
            .from('subcategories')
            .select('id, service_type_id, name, code, is_active, is_service_active, parent_id, form_path, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name'),
        ]);

        if (typesRes.error) throw typesRes.error;
        if (subsRes.error) throw subsRes.error;

        const types = typesRes.data || [];
        const subs = (subsRes.data || []) as Subcategory[];

        // Build tree per service type
        const byParent = new Map<string | null, Subcategory[]>();
        for (const s of subs) {
          const key = (s.parent_id ?? null) as string | null;
          if (!byParent.has(key)) byParent.set(key, []);
          byParent.get(key)!.push(s);
        }
        const attach = (node: Subcategory): Subcategory => {
          const kids = (byParent.get(node.id) || []).map(attach);
          return { ...node, children: kids };
        };

        const result = types.map((type: any) => {
          const roots = subs
            .filter(s => s.service_type_id === type.id && !s.parent_id)
            .map(attach);
          return { ...type, subcategories: roots };
        });

        // Cache for offline use
        cacheSet(CACHE_KEY, result, 30 * 24 * 60 * 60 * 1000).catch(() => {});

        return result;
      } catch (err) {
        // Offline fallback
        const cached = await cacheGet<ServiceTypeWithSubcategories[]>(CACHE_KEY);
        if (cached) {
          console.debug('Service types loaded from offline cache');
          return cached;
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 دقیقه cache
    gcTime: 1000 * 60 * 30, // 30 دقیقه نگهداری
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { serviceTypes, loading };
};
