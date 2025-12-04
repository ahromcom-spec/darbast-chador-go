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

interface CallSignal {
  id: string;
  order_id: string;
  caller_id: string;
  receiver_id: string;
  signal_type: string;
  signal_data: any;
  created_at: string;
}

type CallState = 'idle' | 'calling' | 'incoming' | 'connected';

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
  const [resolvedOtherPartyId, setResolvedOtherPartyId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const incomingCallIdRef = useRef<string | null>(null);
  const otherPartyIdRef = useRef<string | null>(null);

  // Keep otherPartyIdRef in sync
  useEffect(() => {
    otherPartyIdRef.current = resolvedOtherPartyId;
  }, [resolvedOtherPartyId]);

  // Resolve customer user_id if manager is calling
  useEffect(() => {
    const resolveOtherPartyId = async () => {
      setIsResolving(true);
      console.log('[VoiceCall] Resolving other party ID...', { isManager, customerId, managerId });
      
      if (isManager && customerId) {
        try {
          const { data: customerData, error } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', customerId)
            .single();
          
          if (error) {
            console.error('[VoiceCall] Error fetching customer:', error);
          } else if (customerData?.user_id) {
            console.log('[VoiceCall] Resolved customer user_id:', customerData.user_id);
            setResolvedOtherPartyId(customerData.user_id);
          } else {
            console.warn('[VoiceCall] No user_id found for customer:', customerId);
          }
        } catch (err) {
          console.error('[VoiceCall] Exception resolving customer:', err);
        }
      } else if (!isManager && managerId) {
        console.log('[VoiceCall] Using manager ID directly:', managerId);
        setResolvedOtherPartyId(managerId);
      } else {
        console.log('[VoiceCall] No party to resolve', { isManager, customerId, managerId });
      }
      
      setIsResolving(false);
    };

    resolveOtherPartyId();
  }, [isManager, customerId, managerId]);

  // ICE servers for NAT traversal
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  // Initialize peer connection - using ref to get latest otherPartyId
  const createPeerConnection = useCallback(() => {
    console.log('[VoiceCall] Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = async (event) => {
      const currentOtherPartyId = otherPartyIdRef.current;
      if (event.candidate && user && currentOtherPartyId) {
        console.log('[VoiceCall] Sending ICE candidate to:', currentOtherPartyId);
        const { error } = await (supabase.from('voice_call_signals') as any).insert({
          order_id: orderId,
          caller_id: user.id,
          receiver_id: currentOtherPartyId,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate }
        });
        if (error) {
          console.error('[VoiceCall] Error sending ICE candidate:', error);
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('[VoiceCall] Received remote track');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[VoiceCall] ICE connection state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceCall] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        // Clear timeout since we connected
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        setCallState('connected');
        startCallTimer();
        toast.success('تماس برقرار شد');
      } else if (pc.connectionState === 'disconnected') {
        toast.info('اتصال قطع شد، در حال تلاش مجدد...');
      } else if (pc.connectionState === 'failed') {
        toast.error('اتصال ناموفق بود');
        endCall();
      }
    };

    return pc;
  }, [orderId, user]);

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start a call
  const startCall = async () => {
    const currentOtherPartyId = otherPartyIdRef.current;
    
    if (!user) {
      toast.error('لطفاً وارد حساب کاربری شوید');
      return;
    }
    
    if (!currentOtherPartyId) {
      console.error('[VoiceCall] No other party ID available');
      toast.error('اطلاعات تماس در دسترس نیست');
      return;
    }

    console.log('[VoiceCall] Starting call to:', currentOtherPartyId);

    try {
      setCallState('calling');

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log('[VoiceCall] Got local audio stream');

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[VoiceCall] Created offer, sending signal...');

      // Send call request signal
      const { error } = await (supabase.from('voice_call_signals') as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: currentOtherPartyId,
        signal_type: 'call-request',
        signal_data: { offer: offer }
      });

      if (error) {
        console.error('[VoiceCall] Error sending call request:', error);
        toast.error('خطا در ارسال درخواست تماس');
        setCallState('idle');
        return;
      }

      console.log('[VoiceCall] Call request sent successfully');
      toast.info('در حال برقراری تماس... منتظر پاسخ طرف مقابل');

      // Set timeout for answer (60 seconds)
      callTimeoutRef.current = setTimeout(() => {
        if (callState === 'calling') {
          console.log('[VoiceCall] Call timeout - no answer received');
          toast.error('پاسخی دریافت نشد. طرف مقابل در دسترس نیست');
          endCall();
        }
      }, 60000);

    } catch (error) {
      console.error('[VoiceCall] Error starting call:', error);
      toast.error('خطا در برقراری تماس. لطفاً دسترسی میکروفون را بررسی کنید.');
      setCallState('idle');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!user || !incomingCallIdRef.current) return;

    console.log('[VoiceCall] Accepting incoming call');

    try {
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('[VoiceCall] No peer connection available');
        return;
      }

      // Add local stream
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Get the caller_id from the incoming signal
      const { data: signalData } = await (supabase
        .from('voice_call_signals') as any)
        .select('caller_id')
        .eq('id', incomingCallIdRef.current)
        .single();

      if (signalData) {
        console.log('[VoiceCall] Sending answer to:', signalData.caller_id);
        const { error } = await (supabase.from('voice_call_signals') as any).insert({
          order_id: orderId,
          caller_id: user.id,
          receiver_id: signalData.caller_id,
          signal_type: 'call-accept',
          signal_data: { answer: answer }
        });
        
        if (error) {
          console.error('[VoiceCall] Error sending answer:', error);
        }
      }

      setCallState('connected');
      startCallTimer();
      toast.success('تماس برقرار شد');
    } catch (error) {
      console.error('[VoiceCall] Error accepting call:', error);
      toast.error('خطا در پذیرش تماس');
      endCall();
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    if (!user || !incomingCallIdRef.current) return;

    console.log('[VoiceCall] Rejecting call');

    const { data: signalData } = await (supabase
      .from('voice_call_signals') as any)
      .select('caller_id')
      .eq('id', incomingCallIdRef.current)
      .single();

    if (signalData) {
      await (supabase.from('voice_call_signals') as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: signalData.caller_id,
        signal_type: 'call-reject',
        signal_data: {}
      });
    }

    endCall();
  };

  // End call
  const endCall = async () => {
    console.log('[VoiceCall] Ending call');
    
    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Send end signal
    const currentOtherPartyId = otherPartyIdRef.current;
    if (user && currentOtherPartyId && callState !== 'idle') {
      await (supabase.from('voice_call_signals') as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: currentOtherPartyId,
        signal_type: 'call-end',
        signal_data: {}
      });
    }

    // Clean up old signals after a delay to ensure receiver gets them
    setTimeout(async () => {
      if (user) {
        await (supabase
          .from('voice_call_signals') as any)
          .delete()
          .eq('order_id', orderId)
          .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);
      }
    }, 2000);

    setCallState('idle');
    setCallDuration(0);
    incomingCallIdRef.current = null;
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Listen for incoming signals
  useEffect(() => {
    if (!user) return;

    console.log('[VoiceCall] Setting up realtime subscription for user:', user.id);

    const channel = supabase
      .channel(`voice-calls-${orderId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_call_signals',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const signal = payload.new as CallSignal;
          
          if (signal.order_id !== orderId) return;

          console.log('[VoiceCall] Received signal:', signal.signal_type, 'from:', signal.caller_id);

          switch (signal.signal_type) {
            case 'call-request':
              // Incoming call
              if (callState === 'idle') {
                incomingCallIdRef.current = signal.id;
                
                // Fetch caller name
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', signal.caller_id)
                  .single();
                
                setCallerName(profile?.full_name || 'کاربر');
                
                // Create peer connection and set remote description
                const pc = createPeerConnection();
                peerConnectionRef.current = pc;
                
                if (signal.signal_data?.offer) {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.offer));
                }
                
                setCallState('incoming');
                
                // Play ringtone notification
                toast.info(`تماس ورودی از ${profile?.full_name || 'کاربر'}`, {
                  duration: 10000
                });
              }
              break;

            case 'call-accept':
              // Call was accepted
              console.log('[VoiceCall] Call accepted, setting remote description');
              if (callState === 'calling' && peerConnectionRef.current && signal.signal_data?.answer) {
                // Clear timeout
                if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
                }
                await peerConnectionRef.current.setRemoteDescription(
                  new RTCSessionDescription(signal.signal_data.answer)
                );
              }
              break;

            case 'ice-candidate':
              // ICE candidate received
              if (peerConnectionRef.current && signal.signal_data?.candidate) {
                console.log('[VoiceCall] Adding ICE candidate');
                try {
                  await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(signal.signal_data.candidate)
                  );
                } catch (err) {
                  console.error('[VoiceCall] Error adding ICE candidate:', err);
                }
              }
              break;

            case 'call-reject':
              // Call was rejected
              console.log('[VoiceCall] Call rejected');
              toast.error('تماس رد شد');
              endCall();
              break;

            case 'call-end':
              // Call ended by other party
              console.log('[VoiceCall] Call ended by other party');
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
      endCall();
    };
  }, [user, orderId, callState, createPeerConnection]);

  // Don't render if no customer info (for managers)
  if (isManager && !customerId) {
    return null;
  }

  // Show loading while resolving
  if (isResolving) {
    return (
      <Card className="mt-4">
        <CardContent className="py-4 text-center text-muted-foreground">
          در حال بارگذاری اطلاعات تماس...
        </CardContent>
      </Card>
    );
  }

  const canMakeCall = !isManager ? !!managerId : !!resolvedOtherPartyId;

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
            {canMakeCall ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {isManager 
                    ? 'برای تماس با مشتری این سفارش کلیک کنید'
                    : 'برای تماس با مدیر پروژه کلیک کنید'
                  }
                </p>
                <Button 
                  onClick={startCall}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Phone className="h-4 w-4 ml-2" />
                  شروع تماس
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  هنوز مدیری برای این سفارش تعیین نشده است
                </p>
                <Button 
                  disabled
                  className="bg-gray-400"
                >
                  <Phone className="h-4 w-4 ml-2" />
                  تماس (در انتظار تعیین مدیر)
                </Button>
              </>
            )}
          </div>
        )}

        {callState === 'calling' && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PhoneOutgoing className="h-5 w-5 text-primary animate-pulse" />
              <span className="text-muted-foreground">در حال برقراری تماس... منتظر پاسخ</span>
            </div>
            <Button 
              onClick={endCall}
              variant="destructive"
            >
              <PhoneOff className="h-4 w-4 ml-2" />
              لغو تماس
            </Button>
          </div>
        )}

        {callState === 'incoming' && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PhoneIncoming className="h-5 w-5 text-green-500 animate-bounce" />
              <span>تماس ورودی از {callerName}</span>
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={acceptCall}
                className="bg-green-600 hover:bg-green-700"
              >
                <Phone className="h-4 w-4 ml-2" />
                پاسخ
              </Button>
              <Button 
                onClick={rejectCall}
                variant="destructive"
              >
                <PhoneOff className="h-4 w-4 ml-2" />
                رد تماس
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
              <Button 
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "secondary"}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button 
                onClick={endCall}
                variant="destructive"
              >
                <PhoneOff className="h-4 w-4 ml-2" />
                پایان تماس
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          تماس اینترنتی نیازمند دسترسی به میکروفون و اتصال اینترنت پایدار است
        </p>
      </CardContent>
    </Card>
  );
};

export default VoiceCall;
