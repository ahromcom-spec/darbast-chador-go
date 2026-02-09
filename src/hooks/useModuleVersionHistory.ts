import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VersionRecord {
  id: string;
  moduleKey: string;
  moduleDate: string;
  savedBy: string;
  versionNumber: number;
  dataSnapshot: any;
  createdAt: string;
}

interface UseModuleVersionHistoryOptions {
  moduleKey: string;
  moduleDate?: string;
}

interface UseModuleVersionHistoryReturn {
  versions: VersionRecord[];
  isLoading: boolean;
  saveVersion: (data: any) => Promise<number | null>;
  loadVersion: (versionNumber: number) => Promise<any | null>;
  fetchVersions: () => Promise<void>;
}

export function useModuleVersionHistory({
  moduleKey,
  moduleDate,
}: UseModuleVersionHistoryOptions): UseModuleVersionHistoryReturn {
  const { user } = useAuth();
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const effectiveDate = moduleDate || new Date().toISOString().split('T')[0];

  // Fetch all versions for this module/date
  const fetchVersions = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('module_version_history')
        .select('*')
        .eq('module_key', moduleKey)
        .eq('module_date', effectiveDate)
        .order('version_number', { ascending: false })
        .limit(10);

      if (error) throw error;

      setVersions(
        (data || []).map((v) => ({
          id: v.id,
          moduleKey: v.module_key,
          moduleDate: v.module_date,
          savedBy: v.saved_by,
          versionNumber: v.version_number,
          dataSnapshot: v.data_snapshot,
          createdAt: v.created_at,
        }))
      );
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, moduleKey, effectiveDate]);

  // Save a new version
  const saveVersion = useCallback(
    async (data: any): Promise<number | null> => {
      if (!user) return null;

      try {
        const { data: result, error } = await supabase.rpc('save_module_version', {
          p_module_key: moduleKey,
          p_module_date: effectiveDate,
          p_data_snapshot: data,
        });

        if (error) throw error;

        // Refresh versions list
        await fetchVersions();

        return result as number;
      } catch (error) {
        console.error('Error saving version:', error);
        toast.error('خطا در ذخیره نسخه');
        return null;
      }
    },
    [user, moduleKey, effectiveDate, fetchVersions]
  );

  // Load a specific version
  const loadVersion = useCallback(
    async (versionNumber: number): Promise<any | null> => {
      const version = versions.find((v) => v.versionNumber === versionNumber);
      if (version) {
        return version.dataSnapshot;
      }

      // If not in cache, fetch from DB
      try {
        const { data, error } = await supabase
          .from('module_version_history')
          .select('data_snapshot')
          .eq('module_key', moduleKey)
          .eq('module_date', effectiveDate)
          .eq('version_number', versionNumber)
          .single();

        if (error) throw error;

        return data?.data_snapshot || null;
      } catch (error) {
        console.error('Error loading version:', error);
        toast.error('خطا در بارگذاری نسخه');
        return null;
      }
    },
    [versions, moduleKey, effectiveDate]
  );

  return {
    versions,
    isLoading,
    saveVersion,
    loadVersion,
    fetchVersions,
  };
}
