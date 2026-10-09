import { useContext } from "react";
import { LanguageContext } from "./LanguageContext";
import { translateText } from "./translate";
export function useTranslation() {
  const { language } = useContext(LanguageContext);
  return Object.assign(value => translateText(value, language), {
    locale: language === "hi" ? "hi-IN" : "en-IN"
  });
}
