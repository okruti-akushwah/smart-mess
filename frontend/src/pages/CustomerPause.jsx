import CustomerPage from "../components/CustomerPage";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PauseMeals from "../components/PauseMeals";
import api, { errorMessage } from "../services/api";

export default function CustomerPause() {
  const translate = useTranslation();

  const [subscriptions, setSubscriptions] = useState(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const r = await api.get("/subscriptions/current"); setSubscriptions(r.data); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); window.addEventListener("focus", load); return () => { clearTimeout(t); window.removeEventListener("focus", load); }; }, [load]);
  return <><Navbar title={translate("Pause meals")} /><CustomerPage className="subscription-controls"><section className="welcome"><div><p className="eyebrow">{translate("PLANNING TIME AWAY?")}</p><h1>{translate("Pause your meals")}</h1><p>{translate("Choose dates within your approved subscription to skip eligible meals and extend your subscription.")}</p></div></section>{error && <p className="alert error" role="alert">{translate(error)}</p>}{subscriptions === null ? <p role="status">{translate("Loading your subscriptions…")}</p> : subscriptions.length ? <><section className="management-card"><h2>{translate("Your subscription dates")}</h2>{subscriptions.map(p => <div className="request-row" key={p.id}><div><strong>{p.name}</strong><p>{p.start_date}{translate(" to ")}{p.end_date} · {p.skipped_meals || 0}{translate(" skipped meals · ")}{p.skip_count || 0}{translate(" extra days")}</p></div></div>)}</section><PauseMeals hasSubscription /></> : <section className="empty-card"><h2>{translate("No active subscription")}</h2><p>{translate("Meal pauses are available after your subscription is approved. Single-meal orders cannot be paused.")}</p><Link className="btn btn-primary" to="/customer/plans">{translate("View subscriptions")}</Link></section>}</CustomerPage></>;
}
