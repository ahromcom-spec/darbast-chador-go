import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderApproval {
  id: string;
  order_id: string;
  approver_role: string;
  approver_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  approver_name?: string;
}

export const useOrderApprovals = (orderId?: string) => {
  const [approvals, setApprovals] = useState<OrderApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('order_approvals')
        .select(`
          *,
          profiles:approver_user_id(full_name)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map the data to include approver name
      const mapped = (data || []).map(approval => ({
        ...approval,
        approver_name: (approval as any).profiles?.full_name || null
      }));

      setApprovals(mapped);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [orderId]);

  const recordApproval = async (orderId: string, role: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('order_approvals')
        .update({
          approver_user_id: userId,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .eq('approver_role', role);

      if (error) throw error;
      await fetchApprovals();
    } catch (error) {
      console.error('Error recording approval:', error);
      throw error;
    }
  };

  return {
    approvals,
    loading,
    refetch: fetchApprovals,
    recordApproval
  };
};
