import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  sendOTP: (
    phoneNumber: string,
    isRegistration?: boolean,
    forceSms?: boolean
  ) => Promise<{ error: any; userExists?: boolean; whitelisted?: boolean }>;
  verifyOTP: (phoneNumber: string, code: string, fullName?: string, isRegistration?: boolean) => Promise<{ error: any; session?: Session | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider - returning safe defaults');
    }
    return {
      user: null,
      session: null,
      sendOTP: async () => ({ error: { message: 'Auth not initialized' }, userExists: false, whitelisted: false }),
      verifyOTP: async () => ({ error: { message: 'Auth not initialized' }, session: null }),
      signOut: async () => {},
      loading: true,
    };
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Report customer login activity only on genuine login or after >1h gap.
        // SIGNED_IN fires on tab focus / token refresh / page reload too, so we gate
        // with localStorage timestamp per user. Navigation between pages won't relog.
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const uid = session.user.id;
            const loginKey = `ahrom:last_login_log:${uid}`;
            const activityKey = 'ahrom:last_activity';
            const lastLogin = Number(localStorage.getItem(loginKey) || '0');
            const lastActivity = Number(localStorage.getItem(activityKey) || '0');
            const now = Date.now();
            const ONE_HOUR = 60 * 60 * 1000;
            // Log only when (a) we never logged a login for this user before, or
            // (b) the user has been inactive for more than one hour.
            const inactiveGap = lastActivity ? now - lastActivity : Number.POSITIVE_INFINITY;
            const neverLogged = !lastLogin;
            const shouldLog = neverLogged || inactiveGap > ONE_HOUR;
            if (shouldLog) {
              localStorage.setItem(loginKey, String(now));
              localStorage.setItem(activityKey, String(now));
              const meta: any = session.user.user_metadata || {};
              const wasReturn = !neverLogged && inactiveGap > ONE_HOUR;
              supabase.functions.invoke('report-activity', {
                body: {
                  eventType: wasReturn ? 'بازگشت کاربر به سایت' : 'ورود کاربر به سایت',
                  title: wasReturn ? 'کاربر پس از یک ساعت بی‌فعالیتی به سایت بازگشت' : 'کاربر وارد سایت شد',
                  actorUserId: uid,
                  actorName: meta.full_name || meta.name,
                  actorPhone: session.user.phone || meta.phone_number,
                  details: { note: wasReturn ? 'ورود مجدد پس از بیش از یک ساعت بی‌فعالیتی' : 'ورود از طریق سایت' },
                },
              }).catch(() => {});
            }
          } catch {}
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Track real user activity so we can decide if a re-appearance is a true "return"
    // (after >1h of inactivity) vs. routine tab focus / navigation between pages.
    const ACTIVITY_KEY = 'ahrom:last_activity';
    let activityThrottle = 0;
    const bumpActivity = () => {
      const now = Date.now();
      if (now - activityThrottle < 30_000) return; // throttle writes to once / 30s
      activityThrottle = now;
      try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch {}
    };
    const activityEvents: Array<keyof DocumentEventMap> = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
    activityEvents.forEach((ev) => document.addEventListener(ev, bumpActivity, { passive: true } as any));

    return () => {
      subscription.unsubscribe();
      activityEvents.forEach((ev) => document.removeEventListener(ev, bumpActivity as any));
    };
  }, []);


  const sendOTP = useCallback(async (phoneNumber: string, isRegistration: boolean = false, forceSms: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { 
          phone_number: phoneNumber,
          is_registration: isRegistration,
          force_sms: forceSms
        }
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('Error sending OTP:', error);
        }
        return { error };
      }

      // Return potential user existence flag and whitelist flag (if present)
      if (data?.error) {
        return { 
          error: { message: data.error },
          userExists: data.user_exists,
          whitelisted: !!data?.whitelisted,
        };
      }

      return { error: null, userExists: data?.user_exists, whitelisted: !!data?.whitelisted };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error sending OTP:', error);
      }
      return { error };
    }
  }, []);

  const verifyOTP = useCallback(async (phoneNumber: string, code: string, fullName?: string, isRegistration: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          phone_number: phoneNumber,
          code,
          full_name: fullName,
          is_registration: isRegistration
        }
      });

      if (data?.error) {
        return { error: { message: data.error }, session: null };
      }

      if (error) {
        if (import.meta.env.DEV) {
          console.error('Error verifying OTP:', error);
        }
        const errorMessage = error.message || 'کد تایید نامعتبر است.';
        return { error: { message: errorMessage }, session: null };
      }

      if (data?.session) {
        const access_token = data.session.access_token as string | undefined;
        const refresh_token = data.session.refresh_token as string | undefined;
        if (access_token && refresh_token) {
          const { data: setData, error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!setErr) {
            setSession(setData.session);
            setUser(setData.session?.user ?? null);
          } else if (import.meta.env.DEV) {
            console.error('Error setting session:', setErr);
          }
        }
      }

      return { error: null, session: data?.session };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error verifying OTP:', error);
      }
      return { error, session: null };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && import.meta.env.DEV) {
        console.error('Logout error:', error);
      }
      setSession(null);
      setUser(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Logout error:', error);
      }
      setSession(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    sendOTP,
    verifyOTP,
    signOut,
    loading,
  }), [user, session, sendOTP, verifyOTP, signOut, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};