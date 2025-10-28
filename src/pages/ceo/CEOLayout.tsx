import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CEOSidebar } from '@/components/ceo/CEOSidebar';
import Header from '@/components/Header';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';


export const CEOLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const [isCEO, setIsCEO] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const checkCEORole = async () => {
      if (!user) {
        setIsCEO(false);
        setRoleLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'ceo')
          .maybeSingle();

        if (error) {
          console.error('Error checking CEO role:', error);
          setIsCEO(false);
        } else {
          setIsCEO(!!data);
        }
      } catch (error) {
        console.error('Error checking CEO role:', error);
        setIsCEO(false);
      } finally {
        setRoleLoading(false);
      }
    };

    checkCEORole();
  }, [user]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCEO) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <CEOSidebar />
        <main className="flex-1 p-6">
          
          <Outlet />
        </main>
      </div>
    </div>
  );
};
