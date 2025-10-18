import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useProjectServices } from "@/hooks/useProjectServices";
import { Package, Plus, CheckCircle2 } from "lucide-react";

interface Project {
  id: string;
  code: string;
  address: string;
  province?: { name: string };
  district?: { name: string };
  subcategory?: {
    name: string;
    service_type?: { name: string };
  };
}

export default function AddServiceToProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const { services, loading: servicesLoading, addService } = useProjectServices(projectId);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    if (!projectId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("کاربر احراز هویت نشده");

      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!customerData) throw new Error("اطلاعات مشتری یافت نشد");

      const { data, error } = await supabase
        .from("projects_v3")
        .select(`
          *,
          province:provinces(name),
          district:districts(name),
          subcategory:subcategories(
            name,
            service_type:service_types_v3(name)
          )
        `)
        .eq("id", projectId)
        .eq("customer_id", customerData.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error("پروژه یافت نشد");

      setProject(data);
    } catch (error: any) {
      console.error("Error fetching project:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: error.message,
      });
      navigate("/user/projects");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "لطفاً توضیحات خدمات را وارد کنید",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await addService(description, notes);

      if (result.success) {
        toast({
          title: "موفقیت",
          description: `خدمات با کد ${result.serviceCode} به پروژه اضافه شد`,
        });
        
        // پاک کردن فرم
        setDescription("");
        setNotes("");
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: error.message || "خطا در افزودن خدمات",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || servicesLoading) return <LoadingSpinner />;
  if (!project) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="افزودن خدمات به پروژه"
          description={`کد پروژه: ${project.code}`}
          showBackButton={true}
          backTo="/user/projects"
        />

        {/* اطلاعات پروژه */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h3 className="font-bold text-lg mb-4">مشخصات پروژه</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">نوع خدمات:</span>{" "}
              <span className="font-semibold">{project.subcategory?.service_type?.name}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">زیرشاخه:</span>{" "}
              <span className="font-semibold">{project.subcategory?.name}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">استان:</span>{" "}
              <span className="font-semibold">{project.province?.name}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">بخش:</span>{" "}
              <span className="font-semibold">{project.district?.name}</span>
            </div>
            <div className="md:col-span-2">
              <span className="font-medium text-muted-foreground">آدرس:</span>{" "}
              <span className="font-semibold">{project.address}</span>
            </div>
          </div>
        </Card>

        {/* خدمات موجود */}
        {services.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">خدمات ثبت شده ({services.length})</h3>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="p-3 bg-muted/50 rounded-lg flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{service.service_code}</span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {service.status === 'pending' && 'در انتظار'}
                        {service.status === 'in_progress' && 'در حال اجرا'}
                        {service.status === 'completed' && 'تکمیل شده'}
                        {service.status === 'cancelled' && 'لغو شده'}
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* فرم افزودن خدمات جدید */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">افزودن خدمات جدید</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">
                توضیحات خدمات <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات کامل خدمات مورد نیاز را وارد کنید..."
                className="min-h-[120px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">یادداشت‌های اضافی (اختیاری)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="هر گونه توضیحات تکمیلی..."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "در حال ثبت..." : "افزودن خدمات"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/user/projects")}
              >
                بازگشت
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
