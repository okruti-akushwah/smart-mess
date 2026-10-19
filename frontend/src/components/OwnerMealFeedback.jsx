import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import MenuImage from "./MenuImage";
import api, { errorMessage } from "../services/api";
import "./customerJourney.css";
export default function OwnerMealFeedback() {
  const translate = useTranslation();

  const [rows, setRows] = useState(null), [error, setError] = useState("");
  const load = useCallback(async () => { try { const r = await api.get("/owner/reviews"); setRows(r.data); setError(""); } catch (e) { setError(errorMessage(e)); } }, []);
  useEffect(() => { const t = setTimeout(load, 0), interval = setInterval(load, 30000); return () => { clearTimeout(t); clearInterval(interval); }; }, [load]);
  return <section className="management-card"><div className="section-heading"><div><h2>{translate("Meal ratings & suggestions")}</h2></div><button className="btn btn-outline" onClick={load}>{translate("Refresh")}</button></div>{error && <p className="alert error" role="alert">{translate(error)}</p>}{rows === null ? <p role="status">{translate("Loading feedback…")}</p> : !rows.length ? <div className="empty-card"><h3>{translate("No meal reviews yet")}</h3><p>{translate("Members can rate their latest meal the next day. Their ratings and suggestions will appear here.")}</p></div> : <div className="feedback-list">{rows.map(r => <article className="history-meal-row" key={r.id}><MenuImage className="meal-thumbnail" menu={r.menu} imageUrl={r.image_url} /><div className="history-meal-info"><strong><DynamicText kind="meal" id={r.meal_id || r.id} field="menu_description" source={r.menu} /></strong><p>{r.name} · {translate(r.meal_type)} · {r.date}</p><span className="owner-feedback-stars" aria-label={translate(`${r.rating} out of 5 stars`)}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>{r.comment && <p>{r.comment}</p>}</div></article>)}</div>}</section>;
}
