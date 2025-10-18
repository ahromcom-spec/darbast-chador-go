import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectService {
  id: string;
  project_id: string;
  service_number: number;
  service_code: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  execution_start_date: string | null;
  execution_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useProjectServices = (projectId?: string) => {
  const [services, setServices] = useState<ProjectService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchServices();
    } else {
      setServices([]);
      setLoading(false);
    }
  }, [projectId]);

  const fetchServices = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services_v3')
        .select('*')
        .eq('project_id', projectId)
        .order('service_number', { ascending: true });

      if (error) throw error;
      setServices((data || []) as ProjectService[]);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const addService = async (description: string, notes?: string) => {
    if (!projectId) return { success: false, error: 'شناسه پروژه یافت نشد' };

    try {
      // تولید کد خدمات
      const { data: serviceCode, error: codeError } = await supabase.rpc(
        'generate_service_code',
        { _project_id: projectId }
      );

      if (codeError) throw codeError;

      // استخراج شماره خدمات از کد
      const serviceNumber = parseInt(serviceCode.split(',')[1]);

      // ایجاد خدمات
      const { data, error } = await supabase
        .from('services_v3')
        .insert({
          project_id: projectId,
          service_number: serviceNumber,
          service_code: serviceCode,
          description: description,
          notes: notes || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // به‌روزرسانی لیست
      await fetchServices();

      return { success: true, data, serviceCode };
    } catch (error: any) {
      console.error('Error adding service:', error);
      return { success: false, error: error.message };
    }
  };

  return { services, loading, refetch: fetchServices, addService };
};
