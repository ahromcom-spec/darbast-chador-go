import { Phone, Smartphone, Building, ChevronDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ahromLogo from "@/assets/ahrom-logo.png";
import { StaffRegistrationButton } from "@/components/staff/StaffRegistrationButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useState } from "react";
import { StaffRequestDialog } from "@/components/staff/StaffRequestDialog";

const Header = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user || null;
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Mobile & Tablet Layout */}
        <div className="flex md:hidden items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src={ahromLogo} 
              alt="لوگوی اهرم" 
              width="140"
              height="80"
              className="h-12 sm:h-14 w-auto object-contain"
              loading="eager"
            />
            <h1 className="text-base sm:text-lg font-bold text-foreground font-vazir bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              خدمات ساختمانی اهرم
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {user && (
              <>
                <NotificationBell />
                <StaffRegistrationButton onClick={() => setStaffDialogOpen(true)} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/tickets")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">تیکت‌ها</span>
                </Button>
              </>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">تماس</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
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
                    href="tel:09125511494" 
                    className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                  >
                    <Smartphone className="h-4 w-4 text-primary" />
                    <div className="text-right">
                      <div className="font-medium">موبایل</div>
                      <div className="text-sm text-muted-foreground">09125511494</div>
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

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          {/* Logo - Left side */}
          <div className="flex-shrink-0 cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src={ahromLogo} 
              alt="لوگوی اهرم" 
              width="140"
              height="80"
              className="h-20 w-auto object-contain"
              loading="eager"
            />
          </div>

          {/* Company Name - Center */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground font-vazir bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              خدمات ساختمانی اهرم
            </h1>
          </div>
          
          {/* Contact & Tickets Section - Right side */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <NotificationBell />
                <StaffRegistrationButton onClick={() => setStaffDialogOpen(true)} />
                <Button
                  variant="outline"
                  onClick={() => navigate("/tickets")}
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>تیکت‌های پشتیبانی</span>
                </Button>
              </>
            )}
            {/* Primary Phone - Desktop */}
            <div className="flex items-center gap-3">
              <a 
                href="tel:90000319" 
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all duration-300 group border border-primary/20 hover:border-primary/40"
                title="تماس فوری"
              >
                <Phone className="h-4 w-4 group-hover:animate-pulse" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">تلفن خدماتی اهرم</div>
                  <div className="font-bold">90000319</div>
                </div>
              </a>
            </div>

            {/* Contact Us Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-medium px-4 py-2 h-auto"
                >
                  <Phone className="h-4 w-4" />
                  <span>تماس با ما</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
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
                      href="tel:09125511494" 
                      className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded-md p-3 transition-colors"
                    >
                      <Smartphone className="h-4 w-4 text-primary" />
                      <div className="text-right">
                        <div className="font-medium">موبایل</div>
                        <div className="text-sm text-muted-foreground">09125511494</div>
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
      
      {/* Staff Request Dialog */}
      <StaffRequestDialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen} />
    </header>
  );
};

export default Header;