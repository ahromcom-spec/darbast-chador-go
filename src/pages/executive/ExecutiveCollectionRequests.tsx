import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { CollectionRequestDialog } from "@/components/orders/CollectionRequestDialog";
import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  User,
  Phone,
  XCircle,
} from "lucide-react";
import { formatPersianDateTime } from "@/lib/dateUtils";

interface CollectionRequest {
  id: string;
  order_id: string;
  customer_id: string;
  description: string | null;
  requested_date: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  order?: {
    code: string;
    address: string;
    customer_name: string | null;
    customer_phone: string | null;
  };
}

export default function ExecutiveCollectionRequests() {
  const [requests, setRequests] = useState<CollectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CollectionRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_requests')
        .select(`
          *,
          order:projects_v3(code, address, customer_name, customer_phone)
        `)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching collection requests:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری درخواست‌های جمع‌آوری',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> در انتظار بررسی</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-blue-600"><CheckCircle className="h-3 w-3" /> تایید شده</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="gap-1 bg-orange-600"><Clock className="h-3 w-3" /> در حال اجرا</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> تکمیل شده</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> رد شده</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> لغو شده</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleOpenDialog = (request: CollectionRequest) => {
    setSelectedRequest(request);
    setShowDialog(true);
  };

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      // Refresh the list when dialog closes
      fetchRequests();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          درخواست‌های جمع‌آوری داربست
        </h1>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {requests.filter(r => r.status === 'pending').length} درخواست در انتظار
        </Badge>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Package}
          title="هیچ درخواست جمع‌آوری یافت نشد"
          description="در حال حاضر درخواست جمع‌آوری فعالی وجود ندارد"
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-lg">
                        سفارش {request.order?.code}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>تاریخ درخواست جمع‌آوری:</span>
                      <span className="font-medium text-foreground">
                        {request.requested_date ? formatPersianDateTime(request.requested_date) : 'نامشخص'}
                      </span>
                    </div>

                    {request.order?.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{request.order.address}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      {request.order?.customer_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{request.order.customer_name}</span>
                        </div>
                      )}
                      {request.order?.customer_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span dir="ltr">{request.order.customer_phone}</span>
                        </div>
                      )}
                    </div>

                    {request.description && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                        {request.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenDialog(request)}
                      className="whitespace-nowrap"
                    >
                      {request.status === 'pending' ? 'بررسی درخواست' : 'مشاهده جزئیات'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Collection Request Dialog */}
      {selectedRequest && (
        <CollectionRequestDialog
          open={showDialog}
          onOpenChange={handleDialogClose}
          orderId={selectedRequest.order_id}
          orderCode={selectedRequest.order?.code || ''}
          customerId={selectedRequest.customer_id}
          isManager={true}
        />
      )}
    </div>
  );
}
