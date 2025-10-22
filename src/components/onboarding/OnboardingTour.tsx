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
    return 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[92vw] max-w-md mx-2';
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
        <div className="bg-card border-2 border-primary/30 rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-4 sm:p-6 relative flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="absolute left-2 top-2 h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/20"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            
            <div className="flex items-start gap-2 sm:gap-3 mb-2 pr-0">
              <div className="p-1.5 sm:p-2 rounded-full bg-primary/20 animate-pulse flex-shrink-0">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <h3 className="text-base sm:text-xl font-bold text-foreground leading-tight">
                {currentStepData.title}
              </h3>
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pr-0 max-h-[40vh] overflow-y-auto">
              {currentStepData.description}
            </p>
          </div>

          {/* Footer با دکمه‌ها */}
          <div className="p-3 sm:p-4 bg-background/50 flex items-center justify-between flex-shrink-0 gap-2">
            <div className="flex gap-0.5 sm:gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-6 sm:w-8 bg-primary'
                      : index < currentStep
                      ? 'w-1 sm:w-1.5 bg-primary/50'
                      : 'w-1 sm:w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-1.5 sm:gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
                >
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">قبلی</span>
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={nextStep}
                className="gap-1 sm:gap-2 bg-primary hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9"
              >
                <span>{currentStep === steps.length - 1 ? 'شروع' : 'بعدی'}</span>
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
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
