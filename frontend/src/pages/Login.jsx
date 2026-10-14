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

  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="hero-logo">{translate("M")}</div>

          <h1>{translate("Smart Mess")}</h1>

          <h2>{translate(" Smarter meals. ")}

            <br />{translate(" Less waste. ")}

          </h2>

          <p>{translate("Manage your kitchen or explore meals, plans and bills. One sign-in takes you to the right place.")}



          </p>

          <div className="hero-features">
            <span>{translate("✓ Live meal management")}</span>
            <span>{translate("✓ Transparent billing")}</span>
            <span>{translate("✓ Flexible meal planning")}</span>
          </div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <p className="eyebrow">{translate("WELCOME BACK")}</p>

          <h2>{translate("Sign in to Smart Mess")}</h2>

          <p className="muted">{translate("Use your phone and password. We’ll open your owner or member account automatically.")}

          </p>

          {location.state?.message && <div className="alert success">{translate(location.state.message)}</div>}
          <form onSubmit={handleSubmit}>
            <label htmlFor="login-phone">{translate("Phone Number")}</label>
            <input id="login-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} placeholder={translate("Enter your phone number")} value={form.phone} onChange={handleChange} required disabled={loading} />
            <label htmlFor="login-password">{translate("Password")}</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder={translate("Enter your password")} value={form.password} onChange={handleChange} required disabled={loading} />
            {error && <div className="alert error" role="alert">{translate(error)}</div>}
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{translate(loading ? "Logging in..." : "Login")}</button>
          </form>

          <p className="auth-footer">{translate("New to Smart Mess?")} <Link to={`/register?next=${encodeURIComponent(returnTo(location))}`}>{translate("Create an account")}</Link></p>
          <p className="auth-footer"><Link to="/">{translate("Explore messes")}</Link></p>
        </div>
      </section>
    </div>);

}

export default Login;
