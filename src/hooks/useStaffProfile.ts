import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StaffProfile {
  id: string;
  requested_role: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  province?: string;
  staff_category?: string;
  staff_subcategory?: string;
  staff_position?: string;
  description?: string;
}

export const useStaffProfile = () => {
  const { user } = useAuth();
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaffProfile();
  }, [user]);

  const fetchStaffProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching staff profile:', error);
      }

      setStaffProfile(data as StaffProfile | null);
    } catch (error) {
      console.error('Error in fetchStaffProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestRole = async (
    role: string,
    additionalData?: {
      province?: string;
      staff_category?: string;
      staff_subcategory?: string;
      staff_position?: string;
      description?: string;
    }
  ) => {
    if (!user) return { error: 'کاربر وارد نشده است' };

    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .insert([{
          user_id: user.id,
          requested_role: role as any,
          status: 'pending',
          ...additionalData
        }])
        .select()
        .single();

      if (error) throw error;

      setStaffProfile(data as StaffProfile);
      return { data, error: null };
    } catch (error: any) {
      console.error('Error requesting role:', error);
      return { error: error.message };
    }
  };

  return { staffProfile, loading, requestRole, refetch: fetchStaffProfile };
};
