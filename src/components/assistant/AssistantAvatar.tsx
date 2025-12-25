import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, User, Image, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
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
  timestamp?: string; // ISO string
  id?: string; // Database ID for deletion
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;
const STORAGE_KEY = 'ahrom_assistant_chat_history';
const LAST_USER_MESSAGE_KEY = 'ahrom_last_user_message_time';
const MAX_MESSAGES = 1000;
const EXPIRY_MONTHS = 12;
const WELCOME_MESSAGE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Welcome message content
const WELCOME_MESSAGE_CONTENT = `من دستیار اهرم هستم، یک هوش مصنوعی که برای پاسخگویی به سوالات شما درباره سایت اهرم، خدمات آن و نحوه استفاده از آن طراحی شده‌ام. شما می‌توانید هر سوالی درباره:

• **انواع خدمات اهرم** (داربست‌بندی ساختمانی، اجاره داربست، خدمات نمای ساختمان، تعمیرات داربست)
• **نحوه ثبت سفارش** (راهنمای گام به گام)
• **سوال پرسیدن درباره سفارشاتی که ثبت کرده‌اید**
• **سوالات درباره پرداختی‌ها و مانده حساب‌ها**
• **استعلام قیمت از خدمات اجرای داربست به همراه اجناس**
• **پیگیری و وضعیت سفارشات**
• **مدیریت آدرس‌ها و مکان‌ها**
• **سیستم پیام‌رسانی و چت**
• **نصب اپلیکیشن (PWA)**
• **سایر ویژگی‌های سایت**

از من بپرسید. من اینجا هستم تا به صورت حرفه‌ای و با زبان فارسی محاوره‌ای، شما را راهنمایی کنم.

**چطور می‌توانم به شما کمک کنم؟**`;

type StoredData = {
  messages: Message[];
  timestamp: number;
};

// Format timestamp to Persian-friendly format
const formatMessageTime = (timestamp?: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
};

// Load messages from localStorage (for guests)
const loadMessagesFromStorage = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data: StoredData = JSON.parse(stored);
    const expiryTime = EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000;
    
    if (Date.now() - data.timestamp > expiryTime) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    
    return data.messages.slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
};

// Save messages to localStorage (for guests)
const saveMessagesToStorage = (messages: Message[]) => {
  try {
    const data: StoredData = {
      messages: messages.slice(-MAX_MESSAGES),
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
};

// Load messages from database (for logged-in users)
const loadMessagesFromDB = async (userId: string): Promise<Message[]> => {
  try {
    // Get messages from the last year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data, error } = await supabase
      .from('assistant_chat_messages')
      .select('id, role, content, attachments, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES);
    
    if (error) {
      console.error('Error loading messages from DB:', error);
      return [];
    }
    
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      attachments: msg.attachments as MessageContent[] | undefined,
      timestamp: msg.created_at
    }));
  } catch (err) {
    console.error('Error loading messages from DB:', err);
    return [];
  }
};

// Save a message to database and return the saved message with id
const saveMessageToDB = async (userId: string, message: Message): Promise<Message | null> => {
  try {
    const { data, error } = await supabase
      .from('assistant_chat_messages')
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        attachments: message.attachments || null
      })
      .select('id, created_at')
      .single();
    
    if (error) {
      console.error('Error saving message to DB:', error);
      return null;
    }
    
    return {
      ...message,
      id: data.id,
      timestamp: data.created_at
    };
  } catch (err) {
    console.error('Error saving message to DB:', err);
    return null;
  }
};

// Delete a message from database
const deleteMessageFromDB = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('assistant_chat_messages')
      .delete()
      .eq('id', messageId);
    
    if (error) {
      console.error('Error deleting message from DB:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting message from DB:', err);
    return false;
  }
};

// Helper to get viewport dimensions (works with zoom)
const getViewportSize = () => {
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
      offsetLeft: window.visualViewport.offsetLeft,
      offsetTop: window.visualViewport.offsetTop
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0
  };
};

export function AssistantAvatar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  
  // محاسبه پوزیشن پیش‌فرض اواتار - پایین سمت چپ
  const getDefaultAvatarPosition = useCallback(() => {
    const vp = getViewportSize();
    // Avatar (64px) + label (~24px) + gap (8px) = ~96px total height + margin
    const avatarTotalHeight = 120; // 64 (avatar) + 24 (label) + 32 (safe margin)
    const isMobile = vp.width < 640;
    const bottomOffset = isMobile ? 160 : 180;
    return { 
      x: Math.max(16, 16), 
      y: Math.min(vp.height - bottomOffset, vp.height - avatarTotalHeight) 
    };
  }, []);
  
  // Drag state - separate for avatar and chat panel
  const [avatarPosition, setAvatarPosition] = useState(getDefaultAvatarPosition);
  const [chatPosition, setChatPosition] = useState({ x: 24, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  
  // Resize state
  const [chatSize, setChatSize] = useState({ width: 384, height: 512 }); // sm:w-96 = 384px, h-[32rem] = 512px
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true); // پیش‌فرض تمام صفحه
  const [previousChatState, setPreviousChatState] = useState<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  
  const auth = useAuth();
  const user = auth?.user;

  // Create a welcome message object
  const createWelcomeMessage = (): Message => ({
    role: 'assistant',
    content: WELCOME_MESSAGE_CONTENT,
    timestamp: new Date().toISOString(),
    id: 'welcome-message' // Special ID for welcome message
  });

  // Check if welcome message should be added at the end (after 2 hours of no user message)
  const shouldAddWelcomeMessage = (msgs: Message[]): boolean => {
    if (msgs.length === 0) return false;
    
    // Find the last user message
    const lastUserMsgIndex = [...msgs].reverse().findIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return false;
    
    const lastUserMsg = msgs[msgs.length - 1 - lastUserMsgIndex];
    if (!lastUserMsg.timestamp) return false;
    
    // Check if 2 hours have passed
    const lastMsgTime = new Date(lastUserMsg.timestamp).getTime();
    const timeSinceLastMsg = Date.now() - lastMsgTime;
    
    // Check if the last message is already a welcome message
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.id === 'welcome-message') return false;
    
    return timeSinceLastMsg >= WELCOME_MESSAGE_INTERVAL_MS;
  };

  // Load messages on mount - from DB for logged-in users, from localStorage for guests
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoadingMessages(true);
      let loadedMessages: Message[] = [];
      
      if (user?.id) {
        loadedMessages = await loadMessagesFromDB(user.id);
      } else {
        loadedMessages = loadMessagesFromStorage();
      }
      
      // If messages exist and 2 hours passed since last user message, add welcome message
      if (shouldAddWelcomeMessage(loadedMessages)) {
        loadedMessages = [...loadedMessages, createWelcomeMessage()];
      }
      
      setMessages(loadedMessages);
      setIsLoadingMessages(false);
    };
    loadMessages();
  }, [user?.id]);

  // Note: Avatar position persists between page navigations

  // NOTE: ScrollArea ref points to Root; we must scroll the Viewport element.
  useEffect(() => {
    if (!isOpen) return;

    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;

    const raf = requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });

    return () => cancelAnimationFrame(raf);
  }, [messages, isOpen]);

  // Scroll to bottom when chat opens (with delay to ensure render)
  // Reset chat size and scroll to bottom when chat opens
  // تشخیص موبایل
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    if (isOpen) {
      // فقط در موبایل فول‌اسکرین باز شود، در دسکتاپ پنل معمولی
      const checkMobile = window.innerWidth < 640;
      setIsFullscreen(checkMobile);

      const scrollToBottom = () => {
        const root = scrollRef.current;
        const viewport = root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
        if (!viewport) return;
        viewport.scrollTop = viewport.scrollHeight;
      };

      // Multiple attempts to ensure scroll works after render + messages load
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 0);
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 250);
    }
  }, [isOpen]);

  // Save messages to localStorage for guests only
  useEffect(() => {
    if (messages.length > 0 && !user?.id) {
      saveMessagesToStorage(messages);
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle viewport resize/zoom to keep avatar in bounds
  // Avatar can only move in the bottom-left quadrant (left half, bottom half)
  useEffect(() => {
    const clampPositionToViewport = () => {
      const vp = getViewportSize();
      // Avatar (64px) + label (~24px) + gap (8px) + extra safe margin = ~120px total height
      const avatarTotalHeight = 120; // 64 (avatar) + 24 (label) + 32 (safe margin)
      const avatarSize = 64;
      // Avatar restricted to left half of screen (0 to width/2 - avatarSize)
      const maxX = (vp.width / 2) - avatarSize - 8;
      // Avatar restricted to bottom half of screen (height/2 to height - totalHeight)
      const minY = vp.height / 2;
      const maxY = vp.height - avatarTotalHeight;
      
      setAvatarPosition(prev => ({
        x: Math.max(16, Math.min(maxX, prev.x)),
        y: Math.max(minY, Math.min(maxY, prev.y))
      }));
      
      // Also clamp chat position if open
      if (isOpen) {
        setChatPosition(prev => ({
          x: Math.max(8, Math.min(vp.width - chatSize.width - 8, prev.x)),
          y: Math.max(8, Math.min(vp.height - chatSize.height - 8, prev.y))
        }));
      }
    };

    // Listen to visualViewport changes (handles zoom)
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', clampPositionToViewport);
      viewport.addEventListener('scroll', clampPositionToViewport);
    }
    
    // Also listen to window resize
    window.addEventListener('resize', clampPositionToViewport);
    
    // Initial clamp
    clampPositionToViewport();
    
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', clampPositionToViewport);
        viewport.removeEventListener('scroll', clampPositionToViewport);
      }
      window.removeEventListener('resize', clampPositionToViewport);
    };
  }, [isOpen, chatSize]);

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

  // Avatar drag handlers
  const handleAvatarDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({
      x: clientX - avatarPosition.x,
      y: clientY - avatarPosition.y
    });
  }, [avatarPosition]);

  const handleAvatarDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    setHasMoved(true);
    const vp = getViewportSize();
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    const avatarTotalHeight = 120; // 64 (avatar) + 24 (label) + 32 (safe margin)
    const avatarSize = 64;
    // Avatar restricted to left half of screen
    const maxX = (vp.width / 2) - avatarSize - 8;
    // Avatar restricted to bottom half of screen
    const minY = vp.height / 2;
    const maxY = vp.height - avatarTotalHeight;
    
    setAvatarPosition({
      x: Math.max(16, Math.min(maxX, newX)),
      y: Math.max(minY, Math.min(maxY, newY))
    });
  }, [isDragging, dragOffset]);

  // Chat panel drag handlers
  const handleChatDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDraggingChat(true);
    setDragOffset({
      x: clientX - chatPosition.x,
      y: clientY - chatPosition.y
    });
  }, [chatPosition]);

  const handleChatDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingChat) return;
    
    const vp = getViewportSize();
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    const maxX = vp.width - chatSize.width - 8;
    const maxY = vp.height - chatSize.height - 8;
    
    setChatPosition({
      x: Math.max(8, Math.min(maxX, newX)),
      y: Math.max(8, Math.min(maxY, newY))
    });
  }, [isDraggingChat, dragOffset, chatSize]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsDraggingChat(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((clientX: number, clientY: number) => {
    setIsResizing(true);
    setResizeStart({
      x: clientX,
      y: clientY,
      width: chatSize.width,
      height: chatSize.height
    });
  }, [chatSize]);

  const handleResizeMove = useCallback((clientX: number, clientY: number) => {
    if (!isResizing) return;
    
    const vp = getViewportSize();
    const deltaX = clientX - resizeStart.x;
    const deltaY = clientY - resizeStart.y;
    
    const newWidth = Math.max(280, Math.min(vp.width - chatPosition.x - 20, resizeStart.width + deltaX));
    const newHeight = Math.max(300, Math.min(vp.height - chatPosition.y - 20, resizeStart.height + deltaY));
    
    setChatSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeStart, chatPosition]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      // Restore previous state
      if (previousChatState) {
        setChatPosition(previousChatState.position);
        setChatSize(previousChatState.size);
      }
      setIsFullscreen(false);
    } else {
      // Save current state and go fullscreen
      setPreviousChatState({
        position: { ...chatPosition },
        size: { ...chatSize }
      });
      const vp = getViewportSize();
      setChatPosition({ x: 8, y: 8 });
      setChatSize({ width: vp.width - 16, height: vp.height - 16 });
      setIsFullscreen(true);
    }
  }, [isFullscreen, previousChatState, chatPosition, chatSize]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleResizeStart(e.clientX, e.clientY);
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    handleResizeStart(touch.clientX, touch.clientY);
  };

  // Avatar mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleAvatarDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleAvatarDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleAvatarDragMove(touch.clientX, touch.clientY);
  };

  // Chat header mouse events
  const handleChatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleChatDragStart(e.clientX, e.clientY);
  };

  const handleChatTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleChatDragStart(touch.clientX, touch.clientY);
  };

  const handleChatTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleChatDragMove(touch.clientX, touch.clientY);
  };

  // Global mouse/touch move and up
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) handleAvatarDragMove(e.clientX, e.clientY);
      if (isDraggingChat) handleChatDragMove(e.clientX, e.clientY);
      if (isResizing) handleResizeMove(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isResizing && e.touches[0]) {
        handleResizeMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      handleDragEnd();
      handleResizeEnd();
    };

    const handleGlobalTouchEnd = () => {
      handleDragEnd();
      handleResizeEnd();
    };

    if (isDragging || isDraggingChat || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('touchmove', handleGlobalTouchMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, isDraggingChat, isResizing, handleAvatarDragMove, handleChatDragMove, handleResizeMove, handleDragEnd, handleResizeEnd]);

  const handleAvatarClick = () => {
    if (!hasMoved) {
      const vp = getViewportSize();
      // Open in fullscreen by default
      setChatPosition({ x: 0, y: 0 });
      setChatSize({ width: vp.width, height: vp.height });
      setIsFullscreen(true);
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
        userId: user?.id, // ارسال شناسه کاربر برای دسترسی به اطلاعات سفارشات
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
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date().toISOString()
    };
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    // Remove welcome message from messages before adding user message
    const filteredMessages = messages.filter(m => m.id !== 'welcome-message');

    // Save user message to DB for logged-in users and get the saved message with id
    if (user?.id) {
      const savedUserMsg = await saveMessageToDB(user.id, userMsg);
      setMessages([...filteredMessages, savedUserMsg || userMsg]);
    } else {
      setMessages([...filteredMessages, userMsg]);
    }

    try {
      // Use filtered messages (without welcome message) for API call
      await streamChat([...filteredMessages, userMsg], imageBase64);
      
      // After streaming is complete, save assistant message to DB
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && user?.id && !lastMsg.id) {
          saveMessageToDB(user.id, { ...lastMsg, timestamp: new Date().toISOString() }).then(savedMsg => {
            if (savedMsg) {
              setMessages(p => p.map((m, i) => i === p.length - 1 ? savedMsg : m));
            }
          });
        }
        return prev;
      });
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = { 
        role: 'assistant', 
        content: 'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        timestamp: new Date().toISOString()
      };
      
      if (user?.id) {
        const savedErrorMsg = await saveMessageToDB(user.id, errorMsg);
        setMessages(prev => [...prev, savedErrorMsg || errorMsg]);
      } else {
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (index: number) => {
    const message = messages[index];
    
    // Skip welcome messages - they cannot be deleted
    if (message.id === 'welcome-message') {
      return;
    }
    
    // If message has ID (saved in DB), delete from DB
    if (message.id && user?.id) {
      const deleted = await deleteMessageFromDB(message.id);
      if (!deleted) {
        toast.error('خطا در حذف پیام');
        return;
      }
    }
    
    // Remove from local state
    setMessages(prev => prev.filter((_, i) => i !== index));
    
    // Update localStorage for guests
    if (!user?.id) {
      const newMessages = messages.filter((_, i) => i !== index);
      saveMessagesToStorage(newMessages);
    }
    
    toast.success('پیام حذف شد');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render avatar if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <>
      {/* دکمه آواتار - قابل جابجایی */}
      <div
        style={{
          left: `${avatarPosition.x}px`,
          top: `${avatarPosition.y}px`,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
        className={cn(
          "fixed z-50 flex flex-col items-center gap-1 overflow-visible",
          isOpen && "hidden"
        )}
      >
        <div className="relative overflow-visible">
          <button
            ref={avatarRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onClick={handleAvatarClick}
            className={cn(
              "w-[74px] h-[74px] rounded-full",
              "shadow-lg hover:shadow-2xl transition-shadow duration-300",
              "overflow-hidden select-none bg-white",
              isDragging ? "cursor-grabbing scale-110" : "cursor-grab"
            )}
            aria-label="باز کردن دستیار هوشمند"
          >
            <img 
              src={assistantImage} 
              alt="دستیار اهرم" 
              className="w-full h-full object-cover object-top pointer-events-none"
              draggable={false}
            />
          </button>
          <span className="absolute bottom-1 -right-0.5 w-[18px] h-[18px] bg-green-500 rounded-full border-2 border-background animate-pulse" />
        </div>
        <span className="text-xs font-medium text-[#1e3a5f] bg-background/80 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm whitespace-nowrap -mt-1">
          دستیار اهرم
        </span>
      </div>

      {/* پنل چت */}
      {isOpen && (
        <div 
          ref={chatPanelRef}
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            width: `${chatSize.width}px`,
            height: `${chatSize.height}px`,
          }}
          className={cn(
            "fixed z-[100] bg-background border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300",
            isFullscreen ? "rounded-none" : "rounded-2xl",
            (isDraggingChat || isResizing) && "transition-none"
          )}
        >
          {/* هدر - قابل جابجایی */}
          <div 
            onMouseDown={handleChatMouseDown}
            onTouchStart={handleChatTouchStart}
            onTouchMove={handleChatTouchMove}
            className={cn(
              "bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 flex items-center justify-between select-none",
              isDraggingChat ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <div className="flex items-center gap-3 pointer-events-none">
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
            <div className="flex items-center gap-1 pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="h-8 w-8 text-white hover:bg-white/20"
                title={isFullscreen ? "خروج از تمام صفحه" : "تمام صفحه"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsFullscreen(false); }}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* پیام‌ها */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="py-4">
                {/* پیام خوش‌آمدگویی با آواتار */}
                <div className="flex gap-2 flex-row">
                  <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden">
                    <img src={assistantImage} alt="دستیار" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className="rounded-2xl text-sm leading-relaxed overflow-hidden bg-muted rounded-tl-sm">
                      <p className="px-3 py-2 whitespace-pre-line">{WELCOME_MESSAGE_CONTENT}</p>
                    </div>
                  </div>
                </div>
                {/* دکمه‌های پیشنهادی */}
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
                    key={msg.id || idx}
                    className={cn(
                      "flex gap-2 group",
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
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      <div className={cn(
                        "rounded-2xl text-sm leading-relaxed overflow-hidden",
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
                        <p className="px-3 py-2 whitespace-pre-line">{msg.content}</p>
                      </div>
                      {/* زمان و دکمه حذف - مخفی برای پیام خوش‌آمدگویی */}
                      <div className={cn(
                        "flex items-center gap-2 text-[10px] text-muted-foreground",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}>
                        {msg.timestamp && msg.id !== 'welcome-message' && (
                          <span>{formatMessageTime(msg.timestamp)}</span>
                        )}
                        {msg.id !== 'welcome-message' && (
                          <button
                            onClick={() => handleDeleteMessage(idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                            title="حذف پیام"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        )}
                      </div>
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

          {/* دستگیره تغییر اندازه - گوشه پایین راست */}
          <div
            onMouseDown={handleResizeMouseDown}
            onTouchStart={handleResizeTouchStart}
            className={cn(
              "absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-10",
              "flex items-center justify-center",
              "hover:bg-amber-100/50 rounded-br-2xl transition-colors"
            )}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 12 12" 
              className="text-muted-foreground"
            >
              <path 
                d="M11 11L1 11M11 11L11 1M11 11L3 3" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
