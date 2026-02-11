import { useState } from 'react';
import InteractiveGlobe from '@/components/globe/InteractiveGlobe';
import goldenGlobe from '@/assets/golden-globe-rotating.png';
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar';
import Snowfall from '@/components/effects/Snowfall';
import { ModuleShortcuts } from '@/components/home/ModuleShortcuts';

const Index = () => {
  const [showGlobe, setShowGlobe] = useState(false);

  if (showGlobe) {
    return <InteractiveGlobe onClose={() => setShowGlobe(false)} />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* افکت برف‌ریزی زمستانی */}
      <Snowfall />
      {/* آواتار دستیار هوشمند */}
      <AssistantAvatar />
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
        <div className="text-center space-y-8">
          <h1 className="mb-4 text-5xl font-bold text-white drop-shadow-lg md:text-6xl">
            به سیستم مدیریت اهرم خوش آمدید
          </h1>
          <p className="text-xl text-white/90 drop-shadow-md md:text-2xl">
            مدیریت هوشمند پروژه‌های ساختمانی و داربست
          </p>
          
          {/* کره زمین با انیمیشن چرخشی */}
          <div className="flex justify-center my-12">
            <img 
              src={goldenGlobe} 
              alt="کره زمین طلایی" 
              className="w-64 h-64 md:w-80 md:h-80 animate-[wiggle_3s_ease-in-out_infinite] drop-shadow-2xl outline-none select-none pointer-events-none"
            />
          </div>
          
          {/* Module Shortcuts */}
          <ModuleShortcuts />

          {/* Globe Button */}
          <button
            onClick={() => setShowGlobe(true)}
            className="group relative inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-0"
          >
            <span className="text-lg font-semibold">
              نمایش پروژه‌ها روی کره زمین
            </span>
          </button>
        </div>
      </div>

      {/* Enamad Trust Seal */}
      <div className="absolute bottom-4 left-4 z-20">
        <a 
          referrerPolicy="origin" 
          target="_blank" 
          href="https://trustseal.enamad.ir/?id=367671&Code=hwPDIxFj5XA7YNrVda7i"
          rel="noopener noreferrer"
        >
          <img 
            referrerPolicy="origin" 
            src="https://trustseal.enamad.ir/logo.aspx?id=367671&Code=hwPDIxFj5XA7YNrVda7i" 
            alt="نماد اعتماد الکترونیکی" 
            className="w-20 h-20 cursor-pointer hover:opacity-80 transition-opacity"
          />
        </a>
      </div>
    </div>
  );
};

export default Index;
