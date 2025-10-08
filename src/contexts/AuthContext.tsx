import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  sendOTP: (phoneNumber: string) => Promise<{ error: any; userExists?: boolean }>;
  verifyOTP: (phoneNumber: string, code: string, fullName?: string, isRegistration?: boolean) => Promise<{ error: any; session?: Session | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
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

  const sendOTP = async (phoneNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone_number: phoneNumber }
      });

      if (error) {
        console.error('Error sending OTP:', error);
        return { error };
      }

      return { error: null, userExists: data?.user_exists };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { error };
    }
  };

  const verifyOTP = async (phoneNumber: string, code: string, fullName?: string, isRegistration: boolean = false) => {
    try {
      console.log('Calling verify-otp with:', { phoneNumber, code, fullName, isRegistration });
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          phone_number: phoneNumber,
          code,
          full_name: fullName,
          is_registration: isRegistration
        }
      });

      console.log('verify-otp response:', { data, error });

      // Check if response contains an error message (even with HTTP error)
      if (data?.error) {
        return { error: { message: data.error }, session: null };
      }

      // Check for network/HTTP errors
      if (error) {
        console.error('Error verifying OTP:', error);
        // Try to extract error message from response
        const errorMessage = error.message || 'کد تایید نامعتبر است.';
        return { error: { message: errorMessage }, session: null };
      }

      if (data?.session) {
        // Correctly set session using access and refresh tokens
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
          } else {
            console.error('Error setting session:', setErr);
          }
        }
      }

      return { error: null, session: data?.session };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { error, session: null };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        // Even if there's an error, clear the local state
      }
      // Clear local state regardless of server response
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if there's an error
      setSession(null);
      setUser(null);
    }
  };

  const value = {
    user,
    session,
    sendOTP,
    verifyOTP,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};