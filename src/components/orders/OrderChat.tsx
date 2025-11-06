import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  order_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface OrderChatProps {
  orderId: string;
  orderStatus: string;
}

export default function OrderChat({ orderId, orderStatus }: OrderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // بررسی نقش کاربر
  useEffect(() => {
    checkUserRole();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager'])
      .maybeSingle();

    setIsStaff(!!data);
  };

  // دریافت پیام‌ها
  useEffect(() => {
    if (orderId) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [orderId]);

  // اسکرول به پایین فقط هنگام ارسال پیام جدید توسط کاربر
  // (حذف اسکرول خودکار هنگام بارگذاری اولیه صفحه)

  const fetchMessages = async () => {
    try {
      // دریافت پیام‌ها
      const { data: messagesData, error: messagesError } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // دریافت اطلاعات پروفایل برای هر پیام
      if (messagesData && messagesData.length > 0) {
        const userIds = [...new Set(messagesData.map(m => m.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        const enrichedMessages = messagesData.map(msg => ({
          ...msg,
          profiles: profilesMap.get(msg.user_id)
        }));

        setMessages(enrichedMessages);
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      console.error('خطا در دریافت پیام‌ها:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('order-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          fetchMessages(); // دریافت مجدد برای گرفتن اطلاعات پروفایل
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    // اسکرول فقط زمانی که کاربر پیام ارسال می‌کند
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_messages')
        .insert([{
          order_id: orderId,
          user_id: user.id,
          message: newMessage.trim(),
          is_staff: isStaff
        }]);

      if (error) throw error;

      setNewMessage('');
      // اسکرول به پایین فقط بعد از ارسال موفق پیام
      scrollToBottom();
      toast({
        title: 'پیام ارسال شد',
        description: 'پیام شما با موفقیت ارسال شد'
      });
    } catch (error: any) {
      toast({
        title: 'خطا در ارسال پیام',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // نمایش چت برای همه سفارشات غیر از rejected و closed
  if (['rejected', 'closed'].includes(orderStatus)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          گفتگو با مدیریت
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* لیست پیام‌ها */}
        <div className="max-h-96 overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>هنوز پیامی ارسال نشده است</p>
              <p className="text-sm mt-1">برای تعامل با مدیریت، پیام خود را ارسال کنید</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.user_id === user?.id ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.is_staff
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {msg.is_staff ? (
                    <UserCheck className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`flex-1 max-w-[70%] ${
                    msg.user_id === user?.id ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`rounded-lg p-3 ${
                      msg.user_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border'
                    }`}
                  >
                    {msg.is_staff && (
                      <div className="text-xs opacity-80 mb-1">
                        {msg.profiles?.full_name || 'مدیریت'}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 px-1">
                    {new Date(msg.created_at).toLocaleString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* فرم ارسال پیام */}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="پیام خود را بنویسید..."
            className="min-h-[80px] resize-none"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            className="flex-shrink-0"
            size="lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          برای ارسال پیام، Enter را فشار دهید. برای خط جدید، Shift+Enter استفاده کنید.
        </p>
      </CardContent>
    </Card>
  );
}
