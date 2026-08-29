import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, User, UserCheck, Mic, Square, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

  // Edit / delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Voice message playback (native player)
  const [audioUrlByMessageId, setAudioUrlByMessageId] = useState<Record<string, string>>({});
  const [audioUrlLoadingByMessageId, setAudioUrlLoadingByMessageId] = useState<Record<string, boolean>>({});

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
          event: '*',
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

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditingText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = async (msg: Message) => {
    const text = editingText.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('order_messages')
        .update({ message: text })
        .eq('id', msg.id);
      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, message: text } : m)));
      cancelEdit();
      toast({ title: 'پیام ویرایش شد' });
    } catch (error: any) {
      toast({ title: 'خطا در ویرایش پیام', description: error.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    const msg = deleteTarget;
    if (!msg) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('order_messages').delete().eq('id', msg.id);
      if (error) throw error;

      if (msg.audio_path) {
        await supabase.storage.from('voice-messages').remove([msg.audio_path]).catch(() => {});
      }

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setDeleteTarget(null);
      toast({ title: 'پیام حذف شد' });
    } catch (error: any) {
      toast({ title: 'خطا در حذف پیام', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
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
      console.log('Starting voice recording...');
      
      // First check if microphone permission is already denied
      const permissionState = await checkMicrophonePermission();
      console.log('Permission state:', permissionState);

      if (permissionState === 'denied') {
        toast({
          title: 'دسترسی میکروفون رد شده است',
          description: 'لطفاً ابتدا در تنظیمات مرورگر خود، دسترسی میکروفون را برای این سایت فعال کنید. سپس صفحه را رفرش کنید.',
          variant: 'destructive',
          duration: 8000,
        });
        return;
      }

      // Request microphone access (must be inside user gesture, before any other async work after permission check)
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('Microphone access granted');
      streamRef.current = stream;

      // Choose the best supported format. Order matters: prefer formats that finalize cleanly.
      let mimeType = '';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const mimeTypes = isIOS
        ? ['audio/mp4', 'audio/aac', '']
        : [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
            '',
          ];

      for (const type of mimeTypes) {
        if (!type || MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('Selected mimeType:', mimeType || 'default');
          break;
        }
      }

      console.log('Creating MediaRecorder with mimeType:', mimeType || 'browser default');
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      console.log('MediaRecorder created, actual mimeType:', mediaRecorder.mimeType);

      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.start(500); // Collect data every 500ms
      console.log('Recording started');
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
    console.log('Stopping recording...');
    if (!mediaRecorderRef.current || !user) {
      console.log('No mediaRecorder or user');
      return;
    }

    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const recordedMimeType = mediaRecorder.mimeType || 'audio/webm';
    console.log('Recorded mimeType:', recordedMimeType);
    
    setIsRecording(false);
    setIsUploading(true);

    // Create a promise to wait for recording to stop
    const recordingComplete = new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        // Stop all tracks AFTER onstop so the final chunk is captured
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        resolve();
      };
    });

    // Flush any pending buffered data BEFORE stopping — otherwise the last
    // segment is often lost on some browsers, producing an empty/silent file.
    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }
    } catch (e) {
      console.warn('requestData failed:', e);
    }

    // Give the browser a tick to deliver the flushed dataavailable event
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    await recordingComplete;

    // Extra delay to ensure trailing data events fire
    await new Promise(resolve => setTimeout(resolve, 300));


    try {
      console.log('Audio chunks collected:', audioChunksRef.current.length);
      
      // Create blob from chunks - use the recorded mimeType
      const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
      
      console.log('Audio blob created. Size:', audioBlob.size, 'Type:', audioBlob.type);

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
      else if (recordedMimeType.includes('aac')) extension = 'aac';

      const fileName = `${orderId}/${user.id}/${Date.now()}.${extension}`;
      
      console.log('Uploading to voice-messages bucket:', fileName);

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: recordedMimeType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload success, path:', uploadData.path);

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

      if (messageError) {
        console.error('Message insert error:', messageError);
        throw messageError;
      }

      console.log('Voice message saved successfully');
      toast({ title: 'پیام صوتی ارسال شد ✓' });
      scrollToBottom();

    } catch (error: any) {
      console.error('Upload/save error:', error);
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

  // Resolve voice message URLs (signed URL preferred)
  const fetchVoiceMessageUrl = useCallback(async (audioPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .createSignedUrl(audioPath, 86400); // 24h expiry

    if (!error && data?.signedUrl) return data.signedUrl;

    const { data: publicData } = supabase.storage
      .from('voice-messages')
      .getPublicUrl(audioPath);

    return publicData?.publicUrl || null;
  }, []);

  const resolveAudioUrlForMessage = useCallback(
    async (messageId: string, audioPath: string, opts?: { silent?: boolean }) => {
      if (!audioPath) return null;

      setAudioUrlLoadingByMessageId((prev) => ({ ...prev, [messageId]: true }));

      try {
        const url = await fetchVoiceMessageUrl(audioPath);
        if (!url) throw new Error('آدرس فایل صوتی یافت نشد');

        setAudioUrlByMessageId((prev) => ({ ...prev, [messageId]: url }));
        return url;
      } catch (error: any) {
        console.error('Error resolving voice message url:', error);

        if (!opts?.silent) {
          toast({
            title: 'خطا در آماده‌سازی صدا',
            description: error?.message || 'فایل صوتی قابل دسترسی نیست.',
            variant: 'destructive',
          });
        }

        return null;
      } finally {
        setAudioUrlLoadingByMessageId((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      }
    },
    [fetchVoiceMessageUrl, toast]
  );

  // Preload signed URLs so the user can use the phone's native audio controls reliably
  useEffect(() => {
    const voiceMessages = messages.filter((m) => !!m.audio_path);
    if (voiceMessages.length === 0) return;

    for (const m of voiceMessages) {
      if (!m.audio_path) continue;
      if (audioUrlByMessageId[m.id]) continue;
      if (audioUrlLoadingByMessageId[m.id]) continue;
      resolveAudioUrlForMessage(m.id, m.audio_path, { silent: true });
    }
  }, [messages, audioUrlByMessageId, audioUrlLoadingByMessageId, resolveAudioUrlForMessage]);

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
                    <div className="text-xs opacity-80 mb-1">
                      {msg.is_staff
                        ? (msg.profiles?.full_name || 'مدیریت')
                        : (msg.profiles?.full_name || 'مشتری')
                      }
                    </div>
                    
                    {/* Voice message */}
                    {msg.audio_path ? (
                      <div className="w-full">
                        {audioUrlByMessageId[msg.id] ? (
                          <div className="flex flex-col gap-2">
                            <audio
                              controls
                              preload="metadata"
                              playsInline
                              src={audioUrlByMessageId[msg.id]}
                              className="w-full max-w-[260px]"
                            />

                            <div className="flex items-center gap-3 text-xs">
                              <a
                                href={audioUrlByMessageId[msg.id]}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                              >
                                باز کردن در پلیر گوشی
                              </a>
                              <a
                                href={audioUrlByMessageId[msg.id]}
                                download
                                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                              >
                                دانلود
                              </a>
                            </div>
                          </div>
                        ) : audioUrlLoadingByMessageId[msg.id] ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">درحال آمادهسازی پیام صوتی...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={msg.user_id === user?.id ? "secondary" : "outline"}
                              onClick={() => resolveAudioUrlForMessage(msg.id, msg.audio_path!, { silent: false })}
                            >
                              آمادهسازی پخش
                            </Button>
                            <span className="text-sm">🎤 پیام صوتی</span>
                          </div>
                        )}
                      </div>
                    ) : editingId === msg.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-[70px] resize-none text-sm text-foreground bg-background"
                          disabled={savingEdit}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => saveEdit(msg)} disabled={savingEdit || !editingText.trim()}>
                            {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            <span className="ms-1">ذخیره</span>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                            <X className="h-3.5 w-3.5" />
                            <span className="ms-1">انصراف</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 px-1">
                    <span>
                      {new Date(msg.created_at).toLocaleString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric'
                      })}
                    </span>

                    {msg.user_id === user?.id && !msg.audio_path && editingId !== msg.id && (
                      <button
                        type="button"
                        onClick={() => startEdit(msg)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label="ویرایش پیام"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        ویرایش
                      </button>
                    )}

                    {(msg.user_id === user?.id || isStaff) && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(msg)}
                        className="inline-flex items-center gap-1 hover:text-destructive"
                        aria-label="حذف پیام"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    )}
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
