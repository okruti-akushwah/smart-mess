import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../services/api";
export default function PauseMeals({ hasSubscription }) {
  const translate = useTranslation();
  const today = new Date().toLocaleDateString('en-CA');
  const [dates, setDates] = useState({ start_date: today, end_date: today }),[preview, setPreview] = useState(null),[result, setResult] = useState(null),[error, setError] = useState(''),[busy, setBusy] = useState(false),[loading, setLoading] = useState(false);
  const [bill, setBill] = useState(null);
  const valid = dates.start_date && dates.end_date && dates.start_date >= today && dates.end_date >= dates.start_date;
  const loadPreview = useCallback(async () => {
    if (!hasSubscription || !dates.start_date || !dates.end_date || dates.start_date < new Date().toLocaleDateString('en-CA') || dates.end_date < dates.start_date) return;
    setLoading(true);
    try {const r = await api.get('/subscriptions/pause-preview', { params: dates });setPreview({ ...r.data, range: `${dates.start_date}/${dates.end_date}` });setError('');}
    catch (e) {setPreview(null);setError(errorMessage(e));} finally {setLoading(false);}
  }, [hasSubscription, dates]);
  useEffect(() => {const t = setTimeout(loadPreview, 250);return () => clearTimeout(t);}, [loadPreview]);
  const currentPreview = preview?.range === `${dates.start_date}/${dates.end_date}` ? preview : null;
  function change(key, value) {setDates((previous) => ({ ...previous, [key]: value }));setResult(null);setError('');setBill(null);}
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');setResult(null);
    try {
      const r = await api.post('/subscriptions/pause', dates);setResult(r.data);
      try {const b = await api.get('/bills/current');setBill(b.data);} catch {/* A future subscription may not have a current bill yet. */}
      await loadPreview();window.dispatchEvent(new Event('meals-updated'));
    } catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  return <section className="management-card" id="pause-meals"><h2>{translate("Pause scheduled meals")}</h2><p className="muted">{translate("Choose a date range to skip eligible published meals. Closed meals, guest bookings and dispatched meals stay unchanged. Menus published later are not automatically paused.")}</p>{!hasSubscription && <p className="alert error">{translate("You need an approved subscription before pausing meals.")}</p>}<form className="meal-form" onSubmit={submit}><label className="form-field">{translate("From")}<input required type="date" name="pause_start" min={today} disabled={busy} value={dates.start_date} onChange={(e) => change('start_date', e.target.value)} /></label><label className="form-field">{translate("Through")}<input required type="date" name="pause_end" min={dates.start_date || today} disabled={busy} value={dates.end_date} onChange={(e) => change('end_date', e.target.value)} /></label>{!valid && <p className="form-wide alert error">{translate("Choose today or future dates, with Through on or after From.")}</p>}<div className="form-actions"><button className="btn btn-primary" disabled={busy || loading || !valid || !hasSubscription || !currentPreview || currentPreview.eligible_count === 0}>{translate(busy ? 'Pausing meals…' : `Pause ${currentPreview?.eligible_count || ''} meal${currentPreview?.eligible_count === 1 ? '' : 's'}`)}</button><button type="button" className="btn btn-outline" disabled={busy || !valid || !hasSubscription} onClick={loadPreview}>{translate("Refresh eligible meals")}</button></div></form>
    {error && <div className="alert error" role="alert">{translate(error)}</div>}
    {loading && <p role="status">{translate("Checking which meals can be paused…")}</p>}
    {result && <div className={`alert ${result.skipped ? 'success' : 'error'}`} role="status"><strong>{translate(result.message)}</strong>{result.skipped > 0 && <><p>{translate("Skip deduction added: ₹")}{translate(result.deductions.toFixed(2))}{translate(bill ? ` · Live bill ₹${bill.final_amount.toFixed(2)} · Balance ₹${bill.balance_due.toFixed(2)}` : '')}</p><Link to="/customer">{translate("View updated meal statuses and bill →")}</Link></>}</div>}
    {currentPreview && !result && <p className={currentPreview.eligible_count ? 'muted' : 'alert error'} role="status">{translate(currentPreview.message)}</p>}
    <PauseRows rows={result?.meals || currentPreview?.meals || []} paused={Boolean(result)} />
    {(result?.unchanged || currentPreview?.unchanged || []).length > 0 && <><h3>{translate("Unchanged meals")}</h3>{(result?.unchanged || currentPreview.unchanged).map((m) => <div className="request-row" key={m.meal_id}><div><strong>{translate(m.date)} · {translate(m.meal_type)}</strong><p>{m.menu_description}</p><p>{translate(m.reason)}</p></div></div>)}</>}
  </section>;
}
function PauseRows({ rows, paused }) {
  const translate = useTranslation();return rows.length > 0 && <><h3>{translate(paused ? 'Paused meals' : 'Meals that will be paused')}</h3>{rows.map((m) => <div className="request-row" key={m.meal_id}><div><strong>{translate(m.date)} · {translate(m.meal_type)}</strong><p>{m.menu_description}</p><p>{translate(paused ? 'Skipped' : 'Eligible')}{translate(" · skip deduction ₹")}{translate(m.deduction.toFixed(2))}</p></div></div>)}</>;}
