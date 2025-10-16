import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Province {
  id: string;
  name: string;
  code: string;
}

export const useRegions = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('provinces')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProvinces((data || []) as Province[]);
    } catch (error) {
      console.error('Error fetching provinces:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    provinces,
    loading,
  };
};
