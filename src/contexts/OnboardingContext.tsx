import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_KEY = 'ahrom-onboarding-completed';

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'به سامانه اهرم خوش آمدید!',
      description: 'ما شما را با قابلیت‌های سیستم آشنا می‌کنیم',
      position: 'center'
    },
    {
      id: 'navigation',
      title: 'منوی اصلی',
      description: 'از این منو می‌توانید به تمام بخش‌های سیستم دسترسی داشته باشید',
      target: '[data-tour="sidebar-trigger"]',
      position: 'left'
    },
    {
      id: 'create-project',
      title: 'ایجاد پروژه',
      description: 'برای شروع، پروژه جدید ایجاد کنید و سفارش خود را ثبت کنید',
      target: '[data-tour="create-project"]',
      position: 'bottom'
    },
    {
      id: 'profile',
      title: 'پروفایل کاربری',
      description: 'اطلاعات شخصی و سفارشات خود را در پروفایل مشاهده کنید',
      target: '[data-tour="profile"]',
      position: 'bottom'
    },
    {
      id: 'guide',
      title: 'راهنمای صفحات',
      description: 'در پروفایل می‌توانید راهنمای صفحات را فعال کنید تا در هر صفحه راهنمایی مختصر ببینید',
      target: '[data-tour="profile"]',
      position: 'bottom'
    },
    {
      id: 'complete',
      title: 'آماده شروع هستید!',
      description: 'اکنون می‌توانید از تمام امکانات سیستم استفاده کنید',
      position: 'center'
    }
  ];

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasCompletedOnboarding) {
      // کمی تاخیر برای بارگذاری کامل صفحه
      setTimeout(() => {
        setIsActive(true);
      }, 1000);
    }
  }, []);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTour = () => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const completeTour = () => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};
