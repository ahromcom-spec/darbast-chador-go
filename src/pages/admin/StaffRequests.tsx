import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { Navigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { toastError } from '@/lib/errorHandler';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

const ROLE_LABELS: Record<string, string> = {
  scaffold_worker: 'نیروی داربست',
  scaffold_supervisor: 'سرپرست داربست',
  operations_manager: 'مدیر اجرایی',
  finance_manager: 'مدیر مالی',
  sales_manager: 'مدیر فروش',
  support_manager: 'مدیر پشتیبانی',
  general_manager: 'مدیرعامل',
  warehouse_manager: 'مدیر انبار',
  security_manager: 'مدیر حراست',
};

interface StaffRequest {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
  profiles?: {
    full_name: string;
    phone_number: string;
  };
}

export const StaffRequests = () => {
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isGeneralManager, loading: gmLoading } = useGeneralManagerRole();
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<StaffRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const hasAccess = isAdmin || isGeneralManager;

  useEffect(() => {
    if (hasAccess) {
      fetchRequests();
      subscribeToChanges();
    }
  }, [hasAccess]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select(`
          *,
          profiles!staff_profiles_user_id_fkey (
            full_name,
            phone_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as any);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت درخواست‌ها',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('staff-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_profiles',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAction = (request: StaffRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setRejectionReason('');
  };

  const confirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('کاربر وارد نشده است');

      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      if (actionType === 'reject' && rejectionReason) {
        updates.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('staff_profiles')
        .update(updates)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description:
          actionType === 'approve'
            ? 'درخواست با موفقیت تأیید شد'
            : 'درخواست رد شد',
      });

      setSelectedRequest(null);
      setActionType(null);
      fetchRequests();
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast(toastError(error, 'خطا در تصمیم‌گیری'));
    } finally {
      setProcessing(false);
    }
  };

  if (adminLoading || gmLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مدیریت درخواست‌های پرسنل</h1>
        <p className="text-muted-foreground">بررسی و تأیید/رد درخواست‌های نقش سازمانی</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">در انتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">تأیید شده</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">رد شده</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>درخواست‌های اخیر</CardTitle>
          <CardDescription>لیست تمام درخواست‌های ثبت شده</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              هیچ درخواستی ثبت نشده است
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>شماره تلفن</TableHead>
                  <TableHead>نقش درخواستی</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>زمان ثبت</TableHead>
                  <TableHead className="text-left">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {(request.profiles as any)?.full_name || '-'}
                    </TableCell>
                    <TableCell>
                      {(request.profiles as any)?.phone_number || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[request.requested_role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          در انتظار
                        </Badge>
                      )}
                      {request.status === 'approved' && (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <CheckCircle className="h-3 w-3" />
                          تأیید شده
                        </Badge>
                      )}
                      {request.status === 'rejected' && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          رد شده
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                        locale: faIR,
                      })}
                    </TableCell>
                    <TableCell className="text-left">
                      {request.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAction(request, 'approve')}
                          >
                            تأیید
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'reject')}
                          >
                            رد
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setRejectionReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'تأیید درخواست' : 'رد درخواست'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'آیا از تأیید این درخواست اطمینان دارید؟'
                : 'لطفاً دلیل رد درخواست را وارد کنید.'}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="reason">دلیل رد</Label>
              <Textarea
                id="reason"
                placeholder="دلیل رد درخواست را وارد کنید..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setRejectionReason('');
              }}
              disabled={processing}
            >
              انصراف
            </Button>
            <Button
              onClick={confirmAction}
              disabled={processing || (actionType === 'reject' && !rejectionReason.trim())}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  در حال پردازش...
                </>
              ) : actionType === 'approve' ? (
                'تأیید'
              ) : (
                'رد درخواست'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
