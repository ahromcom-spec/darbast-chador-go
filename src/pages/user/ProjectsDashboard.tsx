import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { FolderOpen, Building2, CheckCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  project_name: string;
  service_type: string;
  location_address: string;
  status: string;
  created_at: string;
  service_requests_count: number;
}

export default function ProjectsDashboard() {
  usePageTitle('پروژه‌های من');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // دریافت اطلاعات نوع خدمات انتخاب شده از state
  const serviceTypeId = location.state?.serviceTypeId;
  const subcategoryCode = location.state?.subcategoryCode;

  useEffect(() => {
    fetchProjects();
  }, []);
  
  // اگر نوع خدمات انتخاب شده است، دکمه ایجاد پروژه جدید را نمایش بده
  const handleCreateProject = () => {
    if (serviceTypeId && subcategoryCode) {
      navigate('/user/create-project', {
        state: {
          preSelectedServiceType: serviceTypeId,
          preSelectedServiceCode: subcategoryCode
        }
      });
    } else {
      navigate('/user/create-project');
    }
  };

  const fetchProjects = async () => {
    try {
      setError(null);
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

      const transformedProjects = (projectsData || []).map((project: any) => ({
        ...project,
        service_requests_count: project.service_requests?.[0]?.count || 0
      }));

      setProjects(transformedProjects);
    } catch (error: any) {
      setError(error.message || 'خطا در بارگذاری پروژه‌ها');
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
          <LoadingSpinner size="lg" text="در حال بارگذاری پروژه‌ها..." />
        </div>
      </MainLayout>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <PageHeader
          title="کارتابل پروژه‌های من"
          description="مدیریت پروژه‌ها بر اساس آدرس و نوع خدمات"
        />
        <Button 
          onClick={handleCreateProject}
          className="construction-gradient"
        >
          <Plus className="h-4 w-4 ml-2" />
          پروژه جدید
        </Button>
      </div>

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={fetchProjects}
        />
      )}

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <StatCard
          title="پروژه‌های فعال"
          value={activeProjects.length}
          icon={Building2}
          description="پروژه‌های در حال انجام"
        />
        <StatCard
          title="پروژه‌های تکمیل شده"
          value={completedProjects.length}
          icon={CheckCircle}
          description="پروژه‌های به پایان رسیده"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="هیچ پروژه‌ای وجود ندارد"
          description="با ثبت اولین درخواست خدمات، پروژه شما ایجاد خواهد شد"
          actionLabel="ثبت درخواست جدید"
          onAction={() => navigate("/scaffolding/form")}
        />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
