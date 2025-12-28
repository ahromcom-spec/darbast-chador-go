import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  User,
  ShieldCheck,
  Calendar,
  XCircle,
} from "lucide-react";
import { formatPersianDateTime } from "@/lib/dateUtils";

interface CollectionRequest {
  id: string;
  order_id: string;
  description: string | null;
  requested_date: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

interface CollectionMessage {
  id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
}

interface CollectionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderCode: string;
  customerId: string;
  isManager?: boolean;
}

export function CollectionRequestDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  customerId,
  isManager = false,
}: CollectionRequestDialogProps) {
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<CollectionRequest | null>(null);
  const [description, setDescription] = useState("");
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [confirmedDate, setConfirmedDate] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<CollectionMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(false);
  const [completingRequest, setCompletingRequest] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [updatingDate, setUpdatingDate] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!existingRequest) return;

    const channel = supabase
      .channel(`collection-messages-${existingRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collection_request_messages',
          filter: `collection_request_id=eq.${existingRequest.id}`,
        },
        (payload) => {
          const newMsg = payload.new as CollectionMessage;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [existingRequest?.id]);

  useEffect(() => {
    if (open) {
      fetchCollectionRequest();
    }
  }, [open, orderId]);

  const fetchCollectionRequest = async () => {
    setLoading(true);
    try {
      const { data: request, error: requestError } = await supabase
        .from('collection_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) throw requestError;

      if (request) {
        setExistingRequest(request);
        setDescription(request.description || '');
        if (request.requested_date) {
          setRequestedDate(request.requested_date);
          setConfirmedDate(request.requested_date); // Pre-fill with customer's requested date
        }

        // Fetch messages
        const { data: messagesData } = await supabase
          .from('collection_request_messages')
          .select('*')
          .eq('collection_request_id', request.id)
          .order('created_at', { ascending: true });

        if (messagesData) {
          setMessages(messagesData as CollectionMessage[]);
        }
      } else {
        setExistingRequest(null);
        setDescription('');
        setRequestedDate('');
        setConfirmedDate('');
        setRejectionReason('');
        setShowRejectForm(false);
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error fetching collection request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری درخواست جمع‌آوری',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestedDate) {
      toast({
        title: 'خطا',
        description: 'لطفاً تاریخ جمع‌آوری را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // اگر مدیر است، درخواست را مستقیماً تایید کن
      if (isManager) {
        const { data: request, error } = await supabase
          .from('collection_requests')
          .insert({
            order_id: orderId,
            customer_id: customerId,
            description: description.trim() || null,
            requested_date: requestedDate,
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // بروزرسانی سفارش به مرحله در انتظار جمع‌آوری
        const { error: orderError } = await supabase
          .from('projects_v3')
          .update({
            execution_stage: 'awaiting_collection',
            execution_stage_updated_at: new Date().toISOString(),
            customer_completion_date: requestedDate,
          })
          .eq('id', orderId);

        if (orderError) {
          console.error('Error updating order stage:', orderError);
        }

        toast({
          title: '✓ موفق',
          description: 'درخواست جمع‌آوری ثبت و سفارش به مرحله در انتظار جمع‌آوری منتقل شد',
        });

        setExistingRequest(request);
      } else {
        // مشتری: درخواست به حالت pending ثبت شود
        const { data: request, error } = await supabase
          .from('collection_requests')
          .insert({
            order_id: orderId,
            customer_id: customerId,
            description: description.trim() || null,
            requested_date: requestedDate,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: '✓ موفق',
          description: 'درخواست جمع‌آوری با موفقیت ثبت شد و در انتظار تایید مدیر است',
        });

        setExistingRequest(request);
      }
    } catch (error: any) {
      console.error('Error submitting collection request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ثبت درخواست جمع‌آوری',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !existingRequest) return;

    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: newMessage, error } = await supabase
        .from('collection_request_messages')
        .insert({
          collection_request_id: existingRequest.id,
          user_id: user.id,
          message: message.trim(),
          is_staff: isManager,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, newMessage as CollectionMessage]);
      setMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ارسال پیام',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Manager approves collection request with confirmed date
  const handleApproveRequest = async () => {
    if (!existingRequest || !isManager) return;

    // اگر تاریخ تایید شده خالی است، از تاریخ درخواستی استفاده کن
    const dateToUse = confirmedDate || existingRequest.requested_date;
    
    if (!dateToUse) {
      toast({
        title: 'خطا',
        description: 'لطفاً تاریخ جمع‌آوری را تایید یا تنظیم کنید',
        variant: 'destructive',
      });
      return;
    }

    setApprovingRequest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update collection request
      const { error } = await supabase
        .from('collection_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          requested_date: dateToUse, // Update with manager's confirmed date
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      // Update order execution_stage to awaiting_collection and save collection date
      const { error: orderError } = await supabase
        .from('projects_v3')
        .update({
          execution_stage: 'awaiting_collection',
          execution_stage_updated_at: new Date().toISOString(),
          customer_completion_date: dateToUse, // Save collection date to order
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order stage:', orderError);
        throw new Error('خطا در بروزرسانی سفارش');
      }

      setExistingRequest({
        ...existingRequest,
        status: 'approved',
        approved_at: new Date().toISOString(),
        requested_date: dateToUse,
      });

      toast({
        title: '✓ موفق',
        description: 'درخواست جمع‌آوری تایید شد و سفارش به مرحله در انتظار جمع‌آوری منتقل شد',
      });
      
      // بستن دیالوگ بعد از تایید موفق
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در تایید درخواست',
        variant: 'destructive',
      });
    } finally {
      setApprovingRequest(false);
    }
  };

  // Manager rejects collection request
  const handleRejectRequest = async () => {
    if (!existingRequest || !isManager) return;

    if (!rejectionReason.trim()) {
      toast({
        title: 'خطا',
        description: 'لطفاً دلیل رد درخواست را وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setRejectingRequest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('collection_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      // Send rejection message
      await supabase
        .from('collection_request_messages')
        .insert({
          collection_request_id: existingRequest.id,
          user_id: user.id,
          message: `درخواست رد شد: ${rejectionReason}`,
          is_staff: true,
        });

      setExistingRequest({
        ...existingRequest,
        status: 'rejected',
      });

      setShowRejectForm(false);
      setRejectionReason('');

      toast({
        title: '✓ موفق',
        description: 'درخواست جمع‌آوری رد شد',
      });
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در رد درخواست',
        variant: 'destructive',
      });
    } finally {
      setRejectingRequest(false);
    }
  };

  // Manager marks collection as completed
  const handleCompleteCollection = async () => {
    if (!existingRequest || !isManager) return;

    setCompletingRequest(true);
    try {
      const { error } = await supabase
        .from('collection_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      setExistingRequest({
        ...existingRequest,
        status: 'completed',
      });

      toast({
        title: '✓ موفق',
        description: 'جمع‌آوری به عنوان تکمیل‌شده ثبت شد',
      });
    } catch (error: any) {
      console.error('Error completing collection:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ثبت تکمیل جمع‌آوری',
        variant: 'destructive',
      });
    } finally {
      setCompletingRequest(false);
    }
  };

  // Manager updates the collection date
  const handleUpdateDate = async () => {
    if (!existingRequest || !isManager) return;

    if (!confirmedDate) {
      toast({
        title: 'خطا',
        description: 'لطفاً تاریخ جمع‌آوری را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingDate(true);
    try {
      const { error } = await supabase
        .from('collection_requests')
        .update({
          requested_date: confirmedDate,
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      // Also update the collection date in the order
      const { error: orderError } = await supabase
        .from('projects_v3')
        .update({
          customer_completion_date: confirmedDate,
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order collection date:', orderError);
      }

      setExistingRequest({
        ...existingRequest,
        requested_date: confirmedDate,
      });

      toast({
        title: '✓ موفق',
        description: 'تاریخ جمع‌آوری به‌روزرسانی شد',
      });
    } catch (error: any) {
      console.error('Error updating date:', error);
      toast({
        title: 'خطا',
        description: 'خطا در به‌روزرسانی تاریخ',
        variant: 'destructive',
      });
    } finally {
      setUpdatingDate(false);
    }
  };

  // Customer cancels their pending request
  const handleCancelRequest = async () => {
    if (!existingRequest || isManager || existingRequest.status !== 'pending') return;

    setCancellingRequest(true);
    try {
      const { error } = await supabase
        .from('collection_requests')
        .update({
          status: 'cancelled',
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      setExistingRequest(null);
      setDescription('');
      setRequestedDate('');
      setMessages([]);

      toast({
        title: '✓ موفق',
        description: 'درخواست جمع‌آوری لغو شد',
      });
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در لغو درخواست',
        variant: 'destructive',
      });
    } finally {
      setCancellingRequest(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Package className="h-5 w-5 text-primary" />
            درخواست جمع‌آوری داربست
          </DialogTitle>
          <DialogDescription className="text-right">
            سفارش {orderCode}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : existingRequest ? (
          <div className="space-y-4">
            {/* Request Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">وضعیت:</span>
              {getStatusBadge(existingRequest.status)}
            </div>

            {/* Requested Date */}
            {existingRequest.requested_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>تاریخ درخواست جمع‌آوری:</span>
                <span className="font-medium">
                  {formatPersianDateTime(existingRequest.requested_date)}
                </span>
              </div>
            )}

            {/* Description */}
            {existingRequest.description && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm">{existingRequest.description}</p>
              </div>
            )}

            <Separator />

            {/* Manager Actions */}
            {isManager && existingRequest.status === 'pending' && (
              <div className="space-y-4">
                {/* Date Confirmation/Adjustment */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    تاریخ پیشنهادی مشتری را تایید یا تاریخ جدید تعیین کنید:
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">تاریخ جمع‌آوری تایید شده *</label>
                    <PersianDatePicker
                      value={confirmedDate}
                      onChange={setConfirmedDate}
                      placeholder="انتخاب تاریخ جمع‌آوری"
                      timeMode="ampm"
                    />
                  </div>
                </div>

                {!showRejectForm ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApproveRequest}
                      disabled={approvingRequest || !confirmedDate}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {approvingRequest ? <LoadingSpinner className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      تایید درخواست
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      رد درخواست
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="دلیل رد درخواست را وارد کنید..."
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleRejectRequest}
                        disabled={rejectingRequest || !rejectionReason.trim()}
                        className="flex-1"
                      >
                        {rejectingRequest ? <LoadingSpinner className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                        تایید رد درخواست
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason('');
                        }}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isManager && existingRequest.status === 'approved' && (
              <div className="space-y-4">
                {/* Allow managers to edit the approved date */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    در صورت نیاز می‌توانید تاریخ جمع‌آوری را ویرایش کنید:
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">تاریخ جمع‌آوری</label>
                    <PersianDatePicker
                      value={confirmedDate}
                      onChange={setConfirmedDate}
                      placeholder="انتخاب تاریخ جمع‌آوری"
                      timeMode="ampm"
                    />
                  </div>
                  <Button
                    onClick={handleUpdateDate}
                    disabled={updatingDate || !confirmedDate || confirmedDate === existingRequest.requested_date}
                    variant="outline"
                    className="w-full"
                  >
                    {updatingDate ? <LoadingSpinner className="h-4 w-4" /> : <Calendar className="h-4 w-4 mr-2" />}
                    به‌روزرسانی تاریخ
                  </Button>
                </div>
                <Button
                  onClick={handleCompleteCollection}
                  disabled={completingRequest}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {completingRequest ? <LoadingSpinner className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  جمع‌آوری تکمیل شد
                </Button>
              </div>
            )}

            {isManager && existingRequest.status === 'completed' && (
              <div className="space-y-4">
                {/* Allow managers to edit the date even after completion */}
                <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ویرایش تاریخ جمع‌آوری:
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">تاریخ جمع‌آوری</label>
                    <PersianDatePicker
                      value={confirmedDate}
                      onChange={setConfirmedDate}
                      placeholder="انتخاب تاریخ جمع‌آوری"
                      timeMode="ampm"
                    />
                  </div>
                  <Button
                    onClick={handleUpdateDate}
                    disabled={updatingDate || !confirmedDate || confirmedDate === existingRequest.requested_date}
                    variant="outline"
                    className="w-full"
                  >
                    {updatingDate ? <LoadingSpinner className="h-4 w-4" /> : <Calendar className="h-4 w-4 mr-2" />}
                    به‌روزرسانی تاریخ
                  </Button>
                </div>
              </div>
            )}

            {/* Customer Cancel Action */}
            {!isManager && existingRequest.status === 'pending' && (
              <Button
                variant="destructive"
                onClick={handleCancelRequest}
                disabled={cancellingRequest}
                className="w-full"
              >
                {cancellingRequest ? <LoadingSpinner className="h-4 w-4" /> : <XCircle className="h-4 w-4 mr-2" />}
                لغو درخواست جمع‌آوری
              </Button>
            )}

            {/* Chat Section */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">گفتگو</h4>
              
              <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    هنوز پیامی ارسال نشده است
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${msg.is_staff ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`p-2 rounded-lg max-w-[80%] ${
                        msg.is_staff 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-background border'
                      }`}>
                        <div className="flex items-center gap-1 mb-1">
                          {msg.is_staff ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          <span className="text-xs opacity-75">
                            {msg.is_staff ? 'مدیر' : 'مشتری'}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-50 mt-1">
                          {formatPersianDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="پیام خود را بنویسید..."
                  className="resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !message.trim()}
                  size="icon"
                  className="h-auto"
                >
                  {sendingMessage ? <LoadingSpinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // New Request Form
          <div className="space-y-4">
            {isManager ? (
              // Manager view - explicitly prompt for date entry
              <>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">تاریخ جمع‌آوری ثبت نشده</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    مشتری هنوز تاریخ جمع‌آوری را ثبت نکرده است. لطفاً تاریخ جمع‌آوری را تعیین کنید تا درخواست ثبت شود.
                  </p>
                </div>

                {/* Date Picker for Manager */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">تاریخ جمع‌آوری *</label>
                  <PersianDatePicker
                    value={requestedDate}
                    onChange={setRequestedDate}
                    placeholder="انتخاب تاریخ جمع‌آوری"
                    timeMode="ampm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">توضیحات (اختیاری)</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="توضیحات اضافی..."
                    rows={2}
                  />
                </div>

                <Button
                  onClick={handleSubmitRequest}
                  disabled={submitting || !requestedDate}
                  className="w-full"
                >
                  {submitting ? (
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Package className="h-4 w-4 mr-2" />
                  )}
                  ثبت درخواست جمع‌آوری توسط مدیر
                </Button>
              </>
            ) : (
              // Customer view - normal request form
              <>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    برای درخواست جمع‌آوری داربست، تاریخ مورد نظر خود را انتخاب کنید. 
                    پس از ثبت درخواست، مدیریت با شما هماهنگ خواهد کرد.
                  </p>
                </div>

                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">تاریخ جمع‌آوری *</label>
                  <PersianDatePicker
                    value={requestedDate}
                    onChange={setRequestedDate}
                    placeholder="انتخاب تاریخ جمع‌آوری"
                    timeMode="ampm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">توضیحات (اختیاری)</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="اگر توضیحات خاصی دارید اینجا بنویسید..."
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleSubmitRequest}
                  disabled={submitting || !requestedDate}
                  className="w-full"
                >
                  {submitting ? (
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Package className="h-4 w-4 mr-2" />
                  )}
                  ثبت درخواست جمع‌آوری
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
