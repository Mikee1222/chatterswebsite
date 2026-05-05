'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface MobileFabVisibilityContextType {
  isHidden: boolean;
  setIsHidden: (hidden: boolean) => void;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
}

const MobileFabVisibilityContext = createContext<MobileFabVisibilityContextType | undefined>(undefined);

export function MobileFabVisibilityProvider({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  return (
    <MobileFabVisibilityContext.Provider value={{ isHidden, setIsHidden, isVisible, setIsVisible }}>
      {children}
    </MobileFabVisibilityContext.Provider>
  );
}

export function useMobileFabHidden(): boolean {
  const context = useContext(MobileFabVisibilityContext);
  if (context === undefined) {
    throw new Error('useMobileFabHidden must be used within MobileFabVisibilityProvider');
  }
  return context.isHidden;
}

export function useMobileFabVisibility() {
  const context = useContext(MobileFabVisibilityContext);
  if (context === undefined) {
    throw new Error('useMobileFabVisibility must be used within MobileFabVisibilityProvider');
  }
  return {
    isVisible: context.isVisible,
    setIsVisible: context.setIsVisible,
    setMobileFabHidden: context.setIsHidden,
  };
}
