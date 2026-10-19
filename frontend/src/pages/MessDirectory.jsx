import LanguageSwitcher from "../i18n/LanguageSwitcher";
import KitchenPrices from "../components/KitchenPrices";
import LoadingCards from '../components/LoadingCards';
import Button from '../components/ui/Button';
import { LanguageContext } from "../i18n/LanguageContext";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/useTranslation";
import api, { errorMessage } from "../services/api";
import thali from '../assets/thali.png';
import paneer from '../assets/menu-paneer.webp';
import dal from '../assets/menu-dal.webp';
import poha from '../assets/menu-poha.webp';
const kitchenPhotos = [paneer, dal, poha];
import Icon from '../components/Icon';
import NearbySearch from '../components/NearbySearch';
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
  const [location, setLocation] = useState({});
  const visibleMesses = messes.filter(mess => [mess.name, mess.name_hi, mess.city, mess.area].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const cities = [...new Set(messes.map(mess => mess.city).filter(Boolean))];
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.get("/public/messes", { timeout: 60000, signal: controller.signal, params:location }).then(({ data }) => { if (active) {setMesses(data);setError('');} })
      .catch(err => { if (active) setError(errorMessage(err, "Could not load messes. Please refresh to retry.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [retryCount, location]);
  return <div className="mess-directory">
      <header className="directory-wrap directory-nav"><Link className="directory-brand" to="/"><span><Icon name="meal" /></span>{translate(" Smart Mess")}</Link><LanguageSwitcher /><nav aria-label={translate("Explore Smart Mess")}><a href="#find-mess">{translate("Find a mess")}</a><a href="#how-it-works">{translate("How it works")}</a><Link to="/owner/register">{translate("Register your mess")}</Link><Link className="btn btn-outline" to={signedInRole === "customer" ? "/customer/messes" : signedInRole === "owner" ? "/owner" : "/login"}>{translate(signedInRole === "customer" ? "My messes" : signedInRole === "owner" ? "Owner dashboard" : "Sign in")}</Link></nav></header>
    <main className="directory-wrap">
      <section className="directory-hero"><img className="directory-food-accent directory-food-left" src={poha} alt="" width="240" height="240" /><img className="directory-food-accent directory-food-right" src={thali} alt="" width="320" height="320" /><div className="directory-intro"><p className="eyebrow">{translate("A LITTLE CLOSER TO HOME")}</p><h1>{translate("Your everyday meal.")}<br /><em>{translate("Your kind of mess.")}</em></h1><p>{translate("Find your kitchen, explore its menu and make room for a better daily routine.")}</p><form className="directory-search-row directory-hero-search" onSubmit={event => { event.preventDefault(); const results = document.getElementById("find-mess"); results?.focus(); results?.scrollIntoView({block:"start"}); }}><label className="directory-search">{translate("Search messes")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} list="directory-suggestions" placeholder={translate("Search by mess name or city")} /></label><datalist id="directory-suggestions">{[...new Set(messes.flatMap(mess => [name(mess), mess.city]).filter(Boolean))].map(value => <option key={value} value={value} />)}</datalist><button className="btn btn-primary" type="submit">{translate("Find a mess")}</button>{search && <Button variant="outline" onClick={() => setSearch('')}>{translate("Clear search")}</Button>}</form><div className="directory-benefits"><span><Icon name="meal" size={16} />{translate(" Real menus")}</span><span><Icon name="calendar" size={16} />{translate(" Meal plans")}</span><span><Icon name="bill" size={16} />{translate(" Clear bills")}</span></div></div><nav className="directory-paths" aria-label={translate("Explore Smart Mess")}>
        <a className="directory-path" href="#find-mess"><div><Icon name="location" /><h2>{translate("Find your mess")}</h2><p>{translate("Real menus")}</p><span className="directory-path-arrow"><Icon name="arrow" /></span></div><img src={paneer} alt="" width="200" height="160" /></a>
        <a className="directory-path" href="#how-it-works"><div><Icon name="calendar" /><h2>{translate("How it works")}</h2><p>{translate("Meal plans")}</p><span className="directory-path-arrow"><Icon name="arrow" /></span></div><img src={dal} alt="" width="200" height="160" /></a>
        <Link className="directory-path" to={signedInRole === "customer" ? "/customer/messes" : signedInRole === "owner" ? "/owner" : "/login"}><div><Icon name="home" /><h2>{translate(signedInRole === "customer" ? "My messes" : signedInRole === "owner" ? "Owner dashboard" : "Sign in")}</h2><p>{translate("Your Smart Mess account")}</p><span className="directory-path-arrow"><Icon name="arrow" /></span></div><img src={poha} alt="" width="200" height="160" /></Link>
      </nav><p className="directory-photo-note">{translate("Food imagery is illustrative. Explore each mess for its actual menu.")}</p></section>
      <section className="directory-discover" id="find-mess" tabIndex={-1} aria-label={translate("Mess search results")}><div className="section-heading"><div><p className="eyebrow">{translate("FIND YOUR DAILY TABLE")}</p><h2>{translate("A kitchen that fits your day.")}</h2></div>{!loading && <span role="status"><strong>{visibleMesses.length}</strong> {translate("Messes to explore")}</span>}</div>
      {!loading && cities.length > 0 && <nav className="directory-city-chips" aria-label={translate("Browse by city")}><button type="button" aria-pressed={!search} onClick={() => setSearch('')}>{translate("All kitchens")}</button>{cities.map(city => <button key={city} type="button" aria-pressed={search === city} onClick={() => setSearch(city)}><Icon name="location" size={16} />{city}</button>)}</nav>}
      <NearbySearch onChange={params => {setLoading(true);setLocation(params);}} />
      {error && <div className="alert error" role="alert"><p>{translate(error)}</p><button className="btn btn-outline" type="button" onClick={() => { setLoading(true); setError(""); setRetryCount(count => count + 1); }}>{translate("Retry")}</button></div>}
      {loading ? <LoadingCards label={translate("Loading messes…")} /> : <div className="directory-grid">{visibleMesses.map(mess => <article className="directory-card" key={mess.join_token}><figure className="directory-card-photo"><img src={kitchenPhotos[messes.indexOf(mess) % kitchenPhotos.length]} alt="" width="600" height="400" loading="lazy" /><figcaption>{translate("Illustrative meal photo")}</figcaption></figure><div className="directory-monogram" aria-hidden="true">{name(mess).trim().charAt(0).toUpperCase()}</div><h2>{name(mess)}</h2>{(mess.area || mess.city) && <p className="directory-location">{[mess.area, mess.city].filter(Boolean).join(" · ")}</p>}<div className="directory-tags">{mess.food_type && <span>{translate(mess.food_type)}</span>}{mess.service_type && <span>{translate(mess.service_type)}</span>}</div><p>{translate("Explore the menu and request your place.")}</p><KitchenPrices token={mess.join_token} /><Link className="btn btn-primary" to={`/mess/${mess.join_token}`}>{translate("View mess")}<span aria-hidden="true"> ↗</span></Link><Link className="directory-join" to={`/join/${mess.join_token}`}>{translate("Join this mess")}<span aria-hidden="true"> →</span></Link></article>)}</div>}
      {!loading && messes.length > 0 && !visibleMesses.length && <p className="public-empty" role="status">{translate("No matching mess. Try another name.")}</p>}
      {!loading && !error && !messes.length && <div className="public-empty" role="status"><p>{translate(location.radius_km ? "No kitchens within this radius. Try 10 km or All distances." : "Messes will appear here once their owners register. Check back soon.")}</p></div>}
      </section>
      <section className="directory-steps" id="how-it-works"><p className="eyebrow">{translate("FROM FINDING TO FEASTING")}</p><h2>{translate("A simpler way to your daily meal.")}</h2><div className="directory-step-grid">{[['01', 'Find your mess', 'Explore the menu and meet the kitchen.'], ['02', 'Request to join', 'Create your account. The owner approves membership.'], ['03', 'Choose & pay', 'Pick a plan or today’s meal. Pay by the owner’s QR.'], ['04', 'You’re all set', 'Owner confirmation activates your plan. Manage meals in your dashboard.']].map(([number, title, detail]) => <article key={number}><span>{number}</span><h3>{translate(title)}</h3><p>{translate(detail)}</p></article>)}</div></section>
      <section className="directory-faq"><div><p className="eyebrow">{translate("A FEW GOOD QUESTIONS")}</p><h2>{translate("Before you pull up a chair.")}</h2></div><div><details><summary>{translate("How do I pay?")}</summary><p>{translate("Scan the QR provided by your mess owner, submit your payment screenshot, and wait for the owner to confirm receipt.")}</p></details><details><summary>{translate("Can I skip a meal?")}</summary><p>{translate("Eligible subscription meals can be skipped before cutoff. Each skip adds a day to your subscription. Meals with guests or dispatched meals cannot be skipped.")}</p></details><details><summary>{translate("Can I try a single meal?")}</summary><p>{translate("After joining and saving your address, you can order today’s published meals when the owner has enabled a single-meal price. Full payment and owner acceptance are required.")}</p></details></div></section>
    </main>
    <footer className="directory-wrap directory-footer"><span>{translate("Fresh meals. Less waste.")}</span><Link to="/owner/register">{translate("Register your mess")} ↗</Link></footer>
  </div>;
}
