import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { translateText } from './translate';
export function useTranslation() {
  const { i18n } = useI18nextTranslation();
  const language = i18n.resolvedLanguage || 'en';
  return Object.assign(value => translateText(value, language), {locale:language==='hi'?'hi-IN':'en-IN'});
}
