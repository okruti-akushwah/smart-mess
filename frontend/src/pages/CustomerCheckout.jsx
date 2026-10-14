import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BillWorkflow from "../components/BillWorkflow";
import api, { errorMessage } from "../services/api";
import "../components/customerJourney.css";

export default function CustomerCheckout() {
  const translate = useTranslation();

  const [params] = useSearchParams(), billId = params.get("bill");
  const [purchase, setPurchase] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await api.get("/customer/activity"); setPurchase(r.data.purchases.find(p => String(p.id) === billId) || false); }
    catch (e) { setError(errorMessage(e)); }
  }, [billId]);
  useEffect(() => { const t = setTimeout(load, 0), i = setInterval(load, 15000); return () => { clearTimeout(t); clearInterval(i); }; }, [load]);
  async function cancel() {
    setBusy(true); setError("");
    try { await api.delete(`/customer/checkout/${purchase.plan_id}`); await load(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <><Navbar title={translate("Complete payment")} /><main className="dashboard journey-page"><section className="welcome"><div><p className="eyebrow">{translate("STEP 3 OF 3 · PAYMENT")}</p><h1>{purchase?.status === "active" && !purchase.balance_due ? translate("Payment confirmed. You're all set.") : translate("Complete your order")}</h1>{purchase && <><h2>{purchase.kind === "meal" ? <DynamicText kind="meal" id={purchase.meal_id} field="menu_description" source={purchase.menu} /> : purchase.name}</h2>{purchase.kind === "subscription" && <p>{translate("Includes: ")}{(purchase.meal_types || ["breakfast", "lunch", "dinner"]).map(translate).join(" · ")}</p>}<p>{purchase.start_date}{purchase.kind === "subscription" ? ` to ${purchase.end_date}` : ""}{translate(" · Total ₹")}{purchase.final_amount}{translate(" · Paid ₹")}{purchase.amount_paid}</p><p>{purchase.status === "cancelled" ? translate("This checkout was cancelled.") : purchase.status === "pending_acceptance" ? translate("Payment confirmed. Waiting for the owner to accept your meal order.") : purchase.status === "pending_payment" ? translate("Scan the QR below, pay the amount due, and submit your payment screenshot. Your owner will confirm the payment and accept your meal order. Subscriptions activate after full payment is confirmed.") : translate("Your booking is active. Check your dashboard for meal updates.")}</p></>}{purchase && purchase.status !== "cancelled" && <BillWorkflow checkout targetBillId={billId} onUpdate={load} />}<div className="form-actions"><Link to="/customer">{translate("Go to dashboard")}</Link>{purchase && purchase.status !== "pending_payment" && <Link to="/customer/bills">{translate("Payment receipts")}</Link>}</div></div></section>{error && <p className="alert error" role="alert">{translate(error)}</p>}{purchase === null ? <p role="status">{translate("Loading checkout…")}</p> : purchase === false ? <p className="empty-card">{translate("Checkout not found. ")}<Link to="/customer/choose">{translate("Choose your food")}</Link></p> : purchase.status === "cancelled" ? <Link className="btn btn-primary" to="/customer/choose">{translate("Choose another meal or plan")}</Link> : <>{purchase.status === "pending_payment" && <button className="btn btn-outline" disabled={busy} onClick={cancel}>{busy ? translate("Cancelling…") : translate("Cancel unpaid checkout")}</button>}</>}</main></>;
}
