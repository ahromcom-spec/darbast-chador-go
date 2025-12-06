import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeftRight, CheckCircle, XCircle, User, Hash, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TransferRequest {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string;
  to_phone_number: string;
  status: string;
  created_at: string;
  manager_approved_at: string | null;
  manager_rejection_reason: string | null;
  from_profile?: {
    full_name: string;
    phone_number: string;
  };
  to_profile?: {
    full_name: string;
    phone_number: string;
  };
  order?: {
    code: string;
    address: string;
    status: string;
  };
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_manager: { label: 'در انتظار تایید', variant: 'default' },
  manager_approved: { label: 'تایید شده - در انتظار مقصد', variant: 'secondary' },
  manager_rejected: { label: 'رد شده', variant: 'destructive' },
  pending_recipient: { label: 'در انتظار تایید مقصد', variant: 'secondary' },
  recipient_accepted: { label: 'پذیرفته شده توسط مقصد', variant: 'secondary' },
  recipient_rejected: { label: 'رد شده توسط مقصد', variant: 'destructive' },
  completed: { label: 'تکمیل شده', variant: 'outline' },
};

export default function OrderTransferManagement() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<TransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTransferRequests();
  }, [activeTab]);

  const fetchTransferRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('order_transfer_requests')
        .select(`
          *,
          order:projects_v3!order_id(
            code,
            address,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('status', 'pending_manager');
      } else if (activeTab === 'approved') {
        query = query.in('status', ['manager_approved', 'pending_recipient', 'recipient_accepted', 'completed']);
      } else if (activeTab === 'rejected') {
        query = query.in('status', ['manager_rejected', 'recipient_rejected']);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles for each request
      const requestsWithProfiles: TransferRequest[] = [];
      for (const req of (data || [])) {
        const [fromProfile, toProfile] = await Promise.all([
          supabase.from('profiles').select('full_name, phone_number').eq('user_id', req.from_user_id).maybeSingle(),
          req.to_user_id ? supabase.from('profiles').select('full_name, phone_number').eq('user_id', req.to_user_id).maybeSingle() : null,
        ]);

        requestsWithProfiles.push({
          ...req,
          from_profile: fromProfile.data || undefined,
          to_profile: toProfile?.data || undefined,
        } as TransferRequest);
      }

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching transfer requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: TransferRequest) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'pending_recipient',
          manager_approved_by: user?.id,
          manager_approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'درخواست انتقال تایید شد. منتظر تایید شخص مقصد هستیم.',
      });

      fetchTransferRequests();
    } catch (error: any) {
      console.error('Error approving transfer:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تایید درخواست انتقال',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;

    setProcessingId(rejectingRequest.id);
    try {
      const { error } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'manager_rejected',
          manager_approved_by: user?.id,
          manager_approved_at: new Date().toISOString(),
          manager_rejection_reason: rejectionReason || null,
        })
        .eq('id', rejectingRequest.id);

      if (error) throw error;

      toast({
        title: 'انجام شد',
        description: 'درخواست انتقال رد شد',
      });

      setShowRejectDialog(false);
      setRejectingRequest(null);
      setRejectionReason('');
      fetchTransferRequests();
    } catch (error: any) {
      console.error('Error rejecting transfer:', error);
      toast({
        title: 'خطا',
        description: 'خطا در رد درخواست انتقال',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              مدیریت درخواست‌های انتقال سفارش
            </CardTitle>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="pending" className="flex-1">در انتظار تایید</TabsTrigger>
            <TabsTrigger value="approved" className="flex-1">تایید شده</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1">رد شده</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : requests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  درخواستی وجود ندارد
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.order?.code || 'سفارش'}</span>
                        </div>
                        <Badge variant={statusLabels[request.status]?.variant || 'default'}>
                          {statusLabels[request.status]?.label || request.status}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">از: </span>
                            <span className="font-medium">
                              {request.from_profile?.full_name || 'بدون نام'}
                            </span>
                            <span className="text-muted-foreground mr-1">
                              ({request.from_profile?.phone_number})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">به: </span>
                            <span className="font-medium">
                              {request.to_profile?.full_name || 'بدون نام'}
                            </span>
                            <span className="text-muted-foreground mr-1">
                              ({request.to_phone_number})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{request.order?.address}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          تاریخ درخواست: {formatPersianDate(request.created_at)}
                        </span>
                      </div>

                      {request.manager_rejection_reason && (
                        <div className="p-3 bg-destructive/10 rounded-lg text-sm">
                          <span className="text-muted-foreground">دلیل رد: </span>
                          <span className="text-destructive">{request.manager_rejection_reason}</span>
                        </div>
                      )}

                      {request.status === 'pending_manager' && (
                        <>
                          <Separator />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(request)}
                              disabled={processingId === request.id}
                              className="flex-1 gap-2"
                            >
                              {processingId === request.id ? (
                                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              تایید انتقال
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setRejectingRequest(request);
                                setShowRejectDialog(true);
                              }}
                              disabled={processingId === request.id}
                              className="flex-1 gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              رد درخواست
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>رد درخواست انتقال</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از رد این درخواست انتقال سفارش اطمینان دارید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">دلیل رد (اختیاری):</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="دلیل رد درخواست را وارد کنید..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive hover:bg-destructive/90">
              تایید رد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
