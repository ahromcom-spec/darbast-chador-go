import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * پس از بایگانی/بازیابی سفارش، وضعیت is_active آدرس مرتبط را همگام می‌کند.
 * اگر هیچ سفارش فعالی برای پروژه/آدرس باقی نمانده باشد، is_active=false می‌شود.
 */
export async function syncLocationActiveStatusByOrderId(orderId: string) {
  try {
    const { data: order } = await supabase
      .from('projects_v3')
      .select('hierarchy_project_id')
      .eq('id', orderId)
      .maybeSingle();

    const hierarchyProjectId = (order as any)?.hierarchy_project_id;
    if (!hierarchyProjectId) return;

    const { data: hierarchyProject } = await supabase
      .from('projects_hierarchy')
      .select('location_id')
      .eq('id', hierarchyProjectId)
      .maybeSingle();

    const locationId = (hierarchyProject as any)?.location_id;
    if (!locationId) return;

    const { count } = await supabase
      .from('projects_v3')
      .select('id', { count: 'exact', head: true })
      .eq('hierarchy_project_id', hierarchyProjectId)
      .neq('status', 'rejected')
      .or('is_deep_archived.is.null,is_deep_archived.eq.false');

    await supabase
      .from('locations')
      .update({ is_active: (count ?? 0) > 0 })
      .eq('id', locationId);
  } catch (err) {
    console.error('syncLocationActiveStatusByOrderId error:', err);
  }
}

export interface Location {
  id: string;
  user_id: string;
  title?: string;
  province_id?: string;
  district_id?: string;
  address_line: string;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
  provinces?: { name: string };
  districts?: { name: string };
}

export const useLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          provinces (name),
          districts (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const all = (data || []) as Location[];

      // آدرس‌هایی که سفارش دارند (حتی بایگانی‌شده) نمایش داده می‌شوند؛
      // فقط اگر همه سفارش‌ها حذف شده باشند و بیش از یک ماه گذشته باشد، آدرس حذف می‌شود.
      const inactiveIds = all.filter(l => !l.is_active).map(l => l.id);
      const keep = new Set<string>();
      if (inactiveIds.length > 0) {
        const { data: hps } = await supabase
          .from('projects_hierarchy')
          .select('id, location_id')
          .in('location_id', inactiveIds);
        const hpToLoc = new Map<string, string>();
        (hps || []).forEach((h: any) => h.location_id && hpToLoc.set(h.id, h.location_id));
        const hpIds = [...hpToLoc.keys()];
        if (hpIds.length > 0) {
          const { data: orders } = await supabase
            .from('projects_v3')
            .select('hierarchy_project_id, is_deep_archived, deep_archived_at')
            .in('hierarchy_project_id', hpIds);
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          (orders || []).forEach((o: any) => {
            const deletedLongAgo =
              o.is_deep_archived && o.deep_archived_at && new Date(o.deep_archived_at).getTime() < cutoff;
            if (!deletedLongAgo) {
              const loc = hpToLoc.get(o.hierarchy_project_id);
              if (loc) keep.add(loc);
            }
          });
        }
      }
      setLocations(all.filter(l => l.is_active || keep.has(l.id)));
    } catch (error) {
      console.error('خطا در بارگذاری آدرس‌ها:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const createLocation = async (location: Omit<Location, 'id' | 'user_id' | 'created_at' | 'is_active'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است');

    const { data, error } = await supabase
      .from('locations')
      .insert([{ ...location, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    
    // به‌روزرسانی لوکال لیست بدون درخواست مجدد به سرور
    if (data) {
      setLocations(prev => [data, ...prev]);
    }
    
    return data;
  };

  const updateLocation = async (id: string, location: Partial<Omit<Location, 'id' | 'user_id' | 'created_at' | 'is_active'>>) => {
    const { data, error } = await supabase
      .from('locations')
      .update(location)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    // به‌روزرسانی لوکال لیست بدون درخواست مجدد به سرور
    if (data) {
      setLocations(prev => prev.map(loc => loc.id === id ? { ...loc, ...data } : loc));
    }
    
    return data;
  };

  const deleteLocation = async (id: string) => {
    // حذف نرم: آدرس را غیرفعال می‌کنیم تا از لیست خارج شود و وابستگی‌های پروژه‌ها حفظ شود
    const { error: softError } = await supabase
      .from('locations')
      .update({ is_active: false })
      .eq('id', id);

    if (softError) {
      // در صورتی که به هر دلیل آپدیت ناموفق بود، تلاش برای حذف سخت (در صورت نبود وابستگی)
      const { error: hardError } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (hardError) throw hardError;
    }

    await fetchLocations(); // رفرش لیست آدرس‌ها
  };

  return {
    locations,
    loading,
    createLocation,
    updateLocation,
    deleteLocation,
    refetch: fetchLocations
  };
};
