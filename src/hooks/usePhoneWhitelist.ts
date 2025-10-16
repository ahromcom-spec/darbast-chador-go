import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface WhitelistEntry {
  id: string;
  phone_number: string;
  allowed_roles: string[];
  notes: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export const usePhoneWhitelist = () => {
  const { user } = useAuth();
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWhitelist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('phone_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWhitelist(data || []);
    } catch (error) {
      console.error('Error fetching whitelist:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت لیست شماره‌های مجاز',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelist();
  }, [user]);

  const addToWhitelist = async (
    phoneNumber: string,
    allowedRoles: string[],
    notes?: string
  ) => {
    try {
      const { error } = await supabase.from('phone_whitelist').insert({
        phone_number: phoneNumber,
        allowed_roles: allowedRoles,
        notes: notes || null,
        added_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'شماره با موفقیت به لیست مجاز اضافه شد',
      });

      await fetchWhitelist();
      return { success: true };
    } catch (error: any) {
      console.error('Error adding to whitelist:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در افزودن شماره به لیست مجاز',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const removeFromWhitelist = async (id: string) => {
    try {
      const { error } = await supabase
        .from('phone_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'شماره از لیست مجاز حذف شد',
      });

      await fetchWhitelist();
      return { success: true };
    } catch (error: any) {
      console.error('Error removing from whitelist:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در حذف شماره از لیست مجاز',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const updateWhitelist = async (
    id: string,
    allowedRoles: string[],
    notes?: string
  ) => {
    try {
      const { error } = await supabase
        .from('phone_whitelist')
        .update({
          allowed_roles: allowedRoles,
          notes: notes || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'اطلاعات با موفقیت به‌روزرسانی شد',
      });

      await fetchWhitelist();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating whitelist:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در به‌روزرسانی اطلاعات',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  return {
    whitelist,
    loading,
    addToWhitelist,
    removeFromWhitelist,
    updateWhitelist,
    refetch: fetchWhitelist,
  };
};
