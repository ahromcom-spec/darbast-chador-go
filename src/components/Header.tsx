import { useState, useEffect, memo, useRef, useCallback } from "react";
import { Phone, Building, ChevronDown, User, LogOut, FolderKanban, MessageCircle, ShoppingCart, Receipt, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ahromLogo from "@/assets/ahrom-logo.png";
import contactButton from "@/assets/contact-button.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useToast } from "@/hooks/use-toast";
import { useZoom } from "@/contexts/ZoomContext";

const Header = memo(() => {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user || null;
  const { toast } = useToast();
  const { isWindows, zoomIn, zoomOut, resetZoom, zoomPercentage } = useZoom();
  
  // نمایش نام کاربر فقط وقتی لاگین شده
  const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "پروفایل");
  
  const [contactDropdownOpenMobile, setContactDropdownOpenMobile] = useState(false);
  const [contactDropdownOpenDesktop, setContactDropdownOpenDesktop] = useState(false);
  const [profileDropdownOpenMobile, setProfileDropdownOpenMobile] = useState(false);
  const [profileDropdownOpenDesktop, setProfileDropdownOpenDesktop] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Scroll hide functionality
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);


  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        
        // If at the top, always show header
        if (currentScrollY < 50) {
          setIsVisible(true);
        } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          // Scrolling down & past threshold - hide
          setIsVisible(false);
        } else if (currentScrollY < lastScrollY.current) {
          // Scrolling up - show
          setIsVisible(true);
        }
        
        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
      ticking.current = true;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Fetch user avatar and subscribe to changes
  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }

    const fetchAvatar = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      setAvatarUrl(data?.avatar_url || null);
    };
    
    fetchAvatar();

    // Subscribe to realtime changes on the profiles table
    const channel = supabase
      .channel(`profile-avatar-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'avatar_url' in payload.new) {
            setAvatarUrl(payload.new.avatar_url as string | null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  
  // بستن تمام منوهای کشویی هنگام تغییر مسیر
  const location = useLocation();
  useEffect(() => {
    setContactDropdownOpenMobile(false);
    setContactDropdownOpenDesktop(false);
    setProfileDropdownOpenMobile(false);
    setProfileDropdownOpenDesktop(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await auth?.signOut();
      toast({
        title: 'خروج موفق',
        description: 'با موفقیت از سامانه خارج شدید'
      });
      navigate('/');
    } catch (error) {
      toast({
        title: 'خطا در خروج',
        description: 'مشکلی در خروج از سامانه پیش آمد',
        variant: 'destructive'
      });
    }
  };

  // Calculate the height of the first header for smooth positioning
  const firstHeaderHeight = isVisible ? 0 : -80; // Approximate height in pixels

  // Hide header when on globe page
  if (location.pathname === '/globe') {
    return null;
  }

  const ZoomControls = isWindows ? (
    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/40 p-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={zoomOut}
        aria-label="کوچک‌نمایی ۱۵٪"
        title="کوچک‌نمایی ۱۵٪"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 rounded-full px-2 font-semibold tabular-nums"
        onClick={resetZoom}
        aria-label="بازنشانی زوم"
        title="بازنشانی زوم"
      >
        {zoomPercentage}%
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={zoomIn}
        aria-label="بزرگ‌نمایی ۱۵٪"
        title="بزرگ‌نمایی ۱۵٪"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ) : null;

  return (
    <>
      {/* First Header - Logo row - Slides up on scroll */}
      <div 
        className="bg-card/95 backdrop-blur-sm border-b border-border/30 shadow-sm transition-transform duration-300 ease-out"
        style={{ 
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          position: isVisible ? 'relative' : 'absolute',
          width: '100%',
          zIndex: 50
        }}
      >
        <div className="container mx-auto px-4 sm:px-6">
          {/* Mobile & Tablet Layout - First Row */}
          <div className="md:hidden">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-0.5 px-1">
              {/* Logo - Right side (RTL) */}
              <div className="cursor-pointer" onClick={() => navigate('/')}>
                <img 
                  src={ahromLogo} 
                  alt="لوگوی اهرم" 
                  width="126"
                  height="72"
                  className="h-10 sm:h-11 w-auto object-contain"
                  loading="eager"
                />
              </div>

              {/* Company Name - Center */}
              <div className="flex justify-center">
                <h1 className="text-sm sm:text-base font-black text-foreground font-vazir bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent text-center">
                  خدمات ساختمانی و منزل اهرم
                </h1>
              </div>
              
              {/* Contact Button - Left side (RTL) */}
              <div className="flex items-center gap-1.5">
                <DropdownMenu modal={false} open={contactDropdownOpenMobile} onOpenChange={setContactDropdownOpenMobile}>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity" aria-label="تماس">
                      <img 
                        src={contactButton} 
                        alt="تماس" 
                        className="h-[50px] sm:h-[54px] md:h-10 w-auto object-contain"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-sm border shadow-xl z-50 min-w-[200px]">
                    <div className="p-2">
                      <div className="text-xs text-muted-foreground mb-2 text-center">راه‌های تماس</div>
                      <DropdownMenuItem asChild>
                        <a 
                          href="tel:90000319" 
                          className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                        >
                          <Phone className="h-4 w-4 text-primary" />
                          <div className="text-right">
                            <div className="font-medium">تلفن خدماتی اهرم</div>
                            <div className="text-sm text-muted-foreground">90000319</div>
                          </div>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a 
                          href="tel:02538865040" 
                          className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                        >
                          <Building className="h-4 w-4 text-primary" />
                          <div className="text-right">
                            <div className="font-medium">دفتر</div>
                            <div className="text-sm text-muted-foreground">02538865040</div>
                          </div>
                        </a>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Desktop Layout - First Row */}
          <div className="hidden md:block">
            <div className="grid grid-cols-3 items-center py-1">
              {/* Logo - Right side (RTL) */}
              <div className="flex justify-end">
                <div className="cursor-pointer md:translate-x-4 lg:translate-x-6 xl:translate-x-0" onClick={() => navigate('/')}>
                  <img 
                    src={ahromLogo} 
                    alt="لوگوی اهرم" 
                    width="126"
                    height="72"
                    className="h-12 lg:h-14 xl:h-16 w-auto object-contain"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Company Name - Center */}
              <div className="flex justify-center">
                <h1 className="text-xl md:text-2xl font-bold text-foreground font-vazir bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent whitespace-nowrap">
                  خدمات ساختمان و منزل اهرم
                </h1>
              </div>
              
              {/* Contact Dropdown - Left side (RTL) */}
              <div className="flex items-center gap-4 justify-start">
                <DropdownMenu modal={false} open={contactDropdownOpenDesktop} onOpenChange={setContactDropdownOpenDesktop}>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity md:-translate-x-6 lg:translate-x-0" aria-label="تماس">
                      <img 
                        src={contactButton} 
                        alt="تماس" 
                        className="h-28 w-auto object-contain"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-sm border shadow-xl z-50 min-w-[200px]">
                    <div className="p-2">
                      <div className="text-xs text-muted-foreground mb-2 text-center">راه‌های تماس</div>
                      <DropdownMenuItem asChild>
                        <a 
                          href="tel:90000319" 
                          className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                        >
                          <Phone className="h-4 w-4 text-primary" />
                          <div className="text-right">
                            <div className="font-medium">تلفن خدماتی اهرم</div>
                            <div className="text-sm text-muted-foreground">90000319</div>
                          </div>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a 
                          href="tel:02538865040" 
                          className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                        >
                          <Building className="h-4 w-4 text-primary" />
                          <div className="text-right">
                            <div className="font-medium">دفتر</div>
                            <div className="text-sm text-muted-foreground">02538865040</div>
                          </div>
                        </a>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Header - User menu row - Always visible and always on top */}
      <header className="sticky top-0 z-[60] bg-card/95 backdrop-blur-sm border-b border-border shadow-lg">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Mobile & Tablet Layout - Second Row */}
          <div className="md:hidden">
            <div className="flex items-center justify-end gap-2 py-0.5 pr-2">
            {user ? (
              <>
                {ZoomControls}
                <div data-tour="notifications">
                  <NotificationBell />
                </div>
                <DropdownMenu modal={false} open={profileDropdownOpenMobile} onOpenChange={setProfileDropdownOpenMobile}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-tour="profile"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {displayName?.charAt(0) || <User className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs sm:text-sm">اهرم من</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border shadow-xl z-50 min-w-[200px] mt-1">
                    <div className="px-3 py-3 border-b border-border/50 bg-primary/5">
                      <p className="text-sm font-semibold text-foreground leading-relaxed">{displayName}</p>
                      <p className="text-xs text-muted-foreground mt-1">اهرم من</p>
                    </div>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/profile"), 200);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span>پروفایل من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/user/projects"), 200);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <FolderKanban className="h-4 w-4 text-green-600" />
                      <span>پروژه‌های من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/profile?tab=orders"), 200);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span>سفارشات من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/profile?tab=invoice"), 200);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <Receipt className="h-4 w-4 text-purple-600" />
                      <span>صورتحساب من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/tickets"), 200);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <MessageCircle className="h-4 w-4 text-orange-600" />
                      <span>تیکت‌ها</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => handleSignOut(), 200);
                      }}
                      className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>خروج</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {ZoomControls}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/auth/login")}
                  className="gap-2"
                >
                  <span className="text-xs sm:text-sm">ورود</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth/register")}
                  className="gap-2"
                >
                  <span className="text-xs sm:text-sm">ثبت‌نام</span>
                </Button>
              </>
            )}
          </div>
        </div>

          {/* Desktop Layout - Second Row: Login/Register */}
          <div className="hidden md:block">
          <div className="flex items-center justify-end gap-4 py-1 pr-4">
            {user ? (
              <>
                {ZoomControls}
                <div data-tour="notifications">
                  <NotificationBell />
                </div>
                <DropdownMenu modal={false} open={profileDropdownOpenDesktop} onOpenChange={setProfileDropdownOpenDesktop}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-tour="profile"
                      variant="outline"
                      className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {displayName?.charAt(0) || <User className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                      <span>اهرم من</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border shadow-xl z-50 min-w-[220px] mt-1">
                    <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
                      <p className="text-sm font-semibold text-foreground leading-relaxed">{displayName}</p>
                      <p className="text-xs text-muted-foreground mt-1">اهرم من</p>
                    </div>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/profile"), 200);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span>پروفایل من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/user/projects"), 200);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <FolderKanban className="h-4 w-4 text-green-600" />
                      <span>پروژه‌های من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/profile?tab=orders"), 200);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span>سفارشات من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/profile?tab=invoice"), 200);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <Receipt className="h-4 w-4 text-purple-600" />
                      <span>صورتحساب من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/tickets"), 200);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <MessageCircle className="h-4 w-4 text-orange-600" />
                      <span>تیکت‌ها</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => handleSignOut(), 200);
                      }}
                      className="cursor-pointer gap-3 p-3 text-red-600 focus:text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>خروج</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {ZoomControls}

                <Button
                  onClick={() => navigate("/auth/register")}
                  className="gap-2 font-medium"
                >
                  <span>ثبت‌نام</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/auth/login")}
                  className="gap-2 font-medium"
                >
                  <span>ورود</span>
                </Button>
              </>
            )}
          </div>
        </div>
        </div>
      </header>
    </>
  );
});

Header.displayName = 'Header';

export default Header;