import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectHierarchy {
  id: string;
  user_id: string;
  location_id: string;
  service_type_id: string;
  subcategory_id: string;
  title: string;
  status: string;
  created_at: string;
  locations?: {
    title?: string;
    address_line: string;
    lat: number;
    lng: number;
    province_id?: string | null;
    district_id?: string | null;
    is_active?: boolean;
    provinces?: { id?: string; name: string };
    districts?: { id?: string; name: string };
  };
  service_types_v3?: { name: string; code: string };
  subcategories?: { name: string; code: string };
}

type VisibleOrderProject = {
  id: string;
  code?: string | null;
  hierarchy_project_id: string | null;
  address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  subcategory_id: string | null;
  status: string | null;
  created_at: string | null;
};

type QuickProjectLocationMeta = Pick<ProjectHierarchy, 'id' | 'location_id' | 'title' | 'locations'>;

const mergeProjectsById = (projects: ProjectHierarchy[]) => {
  const merged = new Map<string, ProjectHierarchy>();
  projects.forEach((project) => {
    const existing = merged.get(project.id);
    // داده کامل جدول projects_hierarchy را به نسخه سریع/مجازی ترجیح بده
    const existingScore = existing
      ? Number(Boolean(existing.location_id)) + Number(Boolean(existing.service_type_id)) + Number(Boolean(existing.locations?.title))
      : -1;
    const projectScore = Number(Boolean(project.location_id)) + Number(Boolean(project.service_type_id)) + Number(Boolean(project.locations?.title));
    if (!existing || projectScore > existingScore) {
      merged.set(project.id, project);
    }
  });
  return Array.from(merged.values());
};

// آدرس سفارش‌های قابل مشاهده (مشتری/همکار) حتی اگر غیرفعال شده باشد باید روی نقشه بماند
const forceActiveForVisibleOrders = (projects: ProjectHierarchy[], visibleIds: Set<string>) =>
  projects.map((project) =>
    visibleIds.has(project.id) && project.locations
      ? { ...project, locations: { ...project.locations, is_active: true } }
      : project
  );

export const useProjectsHierarchy = () => {
  const [projects, setProjects] = useState<ProjectHierarchy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const hierarchySelect = `
        *,
        locations (
          title,
          address_line,
          lat,
          lng,
          province_id,
          district_id,
          is_active,
          provinces (id, name),
          districts (id, name)
        ),
        service_types_v3 (name, code),
        subcategories (name, code)
      `;

      // درخواست‌ها را واقعاً هم‌زمان شروع می‌کنیم، ولی نتیجه سفارش‌ها را اول نمایش می‌دهیم
      const ownedPromise = supabase
        .from('projects_hierarchy')
        .select(hierarchySelect)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(result => result);

      // این تابع همه سفارش‌های قابل مشاهده کاربر را یک‌جا برمی‌گرداند:
      // سفارش خودش، انتقالی و همکاری؛ بنابراین از چند رفت‌وبرگشت کند جلوگیری می‌شود.
      const orderProjectsPromise = supabase.rpc('get_my_projects_v3').then(result => result);

      // مرحله ۱: سفارش‌های قابل مشاهده را اول بگیر تا مارکرهای سفارش مشتری/همکار سریع دیده شوند
      const { data: visibleOrders, error: visibleOrdersError } = await orderProjectsPromise;
      if (visibleOrdersError) {
        console.error('خطا در بارگذاری سریع سفارش‌ها:', visibleOrdersError);
      }

      const visibleOrderProjects = (visibleOrders || []) as VisibleOrderProject[];
      const visibleProjectIds = [...new Set(visibleOrderProjects
        .map(o => o.hierarchy_project_id).filter(Boolean) as string[])];

      let quickProjectMetaMap = new Map<string, QuickProjectLocationMeta>();
      if (visibleProjectIds.length > 0) {
        const { data: quickProjectMeta, error: quickProjectMetaError } = await supabase
          .from('projects_hierarchy')
          .select(`
            id,
            location_id,
            title,
            locations (
              title,
              address_line,
              lat,
              lng,
              province_id,
              district_id,
              is_active,
              provinces (id, name),
              districts (id, name)
            )
          `)
          .in('id', visibleProjectIds);

        if (quickProjectMetaError) {
          console.error('خطا در بارگذاری عنوان سریع آدرس‌ها:', quickProjectMetaError);
        } else {
          quickProjectMetaMap = new Map((quickProjectMeta || []).map((p) => [p.id, p as QuickProjectLocationMeta]));
        }
      }

      const quickCustomerProjects = visibleOrderProjects
        .filter((order) =>
          Number.isFinite(order.location_lat) &&
          Number.isFinite(order.location_lng)
        )
        .map((order) => {
          const projectId = order.hierarchy_project_id || `order:${order.id}`;
          const meta = order.hierarchy_project_id ? quickProjectMetaMap.get(order.hierarchy_project_id) : undefined;
          return {
            id: projectId,
            user_id: user.id,
            location_id: meta?.location_id || '',
            service_type_id: '',
            subcategory_id: order.subcategory_id || '',
            title: meta?.title || order.code || 'سفارش مشتری',
            status: order.status || 'active',
            created_at: order.created_at || new Date().toISOString(),
            locations: {
              title: meta?.locations?.title || undefined,
              address_line: meta?.locations?.address_line || order.address || 'بدون آدرس',
              lat: meta?.locations?.lat ?? order.location_lat!,
              lng: meta?.locations?.lng ?? order.location_lng!,
              is_active: meta?.locations?.is_active ?? true,
              provinces: meta?.locations?.provinces,
              districts: meta?.locations?.districts,
            },
          };
        }) as ProjectHierarchy[];

      if (quickCustomerProjects.length > 0) {
        setProjects(mergeProjectsById(quickCustomerProjects));
        setLoading(false);
      }

      // مرحله ۲: پروژه‌های مالکیتی و اطلاعات کامل hierarchy در پس‌زمینه اضافه می‌شوند
      const { data: ownedProjects, error: ownedError } = await ownedPromise;
      if (ownedError) throw ownedError;

      const ownedIds = new Set((ownedProjects || []).map(p => p.id));

      if (quickCustomerProjects.length === 0) {
        setProjects(ownedProjects || []);
        setLoading(false);
      } else {
        setProjects(mergeProjectsById([...(ownedProjects || []), ...quickCustomerProjects]));
      }

      const customerOnlyIds = visibleProjectIds
        .filter(id => !ownedIds.has(id));

      let customerProjects: ProjectHierarchy[] = [];
      if (customerOnlyIds.length > 0) {
        const { data: custProjects, error: custError } = await supabase
          .from('projects_hierarchy')
          .select(hierarchySelect)
          .in('id', customerOnlyIds)
          .order('created_at', { ascending: false });

        if (!custError && custProjects) {
          customerProjects = custProjects;
        }
      }


      // ترکیب پروژه‌های مالکیتی و پروژه‌های مشتری
      const uniqueProjects = mergeProjectsById([...(ownedProjects || []), ...quickCustomerProjects, ...customerProjects]);

      setProjects(uniqueProjects);
    } catch (error) {
      console.error('خطا در بارگذاری پروژه‌ها:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime changes for instant updates
    const channel = supabase
      .channel('projects-hierarchy-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3'
        },
        (payload) => {
          console.log('Realtime projects_v3 update:', payload);
          fetchProjects();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_hierarchy'
        },
        (payload) => {
          console.log('Realtime projects_hierarchy update:', payload);
          fetchProjects();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations'
        },
        (payload) => {
          console.log('Realtime locations update:', payload);
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getOrCreateProject = async (
    locationId: string,
    serviceTypeId: string,
    subcategoryId: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('کاربر وارد نشده است');

    const { data, error } = await supabase.rpc('get_or_create_project', {
      _user_id: user.id,
      _location_id: locationId,
      _service_type_id: serviceTypeId,
      _subcategory_id: subcategoryId
    });

    if (error) throw error;
    await fetchProjects();
    return data;
  };

  return {
    projects,
    loading,
    getOrCreateProject,
    refetch: fetchProjects
  };
};
