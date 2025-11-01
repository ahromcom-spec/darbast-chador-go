import { Phone, Smartphone, Building, ChevronDown, MessageSquare, User, LogOut, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
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
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-3 border-b border-border/30 px-1">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-0 border-0 bg-transparent cursor-pointer hover:opacity-80 transition-opacity" aria-label="تماس">
                    <img 
                      src={contactButton} 
                      alt="تماس" 
                      className="h-11 sm:h-12 md:h-10 w-auto object-contain"
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
          <div className="flex items-center justify-end gap-2 py-2 pr-2">
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
                  data-tour="profile"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                >
                  <User className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{displayName}</span>
                </Button>
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
          <div className="grid grid-cols-3 items-center py-4 border-b border-border/50">
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
              <DropdownMenu>
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
          <div className="flex items-center justify-end gap-4 py-3 pr-4">
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
                  data-tour="profile"
                  variant="outline"
                  onClick={() => navigate("/profile")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                >
                  <User className="h-4 w-4" />
                  <span>{displayName}</span>
                </Button>
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