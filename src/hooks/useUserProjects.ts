import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserProject {
  id: string;
  customer_id: string;
  address_id: string;
  service_type_id: string;
  status: string;
  created_at: string;
  title: string;
  service_code?: string;
  project_number?: string;
  addresses?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    geo_lat?: number;
    geo_lng?: number;
  } | null;
}

export const useUserProjects = (serviceTypeId?: string, subcategoryCode?: string) => {
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, [serviceTypeId, subcategoryCode]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjects([]);
        return;
      }

      // Build query conditions
      const conditions: any = {
        customer_id: user.id,
        status: 'ACTIVE'
      };

      if (serviceTypeId) {
        conditions.service_type_id = serviceTypeId;
      }

      if (subcategoryCode) {
        conditions.service_code = subcategoryCode;
      }

      const { data, error } = await supabase
        .from('projects_v2')
        .select('*, addresses(*)')
        .match(conditions)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedProjects: UserProject[] = (data || []).map((item: any) => ({
        id: item.id,
        customer_id: item.customer_id,
        address_id: item.address_id,
        service_type_id: item.service_type_id,
        status: item.status,
        created_at: item.created_at,
        title: item.title,
        service_code: item.service_code || undefined,
        project_number: item.project_number || undefined,
        addresses: Array.isArray(item.addresses) && item.addresses.length > 0 
          ? item.addresses[0] 
          : null
      }));
      
      setProjects(mappedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  return { projects, loading, refetch: fetchProjects };
};
