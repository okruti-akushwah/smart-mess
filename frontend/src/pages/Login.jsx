import AuthLayout from '../components/AuthLayout';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import { useTranslation } from "../i18n/useTranslation";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { returnTo } from "../services/authRouting";
import api, { errorMessage } from "../services/api";

function Login() {
  const translate = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    phone: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  };

  async function completeLogin(data) {
    if (!data.access_token) throw new Error("Backend did not return an access token.");
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.removeItem("user");
    const target = returnTo(location);
    if (data.role === "owner") {
      localStorage.removeItem("activeMessToken");
      const destination = location.state?.message === "Mess created. Log in with your phone and password."
        ? "/owner/onboarding" : "/owner";
      navigate(destination, { replace: true });
      return;
    }
    if (target.startsWith("/join/") || target.startsWith("/mess/") || target === "/customer/history") {
      navigate(target, {replace: true});
      return;
    }
    const { data: memberships } = await api.get("/customer/messes");
    const previousSelection = localStorage.getItem("activeMessToken");
    const selected = memberships.find(item => item.join_token === previousSelection)
      || (memberships.length === 1 ? memberships[0] : null);
    if (selected?.join_token) localStorage.setItem("activeMessToken", selected.join_token);
    else localStorage.removeItem("activeMessToken");
    const destination = memberships.length > 1 && !selected
      ? "/customer/messes"
      : selected ? (target?.startsWith("/customer") && target !== "/customer/messes" ? target : "/customer") : "/";
    navigate(destination, { replace: true, state: { from: target } });
  }

  const handleSubmit = async event => {
    event.preventDefault(); setLoading(true); setError("");
    try { const { data } = await api.post("/auth/login", form); await completeLogin(data); }
    catch (err) { setError(errorMessage(err, "Unable to login.")); }
    finally { setLoading(false); }
  };

  return <AuthLayout title={<>{translate("Smarter meals.")}<br />{translate("Less waste.")}</>}
    description={translate("Manage your kitchen or explore meals, plans and bills. One sign-in takes you to the right place.")}
    features={[translate("Live meal management"), translate("Transparent billing"), translate("Flexible meal planning")]}>
          <p className="eyebrow">{translate("WELCOME BACK")}</p>

          <h1>{translate("Sign in to Smart Mess")}</h1>

          <p className="muted">{translate("Use your phone and password. We’ll open your owner or member account automatically.")}

          </p>

          {location.state?.message && <div className="alert success" role="status">{translate(location.state.message)}</div>}
          <form onSubmit={handleSubmit} aria-busy={loading} aria-describedby={error ? "login-error" : undefined}>
            <label htmlFor="login-phone">{translate("Phone Number")}</label>
            <input id="login-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} placeholder={translate("Enter your phone number")} value={form.phone} onChange={handleChange} required disabled={loading} />
            <label htmlFor="login-password">{translate("Password")}</label>
            <div className="password-field"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={translate("Enter your password")} value={form.password} onChange={handleChange} required disabled={loading} /><button type="button" className="password-toggle" aria-label={translate(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} disabled={loading} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} /></button></div>
            {error && <div id="login-error" className="alert error" role="alert">{translate(error)}</div>}
            <Button className="btn-full" type="submit" loading={loading}>{translate(loading ? "Logging in..." : "Login")}</Button>
          </form>

          <p className="auth-footer">{translate("New to Smart Mess?")} <Link to={`/register?${new URLSearchParams(location.search).get("role") === "owner" ? "role=owner&" : ""}next=${encodeURIComponent(returnTo(location))}`}>{translate("Create an account")}</Link></p>
          <p className="auth-footer"><Link to="/">{translate("Explore messes")}</Link></p>
          <details className="sign-in-help"><summary>{translate('Sign-in help')}</summary><p>{translate('Check your 10-digit phone number and password.')}</p><p>{translate('For mess questions, find your kitchen in the directory and use its published contact details.')}</p><Link to="/#how-it-works">{translate('How Smart Mess works')}</Link></details>
  </AuthLayout>;
}

export default Login;
