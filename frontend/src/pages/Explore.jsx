import { useTranslation } from "../i18n/useTranslation";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Discovery from "../components/Discovery";
export default function Explore() {
  const translate = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = Boolean(localStorage.getItem("token"));
  const dashboard = localStorage.getItem("role") === "owner" ? "/owner" : "/customer";
  const from = location.state?.from;
  function goBack() {
    if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/explore") && !from.startsWith("/login")) navigate(from);else
    if (window.history.state?.idx > 0) navigate(-1);else
    navigate(signedIn ? dashboard : "/");
  }
  return <main className="dashboard"><div className="section-heading"><button type="button" className="btn btn-outline" onClick={goBack}>{translate("← Back")}</button><Link className="btn btn-primary" to={signedIn ? dashboard : "/login"}>{translate(signedIn ? "My dashboard" : "Log in")}</Link></div><Discovery /></main>;
}
