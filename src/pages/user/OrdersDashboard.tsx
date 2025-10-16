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
  Eye
} from "lucide-react";

interface Order {
  id: string;
  code: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'active' | 'pending_execution' | 'completed';
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

const getStatusBadge = (status: string) => {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'پیش‌نویس', variant: 'outline' },
    pending: { label: 'در انتظار تایید', variant: 'default' },
    approved: { label: 'تایید شده', variant: 'secondary' },
    rejected: { label: 'رد شده', variant: 'destructive' },
    active: { label: 'در حال انجام', variant: 'default' },
    pending_execution: { label: 'در انتظار اجرا', variant: 'default' },
    completed: { label: 'تکمیل شده', variant: 'secondary' },
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
        .order("created_at", { ascending: false });

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
  const approvedOrders = orders.filter(o => o.status === 'approved' || o.status === 'active' || o.status === 'pending_execution');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const rejectedOrders = orders.filter(o => o.status === 'rejected');

  return (
    <MainLayout>
      <PageHeader
        title="کارتابل سفارشات من"
        description="مشاهده و مدیریت سفارشات ثبت شده"
      />

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={fetchOrders}
        />
      )}

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="در انتظار تایید"
          value={pendingOrders.length}
          icon={Clock}
          description="سفارشات در حال بررسی"
        />
        <StatCard
          title="تایید شده"
          value={approvedOrders.length}
          icon={CheckCircle}
          description="سفارشات تایید شده"
        />
        <StatCard
          title="تکمیل شده"
          value={completedOrders.length}
          icon={CheckCircle}
          description="سفارشات به پایان رسیده"
        />
        <StatCard
          title="رد شده"
          value={rejectedOrders.length}
          icon={XCircle}
          description="سفارشات رد شده"
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="هیچ سفارشی وجود ندارد"
          description="با ثبت اولین سفارش، می‌توانید وضعیت آن را در اینجا پیگیری کنید"
          actionLabel="ثبت سفارش جدید"
          onAction={() => navigate("/scaffolding/form")}
        />
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
                      onClick={() => navigate(`/orders/${order.id}`)}
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

                {order.status === 'approved' && order.approved_at && (
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
    </MainLayout>
  );
}
