import { useEffect, useState } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

export const OnboardingTour = () => {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } = useOnboarding();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'center'>('center');

  const currentStepData = steps[currentStep];

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    if (currentStepData.target) {
      const element = document.querySelector(currentStepData.target) as HTMLElement;
      if (element) {
        const rect = element.getBoundingClientRect();
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.left + rect.width / 2,
        });
        setTooltipPosition(currentStepData.position || 'bottom');

        // اسکرول به المان
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // اضافه کردن highlight
        element.classList.add('onboarding-highlight');
        return () => {
          element.classList.remove('onboarding-highlight');
        };
      }
    } else {
      // مرکز صفحه
      setPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
      });
      setTooltipPosition('center');
    }
  }, [isActive, currentStep, currentStepData]);

  if (!isActive || !currentStepData) return null;

  const getTooltipStyles = () => {
    // همیشه در وسط صفحه برای دسترسی آسان در موبایل
    return 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90vw] max-w-md';
  };

  return (
    <>
      {/* Backdrop با تاریکی ملایم */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-fade-in"
        onClick={skipTour}
      />

      {/* Spotlight برای هایلایت المان - با pointer-events-none برای عدم مسدود کردن کلیک */}
      {currentStepData.target && (
        <div
          className="fixed pointer-events-none z-[9997] transition-all duration-300"
          style={{
            top: position.top - 60,
            left: position.left - 60,
            width: 120,
            height: 120,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '12px',
          }}
        />
      )}

      {/* Tooltip با محتوا */}
      <div className={getTooltipStyles()}>
        <div className="bg-card border-2 border-primary/30 rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="absolute left-2 top-2 h-8 w-8 p-0 hover:bg-primary/20"
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/20 animate-pulse">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {currentStepData.title}
              </h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed pr-8">
              {currentStepData.description}
            </p>
          </div>

          {/* Footer با دکمه‌ها */}
          <div className="p-4 bg-background/50 flex items-center justify-between">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-primary'
                      : index < currentStep
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  قبلی
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={nextStep}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {currentStep === steps.length - 1 ? 'شروع' : 'بعدی'}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* استایل برای highlight */}
      <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 9999 !important;
          animation: pulse-highlight 2s ease-in-out infinite;
        }

        @keyframes pulse-highlight {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(var(--primary), 0.7);
          }
          50% {
            box-shadow: 0 0 0 15px rgba(var(--primary), 0);
          }
        }
      `}</style>
    </>
  );
};
