import { useTranslation } from "../i18n/useTranslation";
import MembershipGate from "./MembershipGate";
import CustomerAddressGate from "./CustomerAddressGate";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, requiredRole }) {
  const translate = useTranslation();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to={requiredRole === "owner" ? "/owner/login" : "/login"} state={{ from: location.pathname + location.search }} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <Navigate
        to={role === "owner" ? "/owner" : "/customer"}
        replace />);


  }

  return role === "customer" ? <MembershipGate><CustomerAddressGate>{translate(children)}</CustomerAddressGate></MembershipGate> : children;
}

export default ProtectedRoute;
