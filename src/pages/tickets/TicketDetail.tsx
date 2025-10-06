import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { 
  ArrowRight, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  FileImage, 
  FileVideo, 
  Download,
  Calendar,
  Building2,
  Send,
  User
} from "lucide-react";

interface Ticket {
  id: string;
  department: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  service_request_id: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

const departmentLabels: Record<string, string> = {
  order: "ثبت سفارش",
  execution: "اجرایی",
  support: "پشتیبانی",
  financial: "مالی",
  management: "مدیریت"
};

const statusLabels: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "باز", icon: MessageSquare, color: "bg-blue-500" },
  in_progress: { label: "در حال بررسی", icon: Clock, color: "bg-yellow-500" },
  closed: { label: "بسته شده", icon: CheckCircle2, color: "bg-green-500" }
};

const TicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();

  useEffect(() => {
    if (id) {
      fetchTicketDetails();
      subscribeToMessages();
    }
    
    return () => {
      // Cleanup subscription
      supabase.channel('ticket-messages').unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('ticket-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${id}`
        },
        (payload) => {
          console.log('New message received:', payload);
          setMessages((current) => [...current, payload.new as TicketMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchTicketDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Fetch ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (ticketError) throw ticketError;
      setTicket(ticketData);

      // Fetch attachments
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (attachmentsError) throw attachmentsError;
      setAttachments(attachmentsData || []);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);
    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری تیکت",
        description: error.message,
        variant: "destructive"
      });
      navigate("/tickets");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !id) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("کاربر وارد نشده است");

      const { error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: id,
          user_id: user.id,
          message: newMessage.trim(),
          is_admin: false
        });

      if (error) throw error;

      setNewMessage("");
      toast({
        title: "پیام ارسال شد",
        description: "پیام شما با موفقیت ثبت شد"
      });
    } catch (error: any) {
      toast({
        title: "خطا در ارسال پیام",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("ticket-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "دانلود موفق",
        description: `فایل ${attachment.file_name} دانلود شد`
      });
    } catch (error: any) {
      toast({
        title: "خطا در دانلود فایل",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">در حال بارگذاری جزئیات تیکت...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const StatusIcon = statusLabels[ticket.status]?.icon || MessageSquare;
  const statusInfo = statusLabels[ticket.status] || statusLabels.open;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/tickets")}
        className="mb-6 gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به لیست تیکت‌ها
      </Button>

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="gap-1.5 text-sm py-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {departmentLabels[ticket.department] || ticket.department}
                  </Badge>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white ${statusInfo.color}`}>
                    <StatusIcon className="h-4 w-4" />
                    {statusInfo.label}
                  </div>
                </div>
                <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(ticket.created_at).toLocaleDateString("fa-IR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              {ticket.created_at !== ticket.updated_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    آخرین بروزرسانی: {new Date(ticket.updated_at).toLocaleDateString("fa-IR", {
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Chat Messages Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              گفتگو با پشتیبانی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Initial message */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm">
                      {profile?.full_name || "شما"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString("fa-IR", {
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {ticket.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.is_admin ? "flex-row-reverse" : ""}`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        msg.is_admin ? "bg-accent" : "bg-primary/10"
                      }`}>
                        <User className={`h-4 w-4 ${msg.is_admin ? "text-accent-foreground" : "text-primary"}`} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className={`p-4 rounded-lg ${
                        msg.is_admin 
                          ? "bg-accent text-accent-foreground" 
                          : "bg-muted"
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-sm">
                            {msg.is_admin ? "پشتیبانی اهرم" : (profile?.full_name || "شما")}
                          </span>
                          <span className="text-xs opacity-70">
                            {new Date(msg.created_at).toLocaleDateString("fa-IR", {
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                className="resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="px-8"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    ارسال
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message Card - Old version removed */}
        {/* Attachments Card */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                پیوست‌ها ({attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    {attachment.file_type.startsWith("image/") ? (
                      <FileImage className="h-8 w-8 text-primary flex-shrink-0" />
                    ) : (
                      <FileVideo className="h-8 w-8 text-primary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{attachment.file_name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatFileSize(attachment.file_size)}</span>
                        <span>•</span>
                        <span>
                          {new Date(attachment.created_at).toLocaleDateString("fa-IR")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAttachment(attachment)}
                      className="gap-2 flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      دانلود
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <StatusIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {ticket.status === "open" && "تیکت شما در صف بررسی قرار دارد"}
                  {ticket.status === "in_progress" && "تیکت شما در حال بررسی است"}
                  {ticket.status === "closed" && "این تیکت بسته شده است"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ticket.status === "open" && "به زودی یکی از کارشناسان ما به تیکت شما رسیدگی خواهد کرد. از صبر و شکیبایی شما سپاسگزاریم."}
                  {ticket.status === "in_progress" && "کارشناسان ما در حال بررسی درخواست شما هستند و به زودی پاسخ خواهند داد."}
                  {ticket.status === "closed" && "این تیکت بررسی و بسته شده است. در صورت نیاز می‌توانید تیکت جدیدی ایجاد کنید."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TicketDetail;
