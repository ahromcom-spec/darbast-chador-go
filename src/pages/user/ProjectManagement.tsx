import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import ProjectLocationMap from "@/components/ProjectLocationMap";

interface Project {
  id: string;
  code: string;
  address: string;
  detailed_address: string | null;
  province_id: string;
  district_id: string;
  subcategory_id: string;
  created_at: string;
  province?: { name: string };
  district?: { name: string };
  subcategory?: {
    name: string;
    service_type?: { name: string };
  };
}

export default function ProjectManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
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
        .eq("customer_id", customerData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewProject = () => {
    navigate("/user/create-project");
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
  };

  const handleAddServiceToProject = (projectId: string) => {
    navigate(`/user/add-service/${projectId}`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="مدیریت پروژه‌ها"
          description="پروژه‌های خود را مشاهده و مدیریت کنید"
          showBackButton={true}
          backTo="/"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* نقشه با پروژه‌های قبلی */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">نقشه پروژه‌ها</h2>
              <Button onClick={handleCreateNewProject} className="gap-2">
                <Plus className="w-4 h-4" />
                پروژه جدید
              </Button>
            </div>
            
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <ProjectLocationMap
                existingProjects={projects.map((p) => ({
                  id: p.id,
                  code: p.code,
                  address: p.address,
                  serviceName: p.subcategory?.service_type?.name || "",
                }))}
                onProjectSelect={(projectId) => {
                  const project = projects.find((p) => p.id === projectId);
                  if (project) handleSelectProject(project);
                }}
              />
            </div>

            {selectedProject && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <h3 className="font-semibold mb-2">پروژه انتخاب شده:</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  کد: {selectedProject.code}
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  نوع خدمات: {selectedProject.subcategory?.service_type?.name}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  آدرس: {selectedProject.address}
                </p>
                <Button
                  onClick={() => handleAddServiceToProject(selectedProject.id)}
                  className="w-full gap-2"
                >
                  افزودن خدمات جدید
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            )}
          </Card>

          {/* لیست پروژه‌ها */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">پروژه‌های شما</h2>
            
            {projects.length === 0 ? (
              <Card className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  هنوز پروژه‌ای ندارید
                </h3>
                <p className="text-muted-foreground mb-4">
                  برای شروع، اولین پروژه خود را ایجاد کنید
                </p>
                <Button onClick={handleCreateNewProject} className="gap-2">
                  <Plus className="w-4 h-4" />
                  ایجاد پروژه جدید
                </Button>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedProject?.id === project.id
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => handleSelectProject(project)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="font-semibold">{project.code}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            <span className="font-medium">نوع خدمات:</span>{" "}
                            {project.subcategory?.service_type?.name}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">زیرشاخه:</span>{" "}
                            {project.subcategory?.name}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">استان:</span>{" "}
                            {project.province?.name}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">بخش:</span>{" "}
                            {project.district?.name}
                          </p>
                          <p className="text-muted-foreground line-clamp-1">
                            <span className="font-medium">آدرس:</span>{" "}
                            {project.address}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddServiceToProject(project.id);
                        }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
