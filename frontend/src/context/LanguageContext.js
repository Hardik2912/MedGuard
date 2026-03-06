import React, { createContext, useContext, useMemo, useState } from 'react';

import en from '../translations/en.json';
import hi from '../translations/hi.json';
import ta from '../translations/ta.json';
import te from '../translations/te.json';
import kn from '../translations/kn.json';
import bn from '../translations/bn.json';
import mr from '../translations/mr.json';
import pa from '../translations/pa.json';
import gu from '../translations/gu.json';
import bho from '../translations/bho.json';

const translations = {
  en,
  hi,
  ta,
  te,
  kn,
  bn,
  mr,
  pa,
  gu,
  bho,
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  const value = useMemo(() => {
    const current = translations[language] || translations.en;
    const t = (key) => current?.[key] || translations.en?.[key] || key;
    return {
      language,
      setLanguage,
      t,
      translations,
    };
  }, [language]);

  return React.createElement(
    LanguageContext.Provider,
    { value },
    children
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return ctx;
}
