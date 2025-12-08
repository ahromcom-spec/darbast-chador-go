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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  Wrench,
  Upload,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Send,
  Image,
  Film,
  User,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { formatPersianDateTime } from "@/lib/dateUtils";

interface RepairRequest {
  id: string;
  order_id: string;
  description: string | null;
  status: string;
  estimated_cost: number;
  final_cost: number | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

interface RepairMedia {
  id: string;
  file_path: string;
  file_type: 'image' | 'video';
  created_at: string;
}

interface RepairMessage {
  id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
}

interface RepairRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderCode: string;
  customerId: string;
  onRepairCostChange?: (cost: number) => void;
  isManager?: boolean;
}

export function RepairRequestDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  customerId,
  onRepairCostChange,
  isManager = false,
}: RepairRequestDialogProps) {
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<RepairRequest | null>(null);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<RepairMedia[]>([]);
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [repairCostInput, setRepairCostInput] = useState("");
  const [updatingCost, setUpdatingCost] = useState(false);
  const [approvingRepair, setApprovingRepair] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);
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
      .channel(`repair-messages-${existingRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'repair_request_messages',
          filter: `repair_request_id=eq.${existingRequest.id}`,
        },
        (payload) => {
          const newMsg = payload.new as RepairMessage;
          setMessages((prev) => {
            // Avoid duplicates
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
      fetchRepairRequest();
    }
  }, [open, orderId]);

  const fetchRepairRequest = async () => {
    setLoading(true);
    try {
      // Check for existing repair request
      const { data: request, error: requestError } = await supabase
        .from('repair_requests')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) throw requestError;

      if (request) {
        setExistingRequest(request);
        setDescription(request.description || '');

        // Fetch media
        const { data: mediaData } = await supabase
          .from('repair_request_media')
          .select('*')
          .eq('repair_request_id', request.id)
          .order('created_at', { ascending: false });

        if (mediaData) {
          setMedia(mediaData as RepairMedia[]);
        }

        // Fetch messages
        const { data: messagesData } = await supabase
          .from('repair_request_messages')
          .select('*')
          .eq('repair_request_id', request.id)
          .order('created_at', { ascending: true });

        if (messagesData) {
          setMessages(messagesData as RepairMessage[]);
        }
      } else {
        setExistingRequest(null);
        setDescription('');
        setMedia([]);
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error fetching repair request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری درخواست تعمیر',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!description.trim()) {
      toast({
        title: 'خطا',
        description: 'لطفاً توضیحات تعمیر را وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: request, error } = await supabase
        .from('repair_requests')
        .insert({
          order_id: orderId,
          customer_id: customerId,
          description: description.trim(),
          estimated_cost: 1500000,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'درخواست تعمیر با موفقیت ثبت شد',
      });

      setExistingRequest(request);
      onRepairCostChange?.(1500000);
    } catch (error: any) {
      console.error('Error submitting repair request:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ثبت درخواست تعمیر',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !existingRequest) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `repair-requests/${existingRequest.id}/${fileName}`;
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('order-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from('repair_request_media')
          .insert({
            repair_request_id: existingRequest.id,
            file_path: filePath,
            file_type: fileType,
            file_size: file.size,
            mime_type: file.type,
            user_id: user.id,
          });

        if (dbError) throw dbError;
      }

      toast({
        title: '✓ موفق',
        description: 'فایل‌ها با موفقیت آپلود شدند',
      });

      fetchRepairRequest();
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در آپلود فایل‌ها',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteMedia = async (mediaId: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('order-media').remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('repair_request_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      setMedia(media.filter(m => m.id !== mediaId));
      toast({
        title: '✓ موفق',
        description: 'فایل حذف شد',
      });
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف فایل',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !existingRequest) return;

    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: newMessage, error } = await supabase
        .from('repair_request_messages')
        .insert({
          repair_request_id: existingRequest.id,
          user_id: user.id,
          message: message.trim(),
          is_staff: isManager,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, newMessage as RepairMessage]);
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

  // Manager can update repair cost
  const handleUpdateRepairCost = async () => {
    if (!existingRequest || !isManager) return;
    const costValue = parseInt(repairCostInput.replace(/,/g, ''), 10);
    if (isNaN(costValue) || costValue < 0) {
      toast({
        title: 'خطا',
        description: 'لطفاً یک عدد معتبر وارد کنید',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingCost(true);
    try {
      const { error } = await supabase
        .from('repair_requests')
        .update({ final_cost: costValue })
        .eq('id', existingRequest.id);

      if (error) throw error;

      setExistingRequest({ ...existingRequest, final_cost: costValue });
      onRepairCostChange?.(costValue);
      toast({
        title: '✓ موفق',
        description: 'هزینه تعمیر با موفقیت به‌روزرسانی شد',
      });
    } catch (error: any) {
      console.error('Error updating repair cost:', error);
      toast({
        title: 'خطا',
        description: 'خطا در به‌روزرسانی هزینه',
        variant: 'destructive',
      });
    } finally {
      setUpdatingCost(false);
    }
  };

  // Manager approves repair and sets it to approved status
  const handleApproveRepair = async () => {
    if (!existingRequest || !isManager) return;

    setApprovingRepair(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const finalCost = existingRequest.final_cost || existingRequest.estimated_cost;

      const { error } = await supabase
        .from('repair_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          final_cost: finalCost,
        })
        .eq('id', existingRequest.id);

      if (error) throw error;

      setExistingRequest({
        ...existingRequest,
        status: 'approved',
        approved_at: new Date().toISOString(),
        final_cost: finalCost,
      });
      onRepairCostChange?.(finalCost);

      toast({
        title: '✓ موفق',
        description: 'درخواست تعمیر تایید شد و هزینه به حساب مشتری اضافه شد',
      });
    } catch (error: any) {
      console.error('Error approving repair:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تایید درخواست تعمیر',
        variant: 'destructive',
      });
    } finally {
      setApprovingRepair(false);
    }
  };

  // Manager marks repair as completed
  const handleCompleteRepair = async () => {
    if (!existingRequest || !isManager) return;

    setCompletingRepair(true);
    try {
      const { error } = await supabase
        .from('repair_requests')
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
        description: 'تعمیر به عنوان تکمیل‌شده ثبت شد. مشتری می‌تواند هزینه را پرداخت کند.',
      });
    } catch (error: any) {
      console.error('Error completing repair:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ثبت تکمیل تعمیر',
        variant: 'destructive',
      });
    } finally {
      setCompletingRepair(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> در انتظار بررسی</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-blue-600"><CheckCircle className="h-3 w-3" /> تایید شده</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> رد شده</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> انجام شده</Badge>;
      case 'paid':
        return <Badge variant="default" className="gap-1 bg-purple-600"><CreditCard className="h-3 w-3" /> پرداخت شده</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            درخواست تعمیر داربست - سفارش {orderCode}
          </DialogTitle>
          <DialogDescription className="text-right">
            هزینه تعمیر از ۱٬۵۰۰٬۰۰۰ تومان شروع می‌شود و بسته به نوع تعمیر و فاصله از محل کار و نیاز بودن به اجناس اضافی قابل تغییر است که بعد از تایید برای اصلاح هزینه تعمیر به سفارش اضافی می‌شود.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : existingRequest ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">وضعیت درخواست:</span>
              {getStatusBadge(existingRequest.status)}
            </div>

            {/* Cost Info */}
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">هزینه تعمیر:</span>
                <span className="font-bold text-lg text-primary">
                  {(existingRequest.final_cost || existingRequest.estimated_cost).toLocaleString('fa-IR')} تومان
                </span>
              </div>
              {existingRequest.final_cost && existingRequest.final_cost !== existingRequest.estimated_cost && (
                <p className="text-xs text-muted-foreground">
                  هزینه اولیه: {existingRequest.estimated_cost.toLocaleString('fa-IR')} تومان
                </p>
              )}
              
              {/* Manager can set/update cost */}
              {isManager && (
                <div className="pt-2 border-t border-primary/20">
                  <Label className="text-sm font-medium flex items-center gap-1 mb-2">
                    <Coins className="h-4 w-4" />
                    تنظیم هزینه تعمیر (تومان):
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={repairCostInput}
                      onChange={(e) => setRepairCostInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="مثال: 2500000"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUpdateRepairCost}
                      disabled={updatingCost || !repairCostInput}
                      size="sm"
                    >
                      {updatingCost ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        'اعمال'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    هزینه را از صفر تومان به بالا می‌توانید تنظیم کنید.
                  </p>
                </div>
              )}
              
              {/* Manager approve/complete repair button */}
              {isManager && existingRequest.status === 'pending' && (
                <div className="pt-3 mt-3 border-t border-primary/20">
                  <Button
                    onClick={handleApproveRepair}
                    disabled={approvingRepair}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {approvingRepair ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    تایید و ثبت هزینه تعمیر در سفارش
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    با تایید، هزینه تعمیر به حساب مشتری اضافه می‌شود و مشتری می‌تواند پرداخت کند.
                  </p>
                </div>
              )}
              
              {isManager && existingRequest.status === 'approved' && (
                <div className="pt-3 mt-3 border-t border-primary/20">
                  <Button
                    onClick={handleCompleteRepair}
                    disabled={completingRepair}
                    className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {completingRepair ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    تکمیل تعمیر
                  </Button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">توضیحات تعمیر:</label>
              <p className="text-sm p-3 bg-muted/30 rounded-lg">{existingRequest.description || 'بدون توضیحات'}</p>
            </div>

            <Separator />

            {/* Media Gallery */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">تصاویر و ویدیوها:</label>
                {/* Both customer and manager can upload media */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('repair-media-upload')?.click()}
                  disabled={uploading}
                  className="gap-1"
                >
                  {uploading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  افزودن {isManager ? '(مدیر)' : ''}
                </Button>
              </div>
              <input
                id="repair-media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleMediaUpload}
                disabled={uploading}
              />
              
              {media.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">هنوز فایلی آپلود نشده است</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {media.map((m) => {
                    const { data } = supabase.storage.from('order-media').getPublicUrl(m.file_path);
                    return (
                      <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden border group">
                        {m.file_type === 'image' ? (
                          <img src={data.publicUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Film className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        {existingRequest.status === 'pending' && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteMedia(m.id, m.file_path)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Chat Messages */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                گفتگو بین مشتری و مدیر:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto p-3 bg-muted/20 rounded-lg border">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">هنوز پیامی ارسال نشده است</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg max-w-[85%] ${
                        msg.is_staff
                          ? 'bg-primary/15 ml-auto border-r-2 border-primary'
                          : 'bg-muted mr-auto border-l-2 border-blue-500'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {msg.is_staff ? (
                          <ShieldCheck className="h-3 w-3 text-primary" />
                        ) : (
                          <User className="h-3 w-3 text-blue-500" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.is_staff ? 'مدیر' : 'مشتری'}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-1 text-left">
                        {formatPersianDateTime(msg.created_at)}
                      </p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message */}
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isManager ? 'پیام مدیر را بنویسید...' : 'پیام خود را بنویسید...'}
                  className="resize-none h-20"
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
                  className="self-end"
                >
                  {sendingMessage ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isManager ? 'شما به عنوان مدیر پیام ارسال می‌کنید' : 'پیام شما برای مدیر ارسال می‌شود'}
              </p>
            </div>

            {/* Payment Button for approved/completed repairs */}
            {existingRequest.status === 'completed' && !existingRequest.paid_at && (
              <Button className="w-full gap-2" size="lg">
                <CreditCard className="h-5 w-5" />
                پرداخت هزینه تعمیر ({(existingRequest.final_cost || existingRequest.estimated_cost).toLocaleString('fa-IR')} تومان)
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              ثبت شده در: {formatPersianDateTime(existingRequest.created_at)}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">توضیحات مشکل و نیاز به تعمیر:</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="لطفاً مشکل داربست و نوع تعمیر مورد نیاز را شرح دهید..."
                className="resize-none h-32"
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                پس از ثبت درخواست، می‌توانید تصاویر و ویدیوهای مربوط به مشکل را آپلود کنید و با پشتیبانی گفتگو کنید.
              </p>
            </div>

            <Button
              onClick={handleSubmitRequest}
              disabled={submitting || !description.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {submitting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  ثبت درخواست تعمیر
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
