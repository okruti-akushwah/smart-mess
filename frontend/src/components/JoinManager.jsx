import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";

export default function JoinManager() {
  const translate = useTranslation();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(''),[message, setMessage] = useState(''),[busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {const r = await api.get('/owner/join-requests');setRequests(r.data);setError('');}
    catch (e) {setError(errorMessage(e));}
  }, []);
  useEffect(() => {const t = setTimeout(load, 0);const interval = setInterval(load, 5000);window.addEventListener('focus', load);return () => {clearTimeout(t);clearInterval(interval);window.removeEventListener('focus', load);};}, [load]);
  async function review(id, body) {
    setBusy(true);setError('');setMessage('');
    try {const r = await api.patch(`/owner/join-requests/${id}`, body);setMessage(r.data.message);await load();window.dispatchEvent(new Event('subscription-updated'));}
    catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  return <section className="management-card">{error && <p className="alert error" role="alert">{translate(error)}</p>}{message && <p className="alert success" role="status">{translate(message)}</p>}
    <h2 id="owner-join-requests">{translate("Customer join requests (")}{translate(requests.length)})</h2><button className="btn btn-outline" onClick={load}>{translate("Refresh requests")}</button>{!requests.length && <p>{translate("No pending requests.")}</p>}
    {requests.map((r) => <article className="management-card" key={r.id}><h3>{r.name} · {r.phone}</h3>{r.plan ? <><strong>{r.plan.name} · ₹{translate(r.plan.price)}</strong><p>{translate(r.plan.start_date)}{translate(" to ")}{translate(r.plan.end_date)}{translate(" · each eligible skip adds one day")}</p></> : <p>{translate("Approve this customer to join your mess. They can then log in and choose a plan from Plans & pause.")}</p>}<div className="form-actions"><button className="btn btn-primary" disabled={busy} onClick={() => review(r.id, { status: 'approved' })}>{translate("Approve request")}</button><button className="btn btn-outline" disabled={busy} onClick={() => review(r.id, { status: 'rejected' })}>{translate("Decline")}</button></div></article>)}
  </section>;
}
