import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";

const emptyForm = () => ({ user_id: "", price: "", meal_price: 50, meal_types: [], start_date: "", end_date: "" });

export default function SubscriptionManager() {
  const translate = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [offers,setOffers] = useState([]),[offerId,setOfferId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/owner/offers").then(r=>setOffers(r.data)).catch(()=>{});
    api.get("/owner/customers").then((r) => setCustomers(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);setError("");setMessage("");
    try {
      await api.post("/owner/plans", { ...form, user_id: Number(form.user_id), price: Number(form.price), meal_price: Number(form.meal_price) });
      setForm(emptyForm());setOfferId("");
      setMessage("Subscription assigned awaiting payment. The member can pay from Bills; meal bookings begin only after you confirm full payment.");
      window.dispatchEvent(new Event("subscription-updated"));
    } catch (e) {setError(errorMessage(e));} finally
    {setSaving(false);}
  }
  const chosenOffer=offers.find(offer=>String(offer.id)===offerId);
  function endDate(start,days){if(!start||!days)return '';const date=new Date(`${start}T12:00:00`);date.setDate(date.getDate()+Number(days)-1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function change(event) {const {name,value}=event.target;setForm(previous=>({...previous,[name]:value,...(name==='start_date'&&chosenOffer?{end_date:endDate(value,chosenOffer.duration_days)}:{})}));}
  return <section id="member-subscriptions" className="management-card">
    <p className="eyebrow">{translate("MEMBER SUBSCRIPTIONS")}</p><h2>{translate("Set up a meal plan")}</h2>
    <p className="muted">{translate("Assign a subscription and create its payment bill.")}</p><details><summary>{translate("Payment and overlap rules")}</summary><p>{translate("Assign a subscription and create its payment bill. It counts as taken and enters preparation totals only after you confirm full payment. A new assignment replaces an overlapping unpaid owner assignment when no payment is awaiting confirmation.")}</p></details>
    {error && <div className="alert error" role="alert">{translate(error)}</div>}
    {message && <div className="alert success" role="status">{translate(message)}</div>}
    {!customers.length ? <p>{translate("No members yet. Share your mess join link, then approve their join requests in the Requests tab.")}</p> :
      <form className="meal-form" onSubmit={submit}>
      <label className="form-field">{translate('Start from a published plan')}<select value={offerId} onChange={e=>{const id=e.target.value;setOfferId(id);const offer=offers.find(row=>String(row.id)===id);if(offer)setForm(previous=>({...previous,price:offer.price,meal_price:offer.meal_price??previous.meal_price,meal_types:offer.meal_types||[],end_date:previous.start_date?endDate(previous.start_date,offer.duration_days):previous.end_date}));}}><option value="">{translate('Custom assignment')}</option>{offers.map(offer=><option key={offer.id} value={offer.id}>{offer.name} · ₹{offer.price}</option>)}</select></label><p className="muted">{translate('Plan details are copied for this assignment. Review the amount, meals and dates before saving.')}</p><label className="form-field">{translate("Member")}<select required name="user_id" value={form.user_id} onChange={change}><option value="">{translate("Choose a member")}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
      <label className="form-field">{translate("Plan amount (₹)")}<input required type="number" min="1" step="0.01" name="price" value={form.price} onChange={change} /></label>
      <fieldset className="form-field"><legend>{translate("Meals included")}</legend>{["breakfast", "lunch", "dinner"].map(type => <label key={type} className="plan-meal-option"><input type="checkbox" checked={form.meal_types.includes(type)} onChange={e => setForm(previous => ({ ...previous, meal_types: e.target.checked ? [...previous.meal_types, type] : previous.meal_types.filter(value => value !== type) }))} />{translate(type)}</label>)}{!form.meal_types.length && <p role="alert">{translate("Choose at least one meal.")}</p>}</fieldset><p className="muted">{translate("Each skipped meal adds one subscription day.")}</p>
      <label className="form-field">{translate("Starts on")}<input required type="date" name="start_date" value={form.start_date} onChange={change} /></label>
      <label className="form-field">{translate("Ends on")}<input required type="date" min={form.start_date} name="end_date" value={form.end_date} onChange={change} /></label>
      <div className="form-actions"><button className="btn btn-primary" disabled={saving || !form.meal_types.length}>{translate(saving ? "Assigning…" : "Assign subscription")}</button></div>
    </form>}
  </section>;
}
