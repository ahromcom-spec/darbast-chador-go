import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectHierarchy {
  id: string;
  user_id: string;
  location_id: string;
  service_type_id: string;
  subcategory_id: string;
  title: string;
  status: string;
  created_at: string;
  locations?: {
    title?: string;
    address_line: string;
    lat: number;
    lng: number;
    is_active?: boolean;
    provinces?: { name: string };
    districts?: { name: string };
  };
  service_types_v3?: { name: string; code: string };
  subcategories?: { name: string; code: string };
}

export const useProjectsHierarchy = () => {
  const [projects, setProjects] = useState<ProjectHierarchy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects_hierarchy')
        .select(`
          *,
          locations (
            title,
            address_line,
            lat,
            lng,
            is_active,
            provinces (name),
            districts (name)
          ),
          service_types_v3 (name, code),
          subcategories (name, code)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('خطا در بارگذاری پروژه‌ها:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime changes on projects_v3 for instant updates
    const channel = supabase
      .channel('projects-hierarchy-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3'
        },
        (payload) => {
          console.log('Realtime projects_v3 update:', payload);
          fetchProjects();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_hierarchy'
        },
        (payload) => {
          console.log('Realtime projects_hierarchy update:', payload);
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getOrCreateProject = async (
    locationId: string,
    serviceTypeId: string,
    subcategoryId: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است');

    const { data, error } = await supabase.rpc('get_or_create_project', {
      _user_id: user.id,
      _location_id: locationId,
      _service_type_id: serviceTypeId,
      _subcategory_id: subcategoryId
    });

    if (error) throw error;
    await fetchProjects();
    return data;
  };

  return {
    projects,
    loading,
    getOrCreateProject,
    refetch: fetchProjects
  };
};
