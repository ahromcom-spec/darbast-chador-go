import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/errorHandler";
import {
  FolderOpen,
  MapPin,
  Calendar,
  Plus,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

interface Project {
  id: string;
  project_name: string;
  service_type: string;
  location_address: string;
  status: string;
  created_at: string;
  service_requests_count?: number;
}

interface ServiceRequest {
  id: string;
  sub_type: string | null;
  length: number;
  width: number;
  height: number;
  status: string;
  created_at: string;
}

export default function ProjectsBoard() {
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
      const transformedProjects = projectsData?.map(project => ({
        ...project,
        service_requests_count: project.service_requests?.[0]?.count || 0
      }));

      setProjects(transformedProjects || []);
    } catch (error: any) {
      toast(toastError(error, 'خطا در بارگذاری پروژه‌ها'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">در حال بارگذاری پروژه‌ها...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">کارتابل پروژه‌ها</h1>
          <p className="text-muted-foreground mt-1">
            مدیریت پروژه‌های ساخت و ساز خود
          </p>
        </div>
        <Button
          onClick={() => navigate("/scaffolding/form")}
          className="gap-2 shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          درخواست خدمات جدید
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">پروژه‌های فعال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {projects.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">کل پروژه‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {projects.length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">پروژه‌های تکمیل شده</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {projects.filter(p => p.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="relative">
                <FolderOpen className="h-20 w-20 mx-auto text-muted-foreground/40" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">هنوز پروژه‌ای ندارید</h3>
                <p className="text-muted-foreground leading-relaxed">
                  با ثبت اولین درخواست خدمات، پروژه اول خود را شروع کنید.
                </p>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => navigate("/scaffolding/form")} 
                  className="gap-2 shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  شروع اولین پروژه
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onClick
}: {
  project: Project;
  onClick: () => void;
}) {
  const serviceTypeLabel = project.service_type === 'scaffolding' 
    ? 'داربست فلزی' 
    : 'چادر برزنتی';

  const statusInfo = {
    active: { label: 'فعال', color: 'bg-blue-500' },
    completed: { label: 'تکمیل شده', color: 'bg-green-500' },
    on_hold: { label: 'متوقف شده', color: 'bg-yellow-500' },
  }[project.status] || { label: 'نامشخص', color: 'bg-gray-500' };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 group"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="gap-1">
                {serviceTypeLabel}
              </Badge>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white ${statusInfo.color}`}>
                {project.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                {statusInfo.label}
              </div>
            </div>
            <CardTitle className="text-xl group-hover:text-primary transition-colors">
              {project.project_name}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>{project.location_address || 'آدرس مشخص نشده'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>ایجاد شده در: {new Date(project.created_at).toLocaleDateString("fa-IR", {
              year: "numeric",
              month: "long",
              day: "numeric"
            })}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-muted-foreground">تعداد درخواست‌ها:</span>
            <Badge variant="secondary" className="text-base">
              {project.service_requests_count || 0}
            </Badge>
          </div>
        </div>

        <div className="flex justify-end">
          <span className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            مشاهده جزئیات
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}