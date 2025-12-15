import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export const useRentalExecutiveManagerRole = () => {
  const { user } = useAuth();
  const [isRentalExecutiveManager, setIsRentalExecutiveManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsRentalExecutiveManager(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "rental_executive_manager")
          .maybeSingle();

        if (error) {
          console.error("Error checking rental executive manager role:", error);
          setIsRentalExecutiveManager(false);
        } else {
          setIsRentalExecutiveManager(!!data);
        }
      } catch (err) {
        console.error("Error checking rental executive manager role:", err);
        setIsRentalExecutiveManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user]);

  return { isRentalExecutiveManager, loading };
};
