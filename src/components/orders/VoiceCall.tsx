import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VoiceCallProps {
  orderId: string;
  managerId?: string | null;
  customerId?: string;
  isManager?: boolean;
}

type CallState = 'idle' | 'calling' | 'incoming' | 'connected';

// Audio context for ringtones
let audioContext: AudioContext | null = null;
let ringtoneInterval: NodeJS.Timeout | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const playTone = (frequencies: number[], duration: number = 500) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    frequencies.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.2;
      osc.start();
      setTimeout(() => {
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        setTimeout(() => osc.stop(), 100);
      }, duration);
    });
  } catch (e) {
    console.error('[VoiceCall] Error playing tone:', e);
  }
};

const startOutgoingRingtone = () => {
  stopRingtone();
  playTone([440], 1000);
  ringtoneInterval = setInterval(() => playTone([440], 1000), 3000);
};

const startIncomingRingtone = () => {
  stopRingtone();
  playTone([440, 480], 400);
  ringtoneInterval = setInterval(() => playTone([440, 480], 400), 1500);
};

const stopRingtone = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};

const VoiceCall: React.FC<VoiceCallProps> = ({ 
  orderId, 
  managerId, 
  customerId,
  isManager = false 
}) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callerName, setCallerName] = useState<string>('');
  const [otherPartyId, setOtherPartyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const incomingSignalRef = useRef<any>(null);
  const callStateRef = useRef<CallState>('idle');
  const otherPartyIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    otherPartyIdRef.current = otherPartyId;
  }, [otherPartyId]);

  // Resolve the other party's user ID
  useEffect(() => {
    const resolveOtherParty = async () => {
      setIsLoading(true);
      console.log('[VoiceCall] Resolving other party...', { isManager, customerId, managerId });
      
      if (isManager && customerId) {
        // Manager calling customer - get customer's user_id
        const { data, error } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customerId)
          .single();
        
        if (error) {
          console.error('[VoiceCall] Error resolving customer:', error);
          setDebugInfo('خطا در دریافت اطلاعات مشتری');
        } else if (data?.user_id) {
          console.log('[VoiceCall] Resolved customer user_id:', data.user_id);
          setOtherPartyId(data.user_id);
        }
      } else if (!isManager && managerId) {
        // Customer calling manager
        console.log('[VoiceCall] Using manager ID:', managerId);
        setOtherPartyId(managerId);
      }
      
      setIsLoading(false);
    };

    resolveOtherParty();
  }, [isManager, customerId, managerId]);

  // ICE servers configuration
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Create peer connection
  const createPeerConnection = useCallback((targetUserId: string) => {
    console.log('[VoiceCall] Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        console.log('[VoiceCall] Sending ICE candidate');
        await supabase.from('voice_call_signals' as any).insert({
          order_id: orderId,
          caller_id: user.id,
          receiver_id: targetUserId,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[VoiceCall] Received remote track');
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceCall] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        stopRingtone();
        setCallState('connected');
        startCallTimer();
        toast.success('تماس برقرار شد');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        toast.error('اتصال قطع شد');
        endCall();
      }
    };

    return pc;
  }, [orderId, user]);

  // Start call timer
  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start outgoing call
  const startCall = async () => {
    if (!user || !otherPartyId) {
      toast.error('اطلاعات تماس در دسترس نیست');
      return;
    }

    console.log('[VoiceCall] Starting call to:', otherPartyId);
    setDebugInfo('در حال شروع تماس...');

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log('[VoiceCall] Got microphone access');
      
      setCallState('calling');
      startOutgoingRingtone();

      // Create peer connection
      const pc = createPeerConnection(otherPartyId);
      peerConnectionRef.current = pc;

      // Add audio track
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[VoiceCall] Created offer');

      // Get caller's name for push notification
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Send push notification to receiver (even if site is closed)
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: otherPartyId,
            title: '📞 تماس ورودی',
            body: `${callerProfile?.full_name || 'مدیر'} در حال تماس با شماست`,
            link: `/user/orders/${orderId}`,
            type: 'incoming-call',
            callData: {
              orderId,
              callerId: user.id,
              callerName: callerProfile?.full_name || 'مدیر'
            }
          }
        });
        console.log('[VoiceCall] Push notification sent to receiver');
      } catch (pushError) {
        console.warn('[VoiceCall] Failed to send push notification:', pushError);
        // Continue with call even if push fails
      }

      // Send call request
      const { error } = await supabase.from('voice_call_signals' as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: otherPartyId,
        signal_type: 'call-request',
        signal_data: { offer }
      });

      if (error) {
        console.error('[VoiceCall] Error sending call request:', error);
        toast.error('خطا در ارسال درخواست تماس');
        setDebugInfo('خطا: ' + error.message);
        stopRingtone();
        setCallState('idle');
        return;
      }

      console.log('[VoiceCall] Call request sent');
      setDebugInfo('در انتظار پاسخ...');
      toast.info('در حال زنگ زدن...');

    } catch (error: any) {
      console.error('[VoiceCall] Error starting call:', error);
      toast.error('خطا در دسترسی به میکروفون');
      setDebugInfo('خطا: ' + error.message);
      stopRingtone();
      setCallState('idle');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!user || !incomingSignalRef.current) return;
    
    const signal = incomingSignalRef.current;
    console.log('[VoiceCall] Accepting call from:', signal.caller_id);
    stopRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(signal.caller_id);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Set remote description from offer
      if (signal.signal_data?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.offer));
      }

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('voice_call_signals' as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: signal.caller_id,
        signal_type: 'call-accept',
        signal_data: { answer }
      });

      console.log('[VoiceCall] Answer sent');
      setCallState('connected');
      startCallTimer();
      toast.success('تماس برقرار شد');

    } catch (error: any) {
      console.error('[VoiceCall] Error accepting call:', error);
      toast.error('خطا در پذیرش تماس');
      endCall();
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    if (!user || !incomingSignalRef.current) return;
    
    const signal = incomingSignalRef.current;
    stopRingtone();

    await supabase.from('voice_call_signals' as any).insert({
      order_id: orderId,
      caller_id: user.id,
      receiver_id: signal.caller_id,
      signal_type: 'call-reject',
      signal_data: {}
    });

    endCall();
  };

  // End call
  const endCall = useCallback(async () => {
    console.log('[VoiceCall] Ending call');
    stopRingtone();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Send end signal if we have other party
    const currentOtherParty = otherPartyIdRef.current;
    const currentCallState = callStateRef.current;
    
    if (user && currentOtherParty && currentCallState !== 'idle') {
      await supabase.from('voice_call_signals' as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: currentOtherParty,
        signal_type: 'call-end',
        signal_data: {}
      });
    }

    // Cleanup old signals after delay
    if (user) {
      setTimeout(async () => {
        await supabase
          .from('voice_call_signals' as any)
          .delete()
          .eq('order_id', orderId)
          .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);
      }, 5000);
    }

    setCallState('idle');
    setCallDuration(0);
    incomingSignalRef.current = null;
    setDebugInfo('');
  }, [user, orderId]);

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  };

  // Listen for signals via realtime - STABLE subscription that doesn't re-create
  useEffect(() => {
    if (!user) return;

    console.log('[VoiceCall] Setting up realtime listener for user:', user.id);

    const channel = supabase
      .channel(`voice-${orderId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_call_signals',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.order_id !== orderId) return;

          console.log('[VoiceCall] Received signal:', signal.signal_type, 'Current state:', callStateRef.current);

          switch (signal.signal_type) {
            case 'call-request':
              // Use ref to check current state
              if (callStateRef.current === 'idle') {
                incomingSignalRef.current = signal;
                
                // Get caller name
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', signal.caller_id)
                  .single();
                
                setCallerName(profile?.full_name || 'کاربر');
                setCallState('incoming');
                startIncomingRingtone();
                toast.info(`تماس ورودی از ${profile?.full_name || 'کاربر'}`);
              }
              break;

            case 'call-accept':
              // Use ref to check current state
              if (callStateRef.current === 'calling' && peerConnectionRef.current && signal.signal_data?.answer) {
                console.log('[VoiceCall] Processing call-accept');
                stopRingtone();
                try {
                  await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(signal.signal_data.answer)
                  );
                  console.log('[VoiceCall] Remote description set successfully');
                } catch (e) {
                  console.error('[VoiceCall] Error setting remote description:', e);
                }
              }
              break;

            case 'ice-candidate':
              if (peerConnectionRef.current && signal.signal_data?.candidate) {
                try {
                  await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(signal.signal_data.candidate)
                  );
                } catch (e) {
                  console.error('[VoiceCall] Error adding ICE candidate:', e);
                }
              }
              break;

            case 'call-reject':
              toast.error('تماس رد شد');
              endCall();
              break;

            case 'call-end':
              toast.info('تماس پایان یافت');
              endCall();
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('[VoiceCall] Subscription status:', status);
      });

    return () => {
      console.log('[VoiceCall] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user, orderId, endCall]); // Removed callState from deps - using ref instead

  // Don't render if manager has no customer
  if (isManager && !customerId) return null;

  // Loading state
  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="py-4 text-center text-muted-foreground">
          در حال بارگذاری...
        </CardContent>
      </Card>
    );
  }

  const canCall = isManager ? !!otherPartyId : !!managerId;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          تماس صوتی اینترنتی
        </CardTitle>
      </CardHeader>
      <CardContent>
        <audio ref={remoteAudioRef} autoPlay />
        
        {callState === 'idle' && (
          <div className="text-center">
            {canCall ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {isManager ? 'تماس با مشتری' : 'تماس با مدیر پروژه'}
                </p>
                <Button onClick={startCall} className="bg-green-600 hover:bg-green-700">
                  <Phone className="h-4 w-4 ml-2" />
                  شروع تماس
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                هنوز مدیری تعیین نشده است
              </p>
            )}
            {debugInfo && (
              <p className="text-xs text-muted-foreground mt-2">{debugInfo}</p>
            )}
          </div>
        )}

        {callState === 'calling' && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PhoneOutgoing className="h-5 w-5 text-primary animate-pulse" />
              <span>در حال زنگ زدن...</span>
            </div>
            <Button onClick={endCall} variant="destructive">
              <PhoneOff className="h-4 w-4 ml-2" />
              لغو
            </Button>
            {debugInfo && (
              <p className="text-xs text-muted-foreground mt-2">{debugInfo}</p>
            )}
          </div>
        )}

        {callState === 'incoming' && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PhoneIncoming className="h-5 w-5 text-green-500 animate-bounce" />
              <span>تماس از {callerName}</span>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={acceptCall} className="bg-green-600 hover:bg-green-700">
                <Phone className="h-4 w-4 ml-2" />
                پاسخ
              </Button>
              <Button onClick={rejectCall} variant="destructive">
                <PhoneOff className="h-4 w-4 ml-2" />
                رد
              </Button>
            </div>
          </div>
        )}

        {callState === 'connected' && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-600 font-medium">در حال مکالمه</span>
              <span className="text-muted-foreground">{formatDuration(callDuration)}</span>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={toggleMute} variant={isMuted ? "destructive" : "secondary"}>
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button onClick={endCall} variant="destructive">
                <PhoneOff className="h-4 w-4 ml-2" />
                پایان
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          نیازمند دسترسی میکروفون و اینترنت پایدار
        </p>
      </CardContent>
    </Card>
  );
};

export default VoiceCall;
