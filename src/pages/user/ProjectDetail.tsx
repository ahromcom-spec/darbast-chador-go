import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ProjectProgressBar } from "@/components/projects/ProjectProgressBar";
import { AssignmentsList } from "@/components/projects/AssignmentsList";
import {
  ArrowRight,
  MapPin,
  Calendar,
  Ruler,
  Package
} from "lucide-react";

interface Project {
  id: string;
  project_name: string;
  service_type: string;
  location_address: string;
  status: string;
  created_at: string;
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [canManageProject, setCanManageProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
    }
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch service requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("service_requests")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;
      setServiceRequests(requestsData || []);

      // Fetch project stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("project_progress_stages")
        .select("*")
        .eq("project_id", id)
        .order("order_index", { ascending: true });

      if (stagesError) throw stagesError;
      setStages(stagesData || []);

      // Check if user can manage project (operations_manager or scaffold_supervisor)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["operations_manager", "scaffold_supervisor", "admin", "general_manager"]);

      setCanManageProject(!!rolesData && rolesData.length > 0);

    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری پروژه",
        description: error.message,
        variant: "destructive"
      });
      navigate("/user/projects");
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
            <p className="text-muted-foreground">در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/user/projects")}
        className="mb-6 gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به لیست پروژه‌ها
      </Button>

      <div className="space-y-6">
        {/* Project Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline">
                    {project.service_type === 'scaffolding' ? 'داربست فلزی' : 'چادر برزنتی'}
                  </Badge>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status === 'active' ? 'فعال' : 'تکمیل شده'}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{project.project_name}</CardTitle>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{project.location_address || 'بدون آدرس'}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                ایجاد شده در {new Date(project.created_at).toLocaleDateString("fa-IR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Service Requests List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              درخواست‌های خدمات ({serviceRequests.length})
            </h2>
            <Button onClick={() => navigate("/scaffolding/form")}>
              افزودن درخواست جدید
            </Button>
          </div>

          {serviceRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">هیچ درخواستی در این پروژه وجود ندارد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {serviceRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          درخواست #{request.id.slice(0, 8)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(request.created_at).toLocaleDateString("fa-IR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <Badge variant={request.status === 'pending' ? 'default' : 'secondary'}>
                        {request.status === 'pending' ? 'در انتظار' : request.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <span>
                        طول: {request.length}m × 
                        عرض: {request.width}m × 
                        ارتفاع: {request.height}m
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Project Progress */}
        {stages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>پیشرفت پروژه</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectProgressBar
                stages={stages}
                canEdit={canManageProject}
                onStageClick={async (stage) => {
                  if (!canManageProject) return;
                  
                  try {
                    const { error } = await supabase
                      .from("project_progress_stages")
                      .update({
                        is_completed: !stage.is_completed,
                        completed_at: !stage.is_completed ? new Date().toISOString() : null,
                      })
                      .eq("id", stage.id);

                    if (error) throw error;

                    toast({
                      title: "موفق",
                      description: `مرحله "${stage.stage_title}" بروزرسانی شد`,
                    });

                    // Refresh stages
                    fetchProjectDetails();
                  } catch (error: any) {
                    toast({
                      title: "خطا",
                      description: error.message,
                      variant: "destructive",
                    });
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Assignments */}
        <AssignmentsList projectId={project.id} canAssign={canManageProject} />
      </div>
    </div>
  );
}