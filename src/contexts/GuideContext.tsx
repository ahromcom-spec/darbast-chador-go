import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

interface GuideContextType {
  isGuideEnabled: boolean;
  toggleGuide: () => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export const GuideProvider = ({ children }: { children: ReactNode }) => {
  const [isGuideEnabled, setIsGuideEnabled] = useState(() => {
    const saved = localStorage.getItem('guide-enabled');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('guide-enabled', isGuideEnabled.toString());
  }, [isGuideEnabled]);

  const toggleGuide = useCallback(() => {
    setIsGuideEnabled(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    isGuideEnabled,
    toggleGuide
  }), [isGuideEnabled, toggleGuide]);

  return (
    <GuideContext.Provider value={value}>
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = () => {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within GuideProvider');
  }
  return context;
};
