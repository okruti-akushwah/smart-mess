import { useEffect, useState } from "react";
import api from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import BillNotification from "./BillNotification";
import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar({ title = "Dashboard" }) {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const role = localStorage.getItem("role");

  const [messName, setMessName] = useState("");
  useEffect(() => {
    if (role !== "customer") return;
    let active = true;
    api.get("/customer/account").then(({ data }) => {
      if (active) setMessName(data.mess_name);
    }).catch(() => {});
    return () => { active = false; };
  }, [role]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    navigate(role === "owner" ? "/owner/login" : "/login");
  };

  return (
    <header className={`navbar ${role === "owner" ? "owner-navbar" : "customer-navbar"}`}>
      <Link
        className="brand clickable"
        to={role === "owner" ? "/owner" : role === "customer" ? "/customer" : "/"}>
        
        <div className="brand-icon">{translate("M")}</div>

        <div>
          <h2>{messName || translate("Smart Mess")}</h2>
          <span>{translate("Fresh meals. Less waste.")}</span>
        </div>
      </Link>

      <nav className="nav-links" aria-label={translate("Main navigation")}>
        {role === "owner" ? [
          ["/owner", "Dashboard"], ["/owner/public-page", "Public page"],
          ["/owner/requests", "Requests"], ["/owner/meals", "Meals"],
          ["/owner/plans", "Plans & subscriptions"], ["/owner/payments", "Payments"],
          ["/owner/bills", "Bills"], ["/owner/delivery", "Deliveries"], ["/owner/settings", "Settings"],
        ].map(([path, label]) => <Link key={path} to={path} aria-current={location.pathname === path ? "page" : undefined}>{translate(label)}</Link>) : [
          ["/customer", "Dashboard"],
          ["/customer/choose?type=meal", "Order food"],
          ["/customer/plans", "Subscriptions"],
          ["/customer/pause", "Pause meals"],
          ["/customer/history", "Meal history"],
          ["/customer/bills", "Bills"],
          ["/customer/reviews", "Reviews"],
        ].map(([path, label]) => <Link key={path} to={path} aria-current={location.pathname === path.split("?")[0] ? "page" : undefined}>{translate(label)}</Link>)}
      </nav>

      <div className="nav-right">
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
