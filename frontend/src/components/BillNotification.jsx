import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Icon from "./Icon";
export default function BillNotification() {
  const translate = useTranslation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => api.get("/bills/issued").then((r) => {if (active) setCount(r.data.filter((b) => !b.seen && b.status !== "cancelled").length);}).catch(() => {});
    load();const timer = setInterval(load, 15000);
    return () => {active = false;clearInterval(timer);};
  }, []);
  return count > 0 ? <Link className="workspace-bill-notification" to="/customer/bills" aria-label={`${translate("Your bill has been generated (")}${translate(count)})`}><Icon name="bell" /><span className="workspace-notification-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span></Link> : null;
}
