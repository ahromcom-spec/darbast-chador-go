import React from 'react';
import { useIncomingCall } from '@/contexts/IncomingCallContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, X } from 'lucide-react';

const GlobalIncomingCallPopup: React.FC = () => {
  const {
    incomingCall,
    acceptCall,
    rejectCall,
    endCall,
    callState,
    callDuration,
    isMuted,
    toggleMute
  } = useIncomingCall();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if idle
  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-[350px] max-w-[90vw] shadow-2xl border-2 border-primary/20 animate-in fade-in zoom-in duration-300">
        <CardContent className="p-6">
          {/* Incoming Call State */}
          {callState === 'incoming' && incomingCall && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                    <PhoneIncoming className="h-10 w-10 text-green-500" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-ping opacity-25" />
                </div>
              </div>
              
              <div>
                <p className="text-lg font-bold text-foreground">تماس ورودی</p>
                <p className="text-xl font-semibold text-primary mt-1">
                  {incomingCall.callerName}
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <Button
                  onClick={acceptCall}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full"
                  size="lg"
                >
                  <Phone className="h-5 w-5 ml-2" />
                  پاسخ
                </Button>
                <Button
                  onClick={rejectCall}
                  variant="destructive"
                  className="px-6 py-3 rounded-full"
                  size="lg"
                >
                  <PhoneOff className="h-5 w-5 ml-2" />
                  رد
                </Button>
              </div>
            </div>
          )}

          {/* Connected State */}
          {callState === 'connected' && incomingCall && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-600 font-medium">در حال مکالمه</span>
                </div>
                <p className="text-xl font-semibold text-primary mt-1">
                  {incomingCall.callerName}
                </p>
                <p className="text-2xl font-mono text-muted-foreground mt-2">
                  {formatDuration(callDuration)}
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "secondary"}
                  className="rounded-full w-14 h-14"
                  size="icon"
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                <Button
                  onClick={endCall}
                  variant="destructive"
                  className="rounded-full px-6"
                  size="lg"
                >
                  <PhoneOff className="h-5 w-5 ml-2" />
                  پایان
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalIncomingCallPopup;
