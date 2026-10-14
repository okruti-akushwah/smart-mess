import DynamicText from "../components/DynamicText";
import { Link } from "react-router-dom";
import LatestMealReview from "../components/LatestMealReview";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import { localDay } from "../services/dates";
import MenuImage from "../components/MenuImage";
import Icon from "../components/Icon";

function closed(meal) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return meal.date < localDate || meal.cutoff_time && new Date(meal.cutoff_time.endsWith("Z") || /[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`) <= today;
}

export default function CustomerDashboard() {
  const translate = useTranslation();
  const [meals, setMeals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guest, setGuest] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [mealFilter, setMealFilter] = useState('all');
  const guestPrice = guest?.single_price == null ? null : Number(guest.single_price);
  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api.get("/meals/upcoming"), api.get("/subscriptions/current"),
        api.get("/customer/account"),
      ]);
      const [mealResult, planResult, accountResult] = results;
      if (mealResult.status === "fulfilled") setMeals(mealResult.value.data);
      if (planResult.status === "fulfilled") setSubscriptions(planResult.value.data);
      if (accountResult.status === "fulfilled") setAccount(accountResult.value.data);
      const failed = results.find(result => result.status === "rejected");
      if (failed) throw failed.reason;
      setError("");
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
  const today = localDay();
  const todayMeals = meals.filter((m) => m.date === today);
  const filteredToday = todayMeals.filter(m => mealFilter === 'all' || m.meal_type === mealFilter);
  const upcoming = meals.filter((m) => m.date !== today && (mealFilter === 'all' || m.meal_type === mealFilter));
  function card(meal) {
    const isClosed = closed(meal);
    return <article className="meal-card" key={meal.id}>
      <MenuImage className="food-cover" menu={meal.menu_description} imageUrl={meal.image_url} />
      <div className="meal-top"><span className="meal-type">{translate(meal.meal_type)}</span><span className={`history-status status-${meal.status}`}>{translate(meal.booked ? meal.status.replaceAll("_", " ") : "Not booked")}</span></div>
      <h3><DynamicText kind="meal" id={meal.id} field="menu_description" source={meal.menu_description || "Menu to be announced"} /></h3>
      <p>{translate(new Date(`${meal.date}T00:00:00`).toLocaleDateString(translate.locale, { weekday: "short", day: "numeric", month: "short" }))} · {translate(isClosed ? "Changes closed" : "Changes open")}</p>
      {meal.cutoff_time && <p>{translate("Cutoff: ")}{translate(new Date(/[Z]|[+-]\d\d:\d\d$/.test(meal.cutoff_time) ? meal.cutoff_time : `${meal.cutoff_time}Z`).toLocaleString(translate.locale))}</p>}
      {meal.can_manage ? <div className="meal-actions">
        <button className="btn btn-danger-soft" disabled={isClosed || busy !== null || meal.status === "guest_added"} title={meal.status === "guest_added" ? translate("Skipping is unavailable after adding guests") : undefined} onClick={() => action(meal, meal.status === "skipped" ? "undo-skip" : "skip")}>{translate(busy === meal.id ? "Saving…" : meal.status === "skipped" ? "Undo skip" : "Skip meal")}</button>
        <button className="btn btn-outline" title={!meal.single_price ? translate("Owner must set a single-meal price first") : `₹${meal.single_price} per guest`} disabled={isClosed || busy !== null || !meal.single_price || meal.status === "guest_added" || meal.status === "skipped"} onClick={() => {setGuest(meal);setGuestCount(1);}}>{translate("+ Guest")}</button>
      </div> : <div className="meal-actions">{meal.booked ? <span className="status-badge">{translate("Single meal booked")}</span> : meal.single_price && !isClosed ? <Link className="btn btn-primary" to={`/customer/choose?type=meal#meal-${meal.id}`}>{translate("Order this meal")} · ₹{translate(meal.single_price)}</Link> : <span className="status-badge">{translate(meal.single_price ? "Not included in your subscription · Ordering closed" : "Not included in your subscription")}</span>}</div>}
    </article>;
  }
  return <><Navbar title={translate("Dashboard")} /><main className="dashboard">
    <section className="management-card customer-overview">
      <p className="eyebrow">{translate("YOUR DAILY TABLE")}</p>
      <h1>{account?.mess_name || "Your customer dashboard"}</h1>
      <p>{translate("Welcome")}{account?.customer_name ? `, ${account.customer_name}` : ""}{translate(". Your next good meal starts here.")}</p>
      <details><summary>{translate("Mess address & contact")}</summary>{account?.address && <p>{account.address}</p>}{account?.contact && <p>{account.contact}</p>}</details>
      <div className="form-actions"><Link className="btn btn-primary" to="/customer/choose?type=meal">{translate("Order a meal")}</Link><Link className="btn btn-outline" to="/customer/plans/browse">{translate("Browse plans")}</Link><Link className="btn btn-outline" to="/customer/pause">{translate("Pause meals")}</Link><Link className="btn btn-outline" to="/customer/bills">{translate("Bills & payments")}</Link></div>
    </section>
    <div className="day-switch" aria-label={translate("Filter meal types")}>{["all", "breakfast", "lunch", "dinner"].map(type => <button key={type} aria-pressed={mealFilter === type} onClick={() => setMealFilter(type)}><Icon name="meal" size={15} /> {translate(type === "all" ? "All meals" : type)}</button>)}</div>{loading ? <div className="loading-card">{translate("Loading today's menu…")}</div> : <section className="today-menu-section"><div className="section-heading"><div><p className="eyebrow">{translate("FRESH FROM THE KITCHEN")}</p><h2>{translate("Today's menu")}</h2></div><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div><div className="meal-grid">{filteredToday.length ? filteredToday.map(card) : <div className="empty-card">{translate("No meals in this selection yet.")}</div>}</div></section>}
    <div className="stats-grid" aria-label={translate("Your account summary")}>
      <article className="stat-card"><span className="stat-icon"><Icon name="meal" size={22} /></span><span>{translate("Today's booked meals")}</span><strong>{loading ? "…" : todayMeals.filter(meal => meal.booked && meal.status !== "skipped").length}</strong><p>{translate("Skipped meals are excluded")}</p></article>
      <article className="stat-card"><span className="stat-icon"><Icon name="check" size={22} /></span><span>{translate("Approved subscriptions")}</span><strong>{loading ? "…" : subscriptions.length}</strong><p>{translate("Current and upcoming plans")}</p></article>
      <article className="stat-card"><span className="stat-icon"><Icon name="calendar" size={22} /></span><span>{translate("Extra subscription days")}</span><strong>{loading ? "…" : subscriptions.reduce((sum, plan) => sum + (plan.skip_count || 0), 0)}</strong><p>{translate("Paused dates add one day each.")}</p></article>
    </div>
    {!loading && <section className="management-card"><h2>{translate("Your subscriptions")}</h2>{subscriptions.length ? subscriptions.map(plan => <article key={plan.id} className="customer-plan-row"><h3>{plan.name}</h3><p>{translate("Includes: ")}{(plan.meal_types || ["breakfast", "lunch", "dinner"]).map(translate).join(" · ")}</p><p><span className="status-badge">{plan.start_date > today ? translate("Starts soon") : translate("Active")}</span> {plan.start_date}{translate(" to ")}{plan.end_date}</p><p>{plan.skipped_meals || 0}{translate(" skipped meals · ")}{plan.skip_count || 0}{translate(" extra days included in your end date")}</p></article>) : <p>{translate("No active subscription. You can order a single meal or choose a plan.")}</p>}</section>}
    {!!account?.paused_dates.length && <section className="management-card"><h2>{translate("Saved meal pauses")}</h2><p>{account.paused_dates.join(" · ")}</p><p>{translate("Meals published for these dates will also be skipped. Each paused date adds one extra subscription day.")}</p><Link to="/customer/pause">{translate("Manage meal pauses")}</Link></section>}
    {!loading && !subscriptions.length && <section className="management-card checkout-reminder"><div><p className="eyebrow">{translate("YOUR NEXT MEAL")}</p><h2>{translate("Subscribe, or taste food first")}</h2><p>{translate("Choose your food and pay in a few steps.")}</p></div><div className="form-actions"><Link className="btn btn-primary" to="/customer/plans/browse">{translate("Choose a plan")}</Link><Link className="btn btn-outline" to="/customer/choose?type=meal">{translate("Order a single meal")}</Link><Link to="/customer/bills">{translate("Bills & payments")}</Link></div></section>}
    <LatestMealReview />


    {error && <div className="alert error" role="alert">{translate(error)}</div>}{message && <div className="alert success" role="status">{translate(message)}</div>}
    {loading ? <div className="loading-card">{translate("Preparing your dashboard…")}</div> : <>
      <section><div className="section-heading"><div><p className="eyebrow">{translate("PLAN YOUR WEEK")}</p><h2>{translate("Coming up next")}</h2></div><span>{translate(upcoming.length)}{translate(" scheduled meals")}</span></div><div className="meal-grid">{upcoming.length ? upcoming.map(card) : <div className="empty-card">{translate("Your upcoming meals will appear here.")}</div>}</div></section>
    </>}
    {guest && <div className="modal-backdrop"><section className="guest-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-title"><h2 id="guest-title">{translate("Make room for a guest")}</h2><p><DynamicText kind="meal" id={guest.id} field="menu_description" source={guest.menu_description} /> · {translate(guest.date)}</p><form onSubmit={(e) => {e.preventDefault();action(guest, "add-guest", { guest_count: Number(guestCount), expected_unit_price: guestPrice });}}><label className="form-field">{translate("Number of guests")}<input autoFocus required type="number" min="1" max="100" step="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} /></label><p>{translate("Price per guest: ₹")}{translate(guestPrice?.toFixed(2))}</p><div className="bill-total"><span>{translate("Guest total")}</span><strong>₹{translate(((Number(guestCount) || 0) * (guestPrice || 0)).toFixed(2))}</strong></div><p>{translate("This amount will be added to your bill.")}</p><div className="form-actions"><button className="btn btn-primary" disabled={busy !== null}>{translate("Confirm guest")}</button><button type="button" className="btn btn-outline" disabled={busy !== null} onClick={() => setGuest(null)}>{translate("Cancel")}</button></div></form></section></div>}
  </main></>;
}
