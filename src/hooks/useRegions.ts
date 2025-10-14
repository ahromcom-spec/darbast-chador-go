import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Region {
  id: string;
  name: string;
  type: 'province' | 'city' | 'district';
  parent_id: string | null;
}

export const useRegions = () => {
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('type', 'province')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProvinces((data || []) as Region[]);
    } catch (error) {
      console.error('Error fetching provinces:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCitiesByProvince = async (provinceId: string): Promise<Region[]> => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('type', 'city')
        .eq('parent_id', provinceId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as Region[];
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  };

  const getDistrictsByCity = async (cityId: string): Promise<Region[]> => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('type', 'district')
        .eq('parent_id', cityId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as Region[];
    } catch (error) {
      console.error('Error fetching districts:', error);
      return [];
    }
  };

  return {
    provinces,
    loading,
    getCitiesByProvince,
    getDistrictsByCity,
  };
};
