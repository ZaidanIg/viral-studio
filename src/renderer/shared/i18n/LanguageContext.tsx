// src/shared/i18n/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageCode, TranslationStrings } from './types';
import { translations } from './languages';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: TranslationStrings;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'zeoStudio.language';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && ['en', 'id', 'ms', 'pt', 'es', 'fr', 'ru'].includes(stored)) {
          return stored as LanguageCode;
        }
      } catch (error) {
        console.error('Failed to load language from localStorage:', error);
      }
    }
    return DEFAULT_LANGUAGE;
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (error) {
        console.error('Failed to save language to localStorage:', error);
      }
    }
  };

  // Use useMemo to recompute translations when language changes
  const t = React.useMemo(() => translations[language], [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
