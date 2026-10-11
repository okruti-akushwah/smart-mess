import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";

export default function PersonalOrders({ onUpdate }) {
  const [orders, setOrders] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(null);
  const [notification, setNotification] = useState(null);
  const known = useRef(new Map());
  const dismissed = useRef(new Set());
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/owner/personal-orders");
      setOrders(data);
      const fresh = data.find(order => !order.accepted && !dismissed.current.has(`${order.plan_id}-${order.status}`)
        && known.current.get(order.plan_id) !== order.status);
      if (fresh) setNotification(fresh);
      known.current = new Map(data.map(order => [order.plan_id, order.status]));
    } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0), timer = setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [load]);
  async function accept(order) {
    setBusy(order.plan_id); setError("");
    try { await api.post(`/owner/personal-orders/${order.plan_id}/accept`); setNotification(null); await load(); onUpdate?.(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  const rows = orders.filter(order => !order.accepted);
  return <section className="management-card" id="personal-orders"><h2>Personal meal orders</h2><p>Confirm payment in Payments, then accept the meal order. Accepted meals are included in preparation totals.</p>
    {error && <p className="alert error" role="alert">{error}</p>}
    {!rows.length && <p>No personal orders awaiting acceptance.</p>}
    {rows.map(order => <div className="request-row" key={order.plan_id}><div><strong>{order.customer_name} · {order.meal_type} · {order.start_date}</strong><p>{order.menu}</p><p>₹{order.final_amount} · Paid ₹{order.amount_paid} · {order.status === "pending_acceptance" ? "Payment confirmed — ready to accept" : "Awaiting payment confirmation"}</p></div><button className="btn btn-primary" disabled={busy !== null || order.status !== "pending_acceptance"} onClick={() => accept(order)}>Accept order</button></div>)}
    {notification && <div className="modal-backdrop"><section className="guest-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-order-title"><h2 id="personal-order-title">{notification.status === "pending_acceptance" ? "Paid meal order ready to accept" : "New personal meal order"}</h2><p role="status">{notification.customer_name} · {notification.meal_type} · {notification.start_date}</p><p>{notification.menu} · ₹{notification.final_amount}</p><div className="form-actions">{notification.status === "pending_acceptance" && <button autoFocus className="btn btn-primary" disabled={busy !== null} onClick={() => accept(notification)}>Accept order</button>}<button className="btn btn-outline" onClick={() => { dismissed.current.add(`${notification.plan_id}-${notification.status}`); setNotification(null); }}>Close notification</button></div></section></div>}
  </section>;
}
