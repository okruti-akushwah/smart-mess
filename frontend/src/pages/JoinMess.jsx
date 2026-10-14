import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import { loginUrl, returnTo } from "../services/authRouting";
import api, { errorMessage } from "../services/api";

export default function JoinMess() {
  const translate = useTranslation();
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = !!localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const [owner, setOwner] = useState("");
  const [membership, setMembership] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = returnTo(location, "/customer/choose");
  useEffect(() => {
    if (!signedIn || role !== "customer") return undefined;
    let active = true;
    Promise.all([api.get(`/join/${token}`), api.get("/customer/messes")])
      .then(([details, memberships]) => {
        if (!active) return;
        setOwner(details.data.mess_name || `${details.data.owner_name}’s mess`);
        setMembership(memberships.data.find(mess => mess.join_token === token) || null);
      }).catch(err => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, [token, signedIn, role]);
  if (!signedIn) return <Navigate to={loginUrl(location.pathname + location.search + location.hash)} replace />;
  if (role !== "customer") return <Navigate to="/owner" replace />;
  const openMess = () => {
    localStorage.setItem("activeMessToken", token);
    navigate(destination.startsWith("/join/") ? "/customer/choose" : destination, { replace: true });
  };
  const request = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/join/${token}/request`, {});
      setSuccess(data.message);
      const response = await api.get("/customer/messes");
      setMembership(response.data.find(mess => mess.join_token === token) || null);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <main className="dashboard"><section className="management-card join-signup-card">
    <p className="eyebrow">{translate("SMART MESS")}</p>
    <h1>{translate(owner ? `Join ${owner}` : "Join a mess")}</h1>
    <p>{translate("Use your existing account to request access. Each mess reviews its own membership request.")}</p>
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {success && <p className="alert success" role="status">{translate(success)}</p>}
    {owner && (membership?.status === "approved"
      ? <button className="btn btn-primary" onClick={openMess}>{translate("Open mess")}</button>
      : membership?.status === "pending"
        ? <p role="status">{translate("Waiting for owner approval")}</p>
        : <button className="btn btn-primary" onClick={request} disabled={busy}>{translate(busy ? "Sending request…" : "Request to join this mess")}</button>)}
    <p><Link to="/customer/messes" state={{from: destination}}>{translate("My messes")}</Link></p>
    <Link to={`/mess/${token}`}>{translate("Back to mess page")}</Link>
  </section></main>;
}
