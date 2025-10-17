import { useState, useEffect } from 'react';
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
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeWithSubcategories[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    try {
      const { data: types, error: typesError } = await supabase
        .from('service_types_v3')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) throw typesError;

      const { data: subs, error: subsError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (subsError) throw subsError;

      const typesWithSubs: ServiceTypeWithSubcategories[] = (types || []).map(type => ({
        ...type,
        subcategories: (subs || []).filter(sub => sub.service_type_id === type.id)
      }));

      setServiceTypes(typesWithSubs);
    } catch (error) {
      console.error('Error fetching service types:', error);
    } finally {
      setLoading(false);
    }
  };

  return { serviceTypes, loading };
};
