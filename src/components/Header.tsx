import { Phone, Smartphone, Building } from "lucide-react";
import ahromLogo from "@/assets/ahrom-logo.png";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Company Name and Contact Info - Right side in RTL */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-vazir">
            خدمات ساختمانی اهرم
          </h1>
          {/* Contact Numbers */}
          <div className="flex flex-wrap gap-4 mt-2">
            <a 
              href="tel:90000319" 
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group"
              title="تماس با ما"
            >
              <Phone className="h-3 w-3 group-hover:animate-pulse" />
              <span className="text-sm font-medium">90000319</span>
            </a>
            <a 
              href="tel:09125511494" 
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group"
              title="موبایل"
            >
              <Smartphone className="h-3 w-3 group-hover:animate-pulse" />
              <span className="text-sm font-medium">09125511494</span>
            </a>
            <a 
              href="tel:02538865040" 
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group"
              title="دفتر"
            >
              <Building className="h-3 w-3 group-hover:animate-pulse" />
              <span className="text-sm font-medium">02538865040</span>
            </a>
          </div>
        </div>
        
        {/* Logo - Left side in RTL */}
        <div className="flex-shrink-0 mr-6">
          <img 
            src={ahromLogo} 
            alt="لوگوی اهرم" 
            className="h-14 w-auto object-contain"
          />
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden container mx-auto px-4 pb-4">
        <div className="flex flex-col items-center space-y-3">
          <h1 className="text-xl font-bold text-foreground font-vazir text-center">
            خدمات ساختمانی اهرم
          </h1>
          {/* Contact Numbers - Mobile */}
          <div className="flex flex-col gap-2 text-center">
            <a 
              href="tel:90000319" 
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors group justify-center"
              title="تماس با ما"
            >
              <Phone className="h-4 w-4 group-hover:animate-pulse" />
              <span className="text-base font-medium">90000319</span>
            </a>
            <div className="flex gap-4 justify-center">
              <a 
                href="tel:09125511494" 
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group"
                title="موبایل"
              >
                <Smartphone className="h-3 w-3 group-hover:animate-pulse" />
                <span className="text-sm font-medium">09125511494</span>
              </a>
              <a 
                href="tel:02538865040" 
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors group"
                title="دفتر"
              >
                <Building className="h-3 w-3 group-hover:animate-pulse" />
                <span className="text-sm font-medium">02538865040</span>
              </a>
            </div>
          </div>
          <img 
            src={ahromLogo} 
            alt="لوگوی اهرم" 
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;