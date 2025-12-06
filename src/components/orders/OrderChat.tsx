import { useState, useEffect, useRef, useCallback } from 'react';
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
  const streamRef = useRef<MediaStream | null>(null);

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Check user role
  useEffect(() => {
    if (!user) return;
    
    const checkRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'])
        .maybeSingle();
      setIsStaff(!!data);
    };
    
    checkRole();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!orderId) return;
    
    fetchMessages();
    
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

        setMessages(messagesData.map(msg => ({
          ...msg,
          profiles: profilesMap.get(msg.user_id)
        })));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
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
      toast({ title: 'پیام ارسال شد' });
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

  // Check microphone permission status
  const checkMicrophonePermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }, []);

  // Start recording voice
  const startRecording = useCallback(async () => {
    try {
      // First check if microphone permission is already denied
      const permissionState = await checkMicrophonePermission();
      
      if (permissionState === 'denied') {
        toast({
          title: 'دسترسی میکروفون رد شده است',
          description: 'لطفاً ابتدا در تنظیمات مرورگر خود، دسترسی میکروفون را برای این سایت فعال کنید. سپس صفحه را رفرش کنید.',
          variant: 'destructive',
          duration: 8000
        });
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Find best supported format - prefer webm for web compatibility
      let mimeType = '';
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg'
      ];
      
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      console.log('Using mimeType:', mimeType || 'default');
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);

      // Timer for duration display (max 3 minutes)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 179) {
            stopRecording();
            toast({ title: 'حداکثر زمان ضبط: ۳ دقیقه' });
            return 180;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Microphone error:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'لطفاً دسترسی میکروفون را در تنظیمات مرورگر فعال کنید';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'دسترسی به میکروفون رد شد. برای ضبط صدا، لطفاً روی آیکون قفل در نوار آدرس کلیک کنید و دسترسی میکروفون را فعال نمایید.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'میکروفونی یافت نشد. لطفاً از اتصال میکروفون به دستگاه مطمئن شوید.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'میکروفون در دسترس نیست. ممکن است برنامه دیگری از آن استفاده می‌کند.';
      }
      
      toast({
        title: 'خطا در دسترسی به میکروفون',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000
      });
    }
  }, [toast, checkMicrophonePermission]);

  // Stop recording and upload
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !user) return;

    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const recordedMimeType = mediaRecorder.mimeType || 'audio/webm';
    
    setIsRecording(false);
    setIsUploading(true);

    // Create a promise to wait for recording to stop
    const recordingComplete = new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        resolve();
      };
    });

    mediaRecorder.stop();
    await recordingComplete;

    // Small delay to ensure all data is collected
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      // Create blob from chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
      
      console.log('Recording complete. Size:', audioBlob.size, 'Type:', audioBlob.type);

      if (audioBlob.size < 500) {
        toast({ title: 'ضبط صوتی خیلی کوتاه است', variant: 'destructive' });
        setIsUploading(false);
        return;
      }

      // Determine file extension from mime type
      let extension = 'webm';
      if (recordedMimeType.includes('mp4')) extension = 'mp4';
      else if (recordedMimeType.includes('ogg')) extension = 'ogg';
      else if (recordedMimeType.includes('mpeg') || recordedMimeType.includes('mp3')) extension = 'mp3';

      const fileName = `${orderId}/${user.id}/${Date.now()}.${extension}`;
      
      console.log('Uploading:', fileName);

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: recordedMimeType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      console.log('Upload success:', uploadData.path);

      // Create message record
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

      toast({ title: 'پیام صوتی ارسال شد ✓' });
      scrollToBottom();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'خطا در ارسال پیام صوتی',
        description: error.message || 'لطفاً دوباره تلاش کنید',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  }, [user, orderId, isStaff, toast]);

  // Play audio message - try public URL first, then download as fallback
  const playAudio = useCallback(async (messageId: string, audioPath: string) => {
    // If same audio is playing, stop it
    if (playingAudioId === messageId) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }

    setLoadingAudioId(messageId);
    setPlayingAudioId(null);

    const tryPlayWithUrl = (url: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const audio = new Audio();
        audioElementRef.current = audio;
        
        const timeout = setTimeout(() => {
          console.log('Audio load timeout');
          audio.pause();
          resolve(false);
        }, 10000);

        audio.oncanplaythrough = () => {
          clearTimeout(timeout);
          console.log('Audio ready, playing...');
          setLoadingAudioId(null);
          setPlayingAudioId(messageId);
          audio.play().catch((err) => {
            console.error('Play error:', err);
            setPlayingAudioId(null);
            resolve(false);
          });
          resolve(true);
        };
        
        audio.onended = () => {
          console.log('Audio ended');
          setPlayingAudioId(null);
          audioElementRef.current = null;
        };
        
        audio.onerror = (e) => {
          clearTimeout(timeout);
          console.error('Audio error with URL:', url, audio.error);
          resolve(false);
        };
        
        audio.src = url;
        audio.load();
      });
    };

    try {
      console.log('Attempting to play audio:', audioPath);
      
      // Method 1: Try public URL first (fastest)
      const { data: publicUrlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(audioPath);
      
      console.log('Trying public URL:', publicUrlData.publicUrl);
      const publicSuccess = await tryPlayWithUrl(publicUrlData.publicUrl);
      
      if (publicSuccess) {
        console.log('Public URL playback successful');
        return;
      }
      
      console.log('Public URL failed, trying signed URL...');
      
      // Method 2: Try signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('voice-messages')
        .createSignedUrl(audioPath, 3600);
      
      if (!signedError && signedData?.signedUrl) {
        console.log('Trying signed URL:', signedData.signedUrl);
        const signedSuccess = await tryPlayWithUrl(signedData.signedUrl);
        
        if (signedSuccess) {
          console.log('Signed URL playback successful');
          return;
        }
      }
      
      console.log('Signed URL failed, trying blob download...');
      
      // Method 3: Download as blob (last resort)
      const { data: blobData, error: downloadError } = await supabase.storage
        .from('voice-messages')
        .download(audioPath);

      if (downloadError || !blobData) {
        console.error('Download error:', downloadError);
        throw new Error('فایل صوتی دانلود نشد');
      }

      console.log('Downloaded blob:', blobData.size, 'bytes, type:', blobData.type);

      const objectUrl = URL.createObjectURL(blobData);
      const blobSuccess = await tryPlayWithUrl(objectUrl);
      
      if (!blobSuccess) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('فرمت فایل صوتی توسط مرورگر پشتیبانی نمی‌شود');
      }
      
      // Cleanup object URL when audio ends
      if (audioElementRef.current) {
        const currentAudio = audioElementRef.current;
        const originalOnended = currentAudio.onended;
        currentAudio.onended = (e) => {
          URL.revokeObjectURL(objectUrl);
          if (originalOnended) originalOnended.call(currentAudio, e);
        };
      }
      
    } catch (error: any) {
      console.error('Audio playback error:', error);
      setLoadingAudioId(null);
      setPlayingAudioId(null);
      toast({
        title: 'خطا در پخش صدا',
        description: error.message || 'فایل صوتی قابل پخش نیست. ممکن است فرمت آن توسط مرورگر شما پشتیبانی نشود.',
        variant: 'destructive'
      });
    }
  }, [playingAudioId, toast]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  // Don't show chat for closed/rejected orders
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
        {/* Messages list */}
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
                className={`flex gap-3 ${msg.user_id === user?.id ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.is_staff ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {msg.is_staff ? <UserCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={`flex-1 max-w-[70%] ${msg.user_id === user?.id ? 'text-right' : 'text-left'}`}>
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
                          disabled={loadingAudioId === msg.id}
                        >
                          {loadingAudioId === msg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : playingAudioId === msg.id ? (
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

        {/* Message input */}
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
