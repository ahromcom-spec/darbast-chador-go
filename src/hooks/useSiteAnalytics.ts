import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Generate or get session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('site_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('site_session_id', sessionId);
  }
  return sessionId;
};

// Fetch IP address from external API
const getIPAddress = async (): Promise<string | null> => {
  // Check cache first
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

export function useSiteAnalytics() {
  const location = useLocation();
  const sessionId = useRef(getSessionId());
  const pageLoadTime = useRef(Date.now());
  const pageViewCount = useRef(0);
  const lastEventTime = useRef(Date.now());
  const isTrackingEnabled = useRef(true);

  const trackEvent = useCallback(async (eventType: string, additionalData: Record<string, unknown> = {}) => {
    if (!isTrackingEnabled.current) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const osInfo = getOSInfo();
      const browserInfo = getBrowserInfo();
      const currentTime = Date.now();
      const sessionDuration = Math.floor((currentTime - pageLoadTime.current) / 1000);
      
      // Get IP address
      const ipAddress = await getIPAddress();

      const eventData = {
        user_id: user?.id || null,
        session_id: sessionId.current,
        event_type: eventType,
        page_url: window.location.pathname,
        page_title: document.title,
        referrer_url: document.referrer || null,
        entry_page: sessionStorage.getItem('entry_page') || window.location.pathname,
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
        ...additionalData
      };

      // Insert event
      await supabase.from('site_analytics').insert(eventData);

      // Update or create session
      const { data: existingSession } = await supabase
        .from('site_sessions')
        .select('id')
        .eq('session_id', sessionId.current)
        .single();

      if (existingSession) {
        await supabase
          .from('site_sessions')
          .update({
            user_id: user?.id || null,
            ended_at: new Date().toISOString(),
            total_duration_seconds: sessionDuration,
            total_page_views: pageViewCount.current,
            exit_page: window.location.pathname,
            is_logged_in: !!user,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionId.current);
      } else {
        await supabase.from('site_sessions').insert({
          session_id: sessionId.current,
          user_id: user?.id || null,
          started_at: new Date(pageLoadTime.current).toISOString(),
          entry_page: window.location.pathname,
          device_type: getDeviceType(),
          os_name: osInfo.name,
          os_version: osInfo.version,
          browser_name: browserInfo.name,
          device_model: getDeviceModel(),
          is_logged_in: !!user,
          user_agent: navigator.userAgent,
          ip_address: ipAddress
        });

        // Set entry page for first visit
        if (!sessionStorage.getItem('entry_page')) {
          sessionStorage.setItem('entry_page', window.location.pathname);
        }
      }

      lastEventTime.current = currentTime;
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.debug('Analytics tracking error:', error);
    }
  }, []);

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
