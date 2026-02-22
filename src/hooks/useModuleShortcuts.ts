import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ModuleShortcut {
  id: string;
  module_key: string;
  module_name: string;
  module_description: string | null;
  module_href: string | null;
  display_order: number;
  color: string | null;
}

export function useModuleShortcuts() {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<ModuleShortcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShortcuts = useCallback(async () => {
    if (!user) {
      setShortcuts([]);
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('module_shortcuts')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true });

    if (error) console.error('Error fetching shortcuts:', error);
    setShortcuts(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  // Listen to module_assignments changes and auto-remove shortcuts for revoked assignments
  const userPhoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;

    // Fetch user phone number first
    const init = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();
      userPhoneRef.current = profile?.phone_number || null;
    };
    init();

    const channel = supabase
      .channel('shortcut-assignment-sync')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'module_assignments' },
        async (payload: any) => {
          const old = payload.old;
          if (!old?.module_key) return;
          // Check if this was for our user
          if (old.assigned_phone_number === userPhoneRef.current || old.assigned_user_id === user.id) {
            // Remove shortcut for this module if it exists
            setShortcuts((prev) => {
              const exists = prev.some((s) => s.module_key === old.module_key);
              if (exists) {
                // Also delete from DB
                supabase
                  .from('module_shortcuts')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('module_key', old.module_key)
                  .then(() => {});
              }
              return prev.filter((s) => s.module_key !== old.module_key);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'module_assignments' },
        async (payload: any) => {
          const row = payload.new;
          if (!row?.module_key) return;
          // If assignment was deactivated
          if (row.is_active === false && (row.assigned_phone_number === userPhoneRef.current || row.assigned_user_id === user.id)) {
            setShortcuts((prev) => {
              const exists = prev.some((s) => s.module_key === row.module_key);
              if (exists) {
                supabase
                  .from('module_shortcuts')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('module_key', row.module_key)
                  .then(() => {});
              }
              return prev.filter((s) => s.module_key !== row.module_key);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const addShortcut = useCallback(
    async (moduleKey: string, moduleName: string, moduleDescription?: string, moduleHref?: string) => {
      if (!user) return false;
      const { error } = await supabase.from('module_shortcuts').upsert(
        {
          user_id: user.id,
          module_key: moduleKey,
          module_name: moduleName,
          module_description: moduleDescription || null,
          module_href: moduleHref || null,
          display_order: shortcuts.length,
        },
        { onConflict: 'user_id,module_key' }
      );
      if (error) {
        console.error('Error adding shortcut:', error);
        return false;
      }
      await fetchShortcuts();
      return true;
    },
    [user, shortcuts.length, fetchShortcuts]
  );

  const removeShortcut = useCallback(
    async (moduleKey: string) => {
      if (!user) return false;
      const { error } = await supabase
        .from('module_shortcuts')
        .delete()
        .eq('user_id', user.id)
        .eq('module_key', moduleKey);
      if (error) {
        console.error('Error removing shortcut:', error);
        return false;
      }
      await fetchShortcuts();
      return true;
    },
    [user, fetchShortcuts]
  );

  const hasShortcut = useCallback(
    (moduleKey: string) => shortcuts.some((s) => s.module_key === moduleKey),
    [shortcuts]
  );

  const updateColor = useCallback(
    async (moduleKey: string, color: string | null) => {
      if (!user) return false;
      const { error } = await supabase
        .from('module_shortcuts')
        .update({ color })
        .eq('user_id', user.id)
        .eq('module_key', moduleKey);
      if (error) {
        console.error('Error updating color:', error);
        return false;
      }
      setShortcuts((prev) =>
        prev.map((s) => (s.module_key === moduleKey ? { ...s, color } : s))
      );
      return true;
    },
    [user]
  );

  const reorderShortcuts = useCallback(
    async (reordered: ModuleShortcut[]) => {
      if (!user) return;
      setShortcuts(reordered);
      const updates = reordered.map((s, i) => ({
        id: s.id,
        user_id: user.id,
        module_key: s.module_key,
        module_name: s.module_name,
        display_order: i,
      }));
      await supabase.from('module_shortcuts').upsert(updates, { onConflict: 'user_id,module_key' });
    },
    [user]
  );

  return { shortcuts, isLoading, addShortcut, removeShortcut, hasShortcut, updateColor, reorderShortcuts, refetch: fetchShortcuts };
}
