import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";

export default function SubscriptionManager() {
  const translate = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ user_id: "", price: 3000, meal_price: 50, meal_types: ["breakfast", "lunch", "dinner"], start_date: "", end_date: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/owner/customers").then((r) => setCustomers(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);setError("");setMessage("");
    try {
      await api.post("/owner/plans", { ...form, user_id: Number(form.user_id), price: Number(form.price), meal_price: Number(form.meal_price) });
      setMessage("Subscription assigned. Customer billing and kitchen headcount are now active.");
      window.dispatchEvent(new Event("subscription-updated"));
    } catch (e) {setError(errorMessage(e));} finally
    {setSaving(false);}
  }
  function change(event) {setForm({ ...form, [event.target.name]: event.target.value });}
  return <section className="management-card">
    <p className="eyebrow">{translate("CUSTOMER SUBSCRIPTIONS")}</p><h2>{translate("Set up a meal plan")}</h2>
    <p className="muted">{translate("Assign a subscription to a registered customer to activate their billing and include them in preparation counts.")}</p>
    {error && <div className="alert error" role="alert">{translate(error)}</div>}
    {message && <div className="alert success" role="status">{translate(message)}</div>}
    {!customers.length ? <p>{translate("No customers yet. Share your mess join link, then approve their requests in the Requests tab.")}</p> :
      <form className="meal-form" onSubmit={submit}>
      <label className="form-field">{translate("Customer")}<select required name="user_id" value={form.user_id} onChange={change}><option value="">{translate("Choose a customer")}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
      <label className="form-field">{translate("Plan amount (₹)")}<input required type="number" min="1" step="0.01" name="price" value={form.price} onChange={change} /></label>
      <fieldset className="form-field"><legend>Meals included</legend>{["breakfast", "lunch", "dinner"].map(type => <label key={type} className="plan-meal-option"><input type="checkbox" checked={form.meal_types.includes(type)} onChange={e => setForm(previous => ({ ...previous, meal_types: e.target.checked ? [...previous.meal_types, type] : previous.meal_types.filter(value => value !== type) }))} />{translate(type)}</label>)}{!form.meal_types.length && <p role="alert">Choose at least one meal.</p>}</fieldset><p className="muted">Each skipped meal adds one subscription day.</p>
      <label className="form-field">{translate("Starts on")}<input required type="date" name="start_date" value={form.start_date} onChange={change} /></label>
      <label className="form-field">{translate("Ends on")}<input required type="date" min={form.start_date} name="end_date" value={form.end_date} onChange={change} /></label>
      <div className="form-actions"><button className="btn btn-primary" disabled={saving || !form.meal_types.length}>{translate(saving ? "Assigning…" : "Assign subscription")}</button></div>
    </form>}
  </section>;
}
