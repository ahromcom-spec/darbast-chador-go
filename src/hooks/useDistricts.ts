import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface District {
  id: string;
  name: string;
  province_id: string;
}

export const useDistricts = (provinceId?: string) => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDistrictsByProvince = async (provId: string) => {
    try {
      const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('province_id', provId)
        .order('name');

      if (error) throw error;
      setDistricts(data || []);
    } catch (error) {
      console.error('خطا در بارگذاری شهرستان‌ها:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provinceId) {
      fetchDistrictsByProvince(provinceId);
    }
  }, [provinceId]);

  return { districts, loading, fetchDistrictsByProvince };
};
