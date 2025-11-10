import { useState, useEffect } from "react";
import { Phone, Smartphone, Building, ChevronDown, MessageSquare, User, LogOut, Award, TrendingUp, ShoppingCart, FolderKanban, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ahromLogo from "@/assets/ahrom-logo.png";
import contactButton from "@/assets/contact-button.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useGeneralManagerRole } from "@/hooks/useGeneralManagerRole";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";

const Header = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user || null;
  const { isGeneralManager } = useGeneralManagerRole();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const displayName = profile?.full_name || (user?.email ? user.email.split("@")[0] : "پروفایل");
  
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
const [profileDropdownOpenMobile, setProfileDropdownOpenMobile] = useState(false);
const [profileDropdownOpenDesktop, setProfileDropdownOpenDesktop] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-lg">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Mobile & Tablet Layout - Two Rows */}
        <div className="md:hidden">
          {/* First Row: Logo, Company Name (Centered), Contact */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-0.5 border-b border-border/30 px-1">
            {/* Logo - Right side (RTL) */}
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src={ahromLogo} 
                alt="لوگوی اهرم" 
                width="140"
                height="80"
                className="h-11 sm:h-12 w-auto object-contain"
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
              <DropdownMenu open={contactDropdownOpen} onOpenChange={setContactDropdownOpen}>
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

          {/* Second Row: Auth Buttons, Notifications - Horizontal Layout */}
          <div className="flex items-center justify-end gap-2 py-0.5 pr-2">
            {user ? (
              <>
                <div data-tour="notifications">
                  <NotificationBell />
                </div>
                <Button
                  data-tour="ratings"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/ratings/test")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                >
                  <Award className="h-3 w-3" />
                  <span className="text-xs sm:text-sm">امتیازات</span>
                </Button>
                <Button
                  data-tour="top-users"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/ratings/top-users")}
                  className="gap-2 border-green-500/30 hover:border-green-500 bg-green-500/5 hover:bg-green-500/10 text-green-600"
                >
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs sm:text-sm">برترین‌ها</span>
                </Button>
                <DropdownMenu open={profileDropdownOpenMobile} onOpenChange={setProfileDropdownOpenMobile}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-tour="profile"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                    >
                      <User className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">اهرم من</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border shadow-xl z-50 min-w-[180px]">
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/profile"), 150);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span>پروفایل من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/user/my-orders"), 150);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span>سفارشات من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/user/projects"), 150);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <FolderKanban className="h-4 w-4 text-green-600" />
                      <span>پروژه‌های من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        setTimeout(() => navigate("/tickets"), 150);
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <MessageCircle className="h-4 w-4 text-orange-600" />
                      <span>تیکت‌ها</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenMobile(false);
                        handleSignOut();
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

        {/* Desktop Layout - Two Rows */}
        <div className="hidden md:block">
          {/* First Row: Logo, Company Name, Contact - Symmetrical */}
          <div className="grid grid-cols-3 items-center py-1 border-b border-border/50">
            {/* Logo - Right side (RTL) */}
            <div className="flex justify-end">
              <div className="cursor-pointer md:translate-x-4 lg:translate-x-6 xl:translate-x-0" onClick={() => navigate('/')}>
                <img 
                  src={ahromLogo} 
                  alt="لوگوی اهرم" 
                  width="140"
                  height="80"
                  className="h-20 w-auto object-contain"
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
            
            {/* Contact Dropdown & Notification - Left side (RTL) */}
            <div className="flex items-center gap-4 justify-start">
              <DropdownMenu open={contactDropdownOpen} onOpenChange={setContactDropdownOpen}>
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

          {/* Second Row: Login/Register - Right aligned */}
          <div className="flex items-center justify-end gap-4 py-1 pr-4">
            {user ? (
              <>
                <div data-tour="notifications">
                  <NotificationBell />
                </div>
                <Button
                  data-tour="ratings"
                  variant="outline"
                  onClick={() => navigate("/ratings/test")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                >
                  <Award className="h-4 w-4" />
                  <span>سیستم امتیازدهی</span>
                </Button>
                <Button
                  data-tour="top-users"
                  variant="outline"
                  onClick={() => navigate("/ratings/top-users")}
                  className="gap-2 border-green-500/30 hover:border-green-500 bg-green-500/5 hover:bg-green-500/10 text-green-600 font-medium"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>برترین کاربران</span>
                </Button>
                <DropdownMenu open={profileDropdownOpenDesktop} onOpenChange={setProfileDropdownOpenDesktop}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-tour="profile"
                      variant="outline"
                      className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                    >
                      <User className="h-4 w-4" />
                      <span>اهرم من</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border shadow-xl z-50 min-w-[200px]">
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/profile"), 150);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span>پروفایل من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/user/my-orders"), 150);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      <span>سفارشات من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/user/projects"), 150);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <FolderKanban className="h-4 w-4 text-green-600" />
                      <span>پروژه‌های من</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        setTimeout(() => navigate("/tickets"), 150);
                      }}
                      className="cursor-pointer gap-3 p-3"
                    >
                      <MessageCircle className="h-4 w-4 text-orange-600" />
                      <span>تیکت‌ها</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setProfileDropdownOpenDesktop(false);
                        handleSignOut();
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
  );
};

export default Header;