import LoadingCards from './LoadingCards';
import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../services/api";
import MenuImage from "./MenuImage";
import "./discovery.css";

export default function Discovery({ compact = false, messToken, section = "all", ownerView }) {
  const translate = useTranslation();
  const isOwner = ownerView ?? (localStorage.getItem("role") === "owner");
  const request = useRef(null);
  const handoff = destination => messToken ? `/join/${encodeURIComponent(messToken)}?next=${encodeURIComponent(destination)}` : destination;
  const [data, setData] = useState({ meals: [], plans: [], reviews: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [date,setDate] = useState(null);
  const dates=[...new Set(data.meals.map(meal=>meal.date))].sort();
  const selectedDate=date || dates[0] || "all";
  const [category, setCategory] = useState("all");
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const config = {signal: controller.signal, params: messToken ? {mess_token: messToken} : {}};
    setError("");setLoading(true);
    try {
      const [meals, plans, reviews] = await Promise.all([api.get("/public/menu", config), api.get("/public/plans", config), api.get("/public/reviews", config)]);
      if (controller.signal.aborted) return;
      setData({ meals: meals.data, plans: plans.data, reviews: reviews.data });
    } catch (e) {if (!controller.signal.aborted) setError(errorMessage(e, "Could not load the live menu and plans. Please retry."));} finally
    {if (!controller.signal.aborted) setLoading(false);}
  }, [messToken]);
  useEffect(() => {const timer = setTimeout(load, 0);return () => {clearTimeout(timer);request.current?.abort();};}, [load]);
  return <div className="discovery">
    {error && <div className="alert error" role="alert">{translate(error)} <button className="btn btn-outline" onClick={load}>{translate("Retry")}</button></div>}
    {loading ? <LoadingCards label={translate("Loading the kitchen’s latest menu…")} /> : !error && <>
      {(section === "all" || section === "menu") && <section id="live-menu"><div className="section-heading"><div><p className="eyebrow">{translate("STRAIGHT FROM YOUR MESS")}</p><h2>{translate("The live menu")}</h2><p className="muted">{translate("A weekly menu that repeats, with upcoming meal dates shown below. Food photos are illustrative.")}</p></div><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div><div className="discovery-tabs" aria-label={translate("Meal filters")}>{["all", "breakfast", "lunch", "dinner"].map((t) => <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>{translate(t)}</button>)}</div><label className="discovery-date">{translate("Meal date")}<select value={selectedDate} onChange={e=>setDate(e.target.value)}><option value="all">{translate("All dates")}</option>{selectedDate !== "all" && !dates.includes(selectedDate) && <option value={selectedDate}>{selectedDate} · {translate("Date unavailable")}</option>}{dates.map(value=><option key={value} value={value}>{new Date(`${value}T12:00:00`).toLocaleDateString(translate.locale,{weekday:"short",day:"numeric",month:"short"})}</option>)}</select></label>{selectedDate !== "all" && !dates.includes(selectedDate) && <p role="status">{translate("This date is no longer available.")} <button className="btn btn-outline" onClick={()=>setDate("all")}>{translate("Show available dates")}</button></p>}<div className="meal-grid">{data.meals.filter((m) => (selectedDate === "all" || m.date === selectedDate) && (type === "all" || m.meal_type === type)).slice(0, compact ? 3 : 100).map((m) => <article className="meal-card" key={m.id}><MenuImage className="food-cover" menu={m.menu_description} imageUrl={m.image_url} /><span className="meal-type">{translate(m.meal_type)}</span><h3><DynamicText kind="meal" id={m.id} field="menu_description" source={m.menu_description || "Menu to be announced"} /></h3><p>{translate(new Date(`${m.date}T00:00:00`).toLocaleDateString(translate.locale, { weekday: "short", day: "numeric", month: "short" }))}</p><Link className="btn btn-outline" to={isOwner ? "/owner/meals" : handoff(`/customer/choose#meal-${m.id}`)}>{translate(isOwner ? "Open meal dashboard ↗" : "View meal and availability")}</Link></article>)}</div>{!data.meals.some((m) => (selectedDate === "all" || m.date === selectedDate) && (type === "all" || m.meal_type === type)) && <p className="public-empty" role="status">{translate("No meals published in this category yet.")}</p>}{compact && data.meals.length > 3 && <Link to="/explore">{translate("See the full menu ↗")}</Link>}</section>}
      {(section === "all" || section === "plans") && <section id="plans"><p className="eyebrow">{translate(isOwner ? "YOUR SUBSCRIPTIONS" : "FIND YOUR EVERYDAY FIT")}</p><h2>{translate(isOwner ? "Your published plans" : "Choose your meal plan")}</h2><p className="muted">{translate(isOwner ? "These are the subscriptions members can choose when joining your mess. Manage prices and plans from your dashboard." : "Compare plan descriptions and prices, choose a plan, then pay by QR / UPI. Your owner confirms payment.")}</p><div className="discovery-tabs" aria-label={translate("Plan categories")}>{["all", "regular", "mini", "protein", "special"].map((c) => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{translate(c)}</button>)}</div><div className="meal-grid">{data.plans.filter((p) => category === "all" || p.category === category).map((p) => <article className="plan-choice" key={p.id}><span className="meal-type">{translate(p.category)} · {p.duration_days === 1 ? translate("Trial") : <>{p.duration_days.toLocaleString(translate.locale)}{translate(" days")}</>}</span><h3>{p.name}</h3><strong className="plan-price">₹{translate(p.price.toLocaleString(translate.locale))}</strong><p>{p.description}</p><p>{translate("Includes: ")}{(p.meal_types || ["breakfast", "lunch", "dinner"]).map(translate).join(" · ")}</p><p className="muted">{translate("Each eligible skipped meal adds one subscription day.")}</p><Link className="btn btn-primary" to={isOwner ? "/owner/plans" : handoff(`/customer/plans/browse?offer=${p.id}`)}>{translate(isOwner ? "Manage plans" : "Choose this plan")}</Link></article>)}</div>{!data.plans.some((p) => category === "all" || p.category === category) && <p className="public-empty" role="status">{translate(isOwner ? "You have not published plans in this category yet." : "Your owner has not published plans in this category yet.")}</p>}</section>}
      {(section === "all" || section === "reviews") && <section id="reviews"><p className="eyebrow">{translate("FROM OUR TABLE")}</p><h2>{translate("What members say")}</h2><div className="meal-grid">{data.reviews.slice(0, compact ? 3 : 30).map((r) => <article className="plan-choice" key={r.id}><span className="review-stars" aria-label={translate(`${r.rating} out of 5 stars`)}>{translate("★".repeat(r.rating))}{translate("☆".repeat(5 - r.rating))}</span><p>{translate(r.comment || "A member rated this meal.")}</p><strong>{r.name}</strong><p className="muted">{translate(r.menu)}{translate(" · Subscriber review")}</p></article>)}</div>{!data.reviews.length && <p className="public-empty" role="status">{translate("No reviews yet. Subscribers can rate their past meals from their dashboard.")}</p>}</section>}
    </>}
  </div>;
}
