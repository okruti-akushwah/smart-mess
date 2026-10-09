import { useTranslation } from "../i18n/useTranslation";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Navbar from "./Navbar";
import api, { errorMessage } from "../services/api";
export default function MembershipGate({ children }) {
  const translate = useTranslation();
  const [membership, setMembership] = useState(null),[error, setError] = useState('');
  const [checking, setChecking] = useState(false),[message, setMessage] = useState('');
  const load = useCallback(async (manual = false) => {
    if (manual) {setChecking(true);setMessage('');}
    try {
      const { data } = await api.get('/join-status');
      setMembership(data);setError('');
      if (manual) setMessage(data.status === 'pending' ?
      'Your request is still pending. Please ask your mess owner to approve it from their dashboard.' :
      data.status === 'rejected' ?
      'Your request was declined. Contact your owner or submit your request again.' :
      'Approved! Opening your account...');
    } catch (e) {setError(errorMessage(e));} finally
    {if (manual) setChecking(false);}
  }, []);
  useEffect(() => {const t = setTimeout(load, 0);const interval = setInterval(load, 15000);return () => {clearTimeout(t);clearInterval(interval);};}, [load]);
  if (membership?.status === 'approved') return children;
  return <><Navbar title={translate("Join request")} /><main className="dashboard"><section className="management-card"><h1>{translate(membership?.status === 'rejected' ? 'Your join request was declined' : membership ? 'Waiting for owner approval' : 'Checking membership…')}</h1><p>{translate(membership?.status === 'rejected' ? 'Contact your owner, or open their join link again to resubmit using your existing password.' : 'Your account is ready. Your owner needs to approve your request. Once approved, you can view plans and choose your subscription after logging in.')}</p>{error && <p role="alert" className="alert error">{translate(error)}</p>}{membership?.join_token && membership.status === 'rejected' && <p><Link className="btn btn-outline" to={`/join/${membership.join_token}`}>{translate("Resubmit join request")}</Link></p>}<button className="btn btn-primary" disabled={checking} onClick={() => load(true)}>{translate(checking ? "Checking approval..." : "Check approval")}</button>{message && <p className="alert success" role="status">{translate(message)}</p>}</section></main></>;
}
