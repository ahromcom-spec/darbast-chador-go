import ahromLogo from "@/assets/ahrom-logo.png";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Company Name - Right side in RTL */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-vazir">
            خدمات ساختمانی اهرم
          </h1>
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