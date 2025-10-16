import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useStaffVerificationRequests } from '@/hooks/useStaffVerificationRequests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const ROLE_LABELS: Record<string, string> = {
  operations_manager: 'مدیر عملیات',
  scaffold_supervisor: 'سرپرست داربست',
  warehouse_manager: 'مدیر انبار',
  finance_manager: 'مدیر مالی',
  general_manager: 'مدیر کل',
  contractor: 'پیمانکار',
};

export const StaffVerifications = () => {
  usePageTitle('تأیید پرسنل');

  const {
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    loading,
    approveRequest,
    rejectRequest,
  } = useStaffVerificationRequests();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async (requestId: string) => {
    if (confirm('آیا از تأیید این درخواست مطمئن هستید؟')) {
      await approveRequest(requestId);
    }
  };

  const openRejectDialog = (request: any) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) return;

    const result = await rejectRequest(selectedRequest.id, rejectionReason);
    if (result.success) {
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
    }
  };

  const RequestCard = ({ request, showActions = false }: any) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {request.profiles?.full_name || 'نام نامشخص'}
          </CardTitle>
          {request.status === 'pending' && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              <Clock className="h-3 w-3 ml-1" />
              در انتظار
            </Badge>
          )}
          {request.status === 'approved' && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <Check className="h-3 w-3 ml-1" />
              تأیید شده
            </Badge>
          )}
          {request.status === 'rejected' && (
            <Badge variant="secondary" className="bg-red-100 text-red-700">
              <X className="h-3 w-3 ml-1" />
              رد شده
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">شماره تماس:</span>
              <p className="font-medium">{request.phone_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">نقش درخواستی:</span>
              <p className="font-medium">
                {ROLE_LABELS[request.requested_role] || request.requested_role}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">تاریخ درخواست:</span>
              <p className="font-medium">
                {new Date(request.created_at).toLocaleDateString('fa-IR')}
              </p>
            </div>
          </div>

          {request.rejection_reason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm font-medium text-red-900">دلیل رد:</span>
              <p className="text-sm text-red-700 mt-1">
                {request.rejection_reason}
              </p>
            </div>
          )}

          {showActions && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleApprove(request.id)}
                className="flex-1 gap-2"
              >
                <Check className="h-4 w-4" />
                تأیید
              </Button>
              <Button
                onClick={() => openRejectDialog(request)}
                variant="destructive"
                className="flex-1 gap-2"
              >
                <X className="h-4 w-4" />
                رد
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">تأیید پرسنل</h1>
        <p className="text-muted-foreground mt-2">
          بررسی و تأیید درخواست‌های نقش پرسنلی
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              در انتظار ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              تأیید شده ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              رد شده ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    درخواست جدیدی وجود ندارد
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <RequestCard key={request.id} request={request} showActions />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    درخواست تأیید شده‌ای وجود ندارد
                  </p>
                </CardContent>
              </Card>
            ) : (
              approvedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    درخواست رد شده‌ای وجود ندارد
                  </p>
                </CardContent>
              </Card>
            ) : (
              rejectedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رد درخواست نقش پرسنلی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">دلیل رد درخواست</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="دلیل رد درخواست را وارد کنید..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                variant="destructive"
                className="flex-1"
                disabled={!rejectionReason.trim()}
              >
                تأیید رد درخواست
              </Button>
              <Button
                onClick={() => setRejectDialogOpen(false)}
                variant="outline"
                className="flex-1"
              >
                انصراف
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
