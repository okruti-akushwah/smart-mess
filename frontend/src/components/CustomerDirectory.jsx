import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";

export default function CustomerDirectory() {
  const translate = useTranslation();

  const [customers, setCustomers] = useState(null), [error, setError] = useState(""), [search, setSearch] = useState("");
  const load = useCallback(async () => {
    try { const { data } = await api.get('/owner/customers'); setCustomers(data); setError(''); }
    catch (e) { setError(errorMessage(e, 'Could not load members.')); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(load, 0), timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);
  const query = search.trim().toLowerCase();
  const rows = customers?.filter(c => `${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(query)) || [];
  return <section className="management-card"><div className="section-heading"><h2>{translate("Mess members")}{customers ? ` (${customers.length})` : ''}</h2><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div>
    <label className="form-field">{translate("Search members")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={translate("Name, phone or address")} /></label>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {customers === null ? <p role="status">{translate("Loading members…")}</p> : !rows.length ? <p>{query ? translate("No matching members.") : translate("No members yet. Share your join link to invite people.")}</p> : rows.map(customer => <article className="request-row" key={customer.id}><div><h3>{customer.name}</h3><p>{translate("Phone: ")}<a href={`tel:${customer.phone}`}>{customer.phone}</a></p><p>{translate("Membership: ")}{customer.membership_status}</p><p><strong>{translate("Delivery address:")}</strong> {customer.address || 'Not saved yet'}</p>{customer.instructions && <p><strong>{translate("Instructions:")}</strong> {customer.instructions}</p>}{customer.subscriptions?.length ? customer.subscriptions.map(plan => <p key={plan.id}><strong>{plan.name}</strong> · {plan.status.replaceAll('_', ' ')} · {plan.start_date}{translate(" to ")}{plan.end_date}<br />{translate("Includes: ")}{(plan.meal_types || []).join(' · ')}</p>) : <p>{translate("No current or upcoming subscription.")}</p>}</div></article>)}
  </section>;
}
