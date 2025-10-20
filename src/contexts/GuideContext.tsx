import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

  const toggleGuide = () => {
    setIsGuideEnabled(prev => !prev);
  };

  return (
    <GuideContext.Provider value={{ isGuideEnabled, toggleGuide }}>
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
