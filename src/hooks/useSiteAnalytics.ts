import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Which manager (if any) is currently impersonating a customer account.
// Used so the activity log never credits the customer for a manager's session.
const getImpersonatorId = (): string | null => {
  try {
    const raw = localStorage.getItem('original_admin_session');
    return raw ? (JSON.parse(raw)?.user_id ?? null) : null;
  } catch {
    return null;
  }
};

// Never record what people type into sensitive fields.
const isSensitiveField = (el: HTMLInputElement | HTMLTextAreaElement): boolean => {
  const type = (el as HTMLInputElement).type?.toLowerCase() || 'text';
  if (['password', 'hidden'].includes(type)) return true;
  const hay = `${el.name || ''} ${el.id || ''} ${el.getAttribute('autocomplete') || ''}`.toLowerCase();
  return /pass|otp|code|cvv|card|token|secret/.test(hay);
};

const fieldLabel = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string => {
  const aria = el.getAttribute('aria-label');
  const ph = (el as HTMLInputElement).placeholder;
  if (aria) return aria.trim().slice(0, 60);
  if (ph) return ph.trim().slice(0, 60);
  if (el.id) {
    const lab = document.querySelector(`label[for="${el.id}"]`);
    if (lab?.textContent) return lab.textContent.trim().slice(0, 60);
  }
  const wrapLabel = el.closest('label')?.textContent;
  if (wrapLabel) return wrapLabel.trim().slice(0, 60);
  return el.name || el.id || 'فیلد';
};


// Generate or get session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('site_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('site_session_id', sessionId);
  }
  return sessionId;
};

// Persistent per-device identifier (survives sessions, one per phone/computer).
// Stored in both localStorage and a long-lived cookie so clearing one keeps the other.
const getDeviceId = (): string => {
  const readCookie = (): string | null => {
    try {
      const m = document.cookie.match(/(?:^|;\s*)site_device_id=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
  };
  const writeCookie = (id: string) => {
    try {
      document.cookie = `site_device_id=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; SameSite=Lax`;
    } catch { /* ignore */ }
  };

  let id: string | null = null;
  try { id = localStorage.getItem('site_device_id'); } catch { /* ignore */ }
  if (!id) id = readCookie();
  if (!id) id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  try { localStorage.setItem('site_device_id', id); } catch { /* ignore */ }
  writeCookie(id);
  return id;
};


// Fetch IP address from external API (stable per device: first detected IP is reused)
const getIPAddress = async (): Promise<string | null> => {
  // Stable device-level IP takes priority so the same phone is not logged with many IPs
  try {
    const deviceIP = localStorage.getItem('device_ip_address');
    if (deviceIP) return deviceIP;
  } catch { /* ignore */ }

  const cachedIP = sessionStorage.getItem('user_ip_address');
  if (cachedIP) return cachedIP;

  try {
    const response = await fetch('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(5000) 
    });
    if (response.ok) {
      const data = await response.json();
      if (data.ip) {
        sessionStorage.setItem('user_ip_address', data.ip);
        try { localStorage.setItem('device_ip_address', data.ip); } catch { /* ignore */ }
        return data.ip;
      }
    }
  } catch (error) {
    console.debug('Could not fetch IP address:', error);
  }
  return null;
};


// Detect device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

// Detect OS
const getOSInfo = (): { name: string; version: string } => {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '';

  if (/Windows NT 10/i.test(ua)) {
    name = 'Windows';
    version = '10';
  } else if (/Windows NT 6.3/i.test(ua)) {
    name = 'Windows';
    version = '8.1';
  } else if (/Windows NT 6.2/i.test(ua)) {
    name = 'Windows';
    version = '8';
  } else if (/Windows NT 6.1/i.test(ua)) {
    name = 'Windows';
    version = '7';
  } else if (/Mac OS X/i.test(ua)) {
    name = 'MacOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (match) version = match[1].replace('_', '.');
  } else if (/Android/i.test(ua)) {
    name = 'Android';
    const match = ua.match(/Android\s+(\d+(\.\d+)?)/);
    if (match) version = match[1];
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    name = 'iOS';
    const match = ua.match(/OS (\d+_\d+)/);
    if (match) version = match[1].replace('_', '.');
  } else if (/Linux/i.test(ua)) {
    name = 'Linux';
  }

  return { name, version };
};

// Detect browser
const getBrowserInfo = (): { name: string; version: string } => {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '';

  if (/Edg\//i.test(ua)) {
    name = 'Edge';
    const match = ua.match(/Edg\/(\d+(\.\d+)?)/);
    if (match) version = match[1];
  } else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) {
    name = 'Chrome';
    const match = ua.match(/Chrome\/(\d+(\.\d+)?)/);
    if (match) version = match[1];
  } else if (/Firefox/i.test(ua)) {
    name = 'Firefox';
    const match = ua.match(/Firefox\/(\d+(\.\d+)?)/);
    if (match) version = match[1];
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    name = 'Safari';
    const match = ua.match(/Version\/(\d+(\.\d+)?)/);
    if (match) version = match[1];
  } else if (/MSIE|Trident/i.test(ua)) {
    name = 'Internet Explorer';
  }

  return { name, version };
};

// Get device model (approximate)
const getDeviceModel = (): string => {
  const ua = navigator.userAgent;
  
  // Check for specific device patterns
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Samsung/i.test(ua)) return 'Samsung';
  if (/Huawei/i.test(ua)) return 'Huawei';
  if (/Xiaomi/i.test(ua)) return 'Xiaomi';
  if (/OPPO/i.test(ua)) return 'OPPO';
  if (/Pixel/i.test(ua)) return 'Google Pixel';
  if (/OnePlus/i.test(ua)) return 'OnePlus';
  
  // Generic fallback
  const deviceType = getDeviceType();
  if (deviceType === 'mobile') return 'Mobile Device';
  if (deviceType === 'tablet') return 'Tablet';
  return 'Desktop';
};

// Track visited pages in session
const getVisitedPages = (): string[] => {
  try {
    const stored = sessionStorage.getItem('visited_pages');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addVisitedPage = (page: string): string[] => {
  const pages = getVisitedPages();
  // Only add if different from last page
  if (pages.length === 0 || pages[pages.length - 1] !== page) {
    pages.push(page);
    sessionStorage.setItem('visited_pages', JSON.stringify(pages));
  }
  return pages;
};

export function useSiteAnalytics() {
  const location = useLocation();
  const sessionId = useRef(getSessionId());
  const pageLoadTime = useRef(Date.now());
  const pageViewCount = useRef(0);
  const lastEventTime = useRef(Date.now());
  const isTrackingEnabled = useRef(true);
  const sessionCreated = useRef(false);

  // Create session immediately on first load
  const createSessionImmediately = useCallback(async () => {
    if (sessionCreated.current || !isTrackingEnabled.current) return;
    sessionCreated.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const osInfo = getOSInfo();
      const browserInfo = getBrowserInfo();
      const ipAddress = await getIPAddress();
      const currentPage = window.location.pathname;
      
      // Add first page to visited pages
      addVisitedPage(currentPage);

      // Set entry page
      if (!sessionStorage.getItem('entry_page')) {
        sessionStorage.setItem('entry_page', currentPage);
      }

      // Get phone number if logged in
      let phoneNumber: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .single();
        phoneNumber = profile?.phone_number || null;
      }

      // Create session immediately
      await supabase.from('site_sessions').insert({
        session_id: sessionId.current,
        user_id: user?.id || null,
        started_at: new Date().toISOString(),
        entry_page: currentPage,
        device_type: getDeviceType(),
        os_name: osInfo.name,
        os_version: osInfo.version,
        browser_name: browserInfo.name,
        device_model: getDeviceModel(),
        is_logged_in: !!user,
        user_agent: navigator.userAgent,
        ip_address: ipAddress,
        phone_number: phoneNumber,
        visited_pages: [currentPage]
      });

      // Log every visit in the CEO activity-log module (works for guests too),
      // including page refreshes — no per-session suppression.
      supabase.functions.invoke('track-visit', {
        body: {
          page: currentPage,
          pageTitle: document.title,
          referrer: document.referrer || null,
          sessionId: sessionId.current,
          deviceId: getDeviceId(),
          impersonatorUserId: (() => {
            try {
              const raw = localStorage.getItem('original_admin_session');
              return raw ? (JSON.parse(raw)?.user_id ?? null) : null;
            } catch { return null; }
          })(),

          deviceType: getDeviceType(),
          ip: ipAddress,
          userAgent: navigator.userAgent,
          userId: user?.id || null,
        },
      }).catch(() => { /* silent */ });


      console.debug('Session created immediately:', sessionId.current);
    } catch (error) {
      console.debug('Session creation error:', error);
      sessionCreated.current = false; // Allow retry
    }
  }, []);

  const trackEvent = useCallback(async (eventType: string, additionalData: Record<string, unknown> = {}) => {
    if (!isTrackingEnabled.current) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const osInfo = getOSInfo();
      const browserInfo = getBrowserInfo();
      const currentTime = Date.now();
      const sessionDuration = Math.floor((currentTime - pageLoadTime.current) / 1000);
      const currentPage = window.location.pathname;
      
      // Get IP address (cached)
      const ipAddress = await getIPAddress();
      
      // Add page to visited pages
      const visitedPages = addVisitedPage(currentPage);

      // Get phone number if logged in
      let phoneNumber: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .single();
        phoneNumber = profile?.phone_number || null;
      }

      const eventData = {
        user_id: user?.id || null,
        session_id: sessionId.current,
        event_type: eventType,
        page_url: currentPage,
        page_title: document.title,
        referrer_url: document.referrer || null,
        entry_page: sessionStorage.getItem('entry_page') || currentPage,
        device_type: getDeviceType(),
        os_name: osInfo.name,
        os_version: osInfo.version,
        browser_name: browserInfo.name,
        browser_version: browserInfo.version,
        device_model: getDeviceModel(),
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        session_duration_seconds: sessionDuration,
        page_count: pageViewCount.current,
        is_logged_in: !!user,
        user_agent: navigator.userAgent,
        ip_address: ipAddress,
        phone_number: phoneNumber,
        ...additionalData
      };

      // Insert event immediately
      await supabase.from('site_analytics').insert(eventData);

      // Update session with latest data
      await supabase
        .from('site_sessions')
        .update({
          user_id: user?.id || null,
          ended_at: new Date().toISOString(),
          total_duration_seconds: sessionDuration,
          total_page_views: pageViewCount.current,
          exit_page: currentPage,
          is_logged_in: !!user,
          phone_number: phoneNumber,
          visited_pages: visitedPages,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId.current);

      lastEventTime.current = currentTime;
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.debug('Analytics tracking error:', error);
    }
  }, []);

  // Create session immediately on mount
  useEffect(() => {
    createSessionImmediately();
  }, [createSessionImmediately]);

  // Track page views on route change
  useEffect(() => {
    pageViewCount.current += 1;
    trackEvent('page_view');
  }, [location.pathname, trackEvent]);

  // Track login/logout events
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        trackEvent('login');
      } else if (event === 'SIGNED_OUT') {
        trackEvent('logout');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [trackEvent]);

  // Track page visibility (session end)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackEvent('session_pause');
      } else {
        trackEvent('session_resume');
      }
    };

    const handleBeforeUnload = () => {
      trackEvent('session_end');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [trackEvent]);

  // Periodic session duration update (every 30 seconds)
  useEffect(() => {
    const updateSessionDuration = async () => {
      if (!isTrackingEnabled.current) return;
      
      try {
        const currentTime = Date.now();
        const sessionDuration = Math.floor((currentTime - pageLoadTime.current) / 1000);
        
        await supabase
          .from('site_sessions')
          .update({
            total_duration_seconds: sessionDuration,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionId.current);
      } catch (error) {
        console.debug('Session duration update error:', error);
      }
    };

    // Update immediately after 5 seconds, then every 30 seconds
    const initialTimeout = setTimeout(updateSessionDuration, 5000);
    const interval = setInterval(updateSessionDuration, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return {
    trackEvent,
    sessionId: sessionId.current,
    disableTracking: () => { isTrackingEnabled.current = false; },
    enableTracking: () => { isTrackingEnabled.current = true; }
  };
}
