import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContractorRole = () => {
  const [isContractor, setIsContractor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkContractorRole();
  }, []);

  const checkContractorRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsContractor(false);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'contractor')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking contractor role:', error);
      }

      setIsContractor(!!data);
    } catch (error) {
      console.error('Error in checkContractorRole:', error);
      setIsContractor(false);
    } finally {
      setIsLoading(false);
    }
  };

  return { isContractor, isLoading };
};