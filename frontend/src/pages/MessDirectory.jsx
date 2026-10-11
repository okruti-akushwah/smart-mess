import { LanguageContext } from "../i18n/LanguageContext";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import api, { errorMessage } from "../services/api";
import "./mess-directory.css";

export default function MessDirectory() {
  const translate = useTranslation();
  const { language } = useContext(LanguageContext);
  const name = mess => language === "hi" && mess.name_hi?.trim() ? mess.name_hi : mess.name;
  const [messes, setMesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get("/public/messes").then(({ data }) => { if (active) setMesses(data); })
      .catch(err => { if (active) setError(errorMessage(err, "Could not load messes. Please refresh to retry.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="mess-directory">
    <header className="directory-wrap directory-nav"><Link className="directory-brand" to="/"><span>M</span> Smart Mess</Link><Link className="btn btn-outline" to="/login">{translate("Customer login")}</Link></header>
    <main className="directory-wrap">
      <section className="directory-intro"><p className="eyebrow">{translate("A PLACE AT THE TABLE")}</p><h1>{translate("Find your everyday mess.")}</h1><p>{translate("Explore a mess, see what’s cooking, and choose your meal plan. Have a join link or QR code? Open it to join your mess directly.")}</p></section>
      {error && <p className="alert error" role="alert">{translate(error)}</p>}
      {loading ? <p role="status">{translate("Loading messes…")}</p> : <div className="directory-grid">{messes.map(mess => <article className="directory-card" key={mess.join_token}><div className="directory-monogram" aria-hidden="true">{name(mess).trim().charAt(0).toUpperCase()}</div><h2>{name(mess)}</h2><p>{translate("Explore the menu and request your place.")}</p><Link className="btn btn-primary" to={`/mess/${mess.join_token}`}>{translate("View mess")}<span aria-hidden="true"> ↗</span></Link><Link className="directory-join" to={`/join/${mess.join_token}`}>{translate("Join this mess")}<span aria-hidden="true"> →</span></Link></article>)}</div>}
      {!loading && !error && !messes.length && <p className="empty-card">{translate("Messes will appear here once their owners register. Check back soon.")}</p>}
    </main>
    <footer className="directory-wrap directory-footer"><span>{translate("Fresh meals. Less waste.")}</span><Link to="/owner/login">{translate("For mess owners")} ↗</Link></footer>
  </div>;
}
