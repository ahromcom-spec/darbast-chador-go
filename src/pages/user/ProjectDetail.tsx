import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useProjectServices } from "@/hooks/useProjectServices";
import { PageHeader } from "@/components/common/PageHeader";
import { ArrowRight, MapPin, Calendar, Package, Plus, CheckCircle2 } from "lucide-react";

interface ProjectV3 {
  id: string;
  code: string;
  address: string;
  detailed_address: string | null;
  status: string;
  created_at: string;
  province?: { name: string } | null;
  district?: { name: string } | null;
  subcategory?: { name: string; service_type?: { name: string } | null } | null;
}

export default function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectV3 | null>(null);
  const [loading, setLoading] = useState(true);

  const { services, loading: servicesLoading, refetch } = useProjectServices(projectId);

  useEffect(() => {
    if (projectId) fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("کاربر احراز هویت نشده");

      const { data: customerData, error: customerErr } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (customerErr) throw customerErr;
      if (!customerData) throw new Error("اطلاعات مشتری یافت نشد");

      const { data, error } = await supabase
        .from("projects_v3")
        .select(`*,
          province:provinces(name),
          district:districts(name),
          subcategory:subcategories(
            name,
            service_type:service_types_v3(name)
          )
        `)
        .eq("id", projectId)
        .eq("customer_id", customerData.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("پروژه یافت نشد");
      setProject(data as ProjectV3);
      await refetch();
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطا", description: err.message });
      navigate("/user/projects");
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = () => {
    if (!projectId || !project) return;
    const isScaffoldingWithMaterials =
      project.subcategory?.service_type?.name === "داربست" &&
      project.subcategory?.name === "اجرای داربست به همراه اجناس";

    if (isScaffoldingWithMaterials) {
      navigate(`/service/scaffolding-order/${projectId}`);
    } else {
      navigate(`/user/add-service/${projectId}`);
    }
  };

  if (loading || servicesLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری پروژه..." />
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/user/projects")} className="mb-6 gap-2">
        <ArrowRight className="h-4 w-4" />
        بازگشت به پروژه‌ها
      </Button>

      <PageHeader
        title={`پروژه ${project.code}`}
        description={`${project.subcategory?.service_type?.name || ""} - ${project.subcategory?.name || ""}`}
        showBackButton={false}
      />

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
          <div className="text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 inline mr-1 align-[-2px]" />
            ایجاد شده در {new Date(project.created_at).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </Card>

      <Separator className="my-6" />

      {/* خدمات پروژه */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          خدمات پروژه ({services.length})
        </h2>
        <Button onClick={handleAddService} className="gap-2">
          <Plus className="w-4 h-4" />
          افزودن خدمات جدید
        </Button>
      </div>

      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-4">هنوز خدمتی برای این پروژه ثبت نشده است</p>
          <Button onClick={handleAddService} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> افزودن اولین خدمات
          </Button>
        </Card>
      ) : (
        <Card className="p-6 space-y-3">
          {services.map((service) => (
            <div key={service.id} className="p-3 bg-muted/50 rounded-lg flex items-start justify-between">
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
                  <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
