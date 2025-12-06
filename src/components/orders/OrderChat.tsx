import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, UserCheck, Mic, Square, Play, Pause, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  order_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  audio_path?: string;
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

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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
      .in('role', ['admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'])
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

  const fetchMessages = async () => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

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
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
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

  // Voice recording functions - use most compatible format
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try mp4/aac first (best iOS compatibility), then webm
      let mimeType = '';
      const formats = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'];
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      
      console.log('Recording with mimeType:', mediaRecorder.mimeType);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      // Max recording duration: 3 minutes (180 seconds)
      const MAX_RECORDING_DURATION = 180;
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= MAX_RECORDING_DURATION) {
            stopRecording();
            toast({
              title: 'حداکثر زمان ضبط',
              description: 'ضبط صدا به حداکثر ۳ دقیقه رسید',
            });
          }
          return newDuration;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast({
        title: 'خطا در دسترسی به میکروفون',
        description: 'لطفاً دسترسی میکروفون را فعال کنید',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !user) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
    
    setIsRecording(false);
    setIsUploading(true);

    // Stop recording and wait for data
    mediaRecorder.stop();
    
    // Wait a bit for all data to be collected
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
      
      console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
      
      if (audioBlob.size < 1000) {
        toast({
          title: 'پیام صوتی خیلی کوتاه است',
          variant: 'destructive'
        });
        setIsUploading(false);
        return;
      }

      // Always use webm extension for simplicity
      const fileName = `${orderId}/${user.id}/${Date.now()}.webm`;
      console.log('Uploading file:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload success:', uploadData);

      // Save message with audio path
      const { error: messageError } = await supabase
        .from('order_messages')
        .insert([{
          order_id: orderId,
          user_id: user.id,
          message: '🎤 پیام صوتی',
          is_staff: isStaff,
          audio_path: uploadData.path
        }]);

      if (messageError) {
        console.error('Message error:', messageError);
        throw messageError;
      }

      scrollToBottom();
      toast({
        title: 'پیام صوتی ارسال شد'
      });

    } catch (error: any) {
      console.error('Error uploading voice message:', error);
      toast({
        title: 'خطا در ارسال پیام صوتی',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio playback using embedded audio element
  const playAudio = async (messageId: string, audioPath: string) => {
    // Stop currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }

    if (playingAudioId === messageId) {
      setPlayingAudioId(null);
      setAudioSrc(null);
      return;
    }

    setPlayingAudioId(messageId);

    try {
      // Get signed URL (more reliable than public URL)
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .createSignedUrl(audioPath, 3600);

      if (error || !data?.signedUrl) {
        throw new Error('فایل صوتی یافت نشد');
      }

      setAudioSrc(data.signedUrl);
      
      // Wait a bit for the audio element to update its src
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.play().catch((e) => {
            console.error('Play error:', e);
            toast({
              title: 'خطا در پخش صدا',
              variant: 'destructive'
            });
            setPlayingAudioId(null);
            setAudioSrc(null);
          });
        }
      }, 100);
    } catch (error: any) {
      console.error('Play error:', error);
      toast({
        title: 'خطا در پخش صدا',
        variant: 'destructive'
      });
      setPlayingAudioId(null);
      setAudioSrc(null);
    }
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    setPlayingAudioId(null);
    setAudioSrc(null);
  };

  const handleAudioError = () => {
    toast({
      title: 'خطا در پخش صدا',
      variant: 'destructive'
    });
    setPlayingAudioId(null);
    setAudioSrc(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  if (['rejected', 'closed'].includes(orderStatus)) {
    return null;
  }

  return (
    <Card>
      {/* Hidden audio player for voice messages */}
      <audio
        ref={audioPlayerRef}
        src={audioSrc || undefined}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        style={{ display: 'none' }}
      />
      
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
                    
                    {/* Voice message */}
                    {msg.audio_path ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={msg.user_id === user?.id ? "secondary" : "outline"}
                          className="h-8 w-8 p-0"
                          onClick={() => playAudio(msg.id, msg.audio_path!)}
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-sm">🎤 پیام صوتی</span>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    )}
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
            disabled={loading || isRecording || isUploading}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={sendMessage}
              disabled={loading || !newMessage.trim() || isRecording || isUploading}
              className="flex-shrink-0"
              size="lg"
            >
              <Send className="h-4 w-4" />
            </Button>
            
            {/* Voice record button */}
            {isRecording ? (
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="flex-shrink-0"
                disabled={isUploading}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : isUploading ? (
              <Button
                variant="secondary"
                size="lg"
                className="flex-shrink-0"
                disabled
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (
              <Button
                onClick={startRecording}
                variant="secondary"
                size="lg"
                className="flex-shrink-0"
                disabled={loading}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center justify-center gap-2 text-destructive animate-pulse">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-sm">در حال ضبط... {formatDuration(recordingDuration)}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          برای ارسال پیام متنی، Enter را فشار دهید. برای ارسال پیام صوتی، روی آیکون میکروفون کلیک کنید.
        </p>
      </CardContent>
    </Card>
  );
}
