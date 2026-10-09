import "../components/customerJourney.css";
import MenuImage from "../components/MenuImage";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import StarRating from "../components/StarRating";
import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
export default function Reviews() {
  const translate = useTranslation();
  const [params] = useSearchParams();
  const requestedMeal = params.get("meal");
  const [meals, setMeals] = useState([]),[meal, setMeal] = useState(""),[rating, setRating] = useState(""),[comment, setComment] = useState(""),[error, setError] = useState(""),[message, setMessage] = useState(""),[busy, setBusy] = useState(false);
  const load = useCallback(async () => {try {const r = await api.get("/reviews/eligible");setMeals(r.data);const selected = r.data.find(m => String(m.id) === requestedMeal) || r.data[0];if (selected) {setMeal(String(selected.id));setRating(selected.rating ? String(selected.rating) : "");setComment(selected.comment || "");}} catch (e) {setError(errorMessage(e));}}, [requestedMeal]);
  useEffect(() => {const t = setTimeout(load, 0);return () => clearTimeout(t);}, [load]);
  function select(value) {setMessage("");setMeal(value);const item = meals.find((m) => m.id === Number(value));setRating(item?.rating ? String(item.rating) : "");setComment(item?.comment || "");}
  async function submit(e) {e.preventDefault();setBusy(true);setError("");setMessage("");try {const r = await api.post("/reviews", { meal_id: Number(meal), rating: Number(rating), comment });setMeal("");setRating("");setComment("");setMessage(r.data.message);await load();} catch (e) {setError(errorMessage(e));} finally {setBusy(false);}}
  return <><Navbar title={translate("Meal reviews")} /><main className="dashboard"><section className="management-card"><p className="eyebrow">{translate("HELP YOUR KITCHEN GET BETTER")}</p><h1>{translate("How was your meal?")}</h1><p className="muted">{translate("Rate your subscription or single meal from the next day. Skipped meals are excluded. Your rating and suggestions reach your owner; your first name and review also appear on the public mess page.")}</p>{error && <div className="alert error" role="alert">{translate(error)}</div>}{meals.length ? <form className="meal-form" onSubmit={submit}><label className="form-field">{translate("Meal")}<select required value={meal} onChange={(e) => select(e.target.value)}><option value="">{translate("Choose a past meal")}</option>{meals.map((m) => <option key={m.id} value={m.id}>{translate(m.date)} · {translate(m.menu)}{translate(m.rating ? " · reviewed" : "")}</option>)}</select></label>{meal && <div className="form-wide"><MenuImage className="review-photo" menu={meals.find(m => m.id === Number(meal))?.menu} imageUrl={meals.find(m => m.id === Number(meal))?.image_url} /><h3>{meals.find(m => m.id === Number(meal))?.menu}</h3></div>}<StarRating value={rating} onChange={setRating} disabled={busy} /><label className="form-field">{translate("Your feedback")}<input maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={translate("What did you enjoy? What could be better?")} /></label><div className="form-actions"><button className="btn btn-primary" disabled={busy || !meal || !rating}>{translate(busy ? "Saving…" : "Send rating to owner")}</button></div>{message && <div className="alert success form-wide" role="status">{translate(message)}</div>}</form> : <p>{translate("No eligible past meals yet. Come back the day after your first meal.")}</p>}</section></main></>;
}
