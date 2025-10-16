import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/errorHandler";
import {
  ArrowRight,
  MapPin,
  Calendar,
  Ruler,
  Plus,
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
  sub_type: string | null;
  length: number;
  width: number;
  height: number;
  status: string;
  created_at: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
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
    } catch (error: any) {
      toast(toastError(error, 'خطا در بارگذاری پروژه'));
      navigate("/projects");
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
            <p className="text-muted-foreground">در حال بارگذاری جزئیات پروژه...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const serviceTypeLabel = project.service_type === 'scaffolding' 
    ? 'داربست فلزی' 
    : 'چادر برزنتی';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/projects")}
        className="mb-6 gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به لیست پروژه‌ها
      </Button>

      <div className="space-y-6">
        {/* Project Header */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="text-sm py-1">
                    {serviceTypeLabel}
                  </Badge>
                  <Badge 
                    variant={project.status === 'active' ? 'default' : 'secondary'}
                    className="text-sm py-1"
                  >
                    {project.status === 'active' ? 'فعال' : 'تکمیل شده'}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{project.project_name}</CardTitle>
              </div>
              <Button
                onClick={() => navigate("/scaffolding/form")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                افزودن درخواست جدید
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{project.location_address || 'آدرس مشخص نشده'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  ایجاد شده: {new Date(project.created_at).toLocaleDateString("fa-IR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Service Requests List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              درخواست‌های خدمات ({serviceRequests.length})
            </h2>
          </div>

          {serviceRequests.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">هنوز درخواستی در این پروژه ثبت نشده</p>
                <Button
                  onClick={() => navigate("/scaffolding/form")}
                  className="mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  افزودن اولین درخواست
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {serviceRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          درخواست #{request.id.slice(0, 8)}
                        </CardTitle>
                        <CardDescription>
                          ثبت شده در {new Date(request.created_at).toLocaleDateString("fa-IR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {request.status === 'pending' ? 'در انتظار' : 
                         request.status === 'approved' ? 'تأیید شده' : 'بررسی شده'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm">
                      {request.sub_type && (
                        <div>
                          <span className="text-muted-foreground">نوع: </span>
                          <span className="font-medium">
                            {request.sub_type === 'metal' ? 'داربست فلزی' : 
                             request.sub_type === 'facade' ? 'داربست نمای ساختمان' : request.sub_type}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <span>ابعاد: </span>
                        <span className="font-medium">
                          {request.length}m × {request.width}m × {request.height}m
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}