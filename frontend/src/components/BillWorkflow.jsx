import PaymentOptions from "./PaymentOptions";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
export default function BillWorkflow({ owner = false, onUpdate, view = "all", targetBillId, pendingOnly = false, payOnCheckout = false, checkout = false }) {
  const translate = useTranslation();
  const [bills, setBills] = useState([]),[submissions, setSubmissions] = useState([]),[accounts, setAccounts] = useState([]);
  const [billId, setBillId] = useState(""),[amount, setAmount] = useState(""),[method, setMethod] = useState(""),[reference, setReference] = useState(""),[file, setFile] = useState(null);
  const [error, setError] = useState(""),[message, setMessage] = useState(""),[busy, setBusy] = useState(false),[image, setImage] = useState("");
  const [feedbackAt, setFeedbackAt] = useState("load");
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([api.get(owner ? "/owner/payments" : "/bills/issued"), api.get("/payments/submissions")]);
      if (owner) setAccounts(a.data);else {
        setBills(targetBillId ? a.data.filter(b => String(b.id) === String(targetBillId)) : a.data);
        const payable = a.data.filter((b, i, all) => all.findIndex((x) => x.plan_id === b.plan_id) === i && b.balance_due > 0 && b.status !== "cancelled" && (!targetBillId || String(b.id) === String(targetBillId)));
        setBillId((previous) => {
          if (payable.some((b) => String(b.id) === previous)) return previous;
          const selected = payable[0];
          return selected ? String(selected.id) : "";
        });
      }
      setSubmissions(s.data.filter(x => (!targetBillId || String(x.bill_id) === String(targetBillId)) && (!pendingOnly || x.status === "pending")));
    } catch (e) {setError(errorMessage(e));} finally {setLoaded(true);}
  }, [owner, targetBillId, pendingOnly]);
  useEffect(() => {const t = setTimeout(load, 0);const interval = setInterval(load, 15000);return () => {clearTimeout(t);clearInterval(interval);};}, [load]);
  useEffect(() => () => {if (image) URL.revokeObjectURL(image);}, [image]);
  async function action(fn, success, target) {
    setFeedbackAt(target);
    setBusy(true);setError("");setMessage("");
    try {await fn();setMessage(success);await load();onUpdate?.();} catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  }
  async function submit(e) {
    e.preventDefault();const data = new FormData();data.append("bill_id", billId);data.append("amount", amount === "" ? bills.find((b) => String(b.id) === billId)?.balance_due ?? "" : amount);data.append("method", method);data.append("reference", reference);if (file) data.append("file", file);
    await action(() => api.post("/payments/submissions", data, { headers: { "Content-Type": undefined } }), "Payment submitted for owner confirmation. Your balance changes after approval.", "payment");
  }
  async function showImage(id) {
    try {const r = await api.get(`/payments/submissions/${id}/image`, { responseType: "blob" });setImage(URL.createObjectURL(r.data));} catch (e) {setError(errorMessage(e));}
  }
  function feedback(target) {
    return feedbackAt === target && <div className="action-feedback" aria-live="polite">{error && <p role="alert" className="alert error">{translate(error)}</p>}{message && <p role="status" className="alert success">{translate(message)}</p>}</div>;
  }
  const paymentPending = submissions.some((s) => String(s.bill_id) === billId && s.status === "pending");
  const selectedBill = bills.find((b) => String(b.id) === billId);
  const paymentAmount = amount === "" ? selectedBill?.balance_due ?? "" : amount;
  const latestBills = bills.filter((b, i) => b.status !== "cancelled" && bills.findIndex((x) => x.plan_id === b.plan_id) === i);
  return <section className="management-card"><h2>{translate(owner ? (pendingOnly ? "Payment confirmation requests" : view === "bills" ? "Generate customer bills" : view === "payments" ? "Review customer payments" : "Generate bills & review payments") : checkout ? "Pay for your order" : "Generated bills & payment updates")}</h2>{translate(feedbackAt === "load" && feedback("load"))}
    {owner && view !== "payments" && !loaded && <p className="muted" role="status">{translate("Loading customer bills…")}</p>}
    {owner && view !== "payments" && loaded && !error && !accounts.length && <div className="empty-card" role="status"><h3>{translate("No bills available yet")}</h3><p>{translate("There are no active customer subscriptions to bill. Approve a customer's selected plan in Requests or assign a subscription in Plans & subscriptions, then return here to generate their bill.")}</p></div>}
    {(!owner || view !== "payments") && (owner ? accounts.map((a) => <div className="request-row" key={a.plan_id}><div><strong>{a.name} · {a.phone}</strong><p>{translate("Base ₹")}{translate(a.base_amount)}{translate(" − skips ₹")}{translate(a.deductions)}{translate(" + guests ₹")}{translate(a.extras_total)} = ₹{translate(a.final_amount)}</p><p>{translate("Paid ₹")}{translate(a.amount_paid)}{translate(" · Due ₹")}{translate(a.balance_due)}</p></div><button className="btn btn-primary" disabled={busy || a.bill_generated} onClick={() => action(() => api.post(`/owner/bills/${a.plan_id}`), "Bill generated. Customer has an in-app notification.", `bill-${a.plan_id}`)}>{translate(a.bill_generated ? "✓ Generated" : a.issued_bill_id ? "Generate updated bill" : "Generate bill")}</button>{translate(feedback(`bill-${a.plan_id}`))}</div>) : <>
      {!checkout && bills.some((b) => !b.seen && b.status !== "cancelled") && <div className="alert success" role="status">{translate("Your bill has been generated. Review the amount below and select QR / UPI to pay your owner.")}</div>}
      {!bills.length && <p>{translate("No generated bills yet. Your live estimate is shown below.")}</p>}
      {!checkout && bills.map((b) => <div className="request-row" key={b.id}><div><strong>{translate("Bill #")}{translate(b.id)} · {translate(new Date(b.created_at + (b.created_at.endsWith("Z") ? "" : "Z")).toLocaleString(translate.locale))}</strong><p><strong>{b.name}</strong> · {translate(b.kind === "meal" ? "Single meal" : "Subscription")}</p><p>{translate(b.start_date)}{translate(" to ")}{translate(b.end_date)}</p><p>{translate("Base ₹")}{translate(b.base_amount)}{translate(" − skips ₹")}{translate(b.deductions)}{translate(" + guests ₹")}{translate(b.extras_total)} = ₹{translate(b.final_amount)}</p><p>{translate("Paid ₹")}{translate(b.amount_paid)}{translate(" · Due ₹")}{translate(b.balance_due)} · {translate(b.balance_due === 0 ? "Paid" : "Payment pending")}</p><small>{translate("Snapshot at generation; subsequent meal changes appear in the live bill.")}</small></div>{payOnCheckout && b.balance_due > 0 && b.status !== "cancelled" && <Link className="btn btn-primary" to={`/customer/checkout?bill=${b.id}`}>{translate("Pay now")}</Link>}{!b.seen && <button className="btn btn-outline" disabled={busy} onClick={() => action(() => api.post(`/bills/issued/${b.id}/seen`), "Notification marked read", `notice-${b.id}`)}>{translate("Mark read")}</button>}{translate(feedback(`notice-${b.id}`))}</div>)}
      {!payOnCheckout && latestBills.some((b) => b.balance_due > 0) && <form className="meal-form" onSubmit={submit}>{!checkout && <label className="form-field">{translate("Bill")}<select required value={billId} onChange={(e) => {setBillId(e.target.value);setAmount("");}}><option value="">{translate("Choose bill")}</option>{latestBills.filter((b) => b.balance_due > 0).map((b) => <option key={b.id} value={b.id}>{b.name} · {translate("Bill #")}{translate(b.id)}{translate(" · Due ₹")}{translate(b.balance_due)}</option>)}</select></label>}<label className="form-field">{translate("Amount paid (₹)")}<input required type="number" min="0.01" step="0.01" max={bills.find((b) => b.id === Number(billId))?.balance_due} value={paymentAmount} onChange={(e) => setAmount(e.target.value)} /></label><label className="form-field">{translate("Method")}<select required value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Choose payment method</option><option value="upi">{translate("QR / UPI")}</option></select></label><label className="form-field">{translate("Transaction reference / note")}<input maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} /></label>{method === "upi" && <PaymentOptions />}{method === "upi" && <label className="form-field">{translate("Paid screenshot (PNG/JPEG, up to 5 MB)")}<input required type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files[0])} /></label>}<button className="btn btn-primary" disabled={busy || paymentPending}>{translate(paymentPending ? "Awaiting owner confirmation" : busy ? "Submitting…" : "Submit payment for confirmation")}</button>{translate(feedback("payment"))}</form>}
    </>)}
    {view !== "bills" && <><h3>{translate(pendingOnly ? "Awaiting your confirmation" : "Payment submissions")}</h3>{!submissions.length && <p>{translate(pendingOnly ? "No payment confirmation requests at the moment." : "No payment submissions yet.")}</p>}{submissions.map((s) => <div className="request-row" key={s.id}><div><strong>{translate(owner ? s.name + " · " : "")}₹{translate(s.amount)} · {translate(s.method)}</strong><p>{s.purchase_name} · {translate(s.kind === "meal" ? "Single meal" : "Subscription")}</p><p>{translate("Bill #")}{translate(s.bill_id)} · {translate(s.status)} · {s.reference}</p>{s.has_image && <button className="btn btn-outline" onClick={() => showImage(s.id)}>{translate("View paid screenshot")}</button>}</div>{owner && s.status === "pending" && <div><button className="btn btn-primary" disabled={busy} onClick={() => action(() => api.patch(`/owner/payment-submissions/${s.id}`, { status: "approved" }), "Payment confirmed and receipt saved.", `submission-${s.id}`)}>{translate("Confirm received")}</button><button className="btn btn-outline" disabled={busy} onClick={() => action(() => api.patch(`/owner/payment-submissions/${s.id}`, { status: "rejected" }), "Payment rejected. Customer can resubmit.", `submission-${s.id}`)}>{translate("Reject")}</button></div>}{translate(feedback(`submission-${s.id}`))}</div>)}
    {image && <div><button className="btn btn-outline" onClick={() => setImage("")}>{translate("Close screenshot")}</button><img src={image} alt={translate("Customer payment screenshot")} style={{ display: "block", maxWidth: "100%", maxHeight: 600 }} /></div>}
    </>}
  </section>;
}
