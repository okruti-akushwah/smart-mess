import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import '../components/auth-layout.css';
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [checking, setChecking] = useState(false);
  const [loadedToken, setLoadedToken] = useState(null);
  const readRequest = useRef(null);
  const destination = returnTo(location, "/customer/choose");
  const load = useCallback(async () => {
    if (!signedIn || role !== 'customer') return;
    readRequest.current?.abort();
    const controller = new AbortController();
    readRequest.current = controller;
    setChecking(true); setError('');
    try {
      const config = {signal: controller.signal};
      const [details, memberships] = await Promise.all([api.get(`/join/${token}`, config), api.get('/customer/messes', config)]);
      if (controller.signal.aborted) return;
      setOwner(details.data.mess_name || `${details.data.owner_name}’s mess`);
      setMembership(memberships.data.find(mess => mess.join_token === token) || null);
      setLoadedToken(token);
    } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }, [token, signedIn, role]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => {clearTimeout(timer);readRequest.current?.abort();};
  }, [load]);
  const ownerName = loadedToken === token ? owner : '';
  const currentMembership = loadedToken === token ? membership : null;
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
  return <main className="dashboard join-entry"><section className="management-card join-signup-card"><span className="join-entry-symbol" aria-hidden="true"><Icon name="people" size={24} /></span>
    <p className="eyebrow">{translate("Smart Mess")}</p>
    <h1>{currentMembership?.status === 'approved' ? translate('Continue to your mess') : translate(ownerName ? `Join ${ownerName}` : "Join a mess")}</h1>
    {currentMembership?.status === 'approved' && <h2>{ownerName}</h2>}
    <p>{translate(currentMembership?.status === 'approved' ? 'Your membership is approved. Continue to view your food and availability.' : "Use your existing account to request access. Each mess reviews its own membership request.")}</p>
    {destination.includes('#meal-') && <p className="alert info">{translate('Your selected meal is saved for the next step. Availability is checked in your mess.')}</p>}
    {error && <p className="alert error" role="alert">{translate(error)}</p>}
    {error && <Button variant="outline" onClick={load} disabled={checking || busy}>{translate('Retry')}</Button>}
    {!ownerName && !error && <p role="status">{translate('Checking your request…')}</p>}
    {success && <p className="alert success" role="status">{translate(success)}</p>}
    {ownerName && (currentMembership?.status === "approved"
      ? <Button onClick={openMess}>{translate(destination.includes('#meal-') ? 'Continue to selected meal' : "Open mess")}</Button>
      : currentMembership?.status === "pending"
        ? <div className="join-waiting"><p role="status">{translate("Waiting for owner approval")}</p><p>{translate('The mess owner reviews your request. Check again, or explore other messes while you wait.')}</p><Button variant="outline" onClick={load} disabled={checking || busy}>{translate(checking ? 'Checking…' : 'Check request')}</Button></div>
        : <>{currentMembership?.status === 'rejected' && <p role="status">{translate('Your request was declined. You can contact the owner or send a new request.')}</p>}<Button onClick={request} loading={busy} disabled={checking}>{translate(busy ? "Sending request…" : "Request to join this mess")}</Button></>)}
    <div className="join-entry-links"><Link to="/customer/messes" state={{from: destination}}>{translate("My messes")}</Link>
    <Link to={`/mess/${token}`}>{translate("Back to mess page")}</Link></div>
    <div className="join-entry-links"><Link to={`/mess/${token}#visit`}>{translate('Mess details & contact')}</Link><Link to="/">{translate('Find another mess')}</Link></div>
  </section></main>;
}
