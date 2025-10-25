import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  navigateTo?: string; // مسیر صفحه برای نمایش
  waitForElement?: boolean; // منتظر بمان تا المان در دسترس باشد
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
      title: 'به سامانه اهرم خوش آمدید! 🎉',
      description: 'سامانه مدیریت خدمات ساختمانی و منزل. در مراحل بعدی با امکانات مهم سایت آشنا می‌شوید. هر بخش به طور دقیق برایتان نمایش داده خواهد شد.',
      position: 'center'
    },
    {
      id: 'notifications',
      title: 'اعلان‌ها 🔔',
      description: 'از اینجا می‌توانید اعلان‌های مربوط به سفارشات و پروژه‌های خود را مشاهده کنید. وضعیت تایید سفارش، پیام‌های سیستم و تغییرات مهم از این طریق اطلاع داده می‌شود.',
      target: '[data-tour="notifications"]',
      position: 'bottom',
      waitForElement: true
    },
    {
      id: 'ratings',
      title: 'امتیازدهی ⭐',
      description: 'سیستم امتیازدهی: در این بخش می‌توانید به پیمانکاران امتیاز دهید و امتیازات خود را مشاهده کنید. این امتیازات به بهبود کیفیت خدمات کمک می‌کند.',
      target: '[data-tour="ratings"]',
      position: 'bottom',
      waitForElement: true
    },
    {
      id: 'profile',
      title: 'پروفایل کاربری 👤',
      description: 'با کلیک روی این آیکون به صفحه پروفایل خود می‌روید و می‌توانید اطلاعات شخصی، سوابق سفارشات و تنظیمات حساب کاربری را مدیریت کنید.',
      target: '[data-tour="profile"]',
      position: 'bottom',
      waitForElement: true
    },
    {
      id: 'create-project',
      title: 'ایجاد پروژه جدید 📋',
      description: 'برای شروع، نوع خدمات مورد نیاز خود را انتخاب کنید. سپس می‌توانید پروژه جدید ایجاد کرده و سفارش خود را ثبت نمایید. این بخش در صفحه اصلی قرار دارد.',
      target: '[data-tour="create-project"]',
      position: 'bottom',
      navigateTo: '/',
      waitForElement: true
    },
    {
      id: 'my-orders',
      title: 'سفارشات من 📦',
      description: 'در این بخش لیست تمام سفارشات ثبت شده و وضعیت آن‌ها را مشاهده می‌کنید. سفارشات می‌توانند در حالت "در انتظار تایید"، "تایید شده" یا "رد شده" باشند.',
      navigateTo: '/user/profile',
      target: '[data-tour="my-orders"]',
      position: 'right',
      waitForElement: true
    },
    {
      id: 'my-projects',
      title: 'پروژه‌های من 🏗️',
      description: 'تمام پروژه‌های ایجاد شده شما در این بخش نمایش داده می‌شود. می‌توانید جزئیات هر پروژه، خدمات مربوط به آن و پیشرفت کار را مشاهده کنید.',
      navigateTo: '/user/profile',
      target: '[data-tour="my-projects"]',
      position: 'right',
      waitForElement: true
    },
    {
      id: 'complete',
      title: 'آماده شروع هستید! ✅',
      description: 'تبریک! اکنون با امکانات اصلی سیستم آشنا شدید. برای سفارش خدمات، ابتدا نوع خدمات را انتخاب کرده و سپس پروژه خود را ثبت نمایید.',
      position: 'center',
      navigateTo: '/'
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

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const value = useMemo(() => ({
    isActive,
    currentStep,
    steps,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  }), [isActive, currentStep, steps, startTour, nextStep, prevStep, skipTour, completeTour]);

  return (
    <OnboardingContext.Provider value={value}>
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
