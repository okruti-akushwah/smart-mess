import { useTranslation } from "../i18n/useTranslation";
import { loginUrl } from "../services/authRouting";
import MembershipGate from "./MembershipGate";
import CustomerAddressGate from "./CustomerAddressGate";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, requiredRole }) {
  const translate = useTranslation();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to={loginUrl(location.pathname + location.search + location.hash)} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <Navigate
        to={role === "owner" ? "/owner" : "/customer"}
        replace />);


  }

  if (role === "customer" && location.pathname === "/customer/history") return children;

  if (role === "customer" && !localStorage.getItem("activeMessToken")) {
    return <Navigate to="/customer/messes" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }

  return role === "customer" ? <MembershipGate><CustomerAddressGate>{translate(children)}</CustomerAddressGate></MembershipGate> : children;
}

export default ProtectedRoute;
