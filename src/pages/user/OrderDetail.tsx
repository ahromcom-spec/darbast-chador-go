import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  ArrowRight,
  MapPin,
  Calendar,
  FileText,
  Edit,
  Building,
  Hash,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

interface Order {
  id: string;
  code: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'active' | 'pending_execution' | 'completed' | 'in_progress' | 'paid' | 'closed';
  created_at: string;
  updated_at: string;
  address: string;
  detailed_address?: string;
  notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  approved_by?: string;
  project_number: string;
  service_code: string;
  execution_start_date?: string;
  payment_amount?: number;
  payment_method?: string;
  customer_completion_date?: string;
  executive_completion_date?: string;
  subcategory?: {
    name: string;
    code: string;
    service_type: {
      name: string;
      code: string;
    };
  };
  province?: {
    name: string;
    code: string;
  };
  district?: {
    name: string;
  };
}

const orderNotesSchema = z.object({
  dimensions: z.array(z.object({
    length: z.string(),
    height: z.string(),
    area: z.number()
  })).optional(),
  totalArea: z.number().optional(),
  estimatedPrice: z.number().optional()
}).passthrough();

const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; icon: any; color: string }> = {
    draft: { label: 'پیش‌نویس', icon: FileText, color: 'text-muted-foreground' },
    pending: { label: 'در انتظار تایید', icon: Clock, color: 'text-yellow-600' },
    approved: { label: 'تایید شده - در انتظار اجرا', icon: CheckCircle, color: 'text-green-600' },
    rejected: { label: 'رد شده', icon: XCircle, color: 'text-destructive' },
    in_progress: { label: 'در حال اجرا', icon: Clock, color: 'text-blue-600' },
    completed: { label: 'اجرا شده - در انتظار پرداخت', icon: CheckCircle, color: 'text-orange-600' },
    paid: { label: 'پرداخت شده - در انتظار اتمام', icon: CheckCircle, color: 'text-purple-600' },
    closed: { label: 'به اتمام رسیده', icon: CheckCircle, color: 'text-gray-600' },
  };
  
  return statusMap[status] || { label: status, icon: FileText, color: 'text-muted-foreground' };
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsedNotes, setParsedNotes] = useState<any>(null);
  const [completionDate, setCompletionDate] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
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
        toast({
          title: "خطا",
          description: "اطلاعات مشتری یافت نشد",
          variant: "destructive"
        });
        navigate("/orders");
        return;
      }

      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("projects_v3")
        .select(`
          *,
          subcategory:subcategories(
            name,
            code,
            service_type:service_types_v3(name, code)
          ),
          province:provinces(name, code),
          district:districts(name)
        `)
        .eq("id", id)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (orderError) throw orderError;
      
      if (!orderData) {
        toast({
          title: "خطا",
          description: "سفارش یافت نشد",
          variant: "destructive"
        });
        navigate("/orders");
        return;
      }

      setOrder(orderData);

      // Parse notes if exists
      if (orderData.notes) {
        try {
          const notes = typeof orderData.notes === 'string' 
            ? JSON.parse(orderData.notes) 
            : orderData.notes;
          
          const validated = orderNotesSchema.parse(notes);
          setParsedNotes(validated);
        } catch (e) {
          console.error('Error parsing notes:', e);
          setParsedNotes(null);
        }
      }

    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری سفارش",
        description: error.message,
        variant: "destructive"
      });
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  // Security: Only draft orders are editable, pending orders are locked
  const canEdit = order?.status === 'draft';

  const handleSetCompletionDate = async () => {
    if (!order || !completionDate) {
      toast({
        title: 'خطا',
        description: 'لطفا تاریخ اتمام را وارد کنید',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          customer_completion_date: new Date(completionDate).toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'تاریخ اتمام شما ثبت شد'
      });

      fetchOrderDetails();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'ثبت تاریخ اتمام با خطا مواجه شد',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری..." />
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return null;
  }

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/orders")}
          className="mb-6 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست سفارشات
        </Button>

        <div className="space-y-6">
          {/* Order Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                    <Badge variant={order.status === 'approved' ? 'secondary' : 'default'}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl mb-2">سفارش: {order.code}</CardTitle>
                  {order.subcategory && (
                    <p className="text-muted-foreground">
                      {order.subcategory.service_type.name} - {order.subcategory.name}
                    </p>
                  )}
                </div>
                
                {canEdit && (
                  <Button
                    onClick={() => navigate(`/scaffolding/form?edit=${order.id}`)}
                  >
                    <Edit className="h-4 w-4 ml-2" />
                    ویرایش سفارش
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">شماره پروژه:</span>
                  <span className="font-mono">{order.project_number}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">کد خدمات:</span>
                  <span className="font-mono">{order.service_code}</span>
                </div>
              </div>

              <Separator />
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">آدرس</p>
                  <p>{order.address}</p>
                  {order.detailed_address && (
                    <p className="text-muted-foreground mt-1">{order.detailed_address}</p>
                  )}
                  {order.province && (
                    <p className="text-sm text-muted-foreground mt-1">
                      استان {order.province.name}
                      {order.district && ` - ${order.district.name}`}
                    </p>
                  )}
                </div>
              </div>
              
              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    ثبت شده: {new Date(order.created_at).toLocaleDateString("fa-IR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                {order.approved_at && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      تایید شده: {new Date(order.approved_at).toLocaleDateString("fa-IR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Details from Notes */}
          {parsedNotes && (
            <Card>
              <CardHeader>
                <CardTitle>جزئیات سفارش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {parsedNotes.dimensions && parsedNotes.dimensions.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">ابعاد نما</h3>
                    <div className="space-y-2">
                      {parsedNotes.dimensions.map((dim: any, index: number) => (
                        <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                          <span className="font-medium">نما {index + 1}:</span>
                          <span>طول: {dim.length} متر</span>
                          <span>×</span>
                          <span>ارتفاع: {dim.height} متر</span>
                          <span className="text-muted-foreground">
                            = {dim.area} متر مربع
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedNotes.totalArea && (
                  <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
                    <span className="font-medium">مساحت کل:</span>
                    <span className="text-lg font-bold">{parsedNotes.totalArea} متر مربع</span>
                  </div>
                )}

                {parsedNotes.estimatedPrice && (
                  <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <span className="font-medium">قیمت تخمینی:</span>
                    <span className="text-lg font-bold">
                      {parsedNotes.estimatedPrice.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Messages */}
          {order.status === 'pending' && (
            <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      در انتظار تایید مدیریت
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      سفارش شما در حال بررسی است و به زودی نتیجه به شما اطلاع داده خواهد شد.
                      پس از ثبت سفارش، امکان ویرایش وجود ندارد.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'rejected' && order.rejection_reason && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive mb-1">سفارش رد شده</p>
                    <p className="text-sm text-destructive/80">
                      دلیل رد: {order.rejection_reason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'approved' && (
            <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      سفارش تایید شده
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      سفارش شما توسط مدیریت تایید شده و به زودی عملیات اجرایی آغاز خواهد شد.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'in_progress' && order.execution_start_date && (
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      در حال اجرا
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      سفارش شما از تاریخ {new Date(order.execution_start_date).toLocaleDateString('fa-IR')} در حال اجراست.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'completed' && order.payment_amount && (
            <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                      اجرا تکمیل شد
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      مبلغ قابل پرداخت: {order.payment_amount.toLocaleString('fa-IR')} تومان
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'paid' && (
            <>
              <Card className="border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                          پرداخت انجام شد
                        </p>
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          پرداخت شما ثبت شد. جهت تایید نهایی اتمام پروژه، لطفا تاریخ اتمام را مشخص کنید.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <h4 className="font-semibold mb-2 text-sm">وضعیت تایید اتمام</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          {order.customer_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>تایید شما: {order.customer_completion_date 
                            ? new Date(order.customer_completion_date).toLocaleDateString('fa-IR')
                            : 'در انتظار'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.executive_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>مدیر اجرایی: {order.executive_completion_date 
                            ? new Date(order.executive_completion_date).toLocaleDateString('fa-IR')
                            : 'در انتظار'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!order.customer_completion_date && (
                <Card className="border-2 border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">تایید اتمام پروژه</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      با ثبت تاریخ اتمام، تایید می‌کنید که پروژه به درستی انجام شده است.
                    </p>
                    <div>
                      <Label htmlFor="completion-date">تاریخ اتمام پروژه</Label>
                      <Input
                        id="completion-date"
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={handleSetCompletionDate} className="gap-2 w-full">
                      <CheckCircle className="h-4 w-4" />
                      تایید اتمام پروژه
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {order.status === 'closed' && (
            <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/20">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      پروژه با موفقیت به اتمام رسید
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      از اعتماد شما سپاسگزاریم
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.notes && !parsedNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  یادداشت‌ها
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
