import { LanguageContext } from "../i18n/LanguageContext";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import api, { errorMessage } from "../services/api";
import thali from '../assets/thali.png';
import Icon from '../components/Icon';
import "./mess-directory.css";

export default function MessDirectory() {
  const translate = useTranslation();
  const { language } = useContext(LanguageContext);
  const signedInRole = localStorage.getItem("role");
  const name = mess => language === "hi" && mess.name_hi?.trim() ? mess.name_hi : mess.name;
  const [messes, setMesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const visibleMesses = messes.filter(mess => name(mess).toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.get("/public/messes", { timeout: 60000, signal: controller.signal }).then(({ data }) => { if (active) setMesses(data); })
      .catch(err => { if (active) setError(errorMessage(err, "Could not load messes. Please refresh to retry.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [retryCount]);
  return <div className="mess-directory">
      <header className="directory-wrap directory-nav"><Link className="directory-brand" to="/"><span><Icon name="meal" /></span> Smart Mess</Link><nav aria-label="Explore Smart Mess"><a href="#find-mess">Find a mess</a><a href="#how-it-works">How it works</a><Link className="btn btn-outline" to={signedInRole === "customer" ? "/customer/messes" : signedInRole === "owner" ? "/owner" : "/login"}>{translate(signedInRole === "customer" ? "My messes" : signedInRole === "owner" ? "Owner dashboard" : "Sign in")}</Link></nav></header>
    <main className="directory-wrap">
      <section className="directory-hero"><div className="directory-intro"><p className="eyebrow">A LITTLE CLOSER TO HOME</p><h1>Your everyday meal.<br /><em>Your kind of mess.</em></h1><p>Find your kitchen, explore its menu and make room for a better daily routine.</p><div className="form-actions"><a className="btn btn-primary" href="#find-mess">Explore messes <Icon name="arrow" /></a><a className="btn btn-outline" href="#how-it-works">How it works</a></div><div className="directory-benefits"><span><Icon name="meal" size={16} /> Real menus</span><span><Icon name="calendar" size={16} /> Meal plans</span><span><Icon name="bill" size={16} /> Clear bills</span></div></div><figure className="directory-hero-food"><img src={thali} alt="Illustrative Indian thali with rice, rotis and side dishes" /><figcaption>Food imagery is illustrative. Explore each mess for its actual menu.</figcaption></figure></section>
      <section className="directory-discover" id="find-mess"><div className="section-heading"><div><p className="eyebrow">FIND YOUR DAILY TABLE</p><h2>A kitchen that fits your day.</h2></div>{!loading && <span>{messes.length} mess{messes.length === 1 ? '' : 'es'} to explore</span>}</div><label className="directory-search">Search messes<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by mess name" /></label>
      {error && <div className="alert error" role="alert"><p>{translate(error)}</p><button className="btn btn-outline" type="button" onClick={() => { setLoading(true); setError(""); setRetryCount(count => count + 1); }}>{translate("Retry")}</button></div>}
      {loading ? <p role="status">{translate("Loading messes…")}</p> : <div className="directory-grid">{visibleMesses.map(mess => <article className="directory-card" key={mess.join_token}><div className="directory-monogram" aria-hidden="true">{name(mess).trim().charAt(0).toUpperCase()}</div><h2>{name(mess)}</h2><p>{translate("Explore the menu and request your place.")}</p><Link className="btn btn-primary" to={`/mess/${mess.join_token}`}>{translate("View mess")}<span aria-hidden="true"> ↗</span></Link><Link className="directory-join" to={`/join/${mess.join_token}`}>{translate("Join this mess")}<span aria-hidden="true"> →</span></Link></article>)}</div>}
      {!loading && messes.length > 0 && !visibleMesses.length && <p className="empty-card">No matching mess. Try another name.</p>}
      {!loading && !error && !messes.length && <p className="empty-card">{translate("Messes will appear here once their owners register. Check back soon.")}</p>}
      </section>
      <section className="directory-steps" id="how-it-works"><p className="eyebrow">FROM FINDING TO FEASTING</p><h2>A simpler way to your daily meal.</h2><div className="directory-step-grid">{[['01', 'Find your mess', 'Explore the menu and meet the kitchen.'], ['02', 'Request to join', 'Create your account. The owner approves membership.'], ['03', 'Choose & pay', 'Pick a plan or today’s meal. Pay by the owner’s QR.'], ['04', 'You’re all set', 'Owner confirmation activates your plan. Manage meals in your dashboard.']].map(([number, title, detail]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>
      <section className="directory-faq"><div><p className="eyebrow">A FEW GOOD QUESTIONS</p><h2>Before you pull up a chair.</h2></div><div><details><summary>How do I pay?</summary><p>Scan the QR provided by your mess owner, submit your payment screenshot, and wait for the owner to confirm receipt.</p></details><details><summary>Can I skip a meal?</summary><p>Eligible subscription meals can be skipped before cutoff. Each skip adds a day to your subscription. Meals with guests or dispatched meals cannot be skipped.</p></details><details><summary>Can I try a single meal?</summary><p>After joining and saving your address, you can order today’s published meals when the owner has enabled a single-meal price. Full payment and owner acceptance are required.</p></details></div></section>
    </main>
    <footer className="directory-wrap directory-footer"><span>{translate("Fresh meals. Less waste.")}</span><Link to="/owner/login">{translate("For mess owners")} ↗</Link></footer>
  </div>;
}
