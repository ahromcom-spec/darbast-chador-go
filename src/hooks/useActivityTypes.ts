import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityType {
  id: string;
  name: string;
  description: string | null;
}

export const useActivityTypes = () => {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityTypes();
  }, []);

  const fetchActivityTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setActivityTypes(data || []);
    } catch (error) {
      console.error('Error fetching activity types:', error);
    } finally {
      setLoading(false);
    }
  };

  return { activityTypes, loading };
};
