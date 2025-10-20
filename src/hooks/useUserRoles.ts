import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 
  | 'admin' 
  | 'ceo' 
  | 'contractor' 
  | 'general_manager'
  | 'sales_manager'
  | 'finance_manager'
  | 'scaffold_executive_manager';

interface UseUserRolesReturn {
  roles: UserRole[];
  isAdmin: boolean;
  isCEO: boolean;
  isContractor: boolean;
  isGeneralManager: boolean;
  isSalesManager: boolean;
  isFinanceManager: boolean;
  isExecutiveManager: boolean;
  loading: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  refetch: () => Promise<void>;
}

export const useUserRoles = (): UseUserRolesReturn => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const userRoles = (data || []).map(r => r.role as UserRole);
      setRoles(userRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [user]);

  const hasRole = (role: UserRole): boolean => roles.includes(role);
  const hasAnyRole = (checkRoles: UserRole[]): boolean => 
    checkRoles.some(role => roles.includes(role));

  return {
    roles,
    isAdmin: hasRole('admin'),
    isCEO: hasRole('ceo'),
    isContractor: hasRole('contractor'),
    isGeneralManager: hasRole('general_manager'),
    isSalesManager: hasRole('sales_manager'),
    isFinanceManager: hasRole('finance_manager'),
    isExecutiveManager: hasRole('scaffold_executive_manager'),
    loading,
    hasRole,
    hasAnyRole,
    refetch: fetchRoles,
  };
};
