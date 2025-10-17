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
    if (serviceTypeId || subcategoryCode) {
      fetchProjects();
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [serviceTypeId, subcategoryCode]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Get customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Build query
      let query = supabase
        .from('projects_v3')
        .select(`
          *,
          province:provinces(name),
          district:districts(name),
          subcategory:subcategories(
            name,
            code,
            service_type:service_types_v3(name)
          )
        `)
        .eq('customer_id', customerData.id)
        .in('status', ['draft', 'pending', 'approved']);

      if (subcategoryCode) {
        query = query.eq('service_code', subcategoryCode);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedProjects: UserProject[] = (data || []).map((item: any) => ({
        id: item.id,
        customer_id: item.customer_id,
        address_id: '',
        service_type_id: item.subcategory?.service_type?.id || '',
        status: item.status,
        created_at: item.created_at,
        title: `${item.subcategory?.service_type?.name || ''} - ${item.address}`,
        service_code: item.service_code || undefined,
        project_number: item.project_number || undefined,
        addresses: {
          line1: item.address,
          line2: item.detailed_address || undefined,
          city: item.district?.name || '',
          state: item.province?.name || '',
          postal_code: undefined,
          geo_lat: undefined,
          geo_lng: undefined
        }
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
