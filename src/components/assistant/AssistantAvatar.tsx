import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, User, Image, Trash2, Maximize2, Minimize2, ZoomIn, ZoomOut, Mic, MicOff, Volume2, VolumeX, Loader2, Copy, Check, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import assistantImage from '@/assets/assistant-avatar.png';
import { OrderDraftCard, parseOrderDraft } from './OrderDraftCard';
import { PaymentCard, parsePaymentCards } from './PaymentCard';
import { ModuleOpenCard, parseModuleOpens } from './ModuleOpenCard';
import { ChatComposer, type ChatComposerHandle } from './ChatComposer';

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

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

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

// مسیرهایی که دستیار در آن‌ها مخفی می‌شود
const HIDDEN_ROUTES = [
  '/profile',              // صفحه پروفایل
  '/executive',            // ماژول‌های مدیریت اجرایی
  '/ceo',                  // ماژول‌های مدیر عامل
  '/finance',              // ماژول‌های مالی
  '/admin',                // پنل مدیریت
  '/sales',                // ماژول فروش
  '/hr',                   // ماژول منابع انسانی
  '/contractor',           // پنل پیمانکار
  '/globe',                // نقشه کره زمین مستقل
  '/scaffolding',          // فرم‌های ثبت سفارش
  '/expert-pricing',       // قیمت‌گذاری کارشناسی
  '/invoice',              // فاکتورها
  '/map',                  // نقشه‌ها
  '/daily-report',         // ماژول گزارش روزانه
  '/personnel-accounting', // ماژول حسابکتاب پرسنل
  '/site-registration',    // ماژول ثبت‌نام سایت
  '/my-invoice',           // ماژول صورتحساب شخصی
  '/site-analytics',       // ماژول آمار بازدید
  '/bank-cards',           // ماژول کارت بانکی
  '/customer-invoice',     // صورتحساب جامع مشتری
];

export function AssistantAvatar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  
  // موقعیت آواتار - قابل جابجایی در یک‌چهارم چپ-پایین صفحه
  // Avatar draggable in bottom-left quarter only
  const isMobile = useIsMobile();
  const AVATAR_SIZE = isMobile ? 67 : 74; // اندازه آواتار (10% کوچک‌تر در موبایل)
  const AVATAR_PADDING = 16; // حداقل فاصله از لبه‌ها
  const FOOTER_HEIGHT = 60; // ارتفاع فوتر برای جلوگیری از overlap
  
  // Avatar position state - draggable within bottom-left quarter
  const [avatarPosition, setAvatarPosition] = useState({ x: 16, y: 80 }); // Initialize with proper bottom offset
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [avatarDragOffset, setAvatarDragOffset] = useState({ x: 0, y: 0 });
  
  // Chat panel state
  const [chatPosition, setChatPosition] = useState({ x: 24, y: 100 });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [chatSize, setChatSize] = useState({ width: 384, height: 512 }); // sm:w-96 = 384px, h-[32rem] = 512px
  const [isResizing, setIsResizing] = useState(false);

  // Assistant-only zoom (independent of app zoom).
  // Default: desktop 0.25 (dense view), mobile 1.0 (readable text).
  const ASSISTANT_ZOOM_KEY = 'assistant-chat-zoom';
  const ASSISTANT_ZOOM_KEY_MOBILE = 'assistant-chat-zoom-mobile';
  const [assistantZoom, setAssistantZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.25;
    const mobile = window.innerWidth < 640;
    const key = mobile ? ASSISTANT_ZOOM_KEY_MOBILE : ASSISTANT_ZOOM_KEY;
    const saved = parseFloat(localStorage.getItem(key) || '');
    if (Number.isFinite(saved) && saved > 0) return saved;
    return mobile ? 1 : 0.25;
  });

  useEffect(() => {
    try {
      const key = isMobile ? ASSISTANT_ZOOM_KEY_MOBILE : ASSISTANT_ZOOM_KEY;
      localStorage.setItem(key, String(assistantZoom));
    } catch {}
  }, [assistantZoom, isMobile]);

  const zoomIn = () => setAssistantZoom(z => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setAssistantZoom(z => Math.max(0.1, +(z - 0.05).toFixed(2)));
  const adjustZoom = (delta: number) => setAssistantZoom(z => Math.max(0.1, Math.min(2, +(z + delta).toFixed(3))));
  const pinchStateRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true); // پیش‌فرض تمام صفحه
  const [previousChatState, setPreviousChatState] = useState<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{
    dir: ResizeDirection;
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    posX: number;
    posY: number;
  } | null>(null);
  
  // Voice input (STT) state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; raf: number; silenceStart: number | null; spoke: boolean } | null>(null);
  const voiceReplyPendingRef = useRef<boolean>(false);


  // Voice output (TTS) state
  const TTS_ENABLED_KEY = 'assistant-tts-enabled';
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TTS_ENABLED_KEY) === '1';
  });
  useEffect(() => {
    try { localStorage.setItem(TTS_ENABLED_KEY, ttsEnabled ? '1' : '0'); } catch {}
  }, [ttsEnabled]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [loadingTtsIndex, setLoadingTtsIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyMessage = async (content: string, idx: number) => {
    try {
      // Strip internal markers from copied text
      const clean = content
        .replace(/<<AHROM_ORDER_DRAFT>>[\s\S]*?<<END_ORDER>>/g, '')
        .replace(/<<AHROM_PAYMENT_CARD>>[\s\S]*?<<END_PAYMENT>>/g, '')
        .replace(/<<AHROM_OPEN_MODULE>>[\s\S]*?<<END_MODULE>>/g, '')
        .replace(/<<[A-Z_]+>>/g, '')
        .trim();
      await navigator.clipboard.writeText(clean || content);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex((c) => (c === idx ? null : c)), 1500);
    } catch (e) {
      console.error('copy failed', e);
    }
  };
  const autoSpokenRef = useRef<Set<string>>(new Set());
  const primedSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const auth = useAuth();
  const user = auth?.user;

  const cleanTextForSpeech = (text: string) =>
    text
      // strip our custom markers + JSON payloads
      .replace(/<<AHROM_ORDER_DRAFT>>[\s\S]*?<<END_ORDER>>/g, '')
      .replace(/<<AHROM_PAYMENT_CARD>>[\s\S]*?<<END_PAYMENT>>/g, '')
      .replace(/<<AHROM_OPEN_MODULE>>[\s\S]*?<<END_MODULE>>/g, '')
      .replace(/<<[A-Z_]+>>[\s\S]*?<<END[_A-Z]*>>/g, '')
      .replace(/\*\*/g, '')
      .replace(/[*_`#>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      // strip emojis / pictographs so TTS reads only real words
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const createBrowserUtterance = (text = ''): SpeechSynthesisUtterance | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return null;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fa-IR';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const persianVoice = voices.find(v => v.lang?.toLowerCase().startsWith('fa')) || voices.find(v => /persian|farsi|فارسی/i.test(v.name));
    if (persianVoice) utterance.voice = persianVoice;
    return utterance;
  };

  const primeBrowserSpeech = (text = '') => {
    const utterance = createBrowserUtterance(cleanTextForSpeech(text));
    primedSpeechUtteranceRef.current = utterance;
    return utterance;
  };

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

  // Native scroll container: scrollRef points directly to the scrollable div.
  // Async message load + streamed content means scrollHeight settles late,
  // so we retry several times to keep the latest message pinned.
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const scrollChatToBottom = (smooth = false) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Track scroll position to toggle the "jump to latest" button
  useEffect(() => {
    if (!isOpen) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowJumpToBottom(distanceFromBottom > 240);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [isOpen, messages.length]);


  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => scrollChatToBottom());
    const t1 = setTimeout(() => scrollChatToBottom(), 60);
    const t2 = setTimeout(() => scrollChatToBottom(), 200);
    const t3 = setTimeout(() => scrollChatToBottom(), 500);
    const t4 = setTimeout(() => scrollChatToBottom(), 1000);
    const t5 = setTimeout(() => scrollChatToBottom(), 1800);

    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [messages, isOpen, isLoadingMessages]);

  // Watch the viewport for late-loading content (images, cards) and keep the
  // view pinned to the newest message while the chat is open.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    const observer = new MutationObserver(() => {
      // Only auto-pin if user is already near the bottom (avoid hijacking scroll-up).
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceFromBottom < 220) scrollChatToBottom();
    });
    observer.observe(viewport, { childList: true, subtree: true, characterData: true });
    // Initial pin
    const t = setTimeout(() => scrollChatToBottom(), 350);
    return () => { observer.disconnect(); clearTimeout(t); };
  }, [isOpen]);

  // Save messages to localStorage for guests only
  useEffect(() => {
    if (messages.length > 0 && !user?.id) {
      saveMessagesToStorage(messages);
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (isOpen) {
      composerRef.current?.focus();
    }
  }, [isOpen]);

  // Handle viewport resize to clamp positions (and follow keyboard in fullscreen)
  useEffect(() => {
    const clampPositions = () => {
      const vp = getViewportSize();
      
      // Clamp avatar position to bottom-left quarter
      const maxAvatarX = vp.width / 2 - AVATAR_SIZE - AVATAR_PADDING;
      setAvatarPosition(prev => ({
        x: Math.max(AVATAR_PADDING, Math.min(maxAvatarX, prev.x)),
        y: Math.max(FOOTER_HEIGHT, Math.min(vp.height / 2 - AVATAR_SIZE, prev.y))
      }));
      
      if (isOpen) {
        if (isFullscreen) {
          // Chat is portaled to <body>, so fullscreen must use real viewport
          // coordinates and ignore the app's internal CSS zoom.
          setChatPosition({ x: vp.offsetLeft, y: vp.offsetTop });
          setChatSize({ width: vp.width, height: vp.height });
        } else {
          setChatPosition(prev => ({
            x: Math.max(8, Math.min(vp.width - chatSize.width - 8, prev.x)),
            y: Math.max(8, Math.min(vp.height - chatSize.height - 8, prev.y))
          }));
        }
      }
    };

    // Listen to visualViewport changes (handles zoom + keyboard)
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', clampPositions);
      viewport.addEventListener('scroll', clampPositions);
    }
    
    // Also listen to window resize
    window.addEventListener('resize', clampPositions);
    
    // Initialize avatar position on mount
    clampPositions();
    
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', clampPositions);
        viewport.removeEventListener('scroll', clampPositions);
      }
      window.removeEventListener('resize', clampPositions);
    };
  }, [isOpen, isFullscreen, chatSize]);

  // Ctrl + Wheel zoom and pinch-to-zoom on chat panel
  useEffect(() => {
    if (!isOpen) return;
    const el = chatPanelRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      adjustZoom(delta);
    };

    const dist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStateRef.current = {
          startDist: dist(e.touches[0], e.touches[1]),
          startZoom: assistantZoom,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStateRef.current) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const ratio = d / pinchStateRef.current.startDist;
        const next = Math.max(0.1, Math.min(2, +(pinchStateRef.current.startZoom * ratio).toFixed(3)));
        setAssistantZoom(next);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStateRef.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen, assistantZoom]);

  // Chat panel drag handlers
  const handleChatDragStart = useCallback((clientX: number, clientY: number) => {
    if (isFullscreen) return;
    setIsDraggingChat(true);
    setDragOffset({
      x: clientX - chatPosition.x,
      y: clientY - chatPosition.y
    });
  }, [isFullscreen, chatPosition]);

  const handleChatDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingChat || isFullscreen) return;
    
    const vp = getViewportSize();
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    const maxX = vp.width - chatSize.width - 8;
    const maxY = vp.height - chatSize.height - 8;
    
    setChatPosition({
      x: Math.max(8, Math.min(maxX, newX)),
      y: Math.max(8, Math.min(maxY, newY))
    });
  }, [isDraggingChat, isFullscreen, dragOffset, chatSize]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingChat(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((clientX: number, clientY: number, dir: ResizeDirection, pointerId = -1) => {
    setIsFullscreen(false);
    setIsResizing(true);
    setResizeDir(dir);
    const nextStart = {
      x: clientX,
      y: clientY,
      width: chatSize.width,
      height: chatSize.height,
      posX: chatPosition.x,
      posY: chatPosition.y,
      dir,
      pointerId,
    };
    resizeStartRef.current = nextStart;
    setResizeStart(nextStart);
  }, [chatSize, chatPosition]);

  const handleResizeMove = useCallback((clientX: number, clientY: number) => {
    if (!isResizing || !resizeDir) return;

    const vp = getViewportSize();
    const start = resizeStartRef.current || { ...resizeStart, dir: resizeDir, pointerId: -1 };
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const MIN_W = 280, MIN_H = 300;
    const PAD = 8;

    let newWidth = start.width;
    let newHeight = start.height;
    let newX = start.posX;
    let newY = start.posY;

    if (resizeDir.includes('e')) {
      newWidth = Math.max(MIN_W, Math.min(vp.width - start.posX - PAD, start.width + deltaX));
    }
    if (resizeDir.includes('s')) {
      newHeight = Math.max(MIN_H, Math.min(vp.height - start.posY - PAD, start.height + deltaY));
    }
    if (resizeDir.includes('w')) {
      const proposedW = start.width - deltaX;
      newWidth = Math.max(MIN_W, Math.min(start.posX + start.width - PAD, proposedW));
      newX = start.posX + (start.width - newWidth);
    }
    if (resizeDir.includes('n')) {
      const proposedH = start.height - deltaY;
      newHeight = Math.max(MIN_H, Math.min(start.posY + start.height - PAD, proposedH));
      newY = start.posY + (start.height - newHeight);
    }

    setChatSize({ width: newWidth, height: newHeight });
    setChatPosition({ x: newX, y: newY });
  }, [isResizing, resizeDir, resizeStart]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDir(null);
    resizeStartRef.current = null;
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    const vp = getViewportSize();
    if (isFullscreen) {
      // Restore previous state or use a reasonable default centered
      if (previousChatState && previousChatState.size.width < vp.width - 16) {
        setChatPosition(previousChatState.position);
        setChatSize(previousChatState.size);
      } else {
        const w = Math.min(480, vp.width - 32);
        const h = Math.min(640, vp.height - 32);
        setChatSize({ width: w, height: h });
        setChatPosition({ x: Math.max(8, (vp.width - w) / 2), y: Math.max(8, (vp.height - h) / 2) });
      }
      setIsFullscreen(false);
    } else {
      // Save current state and go fullscreen
      setPreviousChatState({
        position: { ...chatPosition },
        size: { ...chatSize }
      });
      setChatPosition({ x: vp.offsetLeft, y: vp.offsetTop });
      setChatSize({ width: vp.width, height: vp.height });
      setIsFullscreen(true);
    }
  }, [isFullscreen, previousChatState, chatPosition, chatSize]);

  const makeResizePointerDown = (dir: ResizeDirection) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    handleResizeStart(e.clientX, e.clientY, dir, e.pointerId);
  };

  // Avatar drag handlers - constrained to bottom-left quarter
  const avatarDragStartPos = useRef({ x: 0, y: 0 });
  const didAvatarDrag = useRef(false);
  
  const handleAvatarDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDraggingAvatar(true);
    didAvatarDrag.current = false;
    avatarDragStartPos.current = { x: clientX, y: clientY };
    const vp = getViewportSize();
    // avatarPosition.y is from bottom, convert to screen coordinates
    const avatarTop = vp.height - avatarPosition.y - AVATAR_SIZE - 20; // 20 for label
    setAvatarDragOffset({
      x: clientX - avatarPosition.x,
      y: clientY - avatarTop
    });
  }, [avatarPosition]);

  const handleAvatarDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingAvatar) return;
    
    // Check if actually moved (more than 5px)
    const dx = clientX - avatarDragStartPos.current.x;
    const dy = clientY - avatarDragStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      didAvatarDrag.current = true;
    }
    
    const vp = getViewportSize();
    // Constrain to bottom-left quarter
    const maxX = vp.width / 2 - AVATAR_SIZE - AVATAR_PADDING; // Left half only
    const minY = vp.height / 2; // Bottom half only (Y from top)
    
    const newX = clientX - avatarDragOffset.x;
    const newYFromTop = clientY - avatarDragOffset.y;
    
    // Clamp X to left quarter
    const clampedX = Math.max(AVATAR_PADDING, Math.min(maxX, newX));
    // Clamp Y to bottom half (convert to bottom-based)
    const clampedYFromTop = Math.max(minY, Math.min(vp.height - FOOTER_HEIGHT - AVATAR_SIZE - 20, newYFromTop));
    const clampedYFromBottom = vp.height - clampedYFromTop - AVATAR_SIZE - 20;
    
    setAvatarPosition({
      x: clampedX,
      y: Math.max(FOOTER_HEIGHT, clampedYFromBottom)
    });
  }, [isDraggingAvatar, avatarDragOffset]);

  const handleAvatarDragEnd = useCallback(() => {
    setIsDraggingAvatar(false);
  }, []);

  // Avatar mouse/touch handlers
  const handleAvatarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleAvatarDragStart(e.clientX, e.clientY);
  };

  const handleAvatarTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleAvatarDragStart(touch.clientX, touch.clientY);
  };

  const handleAvatarTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleAvatarDragMove(touch.clientX, touch.clientY);
  };

  // Avatar click handler
  const handleAvatarClick = () => {
    if (didAvatarDrag.current) return; // Don't open if was dragging
    const vp = getViewportSize();
    const shouldOpenFullscreen = isMobile || vp.width < 640;
    if (shouldOpenFullscreen) {
      setChatPosition({ x: vp.offsetLeft, y: vp.offsetTop });
      setChatSize({ width: vp.width, height: vp.height });
      setIsFullscreen(true);
    } else {
      const width = Math.min(520, vp.width - 32);
      const height = Math.min(640, vp.height - 32);
      setChatSize({ width, height });
      setChatPosition({
        x: Math.max(16, (vp.width - width) / 2),
        y: Math.max(16, (vp.height - height) / 2),
      });
      setIsFullscreen(false);
    }
    setIsOpen(true);
  };

  // Chat header mouse events
  const handleChatMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    handleChatDragStart(e.clientX, e.clientY);
  };

  const handleChatTouchStart = (e: React.TouchEvent) => {
    if (isFullscreen) return;
    const touch = e.touches[0];
    handleChatDragStart(touch.clientX, touch.clientY);
  };

  const handleChatTouchMove = (e: React.TouchEvent) => {
    if (isFullscreen) return;
    const touch = e.touches[0];
    handleChatDragMove(touch.clientX, touch.clientY);
  };

  // Global mouse/touch move and up for chat panel and avatar
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!isResizing || !start || start.pointerId !== e.pointerId) return;
      e.preventDefault();
      handleResizeMove(e.clientX, e.clientY);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingAvatar) handleAvatarDragMove(e.clientX, e.clientY);
      if (isDraggingChat) handleChatDragMove(e.clientX, e.clientY);
      if (isResizing) handleResizeMove(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDraggingAvatar && e.touches[0]) {
        handleAvatarDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
      if (isResizing && e.touches[0]) {
        handleResizeMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      handleAvatarDragEnd();
      handleDragEnd();
      handleResizeEnd();
    };

    const handleGlobalTouchEnd = () => {
      handleAvatarDragEnd();
      handleDragEnd();
      handleResizeEnd();
    };

    if (isDraggingAvatar || isDraggingChat || isResizing) {
      document.body.style.userSelect = 'none';
      if (isResizing) document.body.style.cursor = `${resizeDir || 'se'}-resize`;
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalTouchEnd);
      document.addEventListener('pointercancel', handleGlobalTouchEnd);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('pointerup', handleGlobalTouchEnd);
      document.removeEventListener('pointercancel', handleGlobalTouchEnd);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDraggingAvatar, isDraggingChat, isResizing, handleAvatarDragMove, handleAvatarDragEnd, handleChatDragMove, handleResizeMove, handleDragEnd, handleResizeEnd]);

  const getUserRole = useCallback(() => {
    if (!user) return 'guest';
    return 'customer';
  }, [user]);

  const streamChat = async (userMessages: Message[], imageBase64?: string) => {
    // Forward the signed-in user's access token so the edge function can
    // resolve userId via JWT and attach the actor name/phone to activity logs.
    let accessToken: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token || null;
    } catch {}
    const bearer = accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

  const handleSend = async (overrideText?: string) => {
    const textToSend = (typeof overrideText === 'string' ? overrideText : input).trim();
    if ((!textToSend && !selectedImage) || isLoading) return;

    let imageBase64: string | undefined;
    const attachments: MessageContent[] = [];

    if (selectedImage) {
      imageBase64 = selectedImage.split(',')[1];
      attachments.push({ type: 'image', imageUrl: selectedImage });
    }

    const userMsg: Message = { 
      role: 'user', 
      content: textToSend || 'این تصویر را ببین',
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

  // ============ Voice Input (STT) ============
  const stopRecordingStream = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(t => t.stop());
      recordingStreamRef.current = null;
    }
  };

  const stopVad = () => {
    if (vadRef.current) {
      cancelAnimationFrame(vadRef.current.raf);
      try { vadRef.current.ctx.close(); } catch {}
      vadRef.current = null;
    }
  };

  const startVad = (stream: MediaStream, onSilence: () => void) => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const SILENCE_THRESHOLD = 0.018; // RMS
      const SILENCE_MS = 1500;
      const MIN_SPEAK_MS = 400;
      const startedAt = performance.now();
      const state = { ctx, analyser, raf: 0, silenceStart: null as number | null, spoke: false };
      vadRef.current = state;
      const tick = () => {
        if (!vadRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (rms > SILENCE_THRESHOLD) {
          state.spoke = true;
          state.silenceStart = null;
        } else if (state.spoke && now - startedAt > MIN_SPEAK_MS) {
          if (state.silenceStart === null) state.silenceStart = now;
          else if (now - state.silenceStart > SILENCE_MS) {
            onSilence();
            return;
          }
        }
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
    } catch (e) {
      console.warn('VAD unavailable', e);
    }
  };

  const startRecording = async () => {
    if (isRecording || isLoading) return;
    // Require a secure context (mic + TTS playback). On http://, getUserMedia is undefined.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      toast.error('برای استفاده از میکروفن سایت باید با HTTPS باز شود');
      return;
    }
    // Prime browser speech inside the user's click/tap gesture so fallback playback can work after async STT/chat.
    primeBrowserSpeech();
    // Proactively check the permission state so we can guide the user
    try {
      if ((navigator as any).permissions?.query) {
        const status = await (navigator as any).permissions.query({ name: 'microphone' as PermissionName });
        if (status.state === 'denied') {
          toast.error('دسترسی به میکروفن مسدود است. لطفاً از تنظیمات مرورگر اجازه دسترسی به میکروفن این سایت را فعال کنید.', { duration: 7000 });
          return;
        }
      }
    } catch { /* Safari may not support this; continue and rely on getUserMedia prompt */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      recordingStreamRef.current = stream;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopVad();
        stopRecordingStream();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 800) {
          toast.error('صدا ضبط نشد، لطفاً دوباره تلاش کنید');
          setIsRecording(false);
          voiceReplyPendingRef.current = false;
          return;
        }
        setIsTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
          }
          const b64 = btoa(bin);
          const { data, error } = await supabase.functions.invoke('assistant-stt', {
            body: { audio: b64, mimeType: blob.type },
          });
          if (error) throw error;
          const text = (data?.text || '').trim();
          if (text) {
            setInput('');
            voiceReplyPendingRef.current = true;
            await handleSend(text);
          } else {
            toast.error('متنی شناسایی نشد');
            voiceReplyPendingRef.current = false;
          }
        } catch (e) {
          console.error('STT error', e);
          toast.error('خطا در تبدیل گفتار به متن');
          voiceReplyPendingRef.current = false;
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      // Auto-stop on silence (end-of-speech detection)
      startVad(stream, () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      });
    } catch (e: any) {
      console.error('mic error', e);
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error('شما اجازه دسترسی به میکروفن را ندادید. برای پرسیدن سؤال با صدا، لطفاً در پنجره مرورگر گزینه «اجازه» (Allow) را انتخاب کنید.', { duration: 7000 });
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        toast.error('میکروفنی روی این دستگاه پیدا نشد');
      } else if (name === 'NotReadableError') {
        toast.error('میکروفن توسط برنامه دیگری در حال استفاده است');
      } else {
        toast.error('دسترسی به میکروفن امکان‌پذیر نشد');
      }
      stopRecordingStream();
      setIsRecording(false);
    }
  };


  const stopRecording = () => {
    stopVad();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopRecordingStream();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording(); else startRecording();
  };


  // ============ Voice Output (TTS) ============
  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); } catch {}
      currentAudioRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeakingIndex(null);
  };

  const speakMessage = async (text: string, index: number) => {
    if (!text?.trim()) return;
    stopSpeaking();
    setLoadingTtsIndex(index);
    const clean = cleanTextForSpeech(text);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-tts', {
        body: { text: clean.slice(0, 4000), voice: 'alloy' },
      });
      if (error) throw error;
      const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audio}`);
      currentAudioRef.current = audio;
      setSpeakingIndex(index);
      audio.onended = () => { if (currentAudioRef.current === audio) { currentAudioRef.current = null; setSpeakingIndex(null); } };
      audio.onerror = () => { if (currentAudioRef.current === audio) { currentAudioRef.current = null; setSpeakingIndex(null); } };
      await audio.play();
    } catch (e) {
      console.error('TTS error', e);
      const utterance = primedSpeechUtteranceRef.current || createBrowserUtterance();
      primedSpeechUtteranceRef.current = null;
      if (utterance && clean) {
        try {
          utterance.text = clean.slice(0, 1500);
          utterance.onend = () => setSpeakingIndex(null);
          utterance.onerror = () => setSpeakingIndex(null);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          setSpeakingIndex(index);
          toast.info('پخش صوتی با صدای مرورگر انجام شد');
          return;
        } catch (fallbackError) {
          console.error('Browser speech fallback error', fallbackError);
        }
      }
      toast.error('خطا در پخش صدا');
      setSpeakingIndex(null);
    } finally {
      setLoadingTtsIndex(null);
    }
  };

  // Auto-play disabled by user preference — TTS only plays when the user
  // clicks the play button on a specific message. Keep the effect only to
  // clear the pending flag so old voice-reply markers don't leak.
  useEffect(() => {
    if (!isOpen || isLoading) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    voiceReplyPendingRef.current = false;
  }, [messages, isOpen, isLoading]);

  useEffect(() => () => { stopSpeaking(); stopRecordingStream(); }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // بررسی اینکه آیا باید دستیار مخفی شود
  const shouldHideAssistant = HIDDEN_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );
  
  // همچنین مخفی شود اگر در صفحه اصلی نقشه کره زمین نمایش داده شود
  const isHomeWithGlobe = location.pathname === '/' && localStorage.getItem('showGlobe') === 'true';

  // Don't render avatar if hidden by route, or in globe view
  // (Allow guests to see the avatar — chat features that require auth will prompt login)
  if (shouldHideAssistant || isHomeWithGlobe) {
    return null;
  }

  return (
    <>
      {/* دکمه آواتار - قابل جابجایی در یک‌چهارم چپ-پایین */}
      <div
        onMouseDown={handleAvatarMouseDown}
        onTouchStart={handleAvatarTouchStart}
        onTouchMove={handleAvatarTouchMove}
        onClick={handleAvatarClick}
        style={{
          left: `${avatarPosition.x}px`,
          bottom: `${avatarPosition.y}px`,
        }}
        className={cn(
          "fixed z-40 flex flex-col items-center gap-1 overflow-visible touch-none",
          isOpen && "hidden",
          isDraggingAvatar ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div className="relative overflow-visible">
          <div
            ref={avatarRef}
            className={cn(
              isMobile ? "w-[67px] h-[67px] rounded-full" : "w-[74px] h-[74px] rounded-full",
              "shadow-lg hover:shadow-2xl transition-shadow duration-300",
              "overflow-hidden select-none bg-white"
            )}
            aria-label="باز کردن دستیار هوشمند"
          >
            <img 
              src={assistantImage} 
              alt="دستیار اهرم" 
              className="w-full h-full object-cover object-top pointer-events-none"
              draggable={false}
            />
          </div>
          <span className="absolute bottom-1 -right-0.5 w-[18px] h-[18px] bg-green-500 rounded-full border-2 border-background animate-pulse" />
        </div>
        <span className="text-xs font-medium text-[#1e3a5f] bg-background/80 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm whitespace-nowrap -mt-1">
          دستیار اهرم
        </span>
      </div>

      {/* پنل چت */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={chatPanelRef}
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            width: `${chatSize.width / assistantZoom}px`,
            height: `${chatSize.height / assistantZoom}px`,
            maxWidth: `${100 / assistantZoom}vw`,
            maxHeight: `${100 / assistantZoom}dvh`,
            zoom: assistantZoom,
            touchAction: (isDraggingChat || isResizing) ? 'none' : 'auto',
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
                onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                className={cn("text-white hover:bg-white/20", isMobile ? "h-11 w-11" : "h-8 w-8")}
                title="کوچک‌تر کردن متن"
              >
                <ZoomOut className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
              </Button>

              <span
                onClick={(e) => { e.stopPropagation(); setAssistantZoom(isMobile ? 1 : 0.25); }}
                title={`بازنشانی زوم (پیش‌فرض ${isMobile ? '۱۰۰٪' : '۲۵٪'})`}
                className={cn(
                  "text-white/90 min-w-[34px] text-center select-none cursor-pointer hover:bg-white/20 rounded px-1",
                  isMobile ? "text-sm" : "text-[11px]"
                )}
              >
                {Math.round(assistantZoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                className={cn("text-white hover:bg-white/20", isMobile ? "h-11 w-11" : "h-8 w-8")}
                title="بزرگ‌تر کردن متن"
              >
                <ZoomIn className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
              </Button>
              {!isMobile && (
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
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsFullscreen(false); }}
                className={cn(
                  "text-white hover:bg-white/20 active:bg-white/30",
                  isMobile ? "h-12 w-12 -mr-1" : "h-8 w-8"
                )}
                aria-label="بستن گفتگو"
                title="بستن"
              >
                <X className={isMobile ? "h-7 w-7" : "h-5 w-5"} />
              </Button>
            </div>
          </div>


          {/* پیام‌ها */}
          <div className="flex-1 p-4 overflow-y-auto ahrom-chat-scroll" ref={scrollRef} style={{ overscrollBehavior: 'contain' }}>
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
                    onClick={() => composerRef.current?.setValue('چطور سفارش ثبت کنم؟')}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    ثبت سفارش
                  </button>
                  <button 
                    onClick={() => composerRef.current?.setValue('خدمات شما چیست؟')}
                    className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                  >
                    خدمات
                  </button>
                  <button 
                    onClick={() => composerRef.current?.setValue('راهنمای سایت')}
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
                        {(() => {
                          if (msg.role !== 'assistant') {
                            return <p className="px-3 py-2 whitespace-pre-line">{msg.content}</p>;
                          }
                          const { cleanText: t1, draft } = parseOrderDraft(msg.content);
                          const { cleanText: t2, cards } = parsePaymentCards(t1);
                          const { cleanText, opens } = parseModuleOpens(t2);
                          return (
                            <>
                              {cleanText && <p className="px-3 py-2 whitespace-pre-line">{cleanText}</p>}
                              {draft && (
                                <div className="px-3 pb-3">
                                  <OrderDraftCard draft={draft} />
                                </div>
                              )}
                              {cards.map((c, idx) => (
                                <div key={`pay-${idx}`} className="px-3 pb-3">
                                  <PaymentCard data={c} />
                                </div>
                              ))}
                              {opens.map((o, idx) => (
                                <div key={`mod-${idx}`} className="px-3 pb-3">
                                  <ModuleOpenCard data={o} />
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                      {/* زمان و دکمه حذف - مخفی برای پیام خوش‌آمدگویی */}
                      <div className={cn(
                        "flex items-center gap-2 text-[10px] text-muted-foreground",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}>
                        {msg.timestamp && msg.id !== 'welcome-message' && (
                          <span>{formatMessageTime(msg.timestamp)}</span>
                        )}
                        {msg.role === 'assistant' && msg.id !== 'welcome-message' && (
                          <button
                            onClick={() => {
                              if (speakingIndex === idx) stopSpeaking();
                              else { primeBrowserSpeech(msg.content); speakMessage(msg.content, idx); }
                            }}
                            className="p-1 hover:bg-amber-100 rounded transition-colors"
                            title={speakingIndex === idx ? "توقف خواندن" : "خواندن پاسخ"}
                            disabled={loadingTtsIndex === idx}
                          >
                            {loadingTtsIndex === idx ? (
                              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                            ) : speakingIndex === idx ? (
                              <VolumeX className="w-3 h-3 text-amber-600" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-amber-600" />
                            )}
                          </button>
                        )}
                        {msg.id !== 'welcome-message' && (
                          <button
                            onClick={() => handleCopyMessage(msg.content, idx)}
                            className="p-1 hover:bg-primary/10 rounded transition-colors"
                            title="کپی متن پیام"
                            aria-label="کپی متن پیام"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-muted-foreground" />
                            )}
                          </button>
                        )}
                        {msg.id !== 'welcome-message' && (
                          <button
                            onClick={() => handleDeleteMessage(idx)}
                            className="p-1 hover:bg-destructive/10 rounded transition-colors"
                            title="حذف پیام"
                            aria-label="حذف پیام"
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
          </div>

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
                disabled={isLoading || isRecording}
                title="افزودن تصویر"
              >
                <Image className="h-5 w-5" />
              </Button>
              <Button
                onClick={toggleRecording}
                size="icon"
                variant="ghost"
                className={cn(
                  "h-9 w-9",
                  isRecording ? "text-red-600 bg-red-100 hover:bg-red-200 animate-pulse" : "text-muted-foreground hover:text-amber-600"
                )}
                disabled={isLoading || isTranscribing}
                title={isRecording ? "توقف ضبط" : "ضبط صدا"}
              >
                {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                onClick={() => { if (ttsEnabled) stopSpeaking(); else primeBrowserSpeech(); setTtsEnabled(v => !v); }}
                size="icon"
                variant="ghost"
                className={cn(
                  "h-9 w-9",
                  ttsEnabled ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-muted-foreground hover:text-amber-600"
                )}
                title={ttsEnabled ? "خاموش کردن خواندن پاسخ‌ها" : "روشن کردن خواندن پاسخ‌ها"}
              >
                {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
              <ChatComposer
                ref={composerRef}
                placeholder={isRecording ? "در حال ضبط صدا..." : isTranscribing ? "در حال تبدیل گفتار..." : "پیام خود را بنویسید..."}
                className="flex-1"
                disabled={isLoading || isRecording || isTranscribing}
                onEnterSubmit={(text) => { handleSend(text); }}
              />
              <Button 
                onClick={() => {
                  const text = composerRef.current?.getValue() ?? '';
                  composerRef.current?.clear();
                  handleSend(text);
                }} 
                disabled={isLoading || isRecording}
                size="icon"
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* دستگیره‌های تغییر اندازه - لبه‌ها و گوشه‌ها */}
          {!isFullscreen && (
            <>
              {/* لبه‌ها */}
              <div onPointerDown={makeResizePointerDown('n')}
                className="absolute top-0 left-5 right-5 h-5 cursor-n-resize z-20 touch-none" />
              <div onPointerDown={makeResizePointerDown('s')}
                className="absolute bottom-0 left-5 right-5 h-5 cursor-s-resize z-20 touch-none" />
              <div onPointerDown={makeResizePointerDown('e')}
                className="absolute top-5 bottom-5 right-0 w-5 cursor-e-resize z-20 touch-none" />
              <div onPointerDown={makeResizePointerDown('w')}
                className="absolute top-5 bottom-5 left-0 w-5 cursor-w-resize z-20 touch-none" />
              {/* گوشه‌ها */}
              <div onPointerDown={makeResizePointerDown('nw')}
                className="absolute top-0 left-0 w-8 h-8 cursor-nw-resize z-30 touch-none" />
              <div onPointerDown={makeResizePointerDown('ne')}
                className="absolute top-0 right-0 w-8 h-8 cursor-ne-resize z-30 touch-none" />
              <div onPointerDown={makeResizePointerDown('sw')}
                className="absolute bottom-0 left-0 w-8 h-8 cursor-sw-resize z-30 touch-none" />
              <div
                onPointerDown={makeResizePointerDown('se')}
                className="absolute bottom-0 right-0 w-9 h-9 cursor-se-resize z-30 flex items-end justify-end p-1.5 hover:bg-amber-100/50 rounded-br-2xl transition-colors touch-none"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground">
                  <path d="M11 11L1 11M11 11L11 1M11 11L3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
