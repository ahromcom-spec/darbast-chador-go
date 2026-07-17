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
import { ArrowRight, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { useRegions } from "@/hooks/useRegions";


export default function ContractorRegister() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    companyName: "",
    phoneNumber: "",
    serviceCategoryId: "",
    activityTypeId: "",
    regionId: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { categories, loading: categoriesLoading } = useServiceCategories();
  const { activityTypes, loading: activityTypesLoading } = useActivityTypes();
  const { provinces, loading: regionsLoading } = useRegions();

  // بررسی لاگین و بارگذاری اطلاعات کاربر
  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      if (!user) {
        toast({
          title: "نیاز به ورود",
          description: "برای ثبت‌نام پیمانکار، لطفاً ابتدا وارد حساب کاربری خود شوید",
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

    if (!formData.phoneNumber || !formData.companyName) {
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

      // ثبت درخواست تأیید پیمانکار
      const { error } = await supabase
        .from("contractor_verification_requests")
        .insert({
          user_id: user.id,
          phone_number: formData.phoneNumber,
          company_name: formData.companyName,
          service_category_id: formData.serviceCategoryId || null,
          activity_type_id: formData.activityTypeId || null,
          region_id: formData.regionId || null,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "✓ درخواست ثبت شد",
        description: "درخواست پیمانکاری شما با موفقیت ثبت شد. درخواست در «ماژول مدیریت پیمانکاران» بررسی می‌شود و پس از تأیید، اطلاع‌رسانی خواهید شد."
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

  if (initialLoading || categoriesLoading || activityTypesLoading || regionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // کاربر در useEffect هدایت می‌شود
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
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">درخواست پیمانکاری</CardTitle>
              <CardDescription>
                برای همکاری به عنوان پیمانکار، درخواست خود را ثبت کنید
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                پس از ثبت درخواست، تیم مدیریت در «ماژول مدیریت پیمانکاران» آن را بررسی و تأیید خواهد کرد.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                اطلاعات پایه
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">نام شرکت *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="نام شرکت پیمانکاری"
                    required
                  />
                </div>

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
                  <Label htmlFor="serviceCategory">دسته خدمات</Label>
                  <Select
                    value={formData.serviceCategoryId}
                    onValueChange={(value) => setFormData({ ...formData, serviceCategoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب دسته خدمات" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activityType">نوع فعالیت</Label>
                  <Select
                    value={formData.activityTypeId}
                    onValueChange={(value) => setFormData({ ...formData, activityTypeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب نوع فعالیت" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">استان فعالیت</Label>
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