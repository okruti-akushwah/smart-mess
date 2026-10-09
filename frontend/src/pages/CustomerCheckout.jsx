import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PaymentOptions from "../components/PaymentOptions";
import BillWorkflow from "../components/BillWorkflow";
import api, { errorMessage } from "../services/api";
import "../components/customerJourney.css";

export default function CustomerCheckout() {
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
  return <><Navbar title="Complete payment" /><main className="dashboard journey-page"><section className="welcome"><div><p className="eyebrow">STEP 3 OF 3 · PAYMENT</p><h1>{purchase?.status === "active" && !purchase.balance_due ? "Payment confirmed. You're all set." : "Complete your order"}</h1>{purchase && <><h2>{purchase.name}</h2><p>{purchase.start_date}{purchase.kind === "subscription" ? ` to ${purchase.end_date}` : ""} · Total ₹{purchase.final_amount} · Paid ₹{purchase.amount_paid}</p><p>{purchase.status === "cancelled" ? "This checkout was cancelled." : purchase.status === "pending_payment" ? "Pay your owner, then submit the payment below. Your booking activates after full payment is confirmed." : "Your booking is active. Check your dashboard for meal updates."}</p></>}<div className="form-actions"><Link className="btn btn-outline" to="/customer/bills">View bills & payment receipts</Link><Link to="/customer">Go to dashboard</Link></div></div></section>{error && <p className="alert error" role="alert">{error}</p>}{purchase === null ? <p role="status">Loading checkout…</p> : purchase === false ? <p className="empty-card">Checkout not found. <Link to="/customer/choose">Choose your food</Link></p> : purchase.status === "cancelled" ? <Link className="btn btn-primary" to="/customer/choose">Choose another meal or plan</Link> : <>{purchase.balance_due > 0 && <PaymentOptions />}<BillWorkflow targetBillId={billId} onUpdate={load} />{purchase.status === "pending_payment" && <button className="btn btn-outline" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Cancel unpaid checkout"}</button>}</>}</main></>;
}
