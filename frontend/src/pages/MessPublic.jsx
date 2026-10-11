import { LanguageContext } from "../i18n/LanguageContext";
import { useTranslation } from "../i18n/useTranslation";
import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../services/api";
import MenuImage from "../components/MenuImage";
import thali from "../assets/thali.png";
import './mess-public.css';
export default function MessPublic() {
  const translate = useTranslation();
  const { token } = useParams();
  const [profile, setProfile] = useState(null),[meals, setMeals] = useState([]),[error, setError] = useState(''),[loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setError('');setLoading(true);
    try {const [p, m] = await Promise.all([api.get(token ? `/public/mess/${token}` : '/public/mess'), api.get('/public/menu', { params: token ? { mess_token: token } : {} })]);setProfile(p.data);setMeals([...m.data].sort((a, b) => a.date.localeCompare(b.date) || ["breakfast", "lunch", "dinner"].indexOf(a.meal_type) - ["breakfast", "lunch", "dinner"].indexOf(b.meal_type)));}
    catch (e) {setError(errorMessage(e));} finally {setLoading(false);}
  }, [token]);
  useEffect(() => {const t = setTimeout(load, 0);return () => clearTimeout(t);}, [load]);
  const { language } = useContext(LanguageContext);
  const display = field => language === "hi" && profile?.[`${field}_hi`]?.trim() ? profile[`${field}_hi`] : profile?.[field];
  const today = new Date().toLocaleDateString('en-CA');
  const todaysMeals = meals.filter((m) => m.date === today),upcoming = meals.filter((m) => m.date > today);
  const dashboard = localStorage.getItem('role') === 'owner' ? '/owner' : '/customer';
  const join = profile ? `/join/${profile.join_token}` : '#';
  return <div className="mess-public"><header className="mess-nav mess-wrap"><Link to="/" className="mess-brand"><span>{translate("M")}</span>{translate(display("name") || 'Our mess')}</Link><nav aria-label={translate("Public mess navigation")}><a href="#about">{translate("About")}</a><a href="#menu">{translate("Menu")}</a><a href="#preparation">{translate("Our kitchen")}</a><a href="#visit">{translate("Find us")}</a></nav>{localStorage.getItem('token') && <Link className="btn btn-outline" to={dashboard}>{translate('My dashboard')}</Link>}</header>
    <main>{error && <div className="mess-wrap alert error" role="alert">{translate(error)} <button className="btn btn-outline" onClick={load}>{translate("Retry")}</button></div>}{loading && !profile && <p className="mess-wrap" role="status">{translate("Loading mess details…")}</p>}{profile && <>
      <section className="mess-hero mess-wrap"><div><p className="eyebrow">{translate("WELCOME TO OUR TABLE")}</p><h1>{display("name")}</h1><p className="mess-intro">{translate(display("about") || 'Explore our published menu, get to know the mess, and request to join when you’re ready.')}</p><div className="form-actions"><Link className="btn btn-primary" to={join}>{translate("Join this mess ↗")}</Link><a className="btn btn-outline" href="#menu">{translate("See the menu ↓")}</a></div><p className="mess-small">{translate("Browse freely. Create your account only when you want to join.")}</p></div><figure><img src={thali} alt={translate("Illustrative Indian thali with rice, roti, dal and vegetables")} /><figcaption>{translate("Illustrative meal photo")}</figcaption></figure></section>
      <section className="mess-facts mess-wrap" id="visit"><article><p className="eyebrow">{translate("COME FIND US")}</p><h2>{translate("Our address")}</h2><p>{translate(display("address") || 'Address will be shared by the owner soon.')}</p></article><article><p className="eyebrow">{translate("PLAN YOUR VISIT")}</p><h2>{translate("Meal timings")}</h2><p>{translate(profile.hours || 'Contact the owner for meal timings.')}</p></article><article><p className="eyebrow">{translate("SAY HELLO")}</p><h2>{translate("Contact")}</h2><p>{translate(profile.contact || 'Contact details will be shared soon.')}</p></article></section>
      <section className="mess-section mess-wrap" id="menu"><div className="section-heading"><div><p className="eyebrow">{translate("WHAT’S COOKING")}</p><h2>{translate("Today’s menu")}</h2><p className="muted">{translate(new Date().toLocaleDateString(translate.locale, { weekday: 'long', day: 'numeric', month: 'long' }))}{translate(" · Meals published by the owner")}</p></div><button className="btn btn-outline" disabled={loading} onClick={load}>{translate("Refresh menu")}</button></div><MealCards meals={todaysMeals} />{!todaysMeals.length && <p className="empty-card">{translate("Today’s menu hasn’t been published yet. Check back soon.")}</p>}{upcoming.length > 0 && <><h3 className="mess-upcoming-title">{translate("Coming up")}</h3><MealCards meals={upcoming} /></>}</section>
      <section className="mess-kitchen" id="preparation"><div className="mess-wrap mess-kitchen-grid"><div><p className="eyebrow">{translate("BEHIND YOUR MEAL")}</p><h2>{translate("From our kitchen")}<br />{translate("to your plate.")}</h2><p>{translate("Get to know how your mess prepares and serves its meals.")}</p></div><div className="mess-preparation">{translate(display("preparation") || 'The owner will add details about ingredients, preparation, hygiene and serving here soon.')}</div></div></section>
      <section className="mess-section mess-wrap" id="about"><p className="eyebrow">{translate("A PLACE AT THE TABLE")}</p><h2>{translate("About ")}{display("name")}</h2><p className="mess-about">{translate(display("about") || 'The owner will share more about the mess here soon.')}</p><div className="mess-join-card"><div><h2>{translate("Ready to join us?")}</h2><p>{translate("Enter your name and phone number, choose your password, and request to join. Once the owner approves you, log in to choose your subscription.")}</p></div><Link className="btn btn-primary" to={join}>{translate("Join this mess ↗")}</Link></div></section>
    </>}</main><footer className="mess-footer mess-wrap"><p>{translate(display("name") || 'Smart Mess')}{translate(" · Menu, kitchen & community")}</p><div><Link to="/login">{translate("Customer login")}</Link><span aria-hidden="true"> · </span><Link to="/owner/login">{translate("For mess owners")}</Link></div></footer></div>;
}
function MealCards({ meals }) {
  const translate = useTranslation();
  return <div className="mess-menu-grid">{meals.map((m) => <article className="mess-meal" key={m.id}><MenuImage className="mess-meal-photo" menu={m.menu_description} imageUrl={m.image_url} /><div><span className="meal-type">{translate(m.meal_type)}</span><h3>{translate(m.menu_description || 'Menu to be announced')}</h3><p>{translate(new Date(`${m.date}T12:00:00`).toLocaleDateString(translate.locale, { weekday: 'short', day: 'numeric', month: 'short' }))}</p></div></article>)}</div>;
}
