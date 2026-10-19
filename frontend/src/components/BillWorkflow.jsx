import BillBreakdown from "./BillBreakdown";
import ExtraLines from "./ExtraLines";
import PaymentOptions from "./PaymentOptions";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
export default function BillWorkflow({ owner = false, onUpdate, view = "all", targetBillId, pendingOnly = false, payOnCheckout = false, checkout = false }) {
  const translate = useTranslation();
  const [search,setSearch] = useState("");
  const [submissionFilter,setSubmissionFilter] = useState("pending");
  const [outstandingOnly,setOutstandingOnly] = useState(false);
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
  const pendingSubmissionsByBill = new Map();
  submissions.filter((s) => s.status === "pending").forEach((s) => {
    const key = String(s.bill_id);
    pendingSubmissionsByBill.set(key, [...(pendingSubmissionsByBill.get(key) || []), s]);
  });
  const hasUnsubmittedUnseenBill = bills.some((b) => !b.seen && b.status !== "cancelled" && !pendingSubmissionsByBill.has(String(b.id)));
  const paymentAmount = amount;
  const matchesSearch=row=>`${row.name || ''} ${row.phone || ''} ${row.purchase_name || ''} ${row.bill_id || ''}`.toLowerCase().includes(search.toLowerCase().trim());
  const visibleAccounts=accounts.filter(row=>matchesSearch(row) && (!outstandingOnly || row.balance_due>0));
  const visibleSubmissions=owner?submissions.filter(row=>matchesSearch(row) && (pendingOnly || submissionFilter==='all' || row.status===submissionFilter)):submissions;
  const latestBills = bills.filter((b, i) => b.status !== "cancelled" && bills.findIndex((x) => x.plan_id === b.plan_id) === i);
  return <section className="management-card"><h2>{translate(owner ? (pendingOnly ? "Payment confirmation requests" : view === "bills" ? "Generate member bills" : view === "payments" ? "Review member payments" : "Generate bills & review payments") : checkout ? "Payment details" : "Generated bills & payment updates")}</h2>{translate(feedbackAt === "load" && feedback("load"))}
    {owner && <div className="history-filters"><label>{translate('Search bills and payments')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>{view !== 'bills' && !pendingOnly && <label>{translate('Payment status')}<select value={submissionFilter} onChange={e=>setSubmissionFilter(e.target.value)}><option value="pending">{translate('Awaiting your confirmation')}</option><option value="all">{translate('All submissions')}</option><option value="approved">{translate('approved')}</option><option value="rejected">{translate('rejected')}</option></select></label>}{view !== 'payments' && <label><input type="checkbox" checked={outstandingOnly} onChange={e=>setOutstandingOnly(e.target.checked)}/>{translate('Outstanding balances only')}</label>}</div>}
    {owner && view !== "payments" && !loaded && <p className="muted" role="status">{translate("Loading member bills…")}</p>}
    {owner && view !== "payments" && loaded && !error && !accounts.length && <div className="empty-card" role="status"><h3>{translate("No bills available yet")}</h3><p>{translate("There are no active member subscriptions to bill. Approve a member's selected plan in Requests or assign a subscription in Plans & subscriptions, then return here to generate their bill.")}</p></div>}
    {(!owner || view !== "payments") && (owner ? visibleAccounts.map((a) => <div className="request-row" key={a.plan_id}><div><strong>{a.name} · {a.phone}</strong><p>{translate("Base ₹")}{translate(a.base_amount)}{translate(" − skips ₹")}{translate(a.deductions)}{translate(" + guests & extras ₹")}{translate(a.extras_total)} = ₹{translate(a.final_amount)}</p><ExtraLines lines={a.extra_lines} /><p>{translate("Paid ₹")}{translate(a.amount_paid)}{translate(" · Due ₹")}{translate(a.balance_due)}</p></div><button className="btn btn-primary" disabled={busy || a.bill_generated} onClick={() => action(() => api.post(`/owner/bills/${a.plan_id}`), "Bill generated. Customer has an in-app notification.", `bill-${a.plan_id}`)}>{translate(a.bill_generated ? "✓ Generated" : a.issued_bill_id ? "Generate updated bill" : "Generate bill")}</button>{translate(feedback(`bill-${a.plan_id}`))}</div>) : <>
      {!checkout && hasUnsubmittedUnseenBill && <div className="alert success" role="status">{translate("Your bill has been generated. Review the amount below and select QR / UPI to pay your owner.")}</div>}
      {!bills.length && <p>{translate("No generated bills yet. Your live estimate is shown below.")}</p>}
      {!checkout && bills.map((b) => {
        const billPendingSubmissions = pendingSubmissionsByBill.get(String(b.id)) || [];
        const pendingSubmissionAmount = billPendingSubmissions.reduce((total, submission) => total + Number(submission.amount || 0), 0);
        const current = bills.find(x => x.plan_id === b.plan_id);
        const historical = current.id !== b.id;
        return <div className="request-row bill-record" key={b.id} id={`bill-${b.id}`} tabIndex={-1}>
          <div>
            <p className="bill-record-status"><strong>{translate(b.status === "cancelled" ? "Cancelled bill" : historical ? "Previous bill" : "Current bill")}</strong></p>
            {historical && <p>{translate("Replaced by bill #")}{current.id}. <a href={`#bill-${current.id}`} onClick={() => document.getElementById(`bill-${current.id}`)?.focus()}>{translate("View current bill #")}{current.id}</a></p>}
            <details open={!historical}>
              <summary>{translate("Bill #")}{b.id} · {translate(new Date(b.created_at + (b.created_at.endsWith("Z") ? "" : "Z")).toLocaleString(translate.locale))}</summary>
              <p><strong>{b.name}</strong> · {translate(b.kind === "meal" ? "Single meal" : "Subscription")}</p>
              <p>{translate(b.start_date)}{translate(" to ")}{translate(b.end_date)}</p>
              <BillBreakdown bill={b} showBalance={!historical} />
              {!historical && <p>{translate(b.status === "cancelled" ? "This checkout was cancelled." : b.balance_due === 0 ? "Paid" : billPendingSubmissions.length ? "Awaiting owner confirmation" : "Payment pending")}</p>}
              {billPendingSubmissions.length > 0 && <small>{translate("Payment submitted for confirmation: ₹")}{pendingSubmissionAmount}. {translate("Your balance changes after approval.")}</small>}
              <p className="muted">{translate(historical ? "Historical snapshot. Do not pay this bill; use the current bill above." : "Snapshot at generation; subsequent meal changes appear in the live bill.")}</p>
            </details>
          </div>
          {payOnCheckout && latestBills.some(latest => latest.id === b.id) && b.balance_due > 0 && b.status !== "cancelled" && !billPendingSubmissions.length && <Link className="btn btn-primary" to={`/customer/checkout?bill=${b.id}`}>{translate("Pay now")}</Link>}
          {!b.seen && <button className="btn btn-outline" disabled={busy} onClick={() => action(() => api.post(`/bills/issued/${b.id}/seen`), "Notification marked read", `notice-${b.id}`)}>{translate("Mark read")}</button>}
          {translate(feedback(`notice-${b.id}`))}
        </div>;
      })}
      {!payOnCheckout && latestBills.some((b) => b.balance_due > 0) && <form className="meal-form" onSubmit={submit}>{!checkout && <label className="form-field">{translate("Bill")}<select required value={billId} onChange={(e) => {setBillId(e.target.value);setAmount("");}}><option value="">{translate("Choose bill")}</option>{latestBills.filter((b) => b.balance_due > 0).map((b) => <option key={b.id} value={b.id}>{b.name} · {translate("Bill #")}{translate(b.id)}{translate(" · Due ₹")}{translate(b.balance_due)}</option>)}</select></label>}<p className="form-wide">{translate("Pay your owner outside Smart Mess first. Enter the amount you paid and submit proof; your balance changes only after confirmation.")}</p><label className="form-field">{translate("Amount you already paid (₹)")}<input required type="number" min="0.01" step="0.01" max={bills.find((b) => b.id === Number(billId))?.balance_due} value={paymentAmount} onChange={(e) => setAmount(e.target.value)} /></label><label className="form-field">{translate("Payment method")}<select required value={method} onChange={(e) => setMethod(e.target.value)}><option value="">{translate("Choose payment method")}</option><option value="upi">{translate("QR / UPI")}</option></select></label><label className="form-field">{translate("Transaction reference / note")}<input maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} /></label>{method === "upi" && <PaymentOptions />}{method === "upi" && <label className="form-field">{translate("Paid screenshot (PNG/JPEG, up to 5 MB)")}<input required type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files[0])} /></label>}<button className="btn btn-primary" disabled={busy || paymentPending}>{translate(paymentPending ? "Awaiting owner confirmation" : busy ? "Submitting…" : "Submit payment for confirmation")}</button>{translate(feedback("payment"))}</form>}
    </>)}
    {view !== "bills" && <><h3>{translate(pendingOnly ? "Awaiting your confirmation" : "Payment submissions")}</h3>{!visibleSubmissions.length && <p>{translate(owner ? "No submissions match this view." : "No payment submissions yet.")}</p>}{visibleSubmissions.map((s) => <div className="request-row" key={s.id}><div><strong>{translate(owner ? s.name + " · " : "")}₹{translate(s.amount)} · {translate(s.method)}</strong><p>{s.purchase_name} · {translate(s.kind === "meal" ? "Single meal" : "Subscription")}</p><p>{translate("Bill #")}{translate(s.bill_id)} · <span className={`status-badge status-${s.status}`}>{translate(s.status)}</span> · {s.reference}</p>{s.has_image && <button className="btn btn-outline" onClick={() => showImage(s.id)}>{translate("View paid screenshot")}</button>}</div>{owner && s.status === "pending" && <div className="row-actions"><button className="btn btn-primary" disabled={busy} onClick={() => action(() => api.patch(`/owner/payment-submissions/${s.id}`, { status: "approved" }), "Payment confirmed and receipt saved.", `submission-${s.id}`)}>{translate("Confirm received")}</button><button className="btn btn-outline" disabled={busy} onClick={() => action(() => api.patch(`/owner/payment-submissions/${s.id}`, { status: "rejected" }), "Payment rejected. Customer can resubmit.", `submission-${s.id}`)}>{translate("Reject")}</button></div>}{translate(feedback(`submission-${s.id}`))}</div>)}
    {image && <div><button className="btn btn-outline" onClick={() => setImage("")}>{translate("Close screenshot")}</button><img src={image} alt={translate("Member payment screenshot")} style={{ display: "block", maxWidth: "100%", maxHeight: 600 }} /></div>}
    </>}
  </section>;
}
