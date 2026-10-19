import Button from './ui/Button';
import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";

export default function SignupOtp({ phone, joinToken, role = "owner", onVerified, onBack, inline = false, autoSend = false }) {
  const translate = useTranslation();
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const sendRef = useRef(null);
  const attempted = useRef(false);
  useEffect(() => { sendRef.current = send; });
  useEffect(() => {
    if (!autoSend || attempted.current || !/^[0-9]{10}$/.test(phone)) return;
    const timer = setTimeout(() => {
      if (attempted.current) return;
      attempted.current = true;
      sendRef.current();
    }, 700);
    return () => clearTimeout(timer);
  }, [autoSend, phone]);
  useEffect(() => {
    if (!challenge) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((challenge.resendAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  async function send() {
    attempted.current = true;
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/auth/signup/otp", { phone, join_token: joinToken || null, role });
      if (!data.otp_required) await onVerified(null);
      else { setChallenge({ ...data, resendAt: Date.now() + data.resend_after * 1000 }); setCode(""); }
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function verify(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await api.post("/auth/signup/verify-otp", { challenge_id: challenge.challenge_id, code });
      await onVerified(data.verification_id);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const FormContainer = inline ? "div" : "form";
  return <section className={`signup-verification ${inline ? "otp-inline" : ""}`} aria-label={translate("Verify your mobile number")}>
    {!inline && <div className="signup-steps"><strong>{translate("1. Verify mobile")}</strong><span>{translate("2. Account details")}</span></div>}
    <h3>{translate("Verify your mobile number")}</h3>
    <p className="muted">{translate("Verify once during signup. Later, log in with your phone and password.")}</p>
    {!inline && <p className="verification-phone">+91 {phone}</p>}
    {challenge && <p className={challenge.delivery === "console" ? "alert otp-test-notice" : "muted"} role="status">{translate(challenge.message)}</p>}
    {error && <p id="signup-otp-error" className="alert error" role="alert">{translate(error)}</p>}
    {!challenge ? <Button type="button" className="btn-full" loading={busy} disabled={!/^[0-9]{10}$/.test(phone)} onClick={send}>{translate(busy ? "Please wait..." : "Send signup OTP")}</Button> : <FormContainer className="otp-code-form" onSubmit={inline ? undefined : verify}>
      <label htmlFor="signup-otp">{translate("6-digit OTP")}</label>
      <input aria-describedby={error ? "signup-otp-expiry signup-otp-error" : "signup-otp-expiry"} id="signup-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ""))} onKeyDown={event => {if (inline && event.key === "Enter") {event.preventDefault();if (!busy && code.length === 6) verify(event);}}} required disabled={busy} autoFocus />
      <p id="signup-otp-expiry" className="muted">{translate("The code expires in 5 minutes.")}</p>
      <Button type={inline ? "button" : "submit"} onClick={inline ? verify : undefined} className="btn-full" loading={busy} disabled={code.length !== 6}>{translate(busy ? "Please wait..." : "Verify number")}</Button>
    </FormContainer>}
    <div className="otp-actions">{challenge && <Button type="button" variant="outline" disabled={busy || remaining > 0} onClick={send}>{translate("Resend OTP")}{remaining > 0 ? ` (${remaining}s)` : ""}</Button>}{onBack && <Button type="button" variant="outline" disabled={busy} onClick={onBack}>{translate("Edit account details")}</Button>}</div>
  </section>;
}
