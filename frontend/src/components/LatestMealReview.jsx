import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MenuImage from "./MenuImage";
import StarRating from "./StarRating";
import api, { errorMessage } from "../services/api";
import "./customerJourney.css";
export default function LatestMealReview() {
  const translate = useTranslation();

  const [meal, setMeal] = useState(null), [rating, setRating] = useState(0), [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { const r = await api.get("/reviews/eligible"); const latest = r.data[0]; setMeal(latest && !latest.rating ? latest : null); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { const t = setTimeout(load, 0), i = setInterval(load, 60000); window.addEventListener("focus", load); return () => { clearTimeout(t); clearInterval(i); window.removeEventListener("focus", load); }; }, [load]);
  async function submit(e) {
    e.preventDefault(); if (!rating) { setError("Choose a star rating first."); return; }
    setBusy(true); setError("");
    try { const r = await api.post("/reviews", { meal_id: meal.id, rating: Number(rating), comment }); setMessage(r.data.message); setMeal(null); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (!meal) return <>{error && <p role="alert" className="alert error">{translate(error)}</p>}{message && <p role="status" className="alert success">{translate(message)}</p>}</>;
  return <section className="management-card meal-review-card"><MenuImage className="review-photo" menu={meal.menu} imageUrl={meal.image_url} /><div><p className="eyebrow">{translate("HOW WAS YOUR LATEST MEAL?")}</p><h2><DynamicText kind="meal" id={meal.meal_id || meal.id} field="menu_description" source={meal.menu} /></h2><p className="muted">{translate(meal.meal_type)} · {meal.date}</p><p className="muted">{translate("Your owner receives your feedback. Your first name, rating and comment also appear in public mess reviews.")}</p><form className="review-form" onSubmit={submit}><StarRating value={rating} onChange={setRating} disabled={busy} /><label className="form-field">{translate("Any suggestions for your owner? (optional)")}<textarea rows={3} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} placeholder={translate("Taste, portion size, freshness…")} /></label>{error && <p role="alert" className="alert error">{translate(error)}</p>}<div className="form-actions"><button className="btn btn-primary" disabled={busy || !rating}>{busy ? translate("Sending…") : translate("Send rating to owner")}</button><Link to="/customer/reviews">{translate("All meal reviews")}</Link></div></form></div></section>;
}
