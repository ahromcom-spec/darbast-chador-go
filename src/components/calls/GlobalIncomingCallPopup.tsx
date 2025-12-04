import React from 'react';
import { useIncomingCall } from '@/contexts/IncomingCallContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, X, Minimize2, Maximize2 } from 'lucide-react';
import { useState } from 'react';

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

  const [isMinimized, setIsMinimized] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if idle
  if (callState === 'idle') return null;

  // Minimized view - small floating bubble
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-[9999] animate-in slide-in-from-bottom duration-300">
        <Card 
          className="shadow-lg border border-primary/20 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setIsMinimized(false)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              callState === 'incoming' ? 'bg-green-500/20 animate-pulse' : 'bg-green-500/20'
            }`}>
              {callState === 'incoming' ? (
                <PhoneIncoming className="h-5 w-5 text-green-500" />
              ) : (
                <Phone className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {callState === 'incoming' ? 'تماس ورودی' : 'در حال مکالمه'}
              </span>
              {callState === 'connected' && (
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDuration(callDuration)}
                </span>
              )}
            </div>
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] animate-in slide-in-from-bottom duration-300">
      <Card className="w-[320px] max-w-[90vw] shadow-2xl border-2 border-primary/20">
        <CardContent className="p-4">
          {/* Header with minimize button */}
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Incoming Call State */}
          {callState === 'incoming' && incomingCall && (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                    <PhoneIncoming className="h-7 w-7 text-green-500" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-25" />
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">تماس ورودی</p>
                <p className="text-base font-semibold text-primary">
                  {incomingCall.callerName}
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={acceptCall}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full"
                  size="sm"
                >
                  <Phone className="h-4 w-4 ml-1" />
                  پاسخ
                </Button>
                <Button
                  onClick={rejectCall}
                  variant="destructive"
                  className="px-4 py-2 rounded-full"
                  size="sm"
                >
                  <PhoneOff className="h-4 w-4 ml-1" />
                  رد
                </Button>
              </div>
            </div>
          )}

          {/* Connected State */}
          {callState === 'connected' && incomingCall && (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-green-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-600 font-medium">در حال مکالمه</span>
                </div>
                <p className="text-base font-semibold text-primary">
                  {incomingCall.callerName}
                </p>
                <p className="text-lg font-mono text-muted-foreground">
                  {formatDuration(callDuration)}
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "secondary"}
                  className="rounded-full w-10 h-10"
                  size="icon"
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={endCall}
                  variant="destructive"
                  className="rounded-full px-4"
                  size="sm"
                >
                  <PhoneOff className="h-4 w-4 ml-1" />
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
