import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface IncomingCall {
  signalId: string;
  orderId: string;
  callerId: string;
  callerName: string;
  offer: RTCSessionDescriptionInit;
}

interface IncomingCallContextType {
  incomingCall: IncomingCall | null;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  callState: 'idle' | 'incoming' | 'connected';
  callDuration: number;
  isMuted: boolean;
  toggleMute: () => void;
}

const IncomingCallContext = createContext<IncomingCallContextType | null>(null);

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
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => {
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        setTimeout(() => osc.stop(), 100);
      }, duration);
    });
  } catch (e) {
    console.error('[IncomingCall] Error playing tone:', e);
  }
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

export const IncomingCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callState, setCallState] = useState<'idle' | 'incoming' | 'connected'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStateRef = useRef<'idle' | 'incoming' | 'connected'>('idle');
  const incomingCallRef = useRef<IncomingCall | null>(null);

  // Keep refs in sync
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const endCall = useCallback(async () => {
    console.log('[IncomingCall] Ending call');
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

    // Send end signal if we have incoming call
    if (user && incomingCall) {
      await supabase.from('voice_call_signals' as any).insert({
        order_id: incomingCall.orderId,
        caller_id: user.id,
        receiver_id: incomingCall.callerId,
        signal_type: 'call-end',
        signal_data: {}
      });
    }

    setCallState('idle');
    setCallDuration(0);
    setIncomingCall(null);
  }, [user, incomingCall]);

  const acceptCall = useCallback(async () => {
    if (!user || !incomingCall) return;

    console.log('[IncomingCall] Accepting call from:', incomingCall.callerId);
    stopRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      pc.onicecandidate = async (event) => {
        if (event.candidate && user) {
          await supabase.from('voice_call_signals' as any).insert({
            order_id: incomingCall.orderId,
            caller_id: user.id,
            receiver_id: incomingCall.callerId,
            signal_type: 'ice-candidate',
            signal_data: { candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[IncomingCall] Received remote track');
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[IncomingCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallState('connected');
          startCallTimer();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          endCall();
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('voice_call_signals' as any).insert({
        order_id: incomingCall.orderId,
        caller_id: user.id,
        receiver_id: incomingCall.callerId,
        signal_type: 'call-accept',
        signal_data: { answer }
      });

      console.log('[IncomingCall] Answer sent');
      setCallState('connected');
      startCallTimer();

    } catch (error: any) {
      console.error('[IncomingCall] Error accepting call:', error);
      endCall();
    }
  }, [user, incomingCall, endCall]);

  const rejectCall = useCallback(async () => {
    if (!user || !incomingCall) return;

    stopRingtone();

    await supabase.from('voice_call_signals' as any).insert({
      order_id: incomingCall.orderId,
      caller_id: user.id,
      receiver_id: incomingCall.callerId,
      signal_type: 'call-reject',
      signal_data: {}
    });

    setCallState('idle');
    setIncomingCall(null);
  }, [user, incomingCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  // Global listener for incoming calls - STABLE subscription
  useEffect(() => {
    if (!user) return;

    console.log('[IncomingCall] Setting up global listener for user:', user.id);

    const channel = supabase
      .channel(`global-voice-${user.id}`)
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

          console.log('[IncomingCall] Received signal:', signal.signal_type, 'Current state:', callStateRef.current);

          switch (signal.signal_type) {
            case 'call-request':
              // Use ref to check current state
              if (callStateRef.current === 'idle') {
                // Get caller name
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', signal.caller_id)
                  .single();

                setIncomingCall({
                  signalId: signal.id,
                  orderId: signal.order_id,
                  callerId: signal.caller_id,
                  callerName: profile?.full_name || 'کاربر',
                  offer: signal.signal_data?.offer
                });
                setCallState('incoming');
                startIncomingRingtone();
              }
              break;

            case 'ice-candidate':
              if (peerConnectionRef.current && signal.signal_data?.candidate) {
                try {
                  await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(signal.signal_data.candidate)
                  );
                } catch (e) {
                  console.error('[IncomingCall] Error adding ICE candidate:', e);
                }
              }
              break;

            case 'call-end':
              // Use ref to check current state
              if (callStateRef.current !== 'idle') {
                stopRingtone();
                endCall();
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('[IncomingCall] Subscription status:', status);
      });

    return () => {
      console.log('[IncomingCall] Cleaning up global listener');
      supabase.removeChannel(channel);
    };
  }, [user, endCall]); // Removed callState from deps - using ref instead

  return (
    <IncomingCallContext.Provider value={{
      incomingCall,
      acceptCall,
      rejectCall,
      endCall,
      callState,
      callDuration,
      isMuted,
      toggleMute
    }}>
      {children}
      {/* Hidden audio element for remote audio */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
    </IncomingCallContext.Provider>
  );
};

export const useIncomingCall = () => {
  const context = useContext(IncomingCallContext);
  if (!context) {
    throw new Error('useIncomingCall must be used within an IncomingCallProvider');
  }
  return context;
};
