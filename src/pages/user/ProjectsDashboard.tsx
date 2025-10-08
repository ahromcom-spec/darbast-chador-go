import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  FolderOpen,
  MapPin,
  Calendar,
  Package,
  ArrowRight
} from "lucide-react";

interface Project {
  id: string;
  project_name: string;
  service_type: string;
  location_address: string;
  status: string;
  created_at: string;
  service_requests_count: number;
}

interface ServiceRequest {
  id: string;
  service_type: string;
  sub_type: string | null;
  length: number;
  width: number;
  height: number;
  created_at: string;
  status: string;
}

export default function ProjectsDashboard() {
  usePageTitle('پروژه‌های من');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Fetch projects with service requests count
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`
          *,
          service_requests (count)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Transform data to include count
      const transformedProjects = (projectsData || []).map((project: any) => ({
        ...project,
        service_requests_count: project.service_requests?.[0]?.count || 0
      }));

      setProjects(transformedProjects);
    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری پروژه‌ها",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">در حال بارگذاری...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <MainLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">کارتابل پروژه‌های من</h1>
            <p className="text-muted-foreground mt-1">
              مدیریت پروژه‌ها بر اساس آدرس و نوع خدمات
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">پروژه‌های فعال</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{activeProjects.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">پروژه‌های تکمیل شده</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedProjects.length}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">هیچ پروژه‌ای وجود ندارد</h3>
            <p className="text-muted-foreground mb-4">
              با ثبت اولین درخواست خدمات، پروژه شما ایجاد خواهد شد
            </p>
            <Button onClick={() => navigate("/scaffolding/form")}>
              ثبت درخواست جدید
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline">
                        {project.service_type === 'scaffolding' ? 'داربست فلزی' : 'چادر برزنتی'}
                      </Badge>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status === 'active' ? 'فعال' : 'تکمیل شده'}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{project.project_name}</CardTitle>
                    <CardDescription className="mt-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(project.created_at).toLocaleDateString("fa-IR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </CardDescription>
                  </div>
                  
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {project.service_requests_count} درخواست
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{project.location_address || 'بدون آدرس'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MainLayout>
  );
}