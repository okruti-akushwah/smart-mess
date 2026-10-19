import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Discovery from '../components/Discovery';
import api, { errorMessage } from '../services/api';

export default function Explore() {
  const t = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const signedIn = Boolean(localStorage.getItem('token'));
  const role = localStorage.getItem('role');
  const requested = params.get('mess');
  const selected = requested || (signedIn && role === 'customer' ? localStorage.getItem('activeMessToken') : null);
  const canLoad = Boolean(selected || (signedIn && role === 'owner'));
  const scope = selected || 'own-kitchen';
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');
  const request = useRef(null);
  const profile = loaded?.scope === scope ? loaded.profile : null;
  const section = ['menu', 'plans', 'reviews'].includes(params.get('view')) ? params.get('view') : 'menu';
  const dashboard = role === 'owner' ? '/owner' : '/customer';
  const load = useCallback(async () => {
    if (!canLoad) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError('');
    try {
      const { data } = await api.get(selected ? `/public/mess/${encodeURIComponent(selected)}` : '/public/mess', { signal: controller.signal });
      if (!controller.signal.aborted) setLoaded({ scope, profile: data });
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e, 'Could not load this mess. Please retry.')); }
  }, [selected, scope, canLoad]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [load]);
  function goBack() {
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/explore') && !from.startsWith('/login')) navigate(from);
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate(signedIn ? dashboard : '/');
  }
  return <main className="dashboard public-explore">
    <div className="section-heading"><button type="button" className="btn btn-outline" onClick={goBack}>{t('← Back')}</button><Link className="btn btn-primary" to={signedIn ? dashboard : '/login'}>{t(signedIn ? 'My dashboard' : 'Log in')}</Link></div>
    <header className="explore-heading"><h1>{t('Explore meals and plans')}</h1>
      {profile && <h2>{t.locale === 'hi-IN' && profile.name_hi?.trim() ? profile.name_hi : profile.name}</h2>}
      <p>{t('Browse the menu, compare plans and hear from members.')}</p>
      {profile?.join_token && <Link to={`/mess/${encodeURIComponent(profile.join_token)}#visit`}>{t('Mess details & contact')}</Link>}
    </header>
    {!canLoad ? <section className="empty-card"><p>{t('Choose a mess to explore its menu and plans.')}</p><Link className="btn btn-primary" to="/">{t('Find a mess')}</Link></section>
      : error ? <div role="alert" className="alert error"><p>{t(error)}</p><button className="btn btn-outline" onClick={load}>{t('Retry')}</button></div>
      : !profile ? <p role="status">{t('Loading mess details…')}</p>
      : <><nav className="discovery-tabs" aria-label={t('Kitchen sections')}>
        {[['menu', 'Menu'], ['plans', 'Plans & prices'], ['reviews', 'Reviews']].map(([value, label]) => <button key={value} type="button" aria-pressed={section === value} onClick={() => setParams(previous => {
          const next = new URLSearchParams(previous);
          if (requested || role !== 'owner') next.set('mess', profile.join_token);
          next.set('view', value); return next;
        }, { replace: true })}>{t(label)}</button>)}
      </nav><Discovery key={profile.join_token} messToken={profile.join_token} section={section} ownerView={!requested && role === 'owner'} /></>}
  </main>;
}
