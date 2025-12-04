import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface CallLog {
  id: string;
  order_id: string;
  caller_id: string;
  receiver_id: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  status: 'ringing' | 'answered' | 'missed' | 'rejected' | 'timeout';
  caller_name?: string;
  receiver_name?: string;
}

interface CallHistoryProps {
  orderId: string;
}

const CallHistory: React.FC<CallHistoryProps> = ({ orderId }) => {
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCallLogs = async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching call logs:', error);
        return;
      }

      // Fetch caller/receiver names
      const logsWithNames = await Promise.all(
        (data || []).map(async (log: any) => {
          const [callerProfile, receiverProfile] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', log.caller_id).single(),
            supabase.from('profiles').select('full_name').eq('user_id', log.receiver_id).single()
          ]);
          
          return {
            ...log,
            caller_name: callerProfile.data?.full_name || 'کاربر',
            receiver_name: receiverProfile.data?.full_name || 'کاربر'
          };
        })
      );

      setCallLogs(logsWithNames);
      setLoading(false);
    };

    fetchCallLogs();

    // Real-time subscription for new call logs
    const channel = supabase
      .channel(`call-logs-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          filter: `order_id=eq.${orderId}`
        },
        () => {
          fetchCallLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (log: CallLog) => {
    switch (log.status) {
      case 'answered':
        return <Phone className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <PhoneMissed className="h-4 w-4 text-orange-500" />;
      case 'rejected':
        return <PhoneOff className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Phone className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: CallLog['status']) => {
    switch (status) {
      case 'answered': return 'پاسخ داده شده';
      case 'missed': return 'از دست رفته';
      case 'rejected': return 'رد شده';
      case 'timeout': return 'بدون پاسخ';
      case 'ringing': return 'در حال زنگ زدن';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="py-4 text-center text-muted-foreground">
          در حال بارگذاری تاریخچه تماس‌ها...
        </CardContent>
      </Card>
    );
  }

  if (callLogs.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          تاریخچه تماس‌ها
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {callLogs.map((log) => {
            const isOutgoing = log.caller_id === user?.id;
            const otherPartyName = isOutgoing ? log.receiver_name : log.caller_name;
            
            return (
              <div 
                key={log.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  log.status === 'missed' && !isOutgoing ? 'bg-orange-50 border-orange-200' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isOutgoing ? (
                    <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                  ) : (
                    <PhoneIncoming className="h-4 w-4 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {isOutgoing ? `تماس با ${otherPartyName}` : `تماس از ${otherPartyName}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: faIR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(log)}
                    <span className="text-xs">{getStatusText(log.status)}</span>
                  </div>
                  {log.duration_seconds > 0 && (
                    <span className="text-muted-foreground">
                      {formatDuration(log.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CallHistory;
