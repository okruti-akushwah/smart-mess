import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageContext } from './LanguageContext';
import './i18n';
export default function LanguageProvider({children}) {
  const {i18n} = useTranslation();
  const language = i18n.resolvedLanguage === 'hi' ? 'hi' : 'en';
  const setLanguage = value => i18n.changeLanguage(value === 'hi' ? 'hi' : 'en');
  useEffect(() => {
    try {localStorage.setItem('mess-language',language);} catch { /* Storage can be disabled. */ }
    document.documentElement.lang=language;
  },[language]);
  return <LanguageContext.Provider value={{language,setLanguage}}>
    <div className="language-toolbar"><label htmlFor="site-language">भाषा / Language</label><select id="site-language" value={language} onChange={event=>setLanguage(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></div>
    {children}
  </LanguageContext.Provider>;
}
