import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  sendOTP: (
    phoneNumber: string,
    isRegistration?: boolean
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
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOTP = useCallback(async (phoneNumber: string, isRegistration: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { 
          phone_number: phoneNumber,
          is_registration: isRegistration
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