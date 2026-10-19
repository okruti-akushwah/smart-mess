import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const searchRef = useRef(null);
  const query = search.trim().toLowerCase();
  const rows = customers?.filter(c => `${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(query)) || [];
  const displayDate = value => new Date(`${value}T12:00:00`).toLocaleDateString(translate.locale, { day: "numeric", month: "short", year: "numeric" });
  return <section className="management-card"><div className="section-heading"><h2>{translate("Mess members")}{customers ? ` (${customers.length})` : ''}</h2><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div>
    <label className="form-field">{translate("Search members")}<input ref={searchRef} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={translate("Name, phone or address")} /></label>{customers !== null && <p role="status" className="member-search-count">{rows.length} {translate("members shown")}{search && <button type="button" className="btn btn-outline" onClick={() => { setSearch(""); searchRef.current?.focus(); }}>{translate("Clear search")}</button>}</p>}
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {customers === null ? <p role="status">{translate("Loading members…")}</p> : !rows.length ? <p>{query ? translate("No matching members.") : translate("No members yet. Share your join link to invite people.")}</p> : rows.map(customer => <article className="request-row member-record" key={customer.id}><div className="member-identity"><h3>{customer.name}</h3><p>{translate("Phone: ")}<a href={`tel:${customer.phone}`}>{customer.phone}</a></p><p>{translate("Membership: ")}<span className="status-badge">{translate(customer.membership_status)}</span></p></div><div className="member-delivery"><p><strong>{translate("Delivery address:")}</strong> {customer.address || translate('Not saved yet')}</p>{customer.instructions && <p><strong>{translate("Instructions:")}</strong> {customer.instructions}</p>}</div><div className="member-plans">{customer.subscriptions?.length ? customer.subscriptions.map(plan => <p key={plan.id}><strong>{plan.name}</strong> · {translate(plan.status.replaceAll('_', ' '))} · {displayDate(plan.start_date)}{translate(" to ")}{displayDate(plan.end_date)}{plan.extension_days > 0 && <span className="member-extension-days"> ({translate(plan.extension_days)} {translate(plan.extension_days === 1 ? 'extra day from skips or pauses' : 'extra days from skips or pauses')})</span>}<br />{translate("Includes: ")}{(plan.meal_types || []).map(translate).join(' · ')}</p>) : <p>{translate("No current or upcoming subscription.")}</p>}</div></article>)}
  </section>;
}
