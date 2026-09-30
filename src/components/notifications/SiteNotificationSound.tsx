import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { loadPrefs, loadCustomSound, PREFS_EVENT } from '@/lib/siteNotifPrefs';

const MANAGER_ROLES = [
  'ceo',
  'admin',
  'general_manager',
  'operations_manager',
  'support_manager',
  'sales_manager',
  'finance_manager',
  'scaffold_executive_manager',
  'executive_manager_scaffold_execution_with_materials',
  'rental_executive_manager',
];

export const SITE_NOTIF_SOUND_KEY = 'siteNotificationSoundEnabled';

let ctx: AudioContext | null = null;
let customUrl: string | null = null;

const refreshCustom = async () => {
  const blob = await loadCustomSound();
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = blob ? URL.createObjectURL(blob) : null;
};
void refreshCustom();
if (typeof window !== 'undefined') window.addEventListener(PREFS_EVENT, () => void refreshCustom());

export const playSiteNotifSound = () => {
  const vol = loadPrefs().volume;
  if (customUrl) {
    const a = new Audio(customUrl);
    a.volume = vol;
    a.play().catch(() => playChime(vol));
    return;
  }
  playChime(vol);
};

const playChime = (vol = 0.8) => {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    // Two-note pleasant chime
    [
      { f: 880, t: 0 },
      { f: 1174.7, t: 0.18 },
    ].forEach(({ f, t }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.3 * vol), now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.45);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.5);
    });
  } catch (e) {
    console.error('[SiteNotifSound] chime failed', e);
  }
};

/** Global listener: plays a sound whenever a new site notification arrives, on any page. */
export default function SiteNotificationSound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isManager, setIsManager] = useState(false);
  const unlockedRef = useRef(false);

  // Unlock audio on first user gesture (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      try {
        if (!ctx) ctx = new AudioContext();
        void ctx.resume();
      } catch {
        /* noop */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsManager(false);
      return;
    }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!active) return;
        setIsManager((data || []).some((r: any) => MANAGER_ROLES.includes(r.role)));
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isManager) return;

    const channel = supabase
      .channel('site-notifications-sound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_notifications' },
        (payload) => {
          const row = payload.new as any;
          const prefs = loadPrefs();
          const src = row?.actor_source;
          const isGuest = src === 'guest';
          const isAdmin = src === 'admin' || src === 'impersonation';
          const isStage = row?.event_type === 'order_stage_change';
          if (isGuest && !prefs.guestNotify) return;
          if (isAdmin && !prefs.adminNotify) return;
          let soundAllowed = true;
          if (isGuest) soundAllowed = prefs.guestSound;
          else if (isAdmin) soundAllowed = isStage ? prefs.adminStageSound : prefs.adminSound;
          const soundOn = localStorage.getItem(SITE_NOTIF_SOUND_KEY) !== 'false';
          if (soundOn && soundAllowed) playSiteNotifSound();
          toast(row?.title || 'اعلان جدید سایت', {
            description: row?.order_code ? `سفارش ${row.order_code}` : undefined,
            action: {
              label: 'مشاهده',
              onClick: () => navigate('/site-notifications'),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isManager, navigate]);

  return null;
}
