import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type OrderStatus = 
  | 'draft' 
  | 'pending' 
  | 'priced' 
  | 'confirmed' 
  | 'scheduled' 
  | 'in_progress' 
  | 'done' 
  | 'canceled';

export interface Order {
  id: string;
  user_id: string;
  project_id: string;
  payload: any;
  price?: number;
  status: OrderStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderWithDetails extends Order {
  projects_hierarchy?: {
    title: string;
    location_id: string;
    locations?: {
      address_line: string;
      provinces?: { name: string };
    };
    service_types_v3?: { name: string };
    subcategories?: { name: string };
  };
}

export const useOrders = (projectId?: string) => {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('orders')
        .select(`
          *,
          projects_hierarchy (
            title,
            location_id,
            locations (
              address_line,
              provinces (name)
            ),
            service_types_v3 (name),
            subcategories (name)
          )
        `)
        .eq('user_id', user.id);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('خطا در بارگذاری سفارشات:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [projectId]);

  const createOrder = async (
    projectId: string,
    payload: any,
    price?: number,
    notes?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است');

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        user_id: user.id,
        project_id: projectId,
        payload,
        price,
        notes,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    await fetchOrders();
    return data;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;
    await fetchOrders();
  };

  return {
    orders,
    loading,
    createOrder,
    updateOrderStatus,
    refetch: fetchOrders
  };
};
