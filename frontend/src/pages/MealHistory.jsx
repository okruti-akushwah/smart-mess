import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import MenuImage from "../components/MenuImage";
import api, { errorMessage } from "../services/api";
import "../components/customerJourney.css";
export default function MealHistory() {
  const translate = useTranslation();

  const [data, setData] = useState(null), [error, setError] = useState("");
  const load = useCallback(async () => { try { const r = await api.get("/customer/account-activity"); setData(r.data); setError(""); } catch (e) { setError(errorMessage(e)); } }, []);
  useEffect(() => { const t = setTimeout(load, 0), i = setInterval(load, 15000); return () => { clearTimeout(t); clearInterval(i); }; }, [load]);
  return <><Navbar title={translate("Meal history")} /><main className="dashboard journey-page"><section className="welcome"><div><p className="eyebrow">{translate("YOUR ORDERED MEALS")}</p><h1>{translate("Meal history")}</h1><p>{translate("View your ordered meals across all messes, delivery status and meal ratings.")}</p></div></section>{error && <p className="alert error" role="alert">{translate(error)}</p>}{!data ? <p role="status">{translate("Loading your meals…")}</p> : <section className="management-card"><h2>{translate("Your orders")}</h2>{data.purchases.map(p => <article className="history-meal-row" key={`purchase-${p.plan_id}`}><div className="history-meal-info"><strong>{p.name}</strong><p>{p.mess_name} · {p.start_date} · {translate(p.status)}</p></div>{p.join_token && <Link to={`/join/${p.join_token}?next=${encodeURIComponent(`/customer/checkout?bill=${p.id}`)}`}>{translate("View order")}</Link>}</article>)}<h2>{translate("Your meals")}</h2>{!data.meals.length ? <div className="empty-card"><h3>{translate("No meals ordered yet")}</h3><p>{translate("Your meals will appear here once your booking is confirmed.")}</p><Link className="btn btn-primary" to="/customer/choose?type=meal">{translate("Order food")}</Link></div> : data.meals.map(m => <article className="history-meal-row" key={m.id}><MenuImage className="meal-thumbnail" menu={m.menu} imageUrl={m.image_url} /><div className="history-meal-info"><strong><DynamicText kind="meal" id={m.id} field="menu_description" source={m.menu || "Menu not available"} /></strong><p>{m.mess_name}</p><p>{translate(m.meal_type)} · {m.date} · {m.kind === "meal" ? translate("Single meal") : translate("Subscription meal")}</p><p>{translate(m.status)}</p>{m.rating && <span aria-label={`${m.rating} out of 5 stars`}>{"★".repeat(m.rating)}</span>}</div>{m.can_review && m.join_token && <Link to={`/join/${m.join_token}?next=${encodeURIComponent(`/customer/reviews?meal=${m.id}`)}`}>{m.rating ? translate("View review") : translate("Rate meal")}</Link>}</article>)}</section>}</main></>;
}
