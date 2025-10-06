import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to automatically assign new service requests to matching contractors
 * This runs in the background and assigns projects based on contractor services
 */
export const useAutoAssignProjects = () => {
  useEffect(() => {
    const channel = supabase
      .channel('service-requests-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_requests'
        },
        async (payload) => {
          console.log('New service request detected:', payload.new);
          await assignToMatchingContractors(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};

async function assignToMatchingContractors(serviceRequest: any) {
  try {
    // Find contractors that offer this service
    const { data: matchingServices, error: servicesError } = await supabase
      .from('contractor_services')
      .select('contractor_id, contractors!inner(*)')
      .eq('service_type', serviceRequest.service_type)
      .eq('contractors.is_approved', true)
      .eq('contractors.is_active', true);

    if (servicesError) {
      console.error('Error fetching matching contractors:', servicesError);
      return;
    }

    if (!matchingServices || matchingServices.length === 0) {
      console.log('No matching contractors found for service:', serviceRequest.service_type);
      return;
    }

    // Create assignment for each matching contractor
    const assignments = matchingServices.map((service: any) => ({
      service_request_id: serviceRequest.id,
      contractor_id: service.contractor_id,
      status: 'pending'
    }));

    const { error: assignmentError } = await supabase
      .from('project_assignments')
      .insert(assignments);

    if (assignmentError) {
      console.error('Error creating assignments:', assignmentError);
    } else {
      console.log(`Assigned project to ${assignments.length} contractors`);
    }
  } catch (error) {
    console.error('Error in assignToMatchingContractors:', error);
  }
}