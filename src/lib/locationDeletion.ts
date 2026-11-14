import { supabase } from '@/integrations/supabase/client';
import { partitionLocationOrders, type LocationOrderRow } from './locationDeletionRules';

export { partitionLocationOrders };

export class LocationHasActiveOrdersError extends Error {
  constructor(public count: number) {
    super('شما پروژه فعال دارید و برای حذف آدرس باید تکلیف پروژه و سفارش را روشن کنید');
    this.name = 'LocationHasActiveOrdersError';
  }
}

/**
 * حذف آدرس توسط مشتری: سفارش‌های در انتظار تایید و پروژه‌های خالی همان آدرس هم حذف می‌شوند
 * تا آدرس بعد از تازه‌سازی دوباره در «پروژه‌های من» و نقشه ظاهر نشود.
 */
export async function deleteCustomerLocation(locationId: string): Promise<{ removedOrders: number }> {
  const { data: hierarchies, error: hErr } = await supabase
    .from('projects_hierarchy')
    .select('id')
    .eq('location_id', locationId);
  if (hErr) throw hErr;
  const hierarchyIds = (hierarchies || []).map((h: any) => h.id as string);

  let removedOrders = 0;
  if (hierarchyIds.length > 0) {
    const { data: orders, error: oErr } = await supabase
      .from('projects_v3')
      .select('id, status, is_archived')
      .in('hierarchy_project_id', hierarchyIds);
    if (oErr) throw oErr;

    const { removable, blocking } = partitionLocationOrders((orders || []) as LocationOrderRow[]);
    if (blocking.length > 0) throw new LocationHasActiveOrdersError(blocking.length);

    if (removable.length > 0) {
      const { error: dErr } = await supabase.from('projects_v3').delete().in('id', removable);
      if (dErr) throw dErr;
      removedOrders = removable.length;
    }

    // پروژه‌های خالی همان آدرس (پروژه‌هایی که هنوز سفارش دارند با قوانین دسترسی حفظ می‌شوند)
    const { error: phErr } = await supabase.from('projects_hierarchy').delete().in('id', hierarchyIds);
    if (phErr) console.warn('[deleteCustomerLocation] could not remove empty projects:', phErr);
  }

  const { error: lErr } = await supabase.from('locations').update({ is_active: false }).eq('id', locationId);
  if (lErr) throw lErr;

  return { removedOrders };
}
