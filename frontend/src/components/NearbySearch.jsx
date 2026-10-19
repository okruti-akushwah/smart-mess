import './nearby-search.css';
import { useRef, useState, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { locate } from '../services/geolocation';
import Icon from './Icon';

export default function NearbySearch({onChange}) {
  const t = useTranslation();
  const [position, setPosition] = useState(null), [radius, setRadius] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function select(next, refresh = false) {
    const request = ++generation.current;
    setError('');
    if (!refresh && (position || next === null)) {
      setBusy(false); setRadius(next); onChange(position ? {latitude:position.latitude, longitude:position.longitude, ...(next ? {radius_km:next} : {})} : {}); return;
    }
    setBusy(true);
    try {
      const found = await locate();
      if (generation.current !== request) return;
      setPosition(found); setRadius(next);
      onChange({latitude:found.latitude, longitude:found.longitude, ...(next ? {radius_km:next} : {})});
    } catch (e) { if (generation.current === request) setError(e.message); }
    finally { if (generation.current === request) setBusy(false); }
  }
  return <div className="nearby-search">
    <div className="nearby-toolbar">
      <div className="nearby-heading"><span className="nearby-icon"><Icon name="location" size={22} /></span><div><h3>{t('Nearby kitchens')}</h3>{position && <p className="nearby-status" role="status"><Icon name="check" size={14} />{t('Location ready')}</p>}</div></div>
      <div className="nearby-actions"><button className="btn btn-primary nearby-locate" type="button" disabled={busy} onClick={() => select(radius, true)}><Icon name="location" size={18} />{t(busy ? 'Finding location…' : 'Use my location')}</button>
        {(position || busy) && <button className="nearby-clear" type="button" onClick={() => {generation.current++;setBusy(false);setError('');setPosition(null);setRadius(null);onChange({});}}>{t('Clear location')}</button>}
      </div>
    </div>
    <div className="nearby-filter-group" role="group" aria-label={t('Distance from you')}>
      {[[null,'All distances'],[4,'Within 4 km'],[10,'Within 10 km']].map(([value,label]) => <button className="nearby-filter" key={label} type="button" disabled={busy} aria-pressed={radius === value} onClick={() => select(value)}>{t(label)}</button>)}
    </div>
    {error && <p className="alert error" role="alert">{t(error)}</p>}
  </div>;
}
