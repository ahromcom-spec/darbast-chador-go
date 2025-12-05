import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Clock, ChevronDown, Play, Pause, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

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
  recording_path?: string | null;
  caller_name?: string;
  receiver_name?: string;
}

interface CallHistoryProps {
  orderId: string;
}

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_COUNT = 10;

const CallHistory: React.FC<CallHistoryProps> = ({ orderId }) => {
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get signed URL for recording
  const getRecordingUrl = async (recordingPath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(recordingPath, 3600); // 1 hour validity
      
      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      return data?.signedUrl || null;
    } catch (e) {
      console.error('Error getting recording URL:', e);
      return null;
    }
  };

  // Play/pause recording
  const togglePlayRecording = async (log: CallLog) => {
    if (playingId === log.id) {
      // Pause current
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (!log.recording_path) {
      toast.error('فایل ضبط‌شده یافت نشد');
      return;
    }

    try {
      const url = await getRecordingUrl(log.recording_path);
      if (!url) {
        toast.error('خطا در دریافت فایل ضبط‌شده');
        return;
      }

      setAudioUrl(url);
      setPlayingId(log.id);
      
      // Play after state update
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(e => {
            console.error('Error playing audio:', e);
            toast.error('خطا در پخش فایل صوتی');
            setPlayingId(null);
          });
        }
      }, 100);
    } catch (e) {
      console.error('Error playing recording:', e);
      toast.error('خطا در پخش فایل');
    }
  };

  // Handle audio ended
  const handleAudioEnded = () => {
    setPlayingId(null);
  };

  useEffect(() => {
    const fetchCallLogs = async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('started_at', { ascending: false });

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

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + LOAD_MORE_COUNT);
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

  const visibleLogs = callLogs.slice(0, visibleCount);
  const hasMore = callLogs.length > visibleCount;
  const remainingCount = callLogs.length - visibleCount;

  return (
    <Card className="mt-4">
      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef} 
        src={audioUrl || undefined} 
        onEnded={handleAudioEnded}
        className="hidden"
      />
      
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            تاریخچه تماس‌ها
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {callLogs.length} تماس
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={visibleLogs.length > 4 ? "h-[320px]" : ""}>
          <div className="space-y-3 pl-2">
            {visibleLogs.map((log) => {
              const isOutgoing = log.caller_id === user?.id;
              const otherPartyName = isOutgoing ? log.receiver_name : log.caller_name;
              const isPlaying = playingId === log.id;
              
              return (
                <div 
                  key={log.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    log.status === 'missed' && !isOutgoing ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' : 'bg-muted/30'
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
                  <div className="flex items-center gap-2 text-sm">
                    {/* Play Recording Button */}
                    {log.recording_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePlayRecording(log)}
                        className={`h-8 w-8 p-0 ${isPlaying ? 'text-primary animate-pulse' : 'text-muted-foreground hover:text-primary'}`}
                        title={isPlaying ? 'توقف پخش' : 'پخش ضبط تماس'}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
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
        </ScrollArea>
        
        {/* Load More Button */}
        {hasMore && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLoadMore}
              className="w-full"
            >
              <ChevronDown className="h-4 w-4 ml-2" />
              دیدن بیشتر ({remainingCount} تماس دیگر)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallHistory;
