import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
export default function BillNotification() {
  const translate = useTranslation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => api.get("/bills/issued").then((r) => {if (active) setCount(r.data.filter((b) => !b.seen && b.status !== "cancelled").length);}).catch(() => {});
    load();const timer = setInterval(load, 15000);
    return () => {active = false;clearInterval(timer);};
  }, []);
  return count > 0 ? <Link role="status" to="/customer/bills">{translate("Your bill has been generated (")}{translate(count)})</Link> : null;
}
