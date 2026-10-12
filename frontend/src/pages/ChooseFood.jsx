import { localDay } from "../services/dates";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import MenuImage from "../components/MenuImage";
import api, { errorMessage } from "../services/api";
import "../components/customerJourney.css";

export default function ChooseFood({ subscriptionsOnly = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null), [start, setStart] = useState(localDay());
  const [error, setError] = useState(""), [busy, setBusy] = useState(null);
  const key = useRef({});
  const checkoutInFlight = useRef(false);
  const [failedChoice, setFailedChoice] = useState(null);
  const load = useCallback(async () => {
    try { const [p, m, a, subscriptions] = await Promise.all([api.get("/public/plans"), api.get("/meals/upcoming"), api.get("/customer/activity"), api.get("/subscriptions/current")]); setData({ plans: p.data, meals: m.data, purchases: a.data.purchases, subscriptions: subscriptions.data }); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  async function buy(item, kind) {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setBusy(`${kind}-${item.id}`); setError(""); setFailedChoice(null);
    const choice = `${kind}-${item.id}-${kind === "subscription" ? start : item.date}-${kind === "subscription" ? item.price : item.single_price}`;
    key.current[choice] ||= crypto.randomUUID();
    try {
      const r = await api.post("/customer/checkout", { [kind === "meal" ? "meal_id" : "offer_id"]: item.id,
        ...(kind === "subscription" ? { start_date: start } : {}), expected_price: kind === "meal" ? item.single_price : item.price, purchase_key: key.current[choice] });
      navigate(`/customer/checkout?bill=${r.data.id}`);
    } catch (e) { setFailedChoice(`${kind}-${item.id}`); setError(errorMessage(e)); await load(); } finally { checkoutInFlight.current = false; setBusy(null); }
  }
  const pending = data?.purchases.filter(p => p.status === "pending_payment") || [];
  const subscriptionPanel = data ? <section role={subscriptionsOnly ? undefined : "tabpanel"} aria-label="Subscription plans"><label className="form-field plan-start">Subscription start date<input required type="date" disabled={busy !== null} min={localDay()} value={start} onChange={e => setStart(e.target.value)} /></label><p className="muted">Each eligible skipped meal adds one day to your subscription. Only the included meal types within your plan dates are automatically booked.</p>{data.subscriptions.length > 0 && <div className="checkout-reminder management-card"><div><strong>Your subscriptions</strong>{data.subscriptions.map(subscription => <p key={subscription.id}>{subscription.name} · {subscription.start_date} to {subscription.end_date}</p>)}<p className="muted">Choose a start date after your existing subscription ends to buy your next plan.</p></div><Link to="/customer/plans">View your subscriptions →</Link></div>}<div className="meal-grid">{data.plans.map(p => {
    const end = start ? new Date(`${start}T00:00:00Z`) : null;
    if (end) end.setUTCDate(end.getUTCDate() + p.duration_days - 1);
    const endDate = end && !Number.isNaN(end.getTime()) ? end.toISOString().slice(0, 10) : "";
    const existing = data.subscriptions.find(subscription => start && subscription.start_date <= endDate && subscription.end_date >= start);
    return <article className="management-card purchase-card" key={p.id}><span className="meal-type">{p.category}</span><h2>{p.name}</h2><p className="purchase-price">₹{p.price}<small> / {p.duration_days} days</small></p><p>{p.description}</p><p><strong>Includes:</strong> {(p.meal_types || ["breakfast", "lunch", "dinner"]).join(" · ")}</p><button className="btn btn-primary" disabled={!!existing || busy !== null || !start || start < localDay()} aria-busy={busy === `subscription-${p.id}`} onClick={() => buy(p, "subscription")}>{existing ? (existing.offer_id === p.id || (existing.offer_id == null && existing.name === p.name) ? "Already subscribed" : "Unavailable for selected dates") : busy === `subscription-${p.id}` ? "Opening checkout…" : "Buy plan & pay →"}</button>{failedChoice === `subscription-${p.id}` && error && <p className="alert error" role="alert">{error}</p>}</article>; })}</div>{!data.plans.length && <div className="empty-card"><h3>No plans available yet</h3><p>Try a single meal, or ask your owner when plans will be available.</p></div>}</section> : null;
  if (subscriptionsOnly) return <><Navbar title="Available subscriptions" /><main className="dashboard journey-page"><section className="welcome"><div><p className="eyebrow">FIND YOUR NEXT PLAN</p><h1>Available plans & subscriptions</h1><p>Compare the plans offered by your mess. Choose your preferred start date, then select a plan to proceed to payment.</p><Link className="btn btn-outline" to="/customer/plans">← Back to your subscriptions</Link></div></section>{error && <p className="alert error" role="alert">{error}</p>}{pending.filter(p => p.kind === "subscription").map(p => <section className="management-card checkout-reminder" key={p.plan_id}><div><strong>{p.name}</strong><p>You have a pending checkout for this plan.</p></div><Link className="btn btn-primary" to={`/customer/checkout?bill=${p.id}`}>Continue payment</Link></section>)}{!data ? <p role="status">Loading available subscriptions…</p> : subscriptionPanel}</main></>;
  return <><Navbar title="Order food" /><main className="dashboard journey-page"><section className="welcome"><div><p className="eyebrow">YOUR NEXT MEAL</p><h1>Order food</h1><p>Browse today's available meals. Meals covered by your subscription are already booked; you can order other available meals individually.</p><div className="form-actions"><Link to="/customer/address">Edit delivery address</Link><Link to="/customer/plans">View subscriptions</Link></div></div></section>{error && <p className="alert error" role="alert">{error}</p>}{pending.filter(p => p.kind === "meal").map(p => <div className="management-card checkout-reminder" key={p.plan_id}><div><strong>{p.name}</strong><p>₹{p.balance_due} remaining · payment confirmation needed</p></div><Link className="btn btn-primary" to={`/customer/checkout?bill=${p.id}`}>Continue payment</Link></div>)}{!data ? <p role="status">Loading meals…</p> : <section role="tabpanel" aria-label="Single meals"><p className="muted">Order from today's menu. No subscription required. Orders close at the meal cutoff.</p><div className="meal-grid">{data.meals.filter(m => m.date === localDay()).map(m => {
    const closed = m.cutoff_time && new Date(m.cutoff_time.endsWith("Z") ? m.cutoff_time : `${m.cutoff_time}Z`) <= new Date();
    return <article className="meal-card purchase-card" key={m.id}><MenuImage className="food-cover" menu={m.menu_description} imageUrl={m.image_url} /><span className="meal-type">{m.meal_type} · {m.date}</span><h3>{m.menu_description || "Menu coming soon"}</h3>{m.booked ? <><p className="muted">{m.status === "skipped" ? "You have skipped this meal. View it to manage your selection." : "This meal is already booked. No additional payment is needed."}</p><button className="btn btn-primary" disabled>{m.can_manage ? m.status === "skipped" ? "Skipped in your subscription" : "Included in your subscription" : "Already ordered"}</button></> : <><p className="purchase-price">{m.single_price ? `₹${m.single_price}` : "Single-meal ordering not available"}</p><button className="btn btn-primary" disabled={busy !== null || closed || !m.single_price} aria-busy={busy === `meal-${m.id}`} onClick={() => buy(m, "meal")}>{busy === `meal-${m.id}` ? "Opening checkout…" : closed ? "Ordering closed" : !m.single_price ? "Price not set by owner" : "Order this meal & pay →"}</button></>}{failedChoice === `meal-${m.id}` && error && <p className="alert error" role="alert">{error}</p>}</article>;
  })}</div>{!data.meals.some(m => m.date === localDay()) && <div className="empty-card">Today's menu has not been published yet. Please check back soon.</div>}</section>}<p className="muted journey-footnote">Your subscription activates after full payment is confirmed. A single meal also needs owner acceptance. Your meals appear in <Link to="/customer/history">Meal history</Link>, and payments and receipts in <Link to="/customer/bills">Bills</Link>.</p></main></>;
}
