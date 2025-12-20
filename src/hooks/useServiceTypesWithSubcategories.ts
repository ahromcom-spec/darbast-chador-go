import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Subcategory {
  id: string;
  service_type_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ServiceTypeWithSubcategories {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  subcategories: Subcategory[];
}

export const useServiceTypesWithSubcategories = () => {
  const { data: serviceTypes = [], isLoading: loading } = useQuery({
    queryKey: ['service-types-with-subcategories'],
    queryFn: async (): Promise<ServiceTypeWithSubcategories[]> => {
      const [typesRes, subsRes] = await Promise.all([
        supabase
          .from('service_types_v3')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('subcategories')
          .select('*')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (subsRes.error) throw subsRes.error;

      const types = typesRes.data || [];
      const subs = subsRes.data || [];

      return types.map(type => ({
        ...type,
        subcategories: subs.filter(sub => sub.service_type_id === type.id)
      }));
    },
    staleTime: 1000 * 60 * 10, // 10 دقیقه cache
    gcTime: 1000 * 60 * 30, // 30 دقیقه نگهداری
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { serviceTypes, loading };
};
