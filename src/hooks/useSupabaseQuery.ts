import { useState, useEffect, useCallback } from 'react';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

interface UseSupabaseQueryOptions<T> {
  queryFn: () => Promise<{ data: T | null; error: any }>;
  enabled?: boolean;
  dependencies?: any[];
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

export function useSupabaseQuery<T>({
  queryFn,
  enabled = true,
  dependencies = [],
  onSuccess,
  onError,
}: UseSupabaseQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await queryFn();
      
      if (result.error) {
        setError(result.error);
        onError?.(result.error);
      } else {
        setData(result.data);
        onSuccess?.(result.data as T);
      }
    } catch (err) {
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
