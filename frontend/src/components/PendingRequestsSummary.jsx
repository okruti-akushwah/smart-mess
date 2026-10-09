import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
export default function PendingRequestsSummary() {
  const translate = useTranslation();
  const [counts, setCounts] = useState({ join: 0, plan: 0, payment: 0 }),[error, setError] = useState('');
  const load = useCallback(async () => {try {const [j, p, payments] = await Promise.all([api.get('/owner/join-requests'), api.get('/owner/requests'), api.get('/payments/submissions')]);setCounts({ join: j.data.length, plan: p.data.length, payment: payments.data.filter(s => s.status === "pending").length });setError('');} catch (e) {setError(errorMessage(e));}}, []);
  useEffect(() => {const t = setTimeout(load, 0),interval = setInterval(load, 5000);window.addEventListener('focus', load);return () => {clearTimeout(t);clearInterval(interval);window.removeEventListener('focus', load);};}, [load]);
  return <section className="management-card" aria-label={translate("Pending customer requests")}><h2>{translate("Customer requests ")}<span className="request-count">({translate(counts.join + counts.plan + counts.payment)}{translate(" pending)")}</span></h2>{error && <p role="alert" className="alert error">{translate(error)}</p>}<div className="form-actions"><a className="btn btn-primary" href="/owner/requests">{translate("Join requests (")}{translate(counts.join)})</a><a className="btn btn-outline" href="/owner/requests">{translate("Subscription requests (")}{translate(counts.plan)})</a><a className="btn btn-outline" href="/owner/requests#payment-confirmations">{translate("Payment confirmation requests (")}{translate(counts.payment)})</a><button className="btn btn-outline" onClick={load}>{translate("Refresh requests")}</button></div></section>;
}
