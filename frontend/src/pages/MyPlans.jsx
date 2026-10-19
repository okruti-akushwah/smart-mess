import CustomerPage from "../components/CustomerPage";
import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
export default function MyPlans() {
  const translate = useTranslation();

  const [current, setCurrent] = useState(null), [error, setError] = useState("");
  useEffect(() => { let live = true; api.get("/subscriptions/current").then(({ data }) => { if(live) setCurrent(data); }).catch(e => { if(live) setError(errorMessage(e)); }); return () => { live = false; }; }, []);
  const displayDate = value => new Date(`${value}T12:00:00`).toLocaleDateString(translate.locale, { day: "numeric", month: "short", year: "numeric" });
  return <><Navbar title={translate("Subscriptions")} /><CustomerPage className="subscription-controls"><section className="catalog-heading"><div><p className="eyebrow">{translate("MEALS THAT FIT YOUR DAY")}</p><h1>{translate("Your subscriptions")}</h1><p>{translate("View your active subscriptions and choose a plan when you are ready.")}</p><Link className="btn btn-primary" to="/customer/plans/browse">{translate("Choose a subscription")}</Link></div></section>{error && <p className="alert error" role="alert">{translate(error)}</p>}<section className="management-card"><h2>{translate("Plan details")}</h2>{current === null ? <p role="status">{translate("Loading subscriptions…")}</p> : current.length ? current.map(p => <div className="request-row" key={p.id}><div><strong>{p.name}</strong><p>{translate("Includes: ")}{(p.meal_types || ["breakfast", "lunch", "dinner"]).map(translate).join(" · ")}</p><p>{displayDate(p.start_date)}{translate(" to ")}{displayDate(p.end_date)} · ₹{p.price} · {p.skipped_meals || 0}{translate(" skipped meals · ")}{p.skip_count || 0}{translate(" extra days")}</p></div></div>) : <p>{translate("No active subscription yet. Complete payment to activate your chosen plan.")}</p>}<Link to="/customer/bills">{translate("View bills & pending payments")}</Link></section><div className="form-actions"><Link className="btn btn-outline" to="/customer/pause">{translate("Pause meals")}</Link></div></CustomerPage></>;
}
