const Index = () => {
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
          <p className="text-xl text-white/90 drop-shadow-md md:text-2xl">
            مدیریت هوشمند پروژه‌های ساختمانی و داربست
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
