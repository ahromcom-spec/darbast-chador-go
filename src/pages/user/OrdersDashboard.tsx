import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleError, toastError } from "@/lib/errorHandler";
import { MainLayout } from "@/components/layouts/MainLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  XCircle,
  Calendar,
  MapPin,
  FileText,
  Eye,
  Building2,
  PlusCircle
} from "lucide-react";

interface Order {
  id: string;
  code: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'scheduled' | 'active' | 'pending_execution' | 'completed' | 'in_progress' | 'paid' | 'closed';
  created_at: string;
  address: string;
  detailed_address?: string;
  notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  subcategory?: {
    name: string;
    service_type: {
      name: string;
    };
  };
  province?: {
    name: string;
  };
  district?: {
    name: string;
  };
}

// تابع استخراج قیمت از notes
const extractPriceFromNotes = (notes?: string): number | null => {
  if (!notes) return null;
  try {
    const parsedNotes = typeof notes === 'string' ? JSON.parse(notes) : notes;
    return parsedNotes?.estimatedPrice || null;
  } catch {
    return null;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'پیش‌نویس', variant: 'outline' },
    pending: { label: 'در انتظار تایید', variant: 'default' },
    approved: { label: 'تایید شده', variant: 'secondary' },
    rejected: { label: 'رد شده', variant: 'destructive' },
    active: { label: 'در حال انجام', variant: 'default' },
    pending_execution: { label: 'در انتظار اجرا', variant: 'default' },
    in_progress: { label: 'در حال اجرا', variant: 'default' },
    completed: { label: 'تکمیل شده', variant: 'secondary' },
    closed: { label: 'بسته شده', variant: 'outline' },
  };

  const config = variants[status] || { label: status, variant: 'outline' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default function OrdersDashboard() {
  usePageTitle('سفارشات من');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Get customer ID
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customer) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("projects_v3")
        .select(`
          *,
          subcategory:subcategories(
            name,
            service_type:service_types_v3(name)
          ),
          province:provinces(name),
          district:districts(name)
        `)
        .eq("customer_id", customer.id)
        .order("code", { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);
    } catch (error: any) {
      const { message } = handleError(error, { context: 'Fetching orders' });
      setError(message);
      toast(toastError(error, 'خطا در بارگذاری سفارشات'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری سفارشات..." />
        </div>
      </MainLayout>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const approvedOrders = orders.filter(o => ['approved', 'active', 'pending_execution', 'in_progress'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'closed');
  const rejectedOrders = orders.filter(o => o.status === 'rejected');

  return (
    <MainLayout>
      <PageHeader
        title="سفارشات من"
        description="مدیریت اطلاعات شخصی و سفارشات"
      />

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={fetchOrders}
        />
      )}

      {/* مدیریت پروژه‌ها */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            مدیریت پروژه‌ها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* پروژه‌های من */}
            <button
              onClick={() => navigate('/user/projects')}
              className="flex items-start gap-4 p-6 rounded-lg border-2 border-border hover:border-primary transition-colors text-right bg-card hover:bg-accent/5"
            >
              <div className="p-3 rounded-lg bg-primary/10">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">پروژه‌های من</h3>
                <p className="text-sm text-muted-foreground">
                  مشاهده و مدیریت پروژه‌ها
                </p>
              </div>
            </button>

            {/* پروژه جدید */}
            <button
              onClick={() => navigate('/user/create-project')}
              className="flex items-start gap-4 p-6 rounded-lg border-2 border-border hover:border-primary transition-colors text-right bg-card hover:bg-accent/5"
            >
              <div className="p-3 rounded-lg bg-primary/10">
                <PlusCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">پروژه جدید</h3>
                <p className="text-sm text-muted-foreground">
                  ایجاد پروژه با آدرس و خدمات
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* سفارشات ثبت شده */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            سفارشات ثبت شده
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingOrders.length}</p>
                  <p className="text-sm text-muted-foreground">در انتظار تایید</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedOrders.length}</p>
                  <p className="text-sm text-muted-foreground">تایید شده</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedOrders.length}</p>
                  <p className="text-sm text-muted-foreground">تکمیل شده</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rejectedOrders.length}</p>
                  <p className="text-sm text-muted-foreground">رد شده</p>
                </div>
              </div>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">هیچ سفارشی وجود ندارد</h3>
              <p className="text-sm text-muted-foreground mb-6">
                با ثبت اولین سفارش، می‌توانید وضعیت آن را در اینجا پیگیری کنید
              </p>
              <Button onClick={() => navigate('/user/create-project')}>
                <PlusCircle className="h-4 w-4 ml-2" />
                ثبت سفارش جدید
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">
                            کد سفارش: {order.code}
                          </CardTitle>
                          {getStatusBadge(order.status)}
                        </div>
                        
                        {order.subcategory && (
                          <p className="text-sm text-muted-foreground">
                            {order.subcategory.service_type.name} - {order.subcategory.name}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {order.status === 'draft' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate(`/scaffolding/form?edit=${order.id}`)}
                          >
                            <Eye className="h-4 w-4 ml-2" />
                            ویرایش
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/user/orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4 ml-2" />
                          مشاهده جزئیات
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{order.address}</p>
                        {order.detailed_address && (
                          <p className="text-muted-foreground">{order.detailed_address}</p>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const price = extractPriceFromNotes(order.notes);
                      if (price) {
                        return (
                          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-sm font-medium">قیمت تخمینی:</span>
                            <span className="text-lg font-bold text-primary">
                              {price.toLocaleString('fa-IR')} تومان
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        ثبت شده در {new Date(order.created_at).toLocaleDateString("fa-IR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>

                    {order.status === 'pending' && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          سفارش شما در حال بررسی توسط مدیریت است
                        </p>
                      </div>
                    )}

                    {order.status === 'rejected' && order.rejection_reason && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-destructive flex items-start gap-2">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>دلیل رد: {order.rejection_reason}</span>
                        </p>
                      </div>
                    )}

                    {(['approved', 'pending_execution'].includes(order.status)) && order.approved_at && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          تایید شده در {new Date(order.approved_at).toLocaleDateString("fa-IR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })}
                        </p>
                      </div>
                    )}

                    {order.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{order.notes}</span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
