import { useState } from 'react';
import { Globe } from 'lucide-react';
import InteractiveGlobe from '@/components/globe/InteractiveGlobe';
import globeIcon from '@/assets/globe-icon.png';

const Index = () => {
  const [showGlobe, setShowGlobe] = useState(false);

  if (showGlobe) {
    return <InteractiveGlobe onClose={() => setShowGlobe(false)} />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-4 text-5xl font-bold text-white drop-shadow-lg md:text-6xl">
            به سیستم مدیریت اهرم خوش آمدید
          </h1>
          <p className="text-xl text-white/90 drop-shadow-md md:text-2xl mb-8">
            مدیریت هوشمند پروژه‌های ساختمانی و داربست
          </p>
          
          {/* Globe Button */}
          <button
            onClick={() => setShowGlobe(true)}
            className="group relative inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <img 
              src={globeIcon} 
              alt="Globe" 
              className="w-8 h-8 transition-transform duration-300 group-hover:rotate-12"
            />
            <span className="text-lg font-semibold">
              نمایش پروژه‌ها روی کره زمین
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
