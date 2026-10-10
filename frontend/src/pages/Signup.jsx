import useSignupSettings from "../services/useSignupSettings";
import SignupOtp from "../components/SignupOtp";
import { useTranslation } from "../i18n/useTranslation";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage } from "../services/api";

export default function Signup() {
  const translate = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mess_name: "", phone: "", password: "" });
  const [verification, setVerification] = useState(null);
  const { settings, settingsError } = useSignupSettings();
  const demo = settings?.demo_registration === true;
  const phoneReady = /^[0-9]{10}$/.test(form.phone) && (demo || verification?.phone === form.phone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async event => {
    event.preventDefault();
    if (!phoneReady) { setError("Verify your mobile number first."); return; }
    setLoading(true);setError("");
    try {
      await api.post("/auth/signup", { ...form, role: "owner", verification_id: demo ? null : verification.id });
      navigate("/owner/login", { replace: true, state: { message: "Mess created. Log in with your phone and password." } });
    } catch (err) {
      setError(errorMessage(err, "Unable to set up mess."));
      if (err.response?.status === 403) setVerification(null);
    } finally
    {setLoading(false);}
  };
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  return <div className="auth-layout">
    <section className="auth-hero"><div className="auth-hero-content">
      <div className="hero-logo">{translate("M")}</div><h1>{translate("Smart Mess")}</h1>
      <h2>{translate("Your mess, connected.")}</h2>
      <p>{translate("Meals, subscriptions and payments in one place.")}</p>
    </div></section>
    <section className="auth-form-side"><div className="auth-card">
      <p className="eyebrow">{translate("OWNER REGISTRATION")}</p>
        <h2>{translate("Set up your mess")}</h2>
        <p>{translate(demo ? "Create your demo owner account. SMS verification is disabled; your mobile number remains unverified." : "Verify your mobile number first, then add your mess and account details.")}</p>
        {!demo && <div className="signup-steps"><strong>{translate("1. Verify mobile")}</strong><span>{translate("2. Account details")}</span></div>}
        {settingsError && <p className="alert error" role="alert">{translate(settingsError)}</p>}
        <form onSubmit={submit}>
          <label htmlFor="owner-phone">{translate("Phone number / login ID")}</label>
          <input id="owner-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} value={form.phone} onChange={event => {setForm({ ...form, phone: event.target.value.replace(/[^0-9]/g, "") });setVerification(null);setError("");}} required disabled={loading} />
          {phoneReady ? <p className="phone-verified" role="status">{translate(demo ? "Demo registration · Mobile number unverified" : "✓ Mobile number verified")}</p> : settings && /^[0-9]{10}$/.test(form.phone) ? <SignupOtp key={form.phone} phone={form.phone} inline autoSend onVerified={async id => setVerification({ id, phone: form.phone })} /> : <p className="phone-hint">{translate(!settings ? "Loading registration settings…" : demo ? "Enter your 10-digit mobile number. No SMS is sent in demo mode." : "Enter 10 digits. We’ll request your OTP automatically.")}</p>}
          {phoneReady && <>
          <label htmlFor="owner-name">{translate("Your name")}</label>
          <input id="owner-name" name="name" value={form.name} onChange={change} required maxLength={100} />
          <label htmlFor="mess-name">{translate("Mess name")}</label>
          <input id="mess-name" name="mess_name" value={form.mess_name} onChange={change} required maxLength={100} placeholder={translate("e.g. Sharma Tiffin Centre")} />
          <label htmlFor="owner-password">{translate("Password")}</label>
          <input id="owner-password" name="password" type="password" maxLength={72} value={form.password} onChange={change} required autoComplete="new-password" />
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{translate(loading ? "Creating mess..." : "Register your mess")}</button>
          </>}
        </form>
      {error && <div className="alert error" role="alert">{translate(error)}</div>}
      <p className="auth-footer">{translate("Already registered? ")}<Link to="/owner/login">{translate("Login")}</Link></p>
      <p className="auth-footer"><Link to="/">{translate("View messes")}</Link></p>
    </div></section>
  </div>;
}
