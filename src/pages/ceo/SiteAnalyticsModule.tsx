import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/common/StatCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  Eye, 
  Clock, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  LogIn, 
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Filter,
  Calendar,
  RefreshCw,
  TrendingUp,
  Activity,
  FileText,
  X
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  session_id: string;
  event_type: string;
  page_url: string | null;
  page_title: string | null;
  entry_page: string | null;
  device_type: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  device_model: string | null;
  screen_width: number | null;
  screen_height: number | null;
  session_duration_seconds: number | null;
  page_count: number | null;
  data_transferred_bytes: number | null;
  is_logged_in: boolean;
  created_at: string;
  user_info?: {
    full_name: string | null;
    phone_number: string | null;
  };
}

interface SessionData {
  id: string;
  session_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  total_duration_seconds: number | null;
  total_page_views: number | null;
  total_data_bytes: number | null;
  entry_page: string | null;
  exit_page: string | null;
  device_type: string | null;
  os_name: string | null;
  browser_name: string | null;
  device_model: string | null;
  ip_address: string | null;
  is_logged_in: boolean;
  user_info?: {
    full_name: string | null;
    phone_number: string | null;
  };
}

interface Stats {
  totalVisits: number;
  uniqueVisitors: number;
  loggedInUsers: number;
  guestUsers: number;
  avgDuration: number;
  avgPageViews: number;
  totalDataBytes: number;
  deviceBreakdown: Record<string, number>;
  osBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
  entryPages: Record<string, number>;
}

type DateFilterType = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';
type UserFilterType = 'all' | 'logged_in' | 'guest';
type DeviceFilterType = 'all' | 'mobile' | 'tablet' | 'desktop';
type OSFilterType = 'all' | 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';

export default function SiteAnalyticsModule() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilterType>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilterType>('all');
  const [osFilter, setOSFilter] = useState<OSFilterType>('all');
  const [activeTab, setActiveTab] = useState('overview');

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'week':
        return { start: subDays(now, 7), end: now };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : subDays(now, 30),
          end: customEndDate ? new Date(customEndDate) : now
        };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      console.log('Fetching analytics from', start.toISOString(), 'to', end.toISOString());
      
      // Fetch analytics events
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('site_analytics')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (analyticsError) {
        console.error('Analytics error:', analyticsError);
        throw analyticsError;
      }
      
      console.log('Analytics data count:', analyticsData?.length || 0);

      // Fetch sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('site_sessions')
        .select('*')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .order('started_at', { ascending: false })
        .limit(500);

      if (sessionsError) {
        console.error('Sessions error:', sessionsError);
        throw sessionsError;
      }
      
      console.log('Sessions data count:', sessionsData?.length || 0);

      // Get user info for logged in users
      const userIds = [...new Set([
        ...(analyticsData || []).filter(e => e.user_id).map(e => e.user_id),
        ...(sessionsData || []).filter(s => s.user_id).map(s => s.user_id)
      ])].filter(Boolean) as string[];

      let userInfoMap: Record<string, { full_name: string | null; phone_number: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesData.forEach(p => {
            userInfoMap[p.user_id] = { 
              full_name: p.full_name, 
              phone_number: p.phone_number 
            };
          });
        }
      }

      // Enrich with user info
      const enrichedEvents = (analyticsData || []).map(e => ({
        ...e,
        user_info: e.user_id ? userInfoMap[e.user_id] : undefined
      }));

      const enrichedSessions = (sessionsData || []).map(s => ({
        ...s,
        ip_address: s.ip_address as string | null,
        user_info: s.user_id ? userInfoMap[s.user_id] : undefined
      }));

      setEvents(enrichedEvents);
      setSessions(enrichedSessions);
      calculateStats(enrichedEvents, enrichedSessions);
      
      if ((analyticsData?.length || 0) === 0 && (sessionsData?.length || 0) === 0) {
        toast.info('داده‌ای برای این بازه زمانی یافت نشد');
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      if (error?.message?.includes('permission') || error?.code === '42501') {
        toast.error('دسترسی به آمار بازدید ندارید. لطفاً با نقش مدیرعامل وارد شوید.');
      } else {
        toast.error('خطا در دریافت آمار: ' + (error?.message || 'خطای ناشناخته'));
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (eventsData: AnalyticsEvent[], sessionsData: SessionData[]) => {
    const uniqueSessionIds = new Set(eventsData.map(e => e.session_id));
    const loggedInEvents = eventsData.filter(e => e.is_logged_in);
    const guestEvents = eventsData.filter(e => !e.is_logged_in);
    
    const deviceBreakdown: Record<string, number> = {};
    const osBreakdown: Record<string, number> = {};
    const browserBreakdown: Record<string, number> = {};
    const entryPages: Record<string, number> = {};

    sessionsData.forEach(s => {
      if (s.device_type) {
        deviceBreakdown[s.device_type] = (deviceBreakdown[s.device_type] || 0) + 1;
      }
      if (s.os_name) {
        osBreakdown[s.os_name] = (osBreakdown[s.os_name] || 0) + 1;
      }
      if (s.browser_name) {
        browserBreakdown[s.browser_name] = (browserBreakdown[s.browser_name] || 0) + 1;
      }
      if (s.entry_page) {
        entryPages[s.entry_page] = (entryPages[s.entry_page] || 0) + 1;
      }
    });

    const totalDuration = sessionsData.reduce((acc, s) => acc + (s.total_duration_seconds || 0), 0);
    const totalPageViews = sessionsData.reduce((acc, s) => acc + (s.total_page_views || 0), 0);
    const totalDataBytes = eventsData.reduce((acc, e) => acc + (e.data_transferred_bytes || 0), 0);

    setStats({
      totalVisits: eventsData.filter(e => e.event_type === 'page_view').length,
      uniqueVisitors: uniqueSessionIds.size,
      loggedInUsers: new Set(loggedInEvents.map(e => e.user_id)).size,
      guestUsers: new Set(guestEvents.map(e => e.session_id)).size,
      avgDuration: sessionsData.length > 0 ? Math.round(totalDuration / sessionsData.length) : 0,
      avgPageViews: sessionsData.length > 0 ? Math.round(totalPageViews / sessionsData.length) : 0,
      totalDataBytes,
      deviceBreakdown,
      osBreakdown,
      browserBreakdown,
      entryPages
    });
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter, customStartDate, customEndDate]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (userFilter === 'logged_in' && !s.is_logged_in) return false;
      if (userFilter === 'guest' && s.is_logged_in) return false;
      if (deviceFilter !== 'all' && s.device_type?.toLowerCase() !== deviceFilter) return false;
      if (osFilter !== 'all') {
        const os = s.os_name?.toLowerCase() || '';
        if (osFilter === 'android' && !os.includes('android')) return false;
        if (osFilter === 'ios' && !os.includes('ios')) return false;
        if (osFilter === 'windows' && !os.includes('windows')) return false;
        if (osFilter === 'macos' && !os.includes('mac')) return false;
        if (osFilter === 'linux' && !os.includes('linux')) return false;
      }
      return true;
    });
  }, [sessions, userFilter, deviceFilter, osFilter]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0 ثانیه';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} ساعت`);
    if (minutes > 0) parts.push(`${minutes} دقیقه`);
    if (secs > 0 && hours === 0) parts.push(`${secs} ثانیه`);
    
    return parts.join(' و ') || '0 ثانیه';
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 بایت';
    const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    let unitIndex = 0;
    let size = bytes;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getOSLabel = (os: string | null) => {
    if (!os) return 'نامشخص';
    const osLower = os.toLowerCase();
    if (osLower.includes('android')) return 'اندروید';
    if (osLower.includes('ios')) return 'iOS';
    if (osLower.includes('windows')) return 'ویندوز';
    if (osLower.includes('mac')) return 'مک';
    if (osLower.includes('linux')) return 'لینوکس';
    return os;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            ماژول آمار بازدید سایت اهرم
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحلیل جامع بازدیدکنندگان و رفتار کاربران
          </p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          بروزرسانی
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            فیلترها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Date Filter */}
            <div className="space-y-2">
              <Label className="text-xs">بازه زمانی</Label>
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">امروز</SelectItem>
                  <SelectItem value="yesterday">دیروز</SelectItem>
                  <SelectItem value="week">هفته گذشته</SelectItem>
                  <SelectItem value="month">این ماه</SelectItem>
                  <SelectItem value="year">امسال</SelectItem>
                  <SelectItem value="custom">دلخواه</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range - Persian Calendar */}
            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">از تاریخ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-right font-normal',
                          !customStartDate && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="ml-2 h-4 w-4" />
                        {customStartDate 
                          ? format(new Date(customStartDate), 'yyyy/MM/dd', { locale: faIR })
                          : 'انتخاب تاریخ'
                        }
                        {customStartDate && (
                          <X 
                            className="mr-auto h-4 w-4 text-muted-foreground hover:text-foreground" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomStartDate('');
                            }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="p-0 z-[9999] w-auto"
                      align="center"
                      style={{
                        position: 'fixed',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate ? new Date(customStartDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setCustomStartDate(date.toISOString());
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          const oneYearAgo = new Date();
                          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                          return date > today || date < oneYearAgo;
                        }}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">تا تاریخ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-right font-normal',
                          !customEndDate && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="ml-2 h-4 w-4" />
                        {customEndDate 
                          ? format(new Date(customEndDate), 'yyyy/MM/dd', { locale: faIR })
                          : 'انتخاب تاریخ'
                        }
                        {customEndDate && (
                          <X 
                            className="mr-auto h-4 w-4 text-muted-foreground hover:text-foreground" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomEndDate('');
                            }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="p-0 z-[9999] w-auto"
                      align="center"
                      style={{
                        position: 'fixed',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate ? new Date(customEndDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setCustomEndDate(date.toISOString());
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          const startDate = customStartDate ? new Date(customStartDate) : new Date();
                          startDate.setFullYear(startDate.getFullYear() - 1);
                          return date > today || date < startDate;
                        }}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* User Filter */}
            <div className="space-y-2">
              <Label className="text-xs">نوع کاربر</Label>
              <Select value={userFilter} onValueChange={(v) => setUserFilter(v as UserFilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="logged_in">کاربران عضو</SelectItem>
                  <SelectItem value="guest">مهمان</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Device Filter */}
            <div className="space-y-2">
              <Label className="text-xs">دستگاه</Label>
              <Select value={deviceFilter} onValueChange={(v) => setDeviceFilter(v as DeviceFilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="mobile">موبایل</SelectItem>
                  <SelectItem value="tablet">تبلت</SelectItem>
                  <SelectItem value="desktop">دسکتاپ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* OS Filter */}
            <div className="space-y-2">
              <Label className="text-xs">سیستم عامل</Label>
              <Select value={osFilter} onValueChange={(v) => setOSFilter(v as OSFilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="android">اندروید</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="windows">ویندوز</SelectItem>
                  <SelectItem value="macos">مک</SelectItem>
                  <SelectItem value="linux">لینوکس</SelectItem>
                  <SelectItem value="other">سایر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="بازدید کل"
            value={stats.totalVisits.toLocaleString('fa-IR')}
            icon={Eye}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30"
          />
          <StatCard
            title="بازدیدکننده یکتا"
            value={stats.uniqueVisitors.toLocaleString('fa-IR')}
            icon={Users}
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30"
          />
          <StatCard
            title="کاربران عضو"
            value={stats.loggedInUsers.toLocaleString('fa-IR')}
            icon={LogIn}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30"
          />
          <StatCard
            title="کاربران مهمان"
            value={stats.guestUsers.toLocaleString('fa-IR')}
            icon={Globe}
            className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30"
          />
          <StatCard
            title="میانگین مدت حضور"
            value={formatDuration(stats.avgDuration)}
            icon={Clock}
            className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/30"
          />
          <StatCard
            title="میانگین صفحات بازدید"
            value={stats.avgPageViews.toLocaleString('fa-IR')}
            icon={FileText}
            className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/30 dark:to-pink-900/30"
          />
          <StatCard
            title="حجم انتقال داده"
            value={formatBytes(stats.totalDataBytes)}
            icon={ArrowDownToLine}
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/30"
          />
          <StatCard
            title="نشست‌های فعال"
            value={filteredSessions.length.toLocaleString('fa-IR')}
            icon={TrendingUp}
            className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30"
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="visitors">بازدیدکنندگان</TabsTrigger>
          <TabsTrigger value="pages">صفحات</TabsTrigger>
          <TabsTrigger value="devices">دستگاه‌ها</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* OS Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">سیستم عامل‌ها</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats && Object.entries(stats.osBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([os, count]) => (
                      <div key={os} className="flex items-center justify-between">
                        <span className="text-sm">{getOSLabel(os)}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ 
                                width: `${(count / Math.max(...Object.values(stats.osBreakdown))) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-left">
                            {count.toLocaleString('fa-IR')}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                  {(!stats || Object.keys(stats.osBreakdown).length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-4">داده‌ای موجود نیست</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Browser Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">مرورگرها</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats && Object.entries(stats.browserBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([browser, count]) => (
                      <div key={browser} className="flex items-center justify-between">
                        <span className="text-sm">{browser || 'نامشخص'}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-secondary rounded-full"
                              style={{ 
                                width: `${(count / Math.max(...Object.values(stats.browserBreakdown))) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-left">
                            {count.toLocaleString('fa-IR')}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                  {(!stats || Object.keys(stats.browserBreakdown).length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-4">داده‌ای موجود نیست</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Entry Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">صفحات ورودی</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {stats && Object.entries(stats.entryPages)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([page, count]) => (
                      <div key={page} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-mono truncate max-w-[70%]">{page || '/'}</span>
                        <Badge variant="secondary">{count.toLocaleString('fa-IR')}</Badge>
                      </div>
                    ))
                  }
                  {(!stats || Object.keys(stats.entryPages).length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-4">داده‌ای موجود نیست</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visitors Tab */}
        <TabsContent value="visitors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">لیست بازدیدکنندگان</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">کاربر</TableHead>
                      <TableHead className="text-right">شماره تماس</TableHead>
                      <TableHead className="text-right">آدرس IP</TableHead>
                      <TableHead className="text-right">دستگاه</TableHead>
                      <TableHead className="text-right">سیستم عامل</TableHead>
                      <TableHead className="text-right">مدت حضور</TableHead>
                      <TableHead className="text-right">صفحات</TableHead>
                      <TableHead className="text-right">زمان ورود</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {session.is_logged_in ? (
                              <Badge variant="default" className="text-xs">عضو</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">مهمان</Badge>
                            )}
                            <span className="text-sm">
                              {session.user_info?.full_name || session.device_model || 'ناشناس'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {session.user_info?.phone_number || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {session.ip_address || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getDeviceIcon(session.device_type)}
                            <span className="text-sm">{session.device_type || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getOSLabel(session.os_name)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(session.total_duration_seconds || 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.total_page_views?.toLocaleString('fa-IR') || '0'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(session.started_at), 'HH:mm - yyyy/MM/dd', { locale: faIR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSessions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          داده‌ای موجود نیست
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">رویدادهای صفحات</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">نوع</TableHead>
                      <TableHead className="text-right">صفحه</TableHead>
                      <TableHead className="text-right">کاربر</TableHead>
                      <TableHead className="text-right">زمان</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 100).map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant={
                            event.event_type === 'login' ? 'default' :
                            event.event_type === 'logout' ? 'secondary' :
                            'outline'
                          }>
                            {event.event_type === 'page_view' ? 'بازدید' :
                             event.event_type === 'login' ? 'ورود' :
                             event.event_type === 'logout' ? 'خروج' :
                             event.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-[200px] truncate">
                          {event.page_url || event.page_title || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.user_info?.full_name || event.user_info?.phone_number || 'مهمان'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(event.created_at), 'HH:mm:ss', { locale: faIR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          داده‌ای موجود نیست
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <div className="grid md:grid-cols-3 gap-4">
            {stats && Object.entries(stats.deviceBreakdown).map(([device, count]) => (
              <Card key={device} className="text-center">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-2">
                    {device === 'mobile' && <Smartphone className="h-12 w-12 text-primary" />}
                    {device === 'tablet' && <Tablet className="h-12 w-12 text-primary" />}
                    {device === 'desktop' && <Monitor className="h-12 w-12 text-primary" />}
                    <h3 className="text-lg font-semibold">
                      {device === 'mobile' ? 'موبایل' :
                       device === 'tablet' ? 'تبلت' :
                       device === 'desktop' ? 'دسکتاپ' : device}
                    </h3>
                    <p className="text-3xl font-bold text-primary">
                      {count.toLocaleString('fa-IR')}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      نشست
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!stats || Object.keys(stats.deviceBreakdown).length === 0) && (
              <Card className="col-span-3">
                <CardContent className="py-12 text-center text-muted-foreground">
                  داده‌ای موجود نیست
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
