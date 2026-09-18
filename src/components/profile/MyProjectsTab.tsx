import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  MapPin, Plus, FolderKanban, Folder, FolderOpen,
  ChevronDown, ChevronLeft, FileText, Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Address {
  id: string;
  title?: string;
  address_line: string;
  is_shared?: boolean;
  provinces?: { name: string };
  districts?: { name: string };
}


interface Project {
  id: string;
  location_id: string;
  service_types_v3?: { name: string; code: string };
  subcategories?: { name: string; code: string };
}

interface Order {
  id: string;
  project_id: string;
  code: string;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'پیش‌نویس', variant: 'secondary' },
  pending: { label: 'در انتظار تایید', variant: 'outline' },
  pending_execution: { label: 'در انتظار اجرا', variant: 'outline' },
  approved: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
  in_progress: { label: 'در حال اجرا', variant: 'default' },
  completed: { label: 'تکمیل شده', variant: 'default' },
  paid: { label: 'پرداخت شده', variant: 'default' },
  closed: { label: 'بسته شده', variant: 'secondary' },
};

export const MyProjectsTab = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [projectsByLocation, setProjectsByLocation] = useState<Record<string, Project[]>>({});
  const [ordersByProject, setOrdersByProject] = useState<Record<string, Order[]>>({});
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [locRes, projRes, ordRes] = await Promise.all([
        supabase
          .from('locations')
          .select('id, title, address_line, provinces(name), districts(name)')
          // آدرس سفارش‌های بسته/غیرفعال هم باید دیده شود (فیلتر نهایی بر اساس داشتن سفارش است)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects_hierarchy')
          .select('id, location_id, service_types_v3(name, code), subcategories(name, code)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_my_projects_v3'),
      ]);

      if (locRes.error) throw locRes.error;
      if (projRes.error) throw projRes.error;
      if (ordRes.error) throw ordRes.error;

      const orders: Order[] = (ordRes.data || []).map((p: any) => ({
        id: p.id,
        project_id: p.hierarchy_project_id || p.id,
        code: p.code,
        status: p.status,
        created_at: p.created_at,
      }));

      // پروژه‌های سفارش‌های همکاری/انتقالی که مالک آن‌ها کاربر دیگری است
      const ownedProjectIds = new Set((projRes.data || []).map((p: any) => p.id));
      const sharedProjectIds = [...new Set(
        orders.map(o => o.project_id).filter(id => id && !ownedProjectIds.has(id))
      )];

      let sharedProjects: any[] = [];
      if (sharedProjectIds.length > 0) {
        const { data: sharedData } = await supabase
          .from('projects_hierarchy')
          .select('id, location_id, service_types_v3(name, code), subcategories(name, code)')
          .in('id', sharedProjectIds);
        sharedProjects = sharedData || [];
      }

      const allProjects = [...(projRes.data || []), ...sharedProjects];

      // آدرس سفارش همکاری هم باید در فهرست آدرس‌های کاربر مقصد دیده شود
      const ownedLocationIds = new Set((locRes.data || []).map((l: any) => l.id));
      const sharedLocationIds = [...new Set(
        sharedProjects
          .map((p: any) => p.location_id)
          .filter((id: string) => id && !ownedLocationIds.has(id))
      )];

      let sharedLocations: any[] = [];
      if (sharedLocationIds.length > 0) {
        const { data: sharedLocData } = await supabase
          .from('locations')
          .select('id, title, address_line, provinces(name), districts(name)')
          .in('id', sharedLocationIds);
        sharedLocations = sharedLocData || [];
      }

      const sharedLocationIdSet = new Set(sharedLocations.map((l: any) => l.id));
      const allLocations = [...(locRes.data || []), ...sharedLocations];

      const projByLoc: Record<string, Project[]> = {};
      allProjects.forEach((p: any) => {
        if (!projByLoc[p.location_id]) projByLoc[p.location_id] = [];
        projByLoc[p.location_id].push(p);
      });

      const ordByProj: Record<string, Order[]> = {};
      allProjects.forEach((p: any) => {
        ordByProj[p.id] = orders
          .filter(o => o.project_id === p.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      // Only keep addresses with projects that have orders
      const filteredProjByLoc: Record<string, Project[]> = {};
      const addressesWithOrders = new Set<string>();
      Object.entries(projByLoc).forEach(([locId, projs]) => {
        const withOrders = projs.filter(pr => (ordByProj[pr.id] || []).length > 0);
        if (withOrders.length > 0) {
          filteredProjByLoc[locId] = withOrders;
          addressesWithOrders.add(locId);
        }
      });

      setAddresses(
        allLocations
          .filter((l: any) => addressesWithOrders.has(l.id))
          .map((l: any) => ({ ...l, is_shared: sharedLocationIdSet.has(l.id) })) as any
      );
      setProjectsByLocation(filteredProjByLoc);
      setOrdersByProject(ordByProj);

    } catch (error: any) {
      console.error("Error fetching projects hierarchy:", error);
      toast({ variant: "destructive", title: "خطا", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleAddress = (id: string) => {
    setExpandedAddresses(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border-2 border-primary/20 bg-card" data-tour="my-projects">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <span>پروژه‌های من</span>
        </h3>
        <Button onClick={() => navigate("/user/create-project")} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          پروژه جدید
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="md" text="در حال بارگذاری..." />
        </div>
      ) : addresses.length === 0 ? (
        <Card className="p-8 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">هنوز پروژه‌ای ندارید</h3>
          <p className="text-muted-foreground mb-4">برای شروع، اولین پروژه خود را ایجاد کنید</p>
          <Button onClick={() => navigate("/user/create-project")} className="gap-2">
            <Plus className="w-4 h-4" />
            ایجاد پروژه جدید
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map(address => {
            const isOpen = expandedAddresses.has(address.id);
            const projects = projectsByLocation[address.id] || [];

            return (
              <Card key={address.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleAddress(address.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" /> : <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                    <div className="min-w-0">
                      {address.title && <p className="text-sm font-medium mb-1">{address.title}</p>}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <h3 className="font-semibold text-sm truncate">{address.address_line}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {address.provinces?.name}
                        {address.districts?.name && ` • ${address.districts.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {address.is_shared && <Badge variant="outline" className="text-xs">همکاری</Badge>}
                    <Badge variant="secondary">{projects.length} پروژه</Badge>
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </div>

                </div>

                {isOpen && (
                  <div className="border-t bg-accent/20 p-3 space-y-2">
                    {projects.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <Building2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p>پروژه‌ای ثبت نشده است</p>
                      </div>
                    ) : (
                      projects.map(project => {
                        const isProjectOpen = expandedProjects.has(project.id);
                        const orders = ordersByProject[project.id] || [];

                        return (
                          <Card key={project.id} className="mr-4">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => toggleProject(project.id)}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isProjectOpen ? <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                                <div className="min-w-0">
                                  <h4 className="font-medium text-sm truncate">
                                    {project.service_types_v3?.name} - {project.subcategories?.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    کد: {project.service_types_v3?.code}{project.subcategories?.code}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="outline" className="text-xs">{orders.length} سفارش</Badge>
                                {isProjectOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                              </div>
                            </div>

                            {isProjectOpen && (
                              <div className="border-t bg-muted/30 p-3 space-y-2">
                                {orders.length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground text-sm">
                                    <FileText className="h-5 w-5 mx-auto mb-2 opacity-50" />
                                    <p>سفارشی ثبت نشده است</p>
                                  </div>
                                ) : (
                                  orders.map(order => {
                                    const cfg = statusConfig[order.status] || { label: order.status, variant: 'default' as const };
                                    return (
                                      <div
                                        key={order.id}
                                        className="p-2 bg-background rounded-md hover:bg-accent/50 cursor-pointer flex items-center justify-between gap-2"
                                        onClick={() => navigate(`/user/orders/${order.id}`)}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium">سفارش #{order.code}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                            </p>
                                          </div>
                                        </div>
                                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                      </div>
                                    );
                                  })
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/service/scaffolding-order/${project.id}`);
                                  }}
                                >
                                  افزودن سفارش جدید
                                </Button>
                              </div>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
