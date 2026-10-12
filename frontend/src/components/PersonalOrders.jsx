import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { localDay } from "../services/dates";

export default function PersonalOrders({ onUpdate }) {
  const [orders, setOrders] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(null);
  const [notification, setNotification] = useState(null);
  const known = useRef(new Map());
  const dismissed = useRef(new Set());
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/owner/personal-orders");
      setOrders(data);
      const fresh = data.find(order => order.status === "pending_acceptance" && Number(order.balance_due) === 0 && !order.accepted && !dismissed.current.has(`${order.plan_id}-${order.status}`)
        && known.current.get(order.plan_id) !== order.status);
      setNotification(previous => {
        if (fresh) return fresh;
        return previous && data.some(order => order.plan_id === previous.plan_id && order.status === "pending_acceptance" && Number(order.balance_due) === 0 && !order.accepted) ? previous : null;
      });
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
  const todayOrders = orders.filter(order => order.start_date === localDay());
  return <><section className="management-card" id="today-personal-orders"><h2>Today’s orders</h2><p>Personal meal orders for {localDay()}. Accepted orders stay here with their delivery details. Refreshes every 5 seconds.</p>
    {error && <p className="alert error" role="alert">{error}</p>}
    {!todayOrders.length && <p>No personal meal orders for today.</p>}
    {todayOrders.map(order => <article className="request-row" key={order.plan_id}><div><strong>{order.customer_name} · {order.meal_type}</strong><p>{order.menu} · Quantity: {order.quantity || 1}</p><p>Phone: <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p><p><strong>Delivery address:</strong> {order.address || "Address not saved — contact customer before delivery."}</p>{order.instructions && <p><strong>Instructions:</strong> {order.instructions}</p>}<p>{order.accepted && order.status === "active" ? "Accepted · ready to prepare" : order.status === "pending_acceptance" ? "Paid · awaiting acceptance" : "Awaiting payment confirmation"} · ₹{order.final_amount} · Paid ₹{order.amount_paid}</p></div></article>)}
  </section><section className="management-card" id="personal-orders"><h2>Personal meal orders awaiting acceptance</h2><p>Confirm payment in Payments, then accept the meal order. Accepted meals are included in preparation totals.</p>
    {error && <p className="alert error" role="alert">{error}</p>}
    {!rows.length && <p>No personal orders awaiting acceptance.</p>}
    {rows.map(order => <div className="request-row" key={order.plan_id}><div><strong>{order.customer_name} · {order.meal_type} · {order.start_date}</strong><p>{order.menu}</p><p>₹{order.final_amount} · Paid ₹{order.amount_paid} · {order.status === "pending_acceptance" ? "Payment confirmed — ready to accept" : "Awaiting payment confirmation"}</p></div><button className="btn btn-primary" disabled={busy !== null || order.status !== "pending_acceptance"} onClick={() => accept(order)}>Accept order</button></div>)}
    {notification && <div className="modal-backdrop"><section className="guest-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-order-title"><h2 id="personal-order-title">{notification.status === "pending_acceptance" ? "Paid meal order ready to accept" : "New personal meal order"}</h2><p role="status">{notification.customer_name} · {notification.meal_type} · {notification.start_date}</p><p>{notification.menu} · ₹{notification.final_amount}</p><div className="form-actions">{notification.status === "pending_acceptance" && <button autoFocus className="btn btn-primary" disabled={busy !== null} onClick={() => accept(notification)}>Accept order</button>}<button className="btn btn-outline" onClick={() => { dismissed.current.add(`${notification.plan_id}-${notification.status}`); setNotification(null); }}>Close notification</button></div></section></div>}
  </section></>;
}
