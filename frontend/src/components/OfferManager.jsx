import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import api, { errorMessage } from "../services/api";
import "./discovery.css";

const initial = {
  name: "",
  category: "regular",
  duration_days: 7,
  price: "",
  meal_price: 50,
  meal_types: ["breakfast", "lunch", "dinner"],
  description: "",
};

export default function OfferManager() {
  const translate = useTranslation();
  const [form, setForm] = useState(initial);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/owner/offers");
      setOffers(response.data);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    const interval = setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function perform(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await action();
      setMessage(response.data.message || "Plan published.");
      await load();
      window.dispatchEvent(new Event("subscription-updated"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  return (
    <section id="subscription-plans" className="management-card">
      <p className="eyebrow">{translate("TRIAL, WEEKLY & MONTHLY CHOICES")}</p>
      <h2>{translate("Publish your plans")}</h2>
      <p className="muted">
        {translate("Publish real prices and descriptions for members to choose. Choose the meals included in each plan. Only the selected breakfast, lunch or dinner meals are booked during its dates.")}
      </p>
      {error && <div className="alert error" role="alert">{translate(error)}</div>}
      {message && <div className="alert success" role="status">{translate(message)}</div>}
      <form
        className="meal-form"
        onSubmit={(event) => {
          event.preventDefault();
          perform(async () => {
            const response = await api.post("/owner/offers", {
              ...form,
              duration_days: Number(form.duration_days),
              price: Number(form.price),
              meal_price: Number(form.meal_price),
            });
            setForm(initial);
            return response;
          });
        }}
      >
        <label className="form-field">
          {translate("Plan name")}
          <input required minLength={3} maxLength={80} name="name" value={form.name} onChange={change} />
        </label>
        <label className="form-field">
          {translate("Category")}
          <select name="category" value={form.category} onChange={change}>
            {["regular", "mini", "protein", "special"].map((category) => (
              <option key={category} value={category}>{translate(category)}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          {translate("Duration in days")}
          <input required type="number" min="1" max="365" name="duration_days" value={form.duration_days} onChange={change} />
        </label>
        <label className="form-field">
          {translate("Total price (₹)")}
          <input required type="number" min="0.01" max="100000" step="0.01" name="price" value={form.price} onChange={change} />
        </label>
        <fieldset className="form-field">
          <legend>{translate("Meals included")}</legend>
          {["breakfast", "lunch", "dinner"].map((type) => (
            <label key={type} className="plan-meal-option">
              <input
                type="checkbox"
                checked={form.meal_types.includes(type)}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  meal_types: event.target.checked
                    ? [...previous.meal_types, type]
                    : previous.meal_types.filter((value) => value !== type),
                }))}
              />
              {translate(type)}
            </label>
          ))}
          {!form.meal_types.length && <p role="alert">{translate("Choose at least one meal.")}</p>}
        </fieldset>
        <p className="muted">{translate("Each skipped meal adds one subscription day.")}</p>
        <label className="form-field">
          {translate("What's included")}
          <input required minLength={3} maxLength={500} name="description" value={form.description} onChange={change} />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy || !form.meal_types.length}>
            {translate("Publish plan")}
          </button>
        </div>
      </form>
      {offers.map((offer) => (
        <div className="request-row" key={offer.id}>
          <div>
            <strong>{offer.name} · ₹{translate(offer.price)}</strong>
            <p>{translate(offer.category)} · {translate(offer.duration_days)}{translate(" days · ")}{offer.description}</p>
            <p>{translate("Includes: ")}{(offer.meal_types || ["breakfast", "lunch", "dinner"]).map(translate).join(" · ")}</p>
          </div>
          <div>
            <button
              className="btn btn-outline"
              disabled={busy || offer.assigned_count > 0}
              onClick={() => perform(() => api.delete(`/owner/offers/${offer.id}`))}
            >
              {translate("Unpublish")}
            </button>
            {offer.assigned_count > 0 && (
              <p className="muted" role="status">
                {translate("Assigned to members. Unpublish after their subscriptions end or are cancelled.")}
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
