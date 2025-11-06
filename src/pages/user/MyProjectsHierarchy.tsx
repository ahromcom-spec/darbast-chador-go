import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { 
  ChevronLeft, 
  ChevronDown, 
  MapPin, 
  FolderOpen, 
  Folder,
  FileText,
  Plus,
  Building2
} from 'lucide-react';

interface Address {
  id: string;
  title?: string;
  address_line: string;
  province_id?: string;
  district_id?: string;
  provinces?: { name: string };
  districts?: { name: string };
}

interface Project {
  id: string;
  location_id: string;
  service_type_id: string;
  subcategory_id: string;
  title: string;
  service_types_v3?: { name: string; code: string };
  subcategories?: { name: string; code: string };
}

interface Order {
  id: string;
  project_id: string;
  code: string;
  status: string;
  created_at: string;
  notes?: any;
  province_id?: string;
  district_id?: string;
  subcategory_id?: string;
  payment_amount?: number;
}

interface HierarchyData {
  addresses: Address[];
  projects: { [locationId: string]: Project[] };
  orders: { [projectId: string]: Order[] };
}

export default function MyProjectsHierarchy() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HierarchyData>({
    addresses: [],
    projects: {},
    orders: {}
  });
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const orderRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    fetchHierarchyData();
  }, []);

  // باز کردن خودکار آدرس و پروژه مورد نظر
  useEffect(() => {
    const state = location.state as any;
    if (state?.expandLocationId) {
      setExpandedAddresses(new Set([state.expandLocationId]));
    }
    if (state?.expandProjectId) {
      setExpandedProjects(new Set([state.expandProjectId]));
    }
    if (state?.highlightOrderId) {
      setHighlightedOrderId(state.highlightOrderId);
      // حذف هایلایت بعد از 3 ثانیه
      setTimeout(() => setHighlightedOrderId(null), 3000);
    }
  }, [location.state]);

  // Scroll to the highlighted order when available
  useEffect(() => {
    if (!highlightedOrderId || loading) return;
    // give the DOM a tick to render expanded sections
    const el = orderRefs.current[highlightedOrderId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedOrderId, loading]);

  const fetchHierarchyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's addresses
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select(`
          id,
          title,
          address_line,
          province_id,
          district_id,
          provinces(name),
          districts(name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (locError) throw locError;

      // Fetch user's projects with relations
      const { data: projects, error: projError } = await supabase
        .from('projects_hierarchy')
        .select(`
          id,
          location_id,
          service_type_id,
          subcategory_id,
          title,
          service_types_v3(name, code),
          subcategories(name, code)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (projError) throw projError;

      // دریافت customer_id برای دریافت سفارشات
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (custErr) throw custErr;

      let orders: Order[] = [];
      
      // Fetch orders from projects_v3 (سفارشات) با لینک به hierarchy
      if (customer) {
        const { data: projectsV3, error: ordErr } = await supabase
          .from('projects_v3')
          .select('id, code, status, created_at, notes, province_id, district_id, subcategory_id, hierarchy_project_id, payment_amount')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (ordErr) throw ordErr;

        // تبدیل projects_v3 به فرمت Order
        orders = (projectsV3 || []).map(pv3 => ({
          id: pv3.id,
          project_id: pv3.hierarchy_project_id || pv3.id, // استفاده از hierarchy_project_id برای لینک
          code: pv3.code,
          status: pv3.status,
          created_at: pv3.created_at,
          notes: pv3.notes,
          province_id: pv3.province_id,
          district_id: pv3.district_id,
          subcategory_id: pv3.subcategory_id,
          payment_amount: pv3.payment_amount
        }));
      }

      // Group projects by location
      const projectsByLocation: { [key: string]: Project[] } = {};
      projects?.forEach(project => {
        if (!projectsByLocation[project.location_id]) {
          projectsByLocation[project.location_id] = [];
        }
        projectsByLocation[project.location_id].push(project);
      });

      // گروه‌بندی سفارش‌ها بر اساس hierarchy_project_id
      const ordersByProject: { [key: string]: Order[] } = {};
      projects?.forEach((project) => {
        ordersByProject[project.id] = (orders || []).filter((o) => 
          o.project_id === project.id
        );
      });

      setData({
        addresses: locations || [],
        projects: projectsByLocation,
        orders: ordersByProject
      });

    } catch (error) {
      console.error('خطا در بارگذاری داده‌ها:', error);
      toast.error('خطا در بارگذاری اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddress = (addressId: string) => {
    const newExpanded = new Set(expandedAddresses);
    if (newExpanded.has(addressId)) {
      newExpanded.delete(addressId);
    } else {
      newExpanded.add(addressId);
    }
    setExpandedAddresses(newExpanded);
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } } = {
      draft: { label: 'پیش‌نویس', variant: 'secondary' },
      pending: { label: 'در انتظار تایید', variant: 'outline' },
      pending_execution: { label: 'در انتظار اجرا', variant: 'outline' },
      approved: { label: 'تایید شده', variant: 'default' },
      rejected: { label: 'رد شده', variant: 'destructive' },
      in_progress: { label: 'در حال اجرا', variant: 'default' },
      completed: { label: 'تکمیل شده', variant: 'default' },
      paid: { label: 'پرداخت شده', variant: 'default' },
      closed: { label: 'بسته شده', variant: 'secondary' }
    };

    const config = statusConfig[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner size="lg" text="در حال بارگذاری پروژه‌ها..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">پروژه‌های من</h1>
          <p className="text-muted-foreground mt-2">
            مشاهده و مدیریت پروژه‌های خود را بر اساس آدرس
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          <Plus className="ml-2 h-4 w-4" />
          پروژه جدید
        </Button>
      </div>

      {data.addresses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">هنوز آدرسی ثبت نکرده‌اید</h3>
            <p className="text-muted-foreground text-center mb-4">
              برای شروع، ابتدا یک آدرس ثبت کنید
            </p>
            <Button onClick={() => navigate('/')}>
              ثبت آدرس و پروژه جدید
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.addresses.map((address) => {
            const isExpanded = expandedAddresses.has(address.id);
            const addressProjects = data.projects[address.id] || [];
            const projectCount = addressProjects.length;

            return (
              <Card key={address.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleAddress(address.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <FolderOpen className="h-5 w-5 text-primary" />
                    ) : (
                      <Folder className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      {address.title && (
                        <p className="text-sm font-medium text-foreground mb-1">
                          {address.title}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{address.address_line}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {address.provinces?.name}
                        {address.districts?.name && ` • ${address.districts.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {projectCount} پروژه
                    </Badge>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronLeft className="h-5 w-5" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-accent/20 p-4 space-y-3">
                    {addressProjects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>هنوز پروژه‌ای در این آدرس ثبت نشده است</p>
                      </div>
                    ) : (
                      addressProjects.map((project) => {
                        const isProjectExpanded = expandedProjects.has(project.id);
                        const projectOrders = data.orders[project.id] || [];
                        const orderCount = projectOrders.length;

                        return (
                          <Card key={project.id} className="mr-6">
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => toggleProject(project.id)}
                            >
                              <div className="flex items-center gap-3">
                                {isProjectExpanded ? (
                                  <FolderOpen className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div>
                                  <h4 className="font-medium text-sm">
                                    {project.service_types_v3?.name} - {project.subcategories?.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    کد: {project.service_types_v3?.code}{project.subcategories?.code}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {orderCount} سفارش
                                </Badge>
                                {isProjectExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronLeft className="h-4 w-4" />
                                )}
                              </div>
                            </div>

                            {isProjectExpanded && (
                              <div className="border-t bg-muted/30 p-3 space-y-2">
                                {projectOrders.length === 0 ? (
                                  <div className="text-center py-6 text-muted-foreground text-sm">
                                    <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                    <p>هنوز سفارشی ثبت نشده است</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/user/add-service/${project.id}`);
                                      }}
                                    >
                                      افزودن سفارش
                                    </Button>
                                  </div>
                                 ) : (
                                   projectOrders.map((order) => {
                                     // سازگاری با ساختارهای مختلف notes (رشته یا آبجکت)
                                     const rawNotes = order.notes as any;
                                     let notes: any = rawNotes;
                                     try {
                                       if (typeof rawNotes === 'string') notes = JSON.parse(rawNotes);
                                     } catch {
                                       notes = rawNotes;
                                     }

                                     const dims = Array.isArray(notes?.dimensions) ? notes.dimensions : [];
                                     const hasWidth = dims.length > 0 && ("width" in dims[0] || dims.some((d: any) => "width" in d));

                                     const dimensionsText = dims.length > 0
                                       ? dims.map((d: any) => {
                                           const l = d.length ?? d.L ?? d.l;
                                           const w = d.width ?? d.W ?? d.w;
                                           const h = d.height ?? d.H ?? d.h;
                                           return hasWidth ? `${l}×${w}×${h}` : `${l}×${h}`;
                                         }).join(' + ')
                                       : 'نامشخص';

                                     // پشتیبانی از totalArea (حجم) و total_area (مساحت)
                                     const computedFromDims = () => {
                                       if (dims.length === 0) return 0;
                                       return dims.reduce((sum: number, d: any) => {
                                         const l = parseFloat(d.length ?? d.L ?? d.l ?? 0) || 0;
                                         const w = parseFloat(d.width ?? d.W ?? d.w ?? 0) || 0;
                                         const h = parseFloat(d.height ?? d.H ?? d.h ?? 0) || 0;
                                         return sum + (hasWidth ? (l * w * h) : (l * h));
                                       }, 0);
                                     };

                                     const totalValue = typeof notes?.totalArea === 'number'
                                       ? notes.totalArea
                                       : (typeof notes?.total_area === 'number' ? notes.total_area : computedFromDims());

                                     const isArea = (notes && ("total_area" in notes)) || (!hasWidth && dims.length > 0);
                                     const metricLabel = 'متراژ:';
                                     const unit = isArea ? 'متر مربع' : 'متر مکعب';

                                     const estimatedPrice = typeof notes?.estimated_price === 'number'
                                       ? notes.estimated_price
                                       : (order.payment_amount || 0);

                                     return (
                                       <div
                                         key={order.id}
                                         ref={(el) => { orderRefs.current[order.id] = el; }}
                                         className={`p-3 bg-background rounded-md hover:bg-accent/50 cursor-pointer transition-all mr-6 ${
                                           highlightedOrderId === order.id ? 'ring-2 ring-primary shadow-lg' : ''
                                         }`}
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           navigate(`/orders/${order.id}`);
                                         }}
                                       >
                                         <div className="flex items-start justify-between mb-2">
                                           <div className="flex items-center gap-2">
                                             <FileText className="h-4 w-4 text-muted-foreground" />
                                             <div>
                                               <p className="text-sm font-medium">سفارش #{order.code}</p>
                                               <p className="text-xs text-muted-foreground">
                                                 {new Date(order.created_at).toLocaleDateString('fa-IR', {
                                                   year: 'numeric',
                                                   month: 'long',
                                                   day: 'numeric'
                                                 })} - {new Date(order.created_at).toLocaleTimeString('fa-IR', {
                                                   hour: '2-digit',
                                                   minute: '2-digit'
                                                 })}
                                               </p>
                                             </div>
                                           </div>
                                           {getStatusBadge(order.status)}
                                         </div>
                                         <div className="grid grid-cols-2 gap-2 text-xs mr-6">
                                           <div className="flex items-center gap-1">
                                             <span className="text-muted-foreground">ابعاد:</span>
                                             <span className="font-medium" dir="ltr">{dimensionsText}{dims.length > 0 ? ' متر' : ''}</span>
                                           </div>
                                           {totalValue > 0 && (
                                             <div className="flex items-center gap-1">
                                               <span className="text-muted-foreground">{metricLabel}</span>
                                               <span className="font-medium" dir="ltr">{totalValue.toFixed(2)} {unit}</span>
                                             </div>
                                           )}
                                           {estimatedPrice > 0 && (
                                             <div className="flex items-center gap-1 col-span-2">
                                               <span className="text-muted-foreground">قیمت:</span>
                                               <span className="font-medium">{estimatedPrice.toLocaleString('fa-IR')} تومان</span>
                                             </div>
                                           )}
                                         </div>
                                       </div>
                                     );
                                   })
                                 )}
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
}
