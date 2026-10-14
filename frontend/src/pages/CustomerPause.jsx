import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PauseMeals from "../components/PauseMeals";
import api, { errorMessage } from "../services/api";

export default function CustomerPause() {
  const [subscriptions, setSubscriptions] = useState(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const r = await api.get("/subscriptions/current"); setSubscriptions(r.data); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); window.addEventListener("focus", load); return () => { clearTimeout(t); window.removeEventListener("focus", load); }; }, [load]);
  return <><Navbar title="Pause meals" /><main className="dashboard subscription-controls"><section className="welcome"><div><p className="eyebrow">PLANNING TIME AWAY?</p><h1>Pause your meals</h1><p>Choose dates within your approved subscription to skip eligible meals and extend your subscription.</p></div></section>{error && <p className="alert error" role="alert">{error}</p>}{subscriptions === null ? <p role="status">Loading your subscriptions…</p> : subscriptions.length ? <><section className="management-card"><h2>Your subscription dates</h2>{subscriptions.map(p => <div className="request-row" key={p.id}><div><strong>{p.name}</strong><p>{p.start_date} to {p.end_date} · {p.skipped_meals || 0} skipped meals · {p.skip_count || 0} extra days</p></div></div>)}</section><PauseMeals hasSubscription /></> : <section className="empty-card"><h2>No active subscription</h2><p>Meal pauses are available after your subscription is approved. Single-meal orders cannot be paused.</p><Link className="btn btn-primary" to="/customer/plans">View subscriptions</Link></section>}</main></>;
}
