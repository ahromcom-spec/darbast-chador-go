import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeftRight, CheckCircle, XCircle, User, Hash, MapPin, Calendar } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
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

interface TransferRequest {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string;
  to_phone_number: string;
  status: string;
  created_at: string;
  from_profile?: {
    full_name: string;
    phone_number: string;
  };
  order?: {
    code: string;
    address: string;
    status: string;
    subcategory?: {
      name: string;
      service_type?: {
        name: string;
      };
    };
  };
}

export function IncomingTransferRequests() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<TransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchIncomingRequests();
    }
  }, [user]);

  const fetchIncomingRequests = async () => {
    setLoading(true);
    try {
      // Fetch transfer requests where status = 'pending_recipient' and to_user_id = current user
      const { data, error } = await supabase
        .from('order_transfer_requests')
        .select(`
          *,
          order:projects_v3!order_id(
            code,
            address,
            status,
            subcategory:subcategories(
              name,
              service_type:service_types_v3(name)
            )
          )
        `)
        .eq('to_user_id', user?.id)
        .eq('status', 'pending_recipient')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch from_user profiles
      const requestsWithProfiles: TransferRequest[] = [];
      for (const req of (data || [])) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('user_id', req.from_user_id)
          .maybeSingle();

        requestsWithProfiles.push({
          ...req,
          from_profile: profile || undefined,
        } as TransferRequest);
      }

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request: TransferRequest) => {
    setProcessingId(request.id);
    try {
      // Get the order details first
      const { data: order, error: orderFetchError } = await supabase
        .from('projects_v3')
        .select(`
          *,
          subcategory:subcategories(
            id,
            name,
            service_type_id,
            service_type:service_types_v3(id, name, code)
          ),
          province:provinces(id, name),
          district:districts(id, name)
        `)
        .eq('id', request.order_id)
        .single();

      if (orderFetchError) throw orderFetchError;

      // Get or create customer record for the recipient
      let { data: recipientCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!recipientCustomer) {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ user_id: user?.id })
          .select('id')
          .single();

        if (createError) throw createError;
        recipientCustomer = newCustomer;
      }

      const customerId = recipientCustomer?.id;

      // Get original owner's phone
      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', request.from_user_id)
        .maybeSingle();

      // Create a location for the recipient user with the order address
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          user_id: user?.id,
          address_line: order.address,
          title: order.detailed_address || 'آدرس انتقالی',
          lat: order.location_lat || 34.6401,
          lng: order.location_lng || 50.8764,
          province_id: order.province_id,
          district_id: order.district_id,
        })
        .select('id')
        .single();

      if (locationError) throw locationError;

      // Create a projects_hierarchy entry for the recipient
      const { data: newHierarchy, error: hierarchyError } = await supabase
        .from('projects_hierarchy')
        .insert({
          user_id: user?.id,
          location_id: newLocation.id,
          service_type_id: order.subcategory?.service_type_id,
          subcategory_id: order.subcategory_id,
          title: `پروژه انتقالی - ${order.code}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (hierarchyError) throw hierarchyError;

      // First update transfer request status to 'completed' 
      // This removes the recipient's ability to modify via the transfer policy
      const { error: transferError } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'completed',
          recipient_responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (transferError) throw transferError;

      // Now update the order to transfer ownership using RPC or direct update
      // Since transfer request is now completed, we need admin-level update
      // Use a database function call to bypass RLS
      const { error: orderError } = await supabase.rpc('transfer_order_ownership', {
        p_order_id: request.order_id,
        p_new_customer_id: customerId,
        p_new_hierarchy_id: newHierarchy.id,
        p_transferred_from_user_id: request.from_user_id,
        p_transferred_from_phone: fromProfile?.phone_number || request.to_phone_number,
      });

      if (orderError) throw orderError;

      toast({
        title: '✓ موفق',
        description: 'سفارش با موفقیت به شما منتقل شد و در پروژه‌های شما قرار گرفت',
      });

      fetchIncomingRequests();
    } catch (error: any) {
      console.error('Error accepting transfer:', error);
      toast({
        title: 'خطا',
        description: 'خطا در پذیرش انتقال سفارش',
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
          status: 'recipient_rejected',
          recipient_responded_at: new Date().toISOString(),
          recipient_rejection_reason: rejectionReason || null,
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
      fetchIncomingRequests();
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <ArrowLeftRight className="h-5 w-5" />
            درخواست‌های انتقال سفارش به شما
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.order?.code || 'سفارش'}</span>
                  </div>
                  <Badge variant="secondary">
                    {request.order?.subcategory?.service_type?.name}
                  </Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">فرستنده: </span>
                      <span className="font-medium">
                        {request.from_profile?.full_name || 'بدون نام'} ({request.from_profile?.phone_number})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">آدرس: </span>
                      <span>{request.order?.address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      تاریخ درخواست: {formatPersianDate(request.created_at)}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAccept(request)}
                    disabled={processingId === request.id}
                    className="flex-1 gap-2"
                  >
                    {processingId === request.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    پذیرش سفارش
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
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

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
    </>
  );
}
