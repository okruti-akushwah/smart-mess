import { translateText } from "../i18n/translate";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSaved } from '../services/dynamicTranslations';
export default function DynamicText({kind,id,field,source,override}) {
  const {i18n}=useTranslation();
  const language=i18n.resolvedLanguage;
  const key=JSON.stringify([kind,id,field,source]);
  const [result,setResult]=useState(null);
  useEffect(()=>{
    if(language!=='hi'||translateText(source,language)!==source||override||!id||typeof source!=='string'||!source.trim())return undefined;
    let active=true;
    translateSaved({kind,id,field},source).then(text=>{if(active)setResult({key,text});});
    return()=>{active=false;};
  },[language,kind,id,field,source,override,key]);
  if(language!=='hi')return source;
  return translateText(override || (result?.key===key ? result.text : source), language);
}
