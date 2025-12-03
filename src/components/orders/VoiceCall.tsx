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
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const incomingCallIdRef = useRef<string | null>(null);

  // Resolve customer user_id if manager is calling
  useEffect(() => {
    const resolveOtherPartyId = async () => {
      if (isManager && customerId) {
        // customerId might be the customer table ID, need to get user_id
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customerId)
          .single();
        
        if (customerData?.user_id) {
          setResolvedOtherPartyId(customerData.user_id);
        }
      } else if (!isManager && managerId) {
        setResolvedOtherPartyId(managerId);
      }
    };

    resolveOtherPartyId();
  }, [isManager, customerId, managerId]);

  // Determine the other party's ID
  const otherPartyId = resolvedOtherPartyId;

  // ICE servers for NAT traversal
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = async (event) => {
      if (event.candidate && user && otherPartyId) {
        await (supabase.from('voice_call_signals') as any).insert({
          order_id: orderId,
          caller_id: user.id,
          receiver_id: otherPartyId,
          signal_type: 'ice-candidate',
          signal_data: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [orderId, user, otherPartyId]);

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
    if (!user || !otherPartyId) {
      toast.error('اطلاعات تماس در دسترس نیست');
      return;
    }

    try {
      setCallState('calling');

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send call request signal
      await (supabase.from('voice_call_signals') as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: otherPartyId,
        signal_type: 'call-request',
        signal_data: { offer: offer }
      });

      toast.info('در حال برقراری تماس...');
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('خطا در برقراری تماس. لطفاً دسترسی میکروفون را بررسی کنید.');
      setCallState('idle');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!user || !incomingCallIdRef.current) return;

    try {
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = peerConnectionRef.current;
      if (!pc) return;

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
        await (supabase.from('voice_call_signals') as any).insert({
          order_id: orderId,
          caller_id: user.id,
          receiver_id: signalData.caller_id,
          signal_type: 'call-accept',
          signal_data: { answer: answer }
        });
      }

      setCallState('connected');
      startCallTimer();
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('خطا در پذیرش تماس');
      endCall();
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    if (!user || !incomingCallIdRef.current) return;

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
    if (user && otherPartyId && callState !== 'idle') {
      await (supabase.from('voice_call_signals') as any).insert({
        order_id: orderId,
        caller_id: user.id,
        receiver_id: otherPartyId,
        signal_type: 'call-end',
        signal_data: {}
      });
    }

    // Clean up old signals
    if (user) {
      await (supabase
        .from('voice_call_signals') as any)
        .delete()
        .eq('order_id', orderId)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);
    }

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

    const channel = supabase
      .channel(`voice-calls-${orderId}`)
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

          console.log('Received signal:', signal.signal_type);

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
                toast.info(`تماس ورودی از ${profile?.full_name || 'کاربر'}`);
              }
              break;

            case 'call-accept':
              // Call was accepted
              if (callState === 'calling' && peerConnectionRef.current && signal.signal_data?.answer) {
                await peerConnectionRef.current.setRemoteDescription(
                  new RTCSessionDescription(signal.signal_data.answer)
                );
              }
              break;

            case 'ice-candidate':
              // ICE candidate received
              if (peerConnectionRef.current && signal.signal_data?.candidate) {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(signal.signal_data.candidate)
                );
              }
              break;

            case 'call-reject':
              // Call was rejected
              toast.error('تماس رد شد');
              endCall();
              break;

            case 'call-end':
              // Call ended by other party
              toast.info('تماس پایان یافت');
              endCall();
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      endCall();
    };
  }, [user, orderId, callState, createPeerConnection]);

  // Don't render if no customer info (for managers)
  if (isManager && !customerId) {
    return null;
  }

  // برای مشتریان همیشه نمایش بده، حتی اگر مدیر تعیین نشده
  const canMakeCall = !isManager ? !!managerId : !!customerId;

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
              <span className="text-muted-foreground">در حال برقراری تماس...</span>
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
