import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, UserCog } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { useOrganizationalPositions } from "@/hooks/useOrganizationalPositions";
import { useRegions } from "@/hooks/useRegions";

const staffRoles = [
  { value: 'admin', label: 'مدیر سیستم' },
  { value: 'general_manager', label: 'مدیرکل' },
  { value: 'operations_manager', label: 'مدیر عملیات' },
  { value: 'scaffold_supervisor', label: 'سرپرست داربست' },
  { value: 'warehouse_manager', label: 'مدیر انبار' },
  { value: 'finance_manager', label: 'مدیر مالی' },
];

export default function StaffRoleRequest() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    phoneNumber: "",
    requestedRole: "",
    positionId: "",
    regionId: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { positions, loading: positionsLoading } = useOrganizationalPositions();
  const { provinces, loading: regionsLoading } = useRegions();

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      if (!user) {
        toast({
          title: "نیاز به ورود",
          description: "برای درخواست نقش پرسنلی، لطفاً ابتدا وارد حساب کاربری خود شوید",
          variant: "destructive"
        });
        navigate("/auth/login");
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.phone_number) {
          setFormData(prev => ({
            ...prev,
            phoneNumber: profile.phone_number || "",
          }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    checkAuthAndLoadProfile();
  }, [user, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phoneNumber || !formData.requestedRole) {
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای الزامی را پر کنید",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطا",
          description: "لطفاً ابتدا وارد حساب کاربری خود شوید",
          variant: "destructive"
        });
        navigate("/auth/login");
        return;
      }

      // ثبت درخواست تأیید نقش پرسنلی
      const { error } = await supabase
        .from("staff_verification_requests")
        .insert([{
          user_id: user.id,
          phone_number: formData.phoneNumber,
          requested_role: formData.requestedRole as any,
          position_id: formData.positionId || null,
          region_id: formData.regionId || null,
        }]);

      if (error) throw error;

      toast({
        title: "✓ درخواست ثبت شد",
        description: "درخواست نقش پرسنلی شما با موفقیت ثبت شد. پس از بررسی و تأیید CEO، اطلاع‌رسانی خواهید شد."
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "خطا در ثبت درخواست",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || positionsLoading || regionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-6 gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به صفحه اصلی
      </Button>

      <Card className="shadow-lg">
        <CardHeader className="space-y-3 border-b">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCog className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">درخواست نقش پرسنلی</CardTitle>
              <CardDescription>
                برای دریافت نقش پرسنلی در سیستم، درخواست خود را ثبت کنید
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                پس از ثبت درخواست، CEO سیستم آن را بررسی و تأیید خواهد کرد.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                اطلاعات درخواست
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">شماره تماس *</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requestedRole">نقش درخواستی *</Label>
                  <Select
                    value={formData.requestedRole}
                    onValueChange={(value) => setFormData({ ...formData, requestedRole: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب نقش" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">سمت سازمانی</Label>
                  <Select
                    value={formData.positionId}
                    onValueChange={(value) => setFormData({ ...formData, positionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب سمت" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">استان محل خدمت</Label>
                  <Select
                    value={formData.regionId}
                    onValueChange={(value) => setFormData({ ...formData, regionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب استان" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                    در حال ثبت...
                  </>
                ) : (
                  "ثبت درخواست"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                disabled={loading}
              >
                انصراف
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
