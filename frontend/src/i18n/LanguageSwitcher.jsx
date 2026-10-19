import { useContext, useId } from 'react';
import { LanguageContext } from './LanguageContext';

export default function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage } = useContext(LanguageContext);
  const id = useId();
  return <div className={`language-switcher${compact ? ' language-switcher--compact' : ''}`}><label htmlFor={id}>भाषा / Language</label><select id={id} aria-label="भाषा / Language" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></div>;
}
