import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, User, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import assistantImage from '@/assets/assistant-avatar.png';

type MessageContent = {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
};

type Message = { 
  role: 'user' | 'assistant'; 
  content: string;
  attachments?: MessageContent[];
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

export function AssistantAvatar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Drag state
  const [position, setPosition] = useState({ x: 24, y: 24 }); // bottom-left default
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  
  const auth = useAuth();
  const user = auth?.user;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isOpen) return;
      
      const target = e.target as Node;
      if (
        chatPanelRef.current && 
        !chatPanelRef.current.contains(target) &&
        avatarRef.current &&
        !avatarRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Drag handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: clientX - (window.innerWidth - position.x - 64), // 64 is avatar width
      y: clientY - (window.innerHeight - position.y - 64)
    });
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    setHasMoved(true);
    const newX = window.innerWidth - clientX + dragStart.x - 64;
    const newY = window.innerHeight - clientY + dragStart.y - 64;
    
    // Keep within bounds
    const clampedX = Math.max(0, Math.min(window.innerWidth - 80, newX));
    const clampedY = Math.max(0, Math.min(window.innerHeight - 80, newY));
    
    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, dragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  // Global mouse/touch move and up
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleGlobalMouseUp = () => {
      handleDragEnd();
    };

    const handleGlobalTouchEnd = () => {
      handleDragEnd();
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleAvatarClick = () => {
    if (!hasMoved) {
      setIsOpen(true);
    }
  };

  const getUserRole = useCallback(() => {
    if (!user) return 'guest';
    return 'customer';
  }, [user]);

  const streamChat = async (userMessages: Message[], imageBase64?: string) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        userRole: getUserRole(),
        imageBase64,
      }),
    });

    if (!resp.ok || !resp.body) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || 'خطا در برقراری ارتباط');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: 'assistant', content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('لطفاً یک فایل تصویری انتخاب کنید');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم تصویر باید کمتر از 5 مگابایت باشد');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    let imageBase64: string | undefined;
    const attachments: MessageContent[] = [];

    if (selectedImage) {
      imageBase64 = selectedImage.split(',')[1];
      attachments.push({ type: 'image', imageUrl: selectedImage });
    }

    const userMsg: Message = { 
      role: 'user', 
      content: input.trim() || 'این تصویر را ببین',
      attachments: attachments.length > 0 ? attachments : undefined
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      await streamChat(newMessages, imageBase64);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* دکمه آواتار - قابل جابجایی */}
      <button
        ref={avatarRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={handleAvatarClick}
        style={{
          left: `${position.x}px`,
          bottom: `${position.y}px`,
        }}
        className={cn(
          "fixed z-50 w-16 h-16 rounded-full",
          "shadow-lg hover:shadow-2xl transition-shadow duration-300",
          "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
          "overflow-hidden select-none",
          isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:ring-amber-500",
          isOpen && "hidden"
        )}
        aria-label="باز کردن دستیار هوشمند"
      >
        <img 
          src={assistantImage} 
          alt="دستیار اهرم" 
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
        <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
      </button>

      {/* پنل چت */}
      {isOpen && (
        <div 
          ref={chatPanelRef}
          style={{
            left: `${position.x}px`,
            bottom: `${position.y}px`,
          }}
          className="fixed z-50 w-80 sm:w-96 h-[32rem] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          {/* هدر */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={assistantImage} 
                  alt="دستیار اهرم" 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/50"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-amber-500" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-sm">دستیار اهرم</span>
                <span className="text-xs text-white/80">آنلاین - آماده خدمت‌رسانی</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* پیام‌ها */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-center py-6">
                <img 
                  src={assistantImage} 
                  alt="دستیار اهرم" 
                  className="w-20 h-20 rounded-full mx-auto mb-4 object-cover ring-4 ring-amber-200 shadow-lg"
                />
                <p className="text-sm font-medium text-foreground">سلام! من منشی اهرم هستم 👋</p>
                <p className="text-sm text-muted-foreground mt-1">چطور می‌تونم کمکتون کنم؟</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <button 
                    onClick={() => setInput('چطور سفارش ثبت کنم؟')}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    ثبت سفارش
                  </button>
                  <button 
                    onClick={() => setInput('خدمات شما چیست؟')}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    خدمات
                  </button>
                  <button 
                    onClick={() => setInput('راهنمای سایت')}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    راهنما
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full shrink-0 overflow-hidden",
                      msg.role === 'user' && "bg-primary flex items-center justify-center"
                    )}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <img src={assistantImage} alt="دستیار" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[80%] rounded-2xl text-sm leading-relaxed overflow-hidden",
                      msg.role === 'user' 
                        ? "bg-primary text-primary-foreground rounded-tr-sm" 
                        : "bg-muted rounded-tl-sm"
                    )}>
                      {msg.attachments?.map((att, i) => (
                        <div key={i}>
                          {att.type === 'image' && att.imageUrl && (
                            <img src={att.imageUrl} alt="تصویر" className="w-full max-h-40 object-cover" />
                          )}
                        </div>
                      ))}
                      <p className="px-3 py-2">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                      <img src={assistantImage} alt="دستیار" className="w-full h-full object-cover" />
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-2xl rounded-tl-sm">
                      <span className="flex gap-1">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* پیش‌نمایش تصویر انتخاب شده */}
          {selectedImage && (
            <div className="px-3 py-2 border-t border-border">
              <div className="relative inline-block">
                <img src={selectedImage} alt="تصویر انتخابی" className="h-16 rounded-lg" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* ورودی پیام */}
          <div className="p-3 border-t border-border">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-amber-600"
                disabled={isLoading}
              >
                <Image className="h-5 w-5" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="پیام خود را بنویسید..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSend} 
                disabled={(!input.trim() && !selectedImage) || isLoading}
                size="icon"
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
