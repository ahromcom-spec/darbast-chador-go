import { Phone, Smartphone, Building, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ahromLogo from "@/assets/ahrom-logo.png";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo - Left side in RTL */}
          <div className="flex-shrink-0">
            <img 
              src={ahromLogo} 
              alt="لوگوی اهرم" 
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Company Name - Center */}
          <div className="flex-1 text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground font-vazir bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              خدمات ساختمانی اهرم
            </h1>
          </div>
          
          {/* Contact Section - Right side in RTL */}
          <div className="flex items-center gap-6">
            {/* Primary Phone - Desktop */}
            <div className="hidden md:flex items-center gap-3">
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
        
        {/* Mobile Layout */}
        <div className="md:hidden mt-4 pt-4 border-t border-border/50">
          <div className="flex flex-col items-center space-y-4">
            {/* Primary Phone - Mobile */}
            <a 
              href="tel:90000319" 
              className="flex items-center gap-3 px-6 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all duration-300 group border border-primary/20 w-full max-w-xs justify-center"
              title="تماس فوری"
            >
              <Phone className="h-5 w-5 group-hover:animate-pulse" />
              <div className="text-center">
                <div className="text-sm font-medium">تلفن خدماتی اهرم</div>
                <div className="text-lg font-bold">90000319</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;