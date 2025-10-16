import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/errorHandler";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  MapPin,
  Phone,
  User
} from "lucide-react";

interface Contractor {
  id: string;
  company_name: string;
  is_approved: boolean;
  is_active: boolean;
}

interface ProjectAssignment {
  id: string;
  status: string;
  assigned_at: string;
  accepted_at: string | null;
  service_requests: {
    id: string;
    service_type: string;
    sub_type: string | null;
    location_address: string | null;
    length: number;
    width: number;
    height: number;
    created_at: string;
    profiles: {
      full_name: string | null;
      phone_number: string | null;
    } | null;
  };
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "در انتظار تأیید", color: "bg-yellow-500", icon: Clock },
  accepted: { label: "پذیرفته شده", color: "bg-blue-500", icon: CheckCircle2 },
  in_progress: { label: "در حال انجام", color: "bg-purple-500", icon: Clock },
  completed: { label: "تکمیل شده", color: "bg-green-500", icon: CheckCircle2 },
};

export default function ContractorDashboard() {
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchContractorData();
  }, []);

  const fetchContractorData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Fetch contractor profile
      const { data: contractorData, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (contractorError) {
        if (contractorError.code === 'PGRST116') {
          navigate("/contractor/register");
          return;
        }
        throw contractorError;
      }

      setContractor(contractorData);

      // Fetch project assignments with proper type handling
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("project_assignments")
        .select(`
          *,
          service_requests!inner (
            id,
            service_type,
            sub_type,
            location_address,
            length,
            width,
            height,
            created_at,
            user_id
          )
        `)
        .eq("contractor_id", contractorData.id)
        .order("assigned_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch profiles separately for each assignment
      const assignmentsWithProfiles = await Promise.all(
        (assignmentsData || []).map(async (assignment: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone_number")
            .eq("user_id", assignment.service_requests.user_id)
            .single();

          return {
            ...assignment,
            service_requests: {
              ...assignment.service_requests,
              profiles: profile
            }
          };
        })
      );

      setAssignments(assignmentsWithProfiles as any);
    } catch (error: any) {
      toast(toastError(error, 'خطا در بارگذاری اطلاعات'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProject = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("project_assignments")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "✓ پروژه پذیرفته شد",
        description: "پروژه با موفقیت پذیرفته شد"
      });

      fetchContractorData();
    } catch (error: any) {
      toast(toastError(error, 'خطا در پذیرش پروژه'));
    }
  };

  const handleCompleteProject = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("project_assignments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "✓ پروژه تکمیل شد",
        description: "پروژه با موفقیت به اتمام رسید"
      });

      fetchContractorData();
    } catch (error: any) {
      toast(toastError(error, 'خطا در تکمیل پروژه'));
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

  if (!contractor) {
    return null;
  }

  const pendingAssignments = assignments.filter(a => a.status === 'pending');
  const activeAssignments = assignments.filter(a => ['accepted', 'in_progress'].includes(a.status));
  const completedAssignments = assignments.filter(a => a.status === 'completed');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">کارتابل پیمانکار</h1>
            <p className="text-muted-foreground mt-1">{contractor.company_name}</p>
          </div>
          {!contractor.is_approved && (
            <Badge variant="outline" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              در انتظار تأیید مدیریت
            </Badge>
          )}
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">پروژه‌های جدید</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingAssignments.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">پروژه‌های فعال</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeAssignments.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">پروژه‌های تکمیل شده</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedAssignments.length}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!contractor.is_approved ? (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">در انتظار تأیید</h3>
                <p className="text-sm text-yellow-800 leading-relaxed">
                  حساب کاربری شما در حال بررسی توسط تیم مدیریت است. پس از تأیید، می‌توانید پروژه‌ها را مشاهده و قبول کنید.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              جدید ({pendingAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              فعال ({activeAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              تکمیل شده ({completedAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">هیچ پروژه جدیدی وجود ندارد</p>
                </CardContent>
              </Card>
            ) : (
              pendingAssignments.map(assignment => (
                <ProjectCard
                  key={assignment.id}
                  assignment={assignment}
                  onAccept={() => handleAcceptProject(assignment.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">هیچ پروژه فعالی وجود ندارد</p>
                </CardContent>
              </Card>
            ) : (
              activeAssignments.map(assignment => (
                <ProjectCard
                  key={assignment.id}
                  assignment={assignment}
                  onComplete={() => handleCompleteProject(assignment.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">هیچ پروژه تکمیل شده‌ای وجود ندارد</p>
                </CardContent>
              </Card>
            ) : (
              completedAssignments.map(assignment => (
                <ProjectCard key={assignment.id} assignment={assignment} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ProjectCard({
  assignment,
  onAccept,
  onComplete
}: {
  assignment: ProjectAssignment;
  onAccept?: () => void;
  onComplete?: () => void;
}) {
  const statusInfo = statusLabels[assignment.status];
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline">
                {assignment.service_requests.service_type === 'scaffolding' ? 'داربست فلزی' : 'چادر برزنتی'}
              </Badge>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white ${statusInfo.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusInfo.label}
              </div>
            </div>
            <CardTitle className="text-lg">
              پروژه #{assignment.service_requests.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="mt-1">
              ثبت شده در {new Date(assignment.service_requests.created_at).toLocaleDateString("fa-IR")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Project Details */}
        <div className="grid gap-3 text-sm">
          {assignment.service_requests.location_address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{assignment.service_requests.location_address}</span>
            </div>
          )}
          
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">ابعاد:</span>
            <span className="font-medium">
              طول: {assignment.service_requests.length}m × 
              عرض: {assignment.service_requests.width}m × 
              ارتفاع: {assignment.service_requests.height}m
            </span>
          </div>

          {/* Customer Info */}
          {assignment.service_requests.profiles && (
            <div className="border-t pt-3 mt-3">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                اطلاعات مشتری
              </h4>
              <div className="space-y-2 text-sm">
                {assignment.service_requests.profiles.full_name && (
                  <div>نام: {assignment.service_requests.profiles.full_name}</div>
                )}
                {assignment.service_requests.profiles.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {assignment.service_requests.profiles.phone_number}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {assignment.status === 'pending' && onAccept && (
          <Button onClick={onAccept} className="w-full">
            قبول پروژه
          </Button>
        )}
        {assignment.status === 'accepted' && onComplete && (
          <Button onClick={onComplete} className="w-full" variant="outline">
            تکمیل پروژه
          </Button>
        )}
      </CardContent>
    </Card>
  );
}