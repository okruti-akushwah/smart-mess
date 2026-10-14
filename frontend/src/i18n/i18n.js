import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { dictionary } from './hi.js';
import { extraHindi } from './extraHindi.js';
export const normalise = value => value.replace(/\s+/g, ' ').trim().replace(/[’‘]/g, "'").replace(/…/g, '...');
const hindi = Object.fromEntries(Object.entries({...dictionary, ...extraHindi}).map(([key,value]) => [normalise(key), value.replace(/ग्राहक/g,'सदस्य')]));
const english = Object.fromEntries(Object.keys(hindi).map(key => [key,key]));
let language='en';
try {if (globalThis.localStorage?.getItem('mess-language') === 'hi') language='hi';} catch { /* Storage can be disabled. */ }
i18next.use(initReactI18next).init({resources:{en:{translation:english},hi:{translation:hindi}},lng:language,supportedLngs:['en','hi'],fallbackLng:'en',keySeparator:false,nsSeparator:false,initAsync:false,interpolation:{escapeValue:false},react:{useSuspense:false}});
export default i18next;
