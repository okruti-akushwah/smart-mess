import { Link } from "react-router-dom";
import LatestMealReview from "../components/LatestMealReview";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import foodPhoto from "../assets/thali.png";
import MenuImage from "../components/MenuImage";

function closed(meal) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return meal.date < localDate || meal.cutoff_time && new Date(meal.cutoff_time.endsWith("Z") || /[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`) <= today;
}

export default function CustomerDashboard() {
  const translate = useTranslation();
  const [meals, setMeals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guest, setGuest] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [guestPrice, setGuestPrice] = useState(null);
  const load = useCallback(async () => {
    try {
      const [mealResult, planResult, priceResult] = await Promise.allSettled([api.get("/meals/upcoming"), api.get("/subscriptions/current"), api.get("/meals/guest-price")]);
      if (priceResult.status === "fulfilled") setGuestPrice(priceResult.value.data.price);else
      {setGuestPrice(null);throw priceResult.reason;}
      if (mealResult.status === "rejected") throw mealResult.reason;
      setMeals(mealResult.value.data);
      if (planResult.status === "rejected") throw planResult.reason;
      setSubscriptions(planResult.value.data);
    } catch (e) {setError(errorMessage(e, "Unable to load your dashboard."));} finally
    {setLoading(false);}
  }, []);
  useEffect(() => {const timer = setTimeout(load, 0);const refresh = setInterval(load, 15000);window.addEventListener('focus', load);window.addEventListener('meals-updated', load);return () => {clearTimeout(timer);clearInterval(refresh);window.removeEventListener('focus', load);window.removeEventListener('meals-updated', load);};}, [load]);
  async function action(meal, endpoint, extras = {}) {
    setBusy(meal.id);setError("");setMessage("");
    try {
      const r = await api.post(`/meals/${endpoint}`, { meal_id: meal.id, ...extras });
      setMessage(r.data.message);setGuest(null);await load();
    } catch (e) {setError(errorMessage(e));} finally
    {setBusy(null);}
  }
  const today = new Date().toLocaleDateString("en-CA");
  const todayMeals = meals.filter((m) => m.date === today);
  const upcoming = meals.filter((m) => m.date !== today);
  function card(meal) {
    const isClosed = closed(meal);
    return <article className="meal-card" key={meal.id}>
      <MenuImage className="food-cover" menu={meal.menu_description} imageUrl={meal.image_url} />
      <div className="meal-top"><span className="meal-type">{translate(meal.meal_type)}</span><span className={`history-status status-${meal.status}`}>{translate(meal.booked ? meal.status.replaceAll("_", " ") : "Not booked")}</span></div>
      <h3>{translate(meal.menu_description || "Menu to be announced")}</h3>
      <p>{translate(new Date(`${meal.date}T00:00:00`).toLocaleDateString(translate.locale, { weekday: "short", day: "numeric", month: "short" }))} · {translate(isClosed ? "Changes closed" : "Changes open")}</p>
      {meal.cutoff_time && <p>{translate("Cutoff: ")}{translate(new Date(/[Z]|[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`).toLocaleString(translate.locale))}</p>}
      {meal.can_manage ? <div className="meal-actions">
        <button className="btn btn-danger-soft" disabled={isClosed || busy !== null} onClick={() => action(meal, meal.status === "skipped" ? "undo-skip" : "skip")}>{translate(busy === meal.id ? "Saving…" : meal.status === "skipped" ? "Undo skip" : "Skip meal")}</button>
        <button className="btn btn-outline" disabled={isClosed || busy !== null || guestPrice === null || meal.status === "guest_added"} onClick={() => {setGuest(meal);setGuestCount(1);}}>{translate("+ Guest")}</button>
      </div> : <div className="meal-actions">{meal.booked ? <span className="status-badge">Single meal booked</span> : <Link className="btn btn-primary" to="/customer/choose?type=meal">Order a meal</Link>}</div>}
    </article>;
  }
  return <><Navbar title={translate("Your meals")} /><main className="dashboard">
    {!loading && !subscriptions.length && <section className="management-card checkout-reminder"><div><p className="eyebrow">YOUR NEXT MEAL</p><h2>Subscribe, or taste food first</h2><p>Choose your food and pay in a few steps.</p></div><div className="form-actions"><Link className="btn btn-primary" to="/customer/plans/browse">Choose a plan</Link><Link className="btn btn-outline" to="/customer/choose?type=meal">Order a single meal</Link><Link to="/customer/bills">Bills & payments</Link></div></section>}
    <LatestMealReview />
    {loading ? <div className="loading-card">{translate("Loading today's menu…")}</div> : <section className="today-menu-section"><div className="section-heading"><div><p className="eyebrow">{translate("FRESH FROM THE KITCHEN")}</p><h2>{translate("Today's menu")}</h2></div><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div><div className="meal-grid">{todayMeals.length ? todayMeals.map(card) : <div className="empty-card">{translate("Today's menu hasn't been scheduled yet.")}</div>}</div></section>}
    <section className="welcome food-welcome"><div><p className="eyebrow">{translate("A LITTLE PLANNING. A LOT LESS WASTE.")}</p><h1>{translate("Good food.")}<br />{translate("On your schedule.")}</h1><p>{translate("Fresh meals, flexible plans and a bill that adds up. Make your choices before the cutoff.")}</p>{!loading && !subscriptions.length && <span className="status-badge">{translate("No active subscription")}</span>}{subscriptions.map(plan => <span className="status-badge" key={plan.id}>{plan.name} · {translate(plan.start_date > today ? "Approved" : "Active")} · {plan.start_date} {translate("to")} {plan.end_date}</span>)}</div><img src={foodPhoto} alt={translate("Fresh vegetarian thali with dal, roti, rice and paneer")} /></section>
    {error && <div className="alert error" role="alert">{translate(error)}</div>}{message && <div className="alert success" role="status">{translate(message)}</div>}
    {loading ? <div className="loading-card">{translate("Preparing your dashboard…")}</div> : <>
      <section><div className="section-heading"><div><p className="eyebrow">{translate("PLAN YOUR WEEK")}</p><h2>{translate("Coming up next")}</h2></div><span>{translate(upcoming.length)}{translate(" scheduled meals")}</span></div><div className="meal-grid">{upcoming.length ? upcoming.map(card) : <div className="empty-card">{translate("Your upcoming meals will appear here.")}</div>}</div></section>
    </>}
    {guest && <div className="modal-backdrop"><section className="guest-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-title"><h2 id="guest-title">{translate("Make room for a guest")}</h2><p>{guest.menu_description} · {translate(guest.date)}</p><form onSubmit={(e) => {e.preventDefault();action(guest, "add-guest", { guest_count: Number(guestCount), expected_unit_price: guestPrice });}}><label className="form-field">{translate("Number of guests")}<input autoFocus required type="number" min="1" max="100" step="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} /></label><p>{translate("Price per guest: ₹")}{translate(guestPrice?.toFixed(2))}</p><div className="bill-total"><span>{translate("Guest total")}</span><strong>₹{translate(((Number(guestCount) || 0) * (guestPrice || 0)).toFixed(2))}</strong></div><p>{translate("This amount will be added to your bill.")}</p><div className="form-actions"><button className="btn btn-primary" disabled={busy !== null}>{translate("Confirm guest")}</button><button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => setGuest(null)}>{translate("Cancel")}</button></div></form></section></div>}
  </main></>;
}
