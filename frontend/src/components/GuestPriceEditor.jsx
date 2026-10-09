import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
export default function GuestPriceEditor() {
  const translate = useTranslation();
  const [price, setPrice] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {let active = true;api.get("/meals/guest-price").then((r) => {if (active) {setPrice(r.data.price);setSaved(r.data.price);}}).catch((e) => {if (active) setError(errorMessage(e));});return () => {active = false;};}, []);
  async function save(e) {
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try {const r = await api.put("/owner/guest-price", { price: Number(price) });setSaved(r.data.price);setMessage("Guest price saved. Existing guest bookings keep their original price.");}
    catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  return <section className="management-card"><p className="eyebrow">{translate("GUEST MEALS")}</p><h2>{translate("Set your guest price")}</h2><p>{translate("Customers choose how many guests to add. Their total is calculated automatically.")}</p>{error && <p className="alert error" role="alert">{translate(error)}</p>}{message && <p className="alert success" role="status">{translate(message)}</p>}<form className="meal-form" onSubmit={save}><label className="form-field">{translate("Price per guest (₹)")}<input required type="number" min="0" max="10000" step="0.01" value={price} disabled={busy} onChange={(e) => {setPrice(e.target.value);setMessage("");}} /></label><div className="form-actions"><button className="btn btn-primary" disabled={busy || price === ""}>{translate(busy ? "Saving..." : "Save guest price")}</button></div></form>{saved !== null && <p>{translate("2 guests × ₹")}{translate(saved.toFixed(2))} = ₹{translate((2 * saved).toFixed(2))}</p>}</section>;
}
