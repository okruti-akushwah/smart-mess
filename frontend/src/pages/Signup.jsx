import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import useSignupSettings from "../services/useSignupSettings";
import SignupOtp from "../components/SignupOtp";
import { useTranslation } from "../i18n/useTranslation";
import { useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { returnTo, loginUrl } from "../services/authRouting";
import api, { errorMessage } from "../services/api";

export default function Signup() {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(() => searchParams.get("role") === "owner" ? "owner" : "customer");
  const [form, setForm] = useState({ name: "", mess_name: "", phone: "", password: "" });
  const [verification, setVerification] = useState(null);
  const { settings, settingsError } = useSignupSettings();
  const demo = settings?.demo_registration === true;
  const phoneReady = /^[0-9]{10}$/.test(form.phone) && (demo || verification?.phone === form.phone && verification.role === role);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const chooseRole = value => {setRole(value);setVerification(null);setError("");};
  const submit = async event => {
    event.preventDefault();
    if (!phoneReady) { setError("Verify your mobile number first."); return; }
    setLoading(true);setError("");
    try {
      await api.post("/auth/signup", { ...form, role, verification_id: demo ? null : verification.id });
      if (role === "owner") {
        navigate("/login", { replace: true, state: { message: "Mess created. Log in with your phone and password." } });
      } else {
        const {data} = await api.post("/auth/login", {phone: form.phone, password: form.password});
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.removeItem("activeMessToken");
        navigate(returnTo(location), {replace: true});
      }
    } catch (err) {
      setError(errorMessage(err, "Unable to create your account."));
      if (err.response?.status === 403) setVerification(null);
    } finally {setLoading(false);}
  };

  return <AuthLayout title={translate(role === "owner" ? "Your mess, connected." : "Good food, all in one place.")}
    description={translate(role === "owner" ? "Set up your kitchen and welcome members to your mess." : "One member account lets you find messes and request access to the ones that fit your day.")}>
      <p className="eyebrow">{translate("CREATE YOUR ACCOUNT")}</p>
      <h1>{translate("Join Smart Mess")}</h1>
      <label htmlFor="account-type">{translate("I am joining as")}</label>
      <select id="account-type" value={role} disabled={loading} onChange={event => chooseRole(event.target.value)}>
        <option value="customer">{translate("Member")}</option>
        <option value="owner">{translate("Mess owner")}</option>
      </select>
      <p>{translate(demo ? "Demo registration: SMS verification is disabled and your mobile number remains unverified." : "Verify your mobile number, then finish your account details.")}</p>
      {!demo && <nav className="signup-steps" aria-label={translate("Registration progress")}><span aria-current={!phoneReady ? "step" : undefined}>{translate(phoneReady ? "Mobile verified" : "1. Verify mobile")}</span><span aria-current={phoneReady ? "step" : undefined}>{translate("2. Account details")}</span></nav>}
      {settingsError && <p className="alert error" role="alert">{translate(settingsError)}</p>}
      <form onSubmit={submit} aria-busy={loading} aria-describedby={error ? 'signup-error' : undefined}>
        <label htmlFor="signup-phone">{translate("Phone number / login ID")}</label>
        <input id="signup-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} value={form.phone} onChange={event => {setForm({ ...form, phone: event.target.value.replace(/[^0-9]/g, "") });setVerification(null);setError("");}} required disabled={loading} />
        {phoneReady ? <p className="phone-verified" role="status">{translate(demo ? "Demo registration · Mobile number unverified" : "✓ Mobile number verified")}</p> : settings && /^[0-9]{10}$/.test(form.phone) ? <SignupOtp key={`${form.phone}-${role}`} phone={form.phone} role={role} inline autoSend onVerified={async id => setVerification({ id, phone: form.phone, role })} /> : <p className="phone-hint">{translate(!settings ? "Loading registration settings…" : demo ? "Enter your 10-digit mobile number. No SMS is sent in demo mode." : "Enter 10 digits. We’ll request your OTP automatically.")}</p>}
        {phoneReady && <>
          <label htmlFor="signup-name">{translate("Your name")}</label>
          <input id="signup-name" name="name" autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={100} disabled={loading} />
          {role === "owner" && <><label htmlFor="signup-mess-name">{translate("Mess name")}</label><input id="signup-mess-name" name="mess_name" value={form.mess_name} onChange={event => setForm({ ...form, mess_name: event.target.value })} required maxLength={100} placeholder={translate("e.g. Sharma Tiffin Centre")} disabled={loading} /></>}
          <label htmlFor="signup-password">{translate("Password")}</label>
          <div className="password-field"><input id="signup-password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required autoComplete="new-password" aria-describedby="signup-password-help" disabled={loading} /><button type="button" className="password-toggle" aria-label={translate(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} disabled={loading} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} /></button></div>
          <p id="signup-password-help">{translate("New passwords must contain at least 8 characters.")}</p>
          <Button type="submit" className="btn-full" loading={loading}>{translate(loading ? "Creating account…" : role === "owner" ? "Register your mess" : "Create member account")}</Button>
        </>}
      </form>
      {error && <div id="signup-error" className="alert error" role="alert">{translate(error)}</div>}
      <p className="auth-footer">{translate("Already have an account?")} <Link to={`${loginUrl(returnTo(location))}${role === "owner" ? "&role=owner" : ""}`}>{translate("Sign in")}</Link></p>
      <p className="auth-footer"><Link to="/">{translate("Explore messes")}</Link></p>
  </AuthLayout>;
}
