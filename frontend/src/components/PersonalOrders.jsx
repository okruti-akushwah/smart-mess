import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { localDay } from "../services/dates";

export default function PersonalOrders({ onUpdate }) {
  const translate = useTranslation();

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
  return <><section className="management-card" id="today-personal-orders"><h2>{translate("Today’s orders")}</h2><p>{translate("Personal meal orders for ")}{localDay()}{translate(". Accepted orders stay here with their delivery details. Refreshes every 5 seconds.")}</p>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {!todayOrders.length && <p>{translate("No personal meal orders for today.")}</p>}
    {todayOrders.map(order => <article className="request-row" key={order.plan_id}><div><strong>{order.customer_name} · {translate(order.meal_type)}</strong><p><DynamicText kind="meal" id={order.meal_id || order.id} field="menu_description" source={order.menu} />{translate(" · Quantity: ")}{order.quantity || 1}</p><p>{translate("Phone: ")}<a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p><p><strong>{translate("Delivery address:")}</strong> {order.address || "Address not saved — contact customer before delivery."}</p>{order.instructions && <p><strong>{translate("Instructions:")}</strong> {order.instructions}</p>}<p>{order.accepted && order.status === "active" ? translate("Accepted · ready to prepare") : order.status === "pending_acceptance" ? translate("Paid · awaiting acceptance") : translate("Awaiting payment confirmation")} · ₹{order.final_amount}{translate(" · Paid ₹")}{order.amount_paid}</p></div></article>)}
  </section><section className="management-card" id="personal-orders"><h2>{translate("Personal meal orders awaiting acceptance")}</h2><p>{translate("Confirm payment in Payments, then accept the meal order. Accepted meals are included in preparation totals.")}</p>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {!rows.length && <p>{translate("No personal orders awaiting acceptance.")}</p>}
    {rows.map(order => <div className="request-row" key={order.plan_id}><div><strong>{order.customer_name} · {translate(order.meal_type)} · {order.start_date}</strong><p><DynamicText kind="meal" id={order.meal_id || order.id} field="menu_description" source={order.menu} /></p><p>₹{order.final_amount}{translate(" · Paid ₹")}{order.amount_paid} · {order.status === "pending_acceptance" ? translate("Payment confirmed — ready to accept") : translate("Awaiting payment confirmation")}</p></div><button className="btn btn-primary" disabled={busy !== null || order.status !== "pending_acceptance"} onClick={() => accept(order)}>{translate("Accept order")}</button></div>)}
    {notification && <div className="modal-backdrop"><section className="guest-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-order-title"><h2 id="personal-order-title">{notification.status === "pending_acceptance" ? translate("Paid meal order ready to accept") : translate("New personal meal order")}</h2><p role="status">{notification.customer_name} · {translate(notification.meal_type)} · {notification.start_date}</p><p><DynamicText kind="meal" id={notification.meal_id || notification.id} field="menu_description" source={notification.menu} /> · ₹{notification.final_amount}</p><div className="form-actions">{notification.status === "pending_acceptance" && <button autoFocus className="btn btn-primary" disabled={busy !== null} onClick={() => accept(notification)}>{translate("Accept order")}</button>}<button className="btn btn-outline" onClick={() => { dismissed.current.add(`${notification.plan_id}-${notification.status}`); setNotification(null); }}>{translate("Close notification")}</button></div></section></div>}
  </section></>;
}
