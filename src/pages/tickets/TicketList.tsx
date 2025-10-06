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
        <div className="text-center">در حال بارگذاری...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">تیکت‌های پشتیبانی</h1>
          <p className="text-muted-foreground">مشاهده و مدیریت تیکت‌های ارسالی</p>
        </div>
        <Button
          onClick={() => navigate("/tickets/new")}
          className="gap-2"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          تیکت جدید
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">هنوز تیکتی ثبت نشده</h3>
            <p className="text-muted-foreground mb-6">
              برای ارتباط با پشتیبانی، تیکت جدیدی ایجاد کنید
            </p>
            <Button onClick={() => navigate("/tickets/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              ایجاد اولین تیکت
            </Button>
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
                className="cursor-pointer hover:shadow-lg transition-all duration-200"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{ticket.subject}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {ticket.message}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="gap-1">
                        {departmentLabels[ticket.department] || ticket.department}
                      </Badge>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${statusInfo.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
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