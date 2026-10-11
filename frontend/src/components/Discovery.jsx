import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../services/api";
import MenuImage from "./MenuImage";
import "./discovery.css";

export default function Discovery({ compact = false }) {
  const translate = useTranslation();
  const isOwner = localStorage.getItem("role") === "owner";
  const [data, setData] = useState({ meals: [], plans: [], reviews: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const load = useCallback(async () => {
    setError("");setLoading(true);
    try {
      const [meals, plans, reviews] = await Promise.all([api.get("/public/menu"), api.get("/public/plans"), api.get("/public/reviews")]);
      setData({ meals: meals.data, plans: plans.data, reviews: reviews.data });
    } catch (e) {setError(errorMessage(e, "Could not load the live menu and plans. Please retry."));} finally
    {setLoading(false);}
  }, []);
  useEffect(() => {const timer = setTimeout(load, 0);return () => clearTimeout(timer);}, [load]);
  return <div className="discovery">
    {error && <div className="alert error" role="alert">{translate(error)} <button className="btn btn-outline" onClick={load}>{translate("Retry")}</button></div>}
    {loading ? <p role="status">{translate("Loading the kitchen’s latest menu…")}</p> : <>
      <section id="live-menu"><div className="section-heading"><div><p className="eyebrow">{translate("STRAIGHT FROM YOUR MESS")}</p><h2>{translate("The live menu")}</h2><p className="muted">{translate("Published meals for the next seven days. Food photos are illustrative.")}</p></div><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div><div className="discovery-tabs" aria-label={translate("Meal filters")}>{["all", "breakfast", "lunch", "dinner"].map((t) => <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>{translate(t)}</button>)}</div><div className="meal-grid">{data.meals.filter((m) => type === "all" || m.meal_type === type).slice(0, compact ? 3 : 100).map((m) => <article className="meal-card" key={m.id}><MenuImage className="food-cover" menu={m.menu_description} imageUrl={m.image_url} /><span className="meal-type">{translate(m.meal_type)}</span><h3>{translate(m.menu_description || "Menu to be announced")}</h3><p>{translate(new Date(`${m.date}T00:00:00`).toLocaleDateString(translate.locale, { weekday: "short", day: "numeric", month: "short" }))}</p><Link className="btn btn-outline" to={localStorage.getItem("role") === "owner" ? "/owner/meals" : "/customer"}>{translate("Open meal dashboard ↗")}</Link></article>)}</div>{!data.meals.some((m) => type === "all" || m.meal_type === type) && <p className="empty-card">{translate("No meals published in this category yet.")}</p>}{compact && data.meals.length > 3 && <Link to="/explore">{translate("See the full menu ↗")}</Link>}</section>
      <section id="plans"><p className="eyebrow">{translate(isOwner ? "YOUR SUBSCRIPTIONS" : "FIND YOUR EVERYDAY FIT")}</p><h2>{translate(isOwner ? "Your published plans" : "Choose your meal plan")}</h2><p className="muted">{translate(isOwner ? "These are the subscriptions customers can choose when joining your mess. Manage prices and plans from your dashboard." : "Compare plan descriptions and prices, choose a plan, then pay by QR / UPI. Your owner confirms payment.")}</p><div className="discovery-tabs" aria-label={translate("Plan categories")}>{["all", "regular", "mini", "protein", "special"].map((c) => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{translate(c)}</button>)}</div><div className="meal-grid">{data.plans.filter((p) => category === "all" || p.category === category).map((p) => <article className="plan-choice" key={p.id}><span className="meal-type">{translate(p.category)} · {translate(p.duration_days === 1 ? "Trial" : `${p.duration_days} days`)}</span><h3>{p.name}</h3><strong className="plan-price">₹{translate(p.price.toLocaleString(translate.locale))}</strong><p>{p.description}</p><p className="muted">{translate("Each eligible skipped meal adds one subscription day.")}</p><Link className="btn btn-primary" to={isOwner ? "/owner/plans" : `/customer/plans/browse?offer=${p.id}`}>{translate(isOwner ? "Manage plans" : "Choose this plan")}</Link></article>)}</div>{!data.plans.some((p) => category === "all" || p.category === category) && <p className="empty-card">{translate(isOwner ? "You have not published plans in this category yet." : "Your owner has not published plans in this category yet.")}</p>}</section>
      <section id="reviews"><p className="eyebrow">{translate("FROM OUR TABLE")}</p><h2>{translate("What customers say")}</h2><div className="meal-grid">{data.reviews.slice(0, compact ? 3 : 30).map((r) => <article className="plan-choice" key={r.id}><span className="review-stars" aria-label={translate(`${r.rating} out of 5 stars`)}>{translate("★".repeat(r.rating))}{translate("☆".repeat(5 - r.rating))}</span><p>{translate(r.comment || "A customer rated this meal.")}</p><strong>{r.name}</strong><p className="muted">{translate(r.menu)}{translate(" · Subscriber review")}</p></article>)}</div>{!data.reviews.length && <p className="empty-card">{translate("No reviews yet. Subscribers can rate their past meals from their dashboard.")}</p>}</section>
    </>}
  </div>;
}
