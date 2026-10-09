import { useEffect, useState } from "react";
import { LanguageContext } from "./LanguageContext";
export default function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("mess-language") === "hi" ? "hi" : "en");
  useEffect(() => {
    localStorage.setItem("mess-language", language);
    document.documentElement.lang = language;
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>
    <div className="language-toolbar"><label htmlFor="site-language">भाषा / Language</label><select id="site-language" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></div>
    {children}
  </LanguageContext.Provider>;
}
