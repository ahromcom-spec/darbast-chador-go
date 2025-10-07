import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, CheckCircle2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicContractor {
  id: string;
  company_name: string;
  contact_person: string;
  address: string | null;
  experience_years: number | null;
  description: string | null;
  is_approved: boolean;
  created_at: string;
}

export default function ContractorsList() {
  const [contractors, setContractors] = useState<PublicContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      // Using the public view that only shows approved contractors without sensitive data
      const { data, error } = await supabase
        .from("public_verified_contractors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setContractors(data || []);
    } catch (error: any) {
      console.error("Error fetching contractors:", error);
      toast({
        title: "خطا در دریافت لیست پیمانکاران",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">لیست پیمانکاران تأیید شده</h1>
        <p className="text-muted-foreground">
          پیمانکاران معتبر و تأیید شده برای انجام پروژه‌های شما
        </p>
      </div>

      {contractors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">هیچ پیمانکار تأیید شده‌ای یافت نشد.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contractors.map((contractor) => (
            <Card key={contractor.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {contractor.company_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {contractor.contact_person}
                    </CardDescription>
                  </div>
                  {contractor.is_approved && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 ml-1" />
                      تأیید شده
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {contractor.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{contractor.address}</span>
                  </div>
                )}
                
                {contractor.experience_years && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {contractor.experience_years} سال سابقه کار
                    </span>
                  </div>
                )}

                {contractor.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mt-3">
                    {contractor.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
