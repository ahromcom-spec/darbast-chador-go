import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ticket {
  id: string;
  department: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  service_request_id: string | null;
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

const TicketList = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری تیکت‌ها",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">در حال بارگذاری تیکت‌ها...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">تیکت‌های من</h1>
          <p className="text-muted-foreground">
            مشاهده و پیگیری تیکت‌های ارسالی به بخش‌های مختلف
          </p>
        </div>
        <Button
          onClick={() => navigate("/tickets/new")}
          className="gap-2 shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          تیکت جدید
        </Button>
      </div>

      {tickets.length > 0 && (
        <div className="mb-6 flex items-center gap-4 p-4 bg-card rounded-lg border">
          <MessageSquare className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            شما <span className="font-semibold text-foreground">{tickets.length}</span> تیکت دارید
          </p>
        </div>
      )}

      {tickets.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="relative">
                <MessageSquare className="h-20 w-20 mx-auto text-muted-foreground/40" />
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-primary/10 rounded-full animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">هنوز تیکتی ثبت نشده</h3>
                <p className="text-muted-foreground leading-relaxed">
                  برای ارتباط با بخش‌های مختلف شرکت اهرم، تیکت جدیدی ایجاد کنید.
                  تیم ما در کوتاه‌ترین زمان ممکن به شما پاسخ خواهند داد.
                </p>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => navigate("/tickets/new")} 
                  className="gap-2 shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  ایجاد اولین تیکت
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => {
            const StatusIcon = statusLabels[ticket.status]?.icon || MessageSquare;
            const statusInfo = statusLabels[ticket.status] || statusLabels.open;

            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 group"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 bg-background">
                          {departmentLabels[ticket.department] || ticket.department}
                        </Badge>
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusInfo.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </div>
                      </div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {ticket.subject}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 leading-relaxed">
                        {ticket.message}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(ticket.created_at).toLocaleDateString("fa-IR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                    <span className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      مشاهده جزئیات ←
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TicketList;