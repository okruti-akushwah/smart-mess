import { useTranslation } from "../i18n/useTranslation";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import api, { errorMessage } from "../services/api";

function Login({ ownerPortal = false }) {
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

  function completeLogin(data) {
    if (!data.access_token) throw new Error("Backend did not return an access token.");
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.removeItem("user");
    const target = location.state?.from;
    navigate(data.role === "owner" ? "/owner" : target?.startsWith("/customer") ? target : "/customer", { replace: true });
  }

  const handleSubmit = async event => {
    event.preventDefault(); setLoading(true); setError("");
    try { const { data } = await api.post("/auth/login", form); completeLogin(data); }
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

          <p>{translate(ownerPortal ? "Manage your kitchen, subscriptions and payments in one place." : "See your meals, manage skips and guests, and keep track of your bill.")}



          </p>

          <div className="hero-features">
            <span>{translate("✓ Live meal management")}</span>
            <span>{translate("✓ Transparent billing")}</span>
            <span>{translate(ownerPortal ? "✓ Smarter kitchen preparation" : "✓ Flexible meal planning")}</span>
          </div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <p className="eyebrow">{translate("WELCOME BACK")}</p>

          <h2>{translate(ownerPortal ? "Mess owner login" : "Customer login")}</h2>

          <p className="muted">{translate(" Enter your details to continue. ")}

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

          <p className="auth-footer">{translate(" New to Smart Mess?")}
            {translate(" ")}
            <Link to={ownerPortal ? "/owner/register" : "/signup"}>{translate(ownerPortal ? "Register your mess" : "Join your mess")}

            </Link>
          </p>
          <p className="auth-footer"><Link to="/">{translate("View mess page")}</Link></p>
        </div>
      </section>
    </div>);

}

export default Login;
