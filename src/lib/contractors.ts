import { supabase } from '@/integrations/supabase/client';

/**
 * Public contractor information (without sensitive contact details)
 */
export interface PublicContractor {
  id: string;
  company_name: string;
  description: string | null;
  experience_years: number | null;
  is_approved: boolean;
  created_at: string;
  general_location: string | null;
  services: Array<{
    service_type: string;
    sub_type: string | null;
  }>;
}

/**
 * Contractor contact information (restricted access)
 */
export interface ContractorContactInfo {
  email: string;
  phone_number: string;
  contact_person: string;
}

/**
 * Get public contractor directory (safe for all authenticated users)
 * Does NOT expose email, phone_number, or contact_person
 */
export async function getPublicContractors(): Promise<PublicContractor[]> {
  const { data, error } = await supabase.rpc('get_public_contractors');
  
  if (error) {
    console.error('Error fetching public contractors:', error);
    throw error;
  }
  
  // Parse the services JSON to proper type
  return (data || []).map((contractor: any) => ({
    ...contractor,
    services: typeof contractor.services === 'string' 
      ? JSON.parse(contractor.services) 
      : contractor.services || []
  }));
}

/**
 * Get contractor contact information (restricted access)
 * Only accessible by:
 * - Admins
 * - General Managers
 * - The contractor themselves
 * 
 * All access is logged in audit_log
 */
export async function getContractorContactInfo(
  contractorId: string
): Promise<ContractorContactInfo | null> {
  const { data, error } = await supabase.rpc('get_contractor_contact_info', {
    _contractor_id: contractorId
  });
  
  if (error) {
    console.error('Error fetching contractor contact info:', error);
    throw error;
  }
  
  return data?.[0] || null;
}
