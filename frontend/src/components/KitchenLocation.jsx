import './a-la-carte.css';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { locate } from '../services/geolocation';

export default function KitchenLocation({value, onChange, disabled}) {
  const t = useTranslation(), generation = useRef(0);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  useEffect(() => () => {generation.current++;}, []);
  async function fill() {
    const request = ++generation.current; setBusy(true);setError('');
    try { const found = await locate(); if (generation.current === request) {onChange({latitude:found.latitude,longitude:found.longitude});} }
    catch(e) {if (generation.current === request) setError(e.message);}
    finally {if (generation.current === request) setBusy(false);}
  }
  return <fieldset className="form-wide kitchen-location"><legend>{t('Kitchen location')}</legend><p>{t('Save the kitchen location so nearby customers can find your mess. Check these coordinates before saving.')}</p><div className="form-actions"><button type="button" className="btn btn-outline" disabled={disabled || busy} onClick={fill}>{t(busy ? 'Finding location…' : 'Use current location')}</button><button type="button" className="btn btn-outline" disabled={disabled} onClick={() => {generation.current++;setBusy(false);setError('');onChange({latitude:null,longitude:null});}}>{t('Clear location')}</button></div>
    <div className="form-actions">{[['latitude','Latitude',-90,90],['longitude','Longitude',-180,180]].map(([key,label,min,max]) => <label className="form-field" key={key}>{t(label)}<input type="number" step="any" min={min} max={max} disabled={disabled || busy} required={value.latitude != null || value.longitude != null} value={value[key] ?? ''} onChange={e => onChange({...value,[key]:e.target.value === '' ? null : Number(e.target.value)})} /></label>)}</div>
    {error && <p role="alert" className="alert error">{t(error)}</p>}
  </fieldset>;
}
