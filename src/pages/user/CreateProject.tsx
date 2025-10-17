import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import ProjectLocationMap from "@/components/ProjectLocationMap";

const projectSchema = z.object({
  province_id: z.string().min(1, "انتخاب استان الزامی است"),
  district_id: z.string().min(1, "انتخاب بخش الزامی است"),
  service_type_id: z.string().min(1, "انتخاب نوع خدمات الزامی است"),
  subcategory_id: z.string().min(1, "انتخاب زیرشاخه الزامی است"),
  address: z.string().min(5, "آدرس باید حداقل 5 کاراکتر باشد"),
  detailed_address: z.string().optional(),
  postal_code: z.string().optional(),
  plaque: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface Province {
  id: string;
  name: string;
  code: string;
}

interface District {
  id: string;
  name: string;
}

interface ServiceType {
  id: string;
  name: string;
  code: string;
}

interface Subcategory {
  id: string;
  name: string;
  code: string;
}

export default function CreateProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  // دریافت اطلاعات از state
  const preselectedServiceTypeId = location.state?.serviceTypeId;
  const preselectedSubcategoryCode = location.state?.subcategoryCode;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      province_id: "",
      district_id: "",
      service_type_id: preselectedServiceTypeId || "",
      subcategory_id: "",
      address: "",
      detailed_address: "",
      postal_code: "",
      plaque: "",
    },
  });

  useEffect(() => {
    fetchProvinces();
    fetchServiceTypes();
  }, []);

  // بارگذاری زیرمجموعه‌ها و انتخاب خودکار subcategory در صورت وجود
  useEffect(() => {
    const loadPreselectedSubcategory = async () => {
      if (preselectedServiceTypeId && preselectedSubcategoryCode) {
        // ابتدا زیرمجموعه‌ها را بارگذاری می‌کنیم
        await fetchSubcategories(preselectedServiceTypeId);
        
        // سپس subcategory مناسب را پیدا و انتخاب می‌کنیم
        const { data, error } = await supabase
          .from("subcategories")
          .select("id")
          .eq("service_type_id", preselectedServiceTypeId)
          .eq("code", preselectedSubcategoryCode)
          .eq("is_active", true)
          .maybeSingle();

        if (data && !error) {
          form.setValue("subcategory_id", data.id);
        }
      }
    };

    loadPreselectedSubcategory();
  }, [preselectedServiceTypeId, preselectedSubcategoryCode]);

  useEffect(() => {
    const provinceId = form.watch("province_id");
    if (provinceId) {
      fetchDistricts(provinceId);
    }
  }, [form.watch("province_id")]);

  useEffect(() => {
    const serviceTypeId = form.watch("service_type_id");
    if (serviceTypeId) {
      fetchSubcategories(serviceTypeId);
    }
  }, [form.watch("service_type_id")]);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from("provinces")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProvinces(data || []);
    } catch (error: any) {
      console.error("Error fetching provinces:", error);
    }
  };

  const fetchDistricts = async (provinceId: string) => {
    try {
      const { data, error } = await supabase
        .from("districts")
        .select("*")
        .eq("province_id", provinceId)
        .order("name");

      if (error) throw error;
      setDistricts(data || []);
    } catch (error: any) {
      console.error("Error fetching districts:", error);
    }
  };

  const fetchServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("service_types_v3")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching service types:", error);
    }
  };

  const fetchSubcategories = async (serviceTypeId: string) => {
    try {
      const { data, error } = await supabase
        .from("subcategories")
        .select("*")
        .eq("service_type_id", serviceTypeId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error: any) {
      console.error("Error fetching subcategories:", error);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("کاربر احراز هویت نشده");

      // Get or create customer record
      let { data: customerData, error: customerFetchError } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerFetchError) throw customerFetchError;
      
      // If customer doesn't exist, create one
      if (!customerData) {
        const { data: newCustomer, error: createError } = await supabase
          .from("customers")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        
        if (createError) throw createError;
        customerData = newCustomer;
      }

      if (!customerData) throw new Error("خطا در ایجاد اطلاعات مشتری");

      // تولید کد پروژه
      const { data: projectCode, error: codeError } = await supabase.rpc(
        "generate_project_code",
        {
          _customer_id: customerData.id,
          _province_id: data.province_id,
          _subcategory_id: data.subcategory_id,
        }
      );

      if (codeError) throw codeError;

      // استخراج اعداد از کد پروژه
      const projectParts = projectCode.split('/');
      const projectNumber = projectParts[0];
      const serviceCode = projectParts[1];

      // ایجاد پروژه
      const { error: projectError } = await supabase.from("projects_v3").insert({
        customer_id: customerData.id,
        province_id: data.province_id,
        district_id: data.district_id,
        subcategory_id: data.subcategory_id,
        address: data.address,
        detailed_address: data.detailed_address || null,
        notes: `پلاک: ${data.plaque || "ثبت نشده"} | کد پستی: ${
          data.postal_code || "ثبت نشده"
        }`,
        code: projectCode,
        project_number: projectNumber,
        service_code: serviceCode,
        status: "draft",
      });

      if (projectError) throw projectError;

      toast({
        title: "موفقیت",
        description: "پروژه با موفقیت ایجاد شد",
      });

      navigate("/user/projects");
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (location: {
    address: string;
    coordinates: [number, number];
    distance: number;
  }) => {
    setSelectedLocation({
      lat: location.coordinates[1],
      lng: location.coordinates[0],
      address: location.address
    });
    form.setValue("address", location.address);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="ایجاد پروژه جدید"
          description="اطلاعات پروژه خود را وارد کنید"
          showBackButton={true}
          backTo="/user/projects"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* نقشه */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">انتخاب محل پروژه</h2>
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <ProjectLocationMap onLocationSelect={handleLocationSelect} />
            </div>
            {selectedLocation && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">آدرس انتخاب شده:</span>{" "}
                  {selectedLocation.address}
                </p>
              </div>
            )}
          </Card>

          {/* فرم */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">مشخصات پروژه</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* استان */}
                <FormField
                  control={form.control}
                  name="province_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>استان *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="انتخاب استان" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50">
                          {provinces.map((province) => (
                            <SelectItem key={province.id} value={province.id}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* بخش */}
                <FormField
                  control={form.control}
                  name="district_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>شهرستان / بخش *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!form.watch("province_id")}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="انتخاب شهرستان / بخش" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50">
                          {districts.map((district) => (
                            <SelectItem key={district.id} value={district.id}>
                              {district.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* نوع خدمات */}
                <FormField
                  control={form.control}
                  name="service_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع خدمات *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!preselectedServiceTypeId}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="انتخاب نوع خدمات" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50">
                          {serviceTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* زیرشاخه */}
                <FormField
                  control={form.control}
                  name="subcategory_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>زیرشاخه خدمات *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!form.watch("service_type_id") || !!preselectedSubcategoryCode}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="انتخاب زیرشاخه" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50 max-h-[300px]">
                          {subcategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* آدرس */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>آدرس *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="آدرس کامل محل پروژه"
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* پلاک */}
                <FormField
                  control={form.control}
                  name="plaque"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>پلاک</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="شماره پلاک" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* کد پستی */}
                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>کد پستی (اختیاری)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="کد پستی 10 رقمی" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* جزئیات بیشتر */}
                <FormField
                  control={form.control}
                  name="detailed_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>جزئیات آدرس (اختیاری)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="توضیحات تکمیلی آدرس"
                          className="min-h-[60px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <LoadingSpinner /> : "ایجاد پروژه"}
                </Button>
              </form>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
