import { useCallback, useRef } from 'react';
import { cacheSet, cacheGet } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface UseOfflineCacheOptions {
  /** Cache key prefix, e.g. "daily_report" */
  prefix: string;
  /** Time-to-live in ms. Default: 7 days */
  ttlMs?: number;
}

/**
 * Hook that provides offline-first caching for any data.
 * - When online: fetches from network, caches result in IndexedDB in background
 * - When offline: returns cached data from IndexedDB
 * - Stale-While-Revalidate: returns cache immediately, then refreshes from network
 */
export function useOfflineCache({ prefix, ttlMs = 7 * 24 * 60 * 60 * 1000 }: UseOfflineCacheOptions) {
  const { online } = useNetworkStatus();
  const pendingRef = useRef<Map<string, Promise<any>>>(new Map());

  /**
   * Build a full cache key from parts
   */
  const buildKey = useCallback((...parts: string[]) => {
    return `${prefix}:${parts.join(':')}`;
  }, [prefix]);

  /**
   * Get data with offline fallback.
   * @param key - Cache key parts (will be joined with prefix)
   * @param fetcher - Function that fetches data from the network
   * @param options - Optional settings
   * @returns The data (from cache or network)
   */
  const getWithFallback = useCallback(async <T>(
    keyParts: string[],
    fetcher: () => Promise<T>,
    options?: { skipCache?: boolean }
  ): Promise<{ data: T | undefined; fromCache: boolean; error?: string }> => {
    const fullKey = buildKey(...keyParts);

    // If offline, return from cache only
    if (!online) {
      const cached = await cacheGet<T>(fullKey);
      if (cached !== undefined) {
        return { data: cached, fromCache: true };
      }
      return { data: undefined, fromCache: true, error: 'آفلاین - داده‌ای در کش موجود نیست' };
    }

    // If online, try to fetch from network
    try {
      // Deduplicate concurrent requests for the same key
      if (pendingRef.current.has(fullKey)) {
        const result = await pendingRef.current.get(fullKey);
        return { data: result, fromCache: false };
      }

      const fetchPromise = fetcher();
      pendingRef.current.set(fullKey, fetchPromise);

      const data = await fetchPromise;
      pendingRef.current.delete(fullKey);

      // Cache in background (don't block)
      if (!options?.skipCache) {
        cacheSet(fullKey, data, ttlMs).catch(() => {});
      }

      return { data, fromCache: false };
    } catch (err: any) {
      pendingRef.current.delete(fullKey);

      // Network error - try cache fallback
      const cached = await cacheGet<T>(fullKey);
      if (cached !== undefined) {
        return { data: cached, fromCache: true };
      }

      return { data: undefined, fromCache: false, error: err?.message || 'خطای شبکه' };
    }
  }, [online, buildKey, ttlMs]);

  /**
   * Manually save data to cache (e.g., after a successful save)
   */
  const saveToCache = useCallback(async <T>(keyParts: string[], data: T) => {
    const fullKey = buildKey(...keyParts);
    await cacheSet(fullKey, data, ttlMs);
  }, [buildKey, ttlMs]);

  /**
   * Check if data exists in cache
   */
  const hasCache = useCallback(async (keyParts: string[]): Promise<boolean> => {
    const fullKey = buildKey(...keyParts);
    const cached = await cacheGet(fullKey);
    return cached !== undefined;
  }, [buildKey]);

  return {
    online,
    getWithFallback,
    saveToCache,
    hasCache,
    buildKey,
  };
}
