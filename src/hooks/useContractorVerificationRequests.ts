import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ContractorVerificationRequest {
  id: string;
  user_id: string;
  phone_number: string;
  company_name: string;
  service_category_id: string | null;
  activity_type_id: string | null;
  region_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export const useContractorVerificationRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ContractorVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('contractor_verification_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // دریافت اطلاعات profiles به صورت جداگانه
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', req.user_id)
            .maybeSingle();
          
          return {
            ...req,
            profiles: profile || { full_name: null },
          } as ContractorVerificationRequest;
        })
      );
      
      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching contractor requests:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت درخواست‌های پیمانکاری',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const approveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('contractor_verification_requests')
        .update({
          status: 'approved',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'درخواست پیمانکاری تأیید شد',
      });

      await fetchRequests();
      return { success: true };
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در تأیید درخواست',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('contractor_verification_requests')
        .update({
          status: 'rejected',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'درخواست رد شد',
      });

      await fetchRequests();
      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در رد درخواست',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

  return {
    requests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    loading,
    approveRequest,
    rejectRequest,
    refetch: fetchRequests,
  };
};
