import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n/useTranslation';

export default function KitchenPrices({ token }) {
  const t = useTranslation();
  const request = useRef(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const config = { params: { mess_token: token }, signal: controller.signal };
    const results = await Promise.allSettled([api.get('/public/menu', config), api.get('/public/plans', config)]);
    if (controller.signal.aborted) return;
    setState({
      meals: results[0].status === 'fulfilled' ? results[0].value.data : [],
      plans: results[1].status === 'fulfilled' ? results[1].value.data : [],
      error: results.some(result => result.status === 'rejected'),
    });
    setBusy(false);
  }
  const prices = (state?.meals || []).map(meal => Number(meal.single_price)).filter(price => Number.isFinite(price) && price > 0);
  const plans = (state?.plans || []).filter(plan => Number(plan.price) > 0 && Number(plan.duration_days) > 0).sort((a, b) => a.price - b.price);
  const money = value => `₹${Number(value).toLocaleString(t.locale)}`;
  return <div className="kitchen-prices">
    {state && <div aria-live="polite">
      {prices.length > 0 && <p><strong>{t('Published single meals from')} {money(Math.min(...prices))}</strong></p>}
      {plans.length > 0 && <p><strong>{t('Plan from')} {money(plans[0].price)}</strong> · {plans[0].duration_days}{t(plans[0].duration_days === 1 ? ' day' : ' days')}</p>}
      {!prices.length && !plans.length && !state.error && <p>{t('No prices published yet.')}</p>}
      {(prices.length > 0 || plans.length > 0) && <small>{t('Published prices; check dates and availability in the mess.')}</small>}
      {state.error && <p role="alert">{t('Some prices could not be loaded. Try again.')}</p>}
    </div>}
    {(!state || state.error) && <button type="button" className="btn btn-outline" disabled={busy} onClick={load}>{t(busy ? 'Loading prices…' : state?.error ? 'Retry prices' : 'Show prices')}</button>}
  </div>;
}
