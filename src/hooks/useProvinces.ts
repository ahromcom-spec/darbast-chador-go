import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Province {
  id: string;
  name: string;
  code: string;
}

export const useProvinces = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const { data, error } = await supabase
          .from('provinces')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setProvinces(data || []);
      } catch (error) {
        console.error('خطا در بارگذاری استان‌ها:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProvinces();
  }, []);

  return { provinces, loading };
};
