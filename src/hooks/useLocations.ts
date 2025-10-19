import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Location {
  id: string;
  user_id: string;
  title?: string;
  province_id?: string;
  district_id?: string;
  address_line: string;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
  provinces?: { name: string };
  districts?: { name: string };
}

export const useLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          provinces (name),
          districts (name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('خطا در بارگذاری آدرس‌ها:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const createLocation = async (location: Omit<Location, 'id' | 'user_id' | 'created_at' | 'is_active'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است');

    const { data, error } = await supabase
      .from('locations')
      .insert([{ ...location, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    await fetchLocations();
    return data;
  };

  const deleteLocation = async (id: string) => {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchLocations();
  };

  return {
    locations,
    loading,
    createLocation,
    deleteLocation,
    refetch: fetchLocations
  };
};
