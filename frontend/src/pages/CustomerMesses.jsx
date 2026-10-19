import Icon from "../components/Icon";
import CustomerPage from "../components/CustomerPage";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { returnTo, loginUrl } from "../services/authRouting";
import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import "./customer-messes.css";

const statusLabel = status => ({approved: "Approved", pending: "Waiting for owner approval", rejected: "Request declined"}[status] || status);

export default function CustomerMesses() {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = returnTo(location, "/customer");
  const selectedDestination = destination === "/" || destination === "/customer/messes"
    ? "/customer" : destination;
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");
  const [messes, setMesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOwner, setCheckingOwner] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || role !== "customer") return undefined;
    let active = true;
    const load = () => api.get("/customer/messes").then(({data}) => {if (active) {setMesses(data);setError("");}})
      .catch(err => {if (active) setError(errorMessage(err, "Unable to load your messes."));})
      .finally(() => {if (active) setLoading(false);});
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {active = false;clearInterval(timer);window.removeEventListener("focus", load);};
  }, [role, token]);

  if (!token) return <Navigate to={loginUrl("/customer/messes")} replace />;
  if (role !== "customer") return <Navigate to={role === "owner" ? "/owner" : "/login"} replace />;

  const selectMess = async mess => {
    if (!mess.join_token) return;
    if (mess.status !== "approved") {
      setCheckingOwner(mess.owner_id);
      setError("");
      try {
        const {data} = await api.get("/join-status", {headers: {"X-Mess-Token": mess.join_token}});
        setMesses(current => current.map(item => item.owner_id === mess.owner_id
          ? {...item, status: data.status || item.status, needs_plan: data.needs_plan ?? item.needs_plan}
          : item));
        if (data.status === "approved") {
          localStorage.setItem("activeMessToken", mess.join_token);
          navigate(selectedDestination, {replace: true});
        }
      } catch (err) {
        setError(errorMessage(err, "Unable to check this mess request."));
      } finally {
        setCheckingOwner(null);
      }
      return;
    }
    localStorage.setItem("activeMessToken", mess.join_token);
    navigate(selectedDestination, {replace: true});
  };

  return <><Navbar title={translate("My messes")} /><CustomerPage className="customer-messes-page">
    <section className="customer-messes-heading"><div><p className="eyebrow">{translate("Your Smart Mess account")}</p><h1>{translate("Choose your mess")}</h1><p>{translate("Use one member account to manage your access to different messes. Each mess reviews its own join request and subscription.")}</p></div><Link className="btn btn-outline" to="/">{translate("Find a mess")}</Link></section>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {loading ? <p className="loading-card" role="status">{translate("Loading your messes…")}</p> : messes.length ? <section className="customer-messes-grid" aria-label={translate("Your mess memberships")}>
      {messes.map(mess => <article className="customer-mess-card" key={mess.owner_id}>
        <div className="customer-mess-monogram" aria-hidden="true">{mess.mess_name.trim().charAt(0).toUpperCase()}</div>
        <div className="customer-mess-info"><h2>{mess.mess_name}</h2><span className={`customer-mess-status status-${mess.status}`}>{translate(statusLabel(mess.status))}</span>
          {mess.status === "approved" && <p>{translate(mess.needs_plan ? "Your membership is approved. Choose a plan or order an eligible single meal." : "Your membership is ready. Open your meals, subscription and bills.")}</p>}
          {mess.status === "pending" && <p>{translate("You can open this mess to check whether the owner has approved your request.")}</p>}
          {mess.status === "rejected" && <p>{translate("Contact the mess owner or use their join link to submit your request again.")}</p>}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => selectMess(mess)} disabled={!mess.join_token || checkingOwner !== null}>{translate(checkingOwner === mess.owner_id ? "Checking…" : mess.status === "approved" ? "Open mess" : "Check request")}</button>
        {mess.join_token && mess.status !== 'approved' && <div className="form-actions"><Link to={`/join/${mess.join_token}?next=${encodeURIComponent(selectedDestination)}`}>{translate('Review join request')}</Link><Link to={`/mess/${mess.join_token}#visit`}>{translate('Mess details & contact')}</Link></div>}
      </article>)}
    </section> : !error && <section className="customer-messes-empty"><Icon name="meal" size={32} /><h2>{translate("No messes joined yet")}</h2><p>{translate("Explore the directory, choose a mess and send a join request. You can use this same account when you join more messes.")}</p><Link className="btn btn-primary" to="/">{translate("Explore messes")}</Link></section>}
  </CustomerPage></>;
}
