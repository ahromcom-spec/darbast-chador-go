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
      // ابتدا تعداد خدمات فعلی را بگیریم تا service_number بعدی را مشخص کنیم
      const { data: existingServices, error: countError } = await supabase
        .from('services_v3')
        .select('service_number')
        .eq('project_id', projectId)
        .order('service_number', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const nextServiceNumber = existingServices && existingServices.length > 0 
        ? existingServices[0].service_number + 1 
        : 1;

      // تولید کد خدمات
      const { data: serviceCode, error: codeError } = await supabase.rpc(
        'generate_service_code',
        { _project_id: projectId }
      );

      if (codeError) throw codeError;

      // ایجاد خدمات
      const { data, error } = await supabase
        .from('services_v3')
        .insert({
          project_id: projectId,
          service_number: nextServiceNumber,
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
