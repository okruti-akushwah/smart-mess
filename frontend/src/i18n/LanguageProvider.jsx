import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { LanguageContext } from './LanguageContext';
import './i18n';
import LanguageSwitcher from './LanguageSwitcher';
export default function LanguageProvider({children}) {
  const {pathname} = useLocation();
  const {i18n} = useTranslation();
  const language = i18n.resolvedLanguage === 'hi' ? 'hi' : 'en';
  const setLanguage = value => i18n.changeLanguage(value === 'hi' ? 'hi' : 'en');
  const inWorkspace = /^\/(owner|customer)(\/|$)/.test(pathname) && !['/owner/login', '/owner/register'].includes(pathname);
  useEffect(() => {
    try {localStorage.setItem('mess-language',language);} catch { /* Storage can be disabled. */ }
    document.documentElement.lang=language;
  },[language]);
  return <LanguageContext.Provider value={{language,setLanguage,inWorkspace}}>
    <div className="language-toolbar"><LanguageSwitcher /></div>
    {children}
  </LanguageContext.Provider>;
}
