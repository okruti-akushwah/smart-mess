import { useEffect, useState } from "react";
import api from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import BillNotification from "./BillNotification";
import NotificationSound from "./NotificationSound";
import Icon from "./Icon";
import { Link, useNavigate, useLocation } from "react-router-dom";

const navIcon = label => ({ Dashboard: 'home', Members: 'people', 'My messes': 'people', Requests: 'people', Meals: 'meal', 'Order food': 'meal', 'Plans & subscriptions': 'calendar', Subscriptions: 'calendar', 'Pause meals': 'pause', Bills: 'bill', Payments: 'bill', 'Meal history': 'calendar', Reviews: 'star', Settings: 'settings', 'Public page': 'home' }[label] || 'home');

function Navbar({ title = "Dashboard" }) {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const role = localStorage.getItem("role");
  const isMessDirectory = location.pathname === "/customer/messes";

  const [messName, setMessName] = useState("");
  useEffect(() => {
    if (role !== "customer" || isMessDirectory) return;
    let active = true;
    api.get("/customer/account").then(({ data }) => {
      if (active) setMessName(data.mess_name);
    }).catch(() => {});
    return () => { active = false; };
  }, [role, isMessDirectory]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("activeMessToken");

    navigate("/login");
  };

  return (
    <header className={`navbar ${role === "owner" ? "owner-navbar" : "customer-navbar"}`}>
      <Link
        className="brand clickable"
        to={role === "owner" ? "/owner" : role === "customer" ? "/customer" : "/"}>
        
        <div className="brand-icon">{translate("M")}</div>

        <div>
          <h2>{isMessDirectory ? translate("Smart Mess") : messName || translate("Smart Mess")}</h2>
          <span>{translate("Fresh meals. Less waste.")}</span>
        </div>
      </Link>

      <nav className="nav-links" aria-label={translate("Main navigation")}>
        {role === "owner" ? [
          ["/owner", "Dashboard"], ["/owner/public-page", "Public page"],
          ["/owner/requests", "Requests"], ["/owner/customers", "Members"], ["/owner/meals", "Meals"],
          ["/owner/plans", "Plans & subscriptions"], ["/owner/payments", "Payments"],
          ["/owner/bills", "Bills"], ["/owner/settings", "Settings"],
        ].map(([path, label]) => <Link key={path} to={path} aria-current={location.pathname === path ? "page" : undefined}><Icon name={navIcon(label)} size={17} /><span>{translate(label)}</span></Link>) : [
          ["/customer/messes", "My messes"], ["/customer", "Dashboard"],
          ["/customer/choose?type=meal", "Order food"],
          ["/customer/plans", "Subscriptions"],
          ["/customer/pause", "Pause meals"],
          ["/customer/history", "Meal history"],
          ["/customer/bills", "Bills"],
          ["/customer/reviews", "Reviews"],
        ].map(([path, label]) => <Link key={path} to={path} aria-current={location.pathname === path.split("?")[0] ? "page" : undefined}><Icon name={navIcon(label)} size={17} /><span>{translate(label)}</span></Link>)}
      </nav>

      <div className="nav-right">
        <NotificationSound role={role} />
        {role === "customer" && <BillNotification />}
        <span className="nav-page">
          {translate(title)}
        </span>

        <button
          className="btn btn-outline"
          onClick={logout}>{translate(" Logout ")}


        </button>
      </div>
    </header>);

}

export default Navbar;
