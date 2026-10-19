import Dialog from "./ui/Dialog";
import DynamicText from "../components/DynamicText";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { localDay } from "../services/dates";
import Icon from './Icon';
import './order-records.css';

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
  function dismissNotification() { dismissed.current.add(`${notification.plan_id}-${notification.status}`); setNotification(null); }
  const rows = orders.filter(order => !order.accepted);
  const todayOrders = orders.filter(order => order.start_date === localDay());
  const money = amount => Number(amount).toLocaleString(translate.locale, {minimumFractionDigits:2});
  const displayDate = date => new Date(`${date}T00:00:00`).toLocaleDateString(translate.locale, {day:'numeric',month:'short',year:'numeric'});
  return <><section className="management-card order-records" id="today-personal-orders"><h2>{translate("Today’s orders")}</h2><p className="order-records-intro">{translate("Personal meal orders for ")}{displayDate(localDay())}{translate(". Accepted orders stay here with their delivery details. Refreshes every 5 seconds.")}</p>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {!todayOrders.length && <p>{translate("No personal meal orders for today.")}</p>}
    <div className="order-record-grid">{todayOrders.map(order => <article className="meal-order-card" key={order.plan_id}>
      <header className="meal-order-heading"><div><h3>{order.customer_name}</h3><span className="meal-order-meta"><Icon name="meal" size={16}/>{translate(order.meal_type)}</span></div><span className={`meal-order-state ${order.accepted && order.status === 'active' ? 'is-ready' : 'is-waiting'}`}>{order.accepted && order.status === "active" ? translate("Accepted · ready to prepare") : order.status === "pending_acceptance" ? translate("Paid · awaiting acceptance") : translate("Awaiting payment confirmation")}</span></header>
      <p className="meal-order-menu"><DynamicText kind="meal" id={order.meal_id || order.id} field="menu_description" source={order.menu}/></p>
      <div className="meal-order-summary"><span>{translate('Quantity')} <strong>{order.quantity || 1}</strong></span><strong>₹{money(order.final_amount)}</strong><span>{translate('Paid ₹')}{money(order.amount_paid)}</span></div>
      <div className="meal-order-delivery"><Icon name="location" size={18}/><div><strong>{translate("Delivery address:")}</strong><p>{order.address || translate("Address not saved — contact customer before delivery.")}</p>{order.instructions && <p className="meal-order-instructions"><strong>{translate("Instructions:")}</strong> {order.instructions}</p>}<a href={`tel:${order.customer_phone}`}>{translate('Phone: ')}{order.customer_phone}</a></div></div>
    </article>)}</div>
  </section><section className="management-card order-records" id="personal-orders"><h2>{translate("Personal meal orders awaiting acceptance")}</h2><p className="order-records-intro">{translate("Confirm payment in Payments, then accept the meal order. Accepted meals are included in preparation totals.")}</p>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {!rows.length && <p>{translate("No personal orders awaiting acceptance.")}</p>}
    <div className="order-record-grid">{rows.map(order => <article className="meal-order-card" key={order.plan_id}>
      <header className="meal-order-heading"><div><h3>{order.customer_name}</h3><span className="meal-order-meta"><Icon name="calendar" size={16}/><time dateTime={order.start_date}>{displayDate(order.start_date)}</time><span>·</span>{translate(order.meal_type)}</span></div></header>
      <p className="meal-order-menu"><DynamicText kind="meal" id={order.meal_id || order.id} field="menu_description" source={order.menu}/></p>
      <div className="meal-order-summary"><strong>₹{money(order.final_amount)}</strong><span>{translate('Paid ₹')}{money(order.amount_paid)}</span></div>
      <p className={`meal-order-state ${order.status === 'pending_acceptance' ? 'is-ready' : 'is-waiting'}`}>{order.status === "pending_acceptance" ? translate("Payment confirmed — ready to accept") : translate("Awaiting payment confirmation")}</p>
      <div className="meal-order-actions"><button className="btn btn-primary" disabled={busy !== null || order.status !== "pending_acceptance"} onClick={() => accept(order)}>{translate("Accept order")}</button></div>
    </article>)}</div>
    {notification && <Dialog open busy={busy !== null} title={notification.status === "pending_acceptance" ? translate("Paid meal order ready to accept") : translate("New personal meal order")} onClose={dismissNotification}><p role="status">{notification.customer_name} · {translate(notification.meal_type)} · {notification.start_date}</p><p><DynamicText kind="meal" id={notification.meal_id || notification.id} field="menu_description" source={notification.menu} /> · ₹{notification.final_amount}</p>{error && <p className="alert error" role="alert">{translate(error)}</p>}<div className="form-actions">{notification.status === "pending_acceptance" && <button className="btn btn-primary" disabled={busy !== null} onClick={() => accept(notification)}>{translate("Accept order")}</button>}<button className="btn btn-outline" disabled={busy !== null} onClick={dismissNotification}>{translate("Close notification")}</button></div></Dialog>}
  </section></>;
}
