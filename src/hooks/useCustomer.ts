import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useCustomer = () => {
  const { user } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      ensureCustomerExists();
    } else {
      setCustomerId(null);
      setLoading(false);
    }
  }, [user]);

  const ensureCustomerExists = async () => {
    if (!user) return;

    try {
      // Try to get existing customer
      let { data: customerData, error: fetchError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If customer doesn't exist, create one
      if (!customerData) {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (createError) throw createError;
        customerData = newCustomer;
      }

      setCustomerId(customerData?.id || null);
    } catch (error) {
      console.error('Error ensuring customer exists:', error);
      setCustomerId(null);
    } finally {
      setLoading(false);
    }
  };

  return { customerId, loading, refetch: ensureCustomerExists };
};
