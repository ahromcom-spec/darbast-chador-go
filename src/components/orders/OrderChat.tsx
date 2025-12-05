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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Voice recording functions
  const getSupportedMimeType = (): string => {
    // Try formats in order of compatibility
    const types = [
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Default - let browser choose
  };

  const getFileExtension = (mimeType: string): string => {
    if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'mp4';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
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

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
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

    setIsRecording(false);
    setIsUploading(true);

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        try {
          const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          
          if (audioBlob.size < 1000) {
            toast({
              title: 'پیام صوتی خیلی کوتاه است',
              variant: 'destructive'
            });
            setIsUploading(false);
            resolve();
            return;
          }

          // Upload to storage with correct extension
          const extension = getFileExtension(actualMimeType);
          const fileName = `${orderId}/${user.id}/${Date.now()}.${extension}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice-messages')
            .upload(fileName, audioBlob, {
              contentType: actualMimeType,
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

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

          if (messageError) throw messageError;

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
          resolve();
        }
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        setIsUploading(false);
        resolve();
      }
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio playback with better mobile support
  const playAudio = async (messageId: string, audioPath: string) => {
    try {
      // Stop currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (playingAudioId === messageId) {
        setPlayingAudioId(null);
        return;
      }

      setPlayingAudioId(messageId);

      // Get public URL instead of signed URL for better compatibility
      const { data: publicData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(audioPath);

      if (!publicData?.publicUrl) {
        // Fallback to signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('voice-messages')
          .createSignedUrl(audioPath, 3600);

        if (signedError || !signedData?.signedUrl) {
          console.error('URL error:', signedError);
          throw new Error('خطا در دریافت فایل صوتی');
        }
        
        await playAudioUrl(signedData.signedUrl, messageId, audioPath);
      } else {
        await playAudioUrl(publicData.publicUrl, messageId, audioPath);
      }

    } catch (error: any) {
      console.error('Error playing audio:', error);
      toast({
        title: 'خطا در پخش صدا',
        description: error.message || 'خطا در پخش فایل صوتی',
        variant: 'destructive'
      });
      setPlayingAudioId(null);
    }
  };

  const playAudioUrl = async (url: string, messageId: string, audioPath: string) => {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio();
      audioRef.current = audio;
      
      // For better mobile compatibility
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      
      let hasStarted = false;
      
      const handlePlay = () => {
        hasStarted = true;
      };
      
      const handleEnded = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
        resolve();
      };

      const handleError = (e: Event) => {
        console.error('Audio error:', e, audio.error);
        
        // If webm format failed, show specific message
        if (audioPath.endsWith('.webm')) {
          toast({
            title: 'فرمت صدا پشتیبانی نمی‌شود',
            description: 'این پیام صوتی با فرمت قدیمی ضبط شده است',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'خطا در پخش صدا',
            description: 'لطفاً دوباره تلاش کنید',
            variant: 'destructive'
          });
        }
        setPlayingAudioId(null);
        audioRef.current = null;
        reject(new Error('Audio playback failed'));
      };

      audio.addEventListener('play', handlePlay);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Set source and try to play
      audio.src = url;
      
      // Use user gesture to play
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Audio playing successfully');
          })
          .catch((err) => {
            console.error('Play promise rejected:', err);
            // Try loading first then playing
            audio.load();
            setTimeout(() => {
              audio.play().catch((retryErr) => {
                console.error('Retry play failed:', retryErr);
                handleError(new Event('error'));
              });
            }, 100);
          });
      }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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
