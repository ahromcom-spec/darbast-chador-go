import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, Briefcase } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const serviceOptions = [
  { id: "scaffolding-metal", label: "داربست فلزی", type: "scaffolding", subType: "metal" },
  { id: "scaffolding-facade", label: "داربست نمای ساختمان", type: "scaffolding", subType: "facade" },
  { id: "tarpaulin", label: "چادر برزنتی", type: "tarpaulin", subType: null },
];

export default function ContractorRegister() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phoneNumber: "",
    email: "",
    address: "",
    experienceYears: "",
    description: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

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
        // دریافت اطلاعات پروفایل کاربر
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', user.id)
          .single();

        if (!error && profile) {
          setFormData(prev => ({
            ...prev,
            contactPerson: profile.full_name || "",
            phoneNumber: profile.phone_number || "",
            email: user.email || "",
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

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedServices.length === 0) {
      toast({
        title: "خطا",
        description: "لطفاً حداقل یک خدمت را انتخاب کنید",
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

      // Insert contractor profile
      const { data: contractor, error: contractorError } = await supabase
        .from("contractors")
        .insert({
          user_id: user.id,
          company_name: formData.companyName,
          contact_person: formData.contactPerson,
          phone_number: formData.phoneNumber,
          email: formData.email,
          address: formData.address,
          experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : null,
          description: formData.description,
        })
        .select()
        .single();

      if (contractorError) throw contractorError;

      // Insert contractor services
      const services = selectedServices.map(serviceId => {
        const service = serviceOptions.find(s => s.id === serviceId)!;
        return {
          contractor_id: contractor.id,
          service_type: service.type,
          sub_type: service.subType,
        };
      });

      const { error: servicesError } = await supabase
        .from("contractor_services")
        .insert(services);

      if (servicesError) throw servicesError;

      // Add contractor role using secure function (will fail if user is not admin)
      // This registration creates a pending contractor that needs approval
      // So we DON'T assign the role here - it will be assigned on approval

      toast({
        title: "✓ ثبت‌نام موفق",
        description: "اطلاعات شما با موفقیت ثبت شد. پس از تأیید توسط مدیریت، می‌توانید پروژه‌ها را مشاهده کنید."
      });

      navigate("/contractor/dashboard");
    } catch (error: any) {
      toast({
        title: "خطا در ثبت‌نام",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
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
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">ثبت‌نام پیمانکاران</CardTitle>
              <CardDescription>
                برای همکاری با ما، اطلاعات خود و خدمات قابل ارائه را ثبت کنید
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* اعلان اطلاعات بارگذاری شده */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                اطلاعات شخصی شما از پروفایل کاربری بارگذاری شده است. در صورت نیاز می‌توانید آنها را ویرایش کنید.
              </AlertDescription>
            </Alert>

            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                اطلاعات شرکت
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">نام شرکت *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPerson">نام مسئول *</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
                    validatePhone
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">آدرس</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experienceYears">سابقه کار (سال)</Label>
                  <Input
                    id="experienceYears"
                    type="number"
                    min="0"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">توضیحات و تخصص‌ها</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="درباره تخصص‌ها، تجربیات و نمونه کارهای خود بنویسید..."
                />
              </div>
            </div>

            <Separator />

            {/* Services Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">خدمات قابل ارائه *</h3>
              <p className="text-sm text-muted-foreground">
                خدماتی که می‌توانید ارائه دهید را انتخاب کنید
              </p>
              
              <div className="space-y-3">
                {serviceOptions.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={service.id}
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={() => handleServiceToggle(service.id)}
                    />
                    <Label
                      htmlFor={service.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {service.label}
                    </Label>
                  </div>
                ))}
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
                  "ثبت درخواست همکاری"
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