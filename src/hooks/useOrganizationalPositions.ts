import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationalPosition {
  id: string;
  name: string;
  description: string | null;
}

export const useOrganizationalPositions = () => {
  const [positions, setPositions] = useState<OrganizationalPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('organizational_positions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching organizational positions:', error);
    } finally {
      setLoading(false);
    }
  };

  return { positions, loading };
};
