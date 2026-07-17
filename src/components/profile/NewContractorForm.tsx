import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Briefcase, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  code: string;
}

interface Subcategory {
  id: string;
  name: string;
  code: string;
  service_type_id: string;
}

interface NewContractorFormProps {
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

interface ExistingService {
  service_type: string; // service_types_v3.id
  sub_type: string | null; // subcategory.code
  service_type_name?: string;
  sub_name?: string;
}

export function NewContractorForm({ userId, userEmail, onSuccess }: NewContractorFormProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phoneNumber: "",
    email: userEmail,
    address: "",
    experienceYears: "",
    description: "",
  });

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [existingContractorId, setExistingContractorId] = useState<string | null>(null);
  const [existingServices, setExistingServices] = useState<ExistingService[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [userId]);

  useEffect(() => {
    if (selectedServiceType) {
      loadSubcategories(selectedServiceType);
    } else {
      setSubcategories([]);
      setSelectedSubcategories([]);
    }
  }, [selectedServiceType]);

  const loadInitialData = async () => {
    try {
      setDataLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile) {
        setFormData(prev => ({
          ...prev,
          contactPerson: profile.full_name || "",
          phoneNumber: profile.phone_number || "",
        }));
      }

      // بررسی وجود پیمانکار قبلی
      const { data: existing } = await supabase
        .from('contractors')
        .select('id, company_name, contact_person, phone_number, email, address, experience_years, description')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        setExistingContractorId(existing.id);
        setFormData({
          companyName: existing.company_name || "",
          contactPerson: existing.contact_person || "",
          phoneNumber: existing.phone_number || "",
          email: existing.email || userEmail,
          address: existing.address || "",
          experienceYears: existing.experience_years ? String(existing.experience_years) : "",
          description: existing.description || "",
        });
      }

      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('service_types_v3')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      // بارگذاری خدمات موجود (اگر پیمانکار قبلاً ثبت‌شده باشد)
      if (existing) {
        const { data: srv } = await supabase
          .from('contractor_services')
          .select('service_type, sub_type')
          .eq('contractor_id', existing.id);

        const list = (srv || []) as ExistingService[];
        // resolve names
        const stIds = [...new Set(list.map((s) => s.service_type))];
        const { data: stRows } = await supabase
          .from('service_types_v3')
          .select('id,name,code')
          .in('id', stIds.length ? stIds : ['00000000-0000-0000-0000-000000000000']);
        const stMap = new Map((stRows || []).map((r: any) => [r.id, r]));
        const subCodes = [...new Set(list.map((s) => s.sub_type).filter(Boolean) as string[])];
        const { data: subRows } = await supabase
          .from('subcategories')
          .select('code,name')
          .in('code', subCodes.length ? subCodes : ['__none__']);
        const subMap = new Map((subRows || []).map((r: any) => [r.code, r.name]));
        setExistingServices(
          list.map((s) => ({
            ...s,
            service_type_name: (stMap.get(s.service_type) as any)?.name || s.service_type,
            sub_name: s.sub_type ? subMap.get(s.sub_type) || s.sub_type : '—',
          }))
        );
      }

      // پیش‌فرض: داربست فلزی
      if (!existing) {
        const scaffolding = serviceTypesData?.find(st => st.code === '10');
        if (scaffolding) setSelectedServiceType(scaffolding.id);
      } else {
        // در حالت افزودن، چیزی پیش‌فرض انتخاب نشود
        setSelectedServiceType('');
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('خطا در بارگذاری اطلاعات');
    } finally {
      setDataLoading(false);
    }
  };

  const loadSubcategories = async (serviceTypeId: string) => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('service_type_id', serviceTypeId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error: any) {
      console.error('Error loading subcategories:', error);
      toast.error('خطا در بارگذاری زیرشاخه‌ها');
    }
  };

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedSubcategories(prev =>
      prev.includes(subcategoryId)
        ? prev.filter(id => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedServiceType) {
      toast.error("لطفاً نوع خدمات را انتخاب کنید");
      return;
    }

    if (selectedSubcategories.length === 0) {
      toast.error("لطفاً حداقل یک زیرشاخه را انتخاب کنید");
      return;
    }

    if (!existingContractorId) {
      if (!formData.companyName.trim() || !formData.contactPerson.trim() || !formData.phoneNumber.trim()) {
        toast.error("لطفاً تمام فیلدهای الزامی را پر کنید");
        return;
      }
    }

    setLoading(true);
    try {
      let contractorId = existingContractorId;

      if (!contractorId) {
        // ایجاد رکورد جدید پیمانکار
        const { data: existing, error: checkError } = await supabase
          .from('contractors')
          .select('id')
          .or(`email.eq.${formData.email},phone_number.eq.${formData.phoneNumber}`);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
          toast.error('شماره تلفن یا ایمیل قبلاً ثبت شده است');
          setLoading(false);
          return;
        }

        const { data: contractor, error: contractorError } = await supabase
          .from("contractors")
          .insert([{
            user_id: userId,
            company_name: formData.companyName,
            contact_person: formData.contactPerson,
            phone_number: formData.phoneNumber,
            email: formData.email,
            address: formData.address || null,
            experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : null,
            description: formData.description || null,
            is_approved: false,
            is_active: true
          }])
          .select()
          .single();

        if (contractorError) {
          if (contractorError.code === '23505') {
            toast.error('این ایمیل یا شماره تلفن قبلاً ثبت شده است');
          } else {
            throw contractorError;
          }
          return;
        }
        contractorId = contractor.id;
      }

      // ثبت خدمات جدید (با اجتناب از تکرار)
      const existingKeys = new Set(
        existingServices.map((s) => `${s.service_type}|${s.sub_type || ''}`)
      );
      const serviceInserts = selectedSubcategories
        .map((subcategoryId) => {
          const subcategory = subcategories.find(sc => sc.id === subcategoryId);
          return {
            contractor_id: contractorId!,
            service_type: selectedServiceType,
            sub_type: subcategory?.code || null,
          };
        })
        .filter((row) => !existingKeys.has(`${row.service_type}|${row.sub_type || ''}`));

      if (serviceInserts.length === 0) {
        toast.info('این خدمات قبلاً ثبت شده است');
      } else {
        const { error: servicesError } = await supabase
          .from("contractor_services")
          .insert(serviceInserts);
        if (servicesError) throw servicesError;

        toast.success(existingContractorId ? 'خدمات جدید با موفقیت اضافه شد' : 'درخواست شما با موفقیت ثبت شد', {
          description: existingContractorId
            ? 'خدمات جدید برای بررسی به مدیریت ارسال شد.'
            : 'پس از تأیید مدیریت، می‌توانید پروژه‌ها را مشاهده کنید',
        });
      }

      // پاکسازی انتخاب‌ها و تازه‌سازی لیست خدمات
      setSelectedSubcategories([]);
      setSelectedServiceType('');
      await loadInitialData();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating contractor:', error);
      toast.error('خطا در ثبت اطلاعات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const isAddMore = !!existingContractorId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          {isAddMore ? 'افزودن خدمات بیشتر به پیمانکاری' : 'ثبت‌نام پیمانکار'}
        </CardTitle>
        <CardDescription>
          {isAddMore
            ? 'می‌توانید خدمات بیشتری به پروفایل پیمانکاری خود اضافه کنید. هر خدمت جدید پس از تأیید مدیریت فعال می‌شود.'
            : 'برای همکاری با ما، اطلاعات شرکت و خدمات خود را وارد کنید'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isAddMore
              ? 'این فرم برای افزودن خدمات جدید همیشه باز است. هر دفعه که می‌خواهید خدمات جدیدی ارائه کنید، آن را در اینجا ثبت کنید.'
              : 'پس از ثبت درخواست، اطلاعات شما توسط مدیریت بررسی و در صورت تأیید، امکان فعالیت فراهم خواهد شد.'}
          </AlertDescription>
        </Alert>

        {isAddMore && existingServices.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="font-semibold text-sm">خدمات ثبت‌شده شما</h3>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
              {existingServices.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {s.service_type_name} {s.sub_name && s.sub_name !== '—' ? `· ${s.sub_name}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isAddMore && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  اطلاعات شرکت
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">
                      نام شرکت <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="نام شرکت یا کسب و کار"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">
                      نام و نام خانوادگی <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="نام مسئول"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      شماره تماس <span className="text-destructive">*</span>
                    </Label>
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
                    <Label htmlFor="email">
                      ایمیل <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experienceYears">سابقه کار (سال)</Label>
                    <Input
                      id="experienceYears"
                      type="number"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                      placeholder="تعداد سال"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">آدرس</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="آدرس دفتر یا کارگاه"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">توضیحات تکمیلی</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="هر گونه توضیحات اضافی درباره شرکت و خدمات شما..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <Separator />
            </>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">
              {isAddMore ? 'افزودن خدمات جدید' : 'انتخاب خدمات ارائه شده'}
            </h3>

            <div className="space-y-2">
              <Label htmlFor="serviceType">
                نوع خدمات <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                <SelectTrigger id="serviceType">
                  <SelectValue placeholder="انتخاب نوع خدمات" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(serviceType => (
                    <SelectItem key={serviceType.id} value={serviceType.id}>
                      {serviceType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subcategories.length > 0 && (
              <div className="space-y-3">
                <Label>
                  زیرشاخه‌های خدمات <span className="text-destructive">*</span>
                  <span className="text-sm text-muted-foreground mr-2">
                    (حداقل یک مورد را انتخاب کنید)
                  </span>
                </Label>
                <div className="grid gap-3 p-4 border rounded-lg bg-muted/30">
                  {subcategories.map(subcategory => {
                    const alreadyHas = existingServices.some(
                      (s) => s.service_type === selectedServiceType && s.sub_type === subcategory.code
                    );
                    return (
                      <div key={subcategory.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`subcategory-${subcategory.id}`}
                          checked={selectedSubcategories.includes(subcategory.id)}
                          onChange={() => handleSubcategoryToggle(subcategory.id)}
                          disabled={alreadyHas}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label
                          htmlFor={`subcategory-${subcategory.id}`}
                          className={`cursor-pointer font-normal ${alreadyHas ? 'text-muted-foreground line-through' : ''}`}
                        >
                          {subcategory.name}
                          {alreadyHas && <span className="text-xs mr-2">(قبلاً ثبت شده)</span>}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {isAddMore ? <Plus className="h-4 w-4" /> : null}
            {loading ? 'در حال ثبت...' : isAddMore ? 'افزودن خدمات جدید' : 'ثبت درخواست پیمانکاری'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
