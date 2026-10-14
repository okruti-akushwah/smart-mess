import { useTranslation } from "../i18n/useTranslation";
import { Link } from "react-router-dom";
import thali from "../assets/thali.png";
import "./home.css";
import Discovery from "../components/Discovery";

const questions = [
["Can I try a plan before subscribing for longer?", "Browse the owner’s published plans. A one-day plan is a trial; longer plans can be weekly or monthly. Request a plan with your chosen start date. Your owner confirms the subscription and arranges payment."],
["Can I pause meals when I am away?", "Use Plans & pause to skip scheduled meals across a date range. Closed meals, dispatched meals and guest bookings stay unchanged. Menus published later are not included. Your end date stays the same and eligible skip deductions apply."],
["How do I track delivery?", "Save your address in Delivery and confirm availability with your owner. Your owner updates preparing, out for delivery and delivered statuses. Open Delivery and refresh for the latest update."],
["How do I see my actual menu?", "Create a member account and sign in. Your dashboard shows the meals published by your mess owner, including their dates, menus and photos."],
["Can I skip a meal or bring a guest?", "Yes. Use Skip meal or Add guest on your dashboard before the meal’s cutoff. You can undo a skip before that cutoff too."],
["How is my bill calculated?", "Your owner assigns your subscription amount and skip deduction. Your current bill reflects eligible skips and guest charges. You can also view available bill history."],
["How do menu photos work?", "When an owner types a menu, Smart Mess can generate a matching illustrative food photo using Gemini. The owner needs to configure a Gemini API key on the backend. Photos are illustrations, so the served meal may look different."]];


export default function Home() {
  const translate = useTranslation();
  const signedIn = Boolean(localStorage.getItem("token"));
  const dashboard = localStorage.getItem("role") === "owner" ? "/owner" : "/customer";
  return (
    <div className="home-page">
      <header className="home-nav home-wrap">
        <Link className="home-brand" to="/" aria-label={translate("Smart Mess home")}><span className="home-logo">{translate("M")}<span>✦</span></span><span>{translate("Smart Mess")}<small>{translate("GOOD FOOD. BETTER PLANNED.")}</small></span></Link>
        <nav aria-label={translate("Main navigation")}><a href="#live-menu">{translate("The menu")}</a><a href="#plans">{translate("Plans")}</a><a href="#reviews">{translate("Reviews")}</a><a href="#how-it-works">{translate("How it works")}</a><a href="#faq">{translate("FAQ")}</a></nav>
        <div className="home-nav-actions">{!signedIn && <Link to="/login">{translate("Log in")}</Link>}<Link className="home-button" to={signedIn ? dashboard : "/signup"}>{translate(signedIn ? "My dashboard" : "Get started")}<span aria-hidden="true">↗</span></Link></div>
      </header>
      <main>
        {/* Published menus and real plan choices appear below the introductory hero. */}
        <section className="home-hero home-wrap">
          <div className="home-hero-copy"><span className="home-eyebrow">{translate("A LITTLE LESS HASSLE. A LOT MORE FLAVOUR.")}</span><h1>{translate("Feels like home.")}<br /><em>{translate("Fits your day.")}</em></h1><p>{translate("Your everyday meals, beautifully organised. See what’s cooking, plan your meals and keep your bill in one easy place.")}</p><div className="home-actions"><Link className="home-button" to={signedIn ? dashboard : "/signup"}>{translate("Find your daily rhythm ")}<span aria-hidden="true">↗</span></Link><a className="home-secondary" href="#live-menu">{translate("Explore the menu ")}<span aria-hidden="true">↓</span></a></div><div className="home-trust"><span>{translate("✓ Menus at a glance")}</span><span>{translate("✓ Flexible meal planning")}</span><span>{translate("✓ Clear billing")}</span></div></div>
          <div className="home-hero-visual"><div className="home-photo-frame"><img src={thali} alt={translate("Illustrative Indian thali with roti, rice, dal and colourful vegetable sides")} fetchPriority="high" /><span className="home-image-caption">{translate("A taste of everyday comfort · illustrative photo")}</span></div><div className="home-floating"><span className="home-floating-icon" aria-hidden="true">✓</span><div>{translate("Your meal. Your choice.")}<small>{translate("Skip or add a guest before cutoff.")}</small></div></div><span className="home-round-label">{translate("GOOD FOOD")}<br /><b>{translate("less waste")}</b><br />{translate("HAPPY DAYS")}</span></div>
        </section>
        <div className="home-ribbon"><span>{translate("Breakfast to dinner")}</span><i>✦</i><span>{translate("Plan ahead")}</span><i>✦</i><span>{translate("Bring a guest")}</span><i>✦</i><span>{translate("Know your bill")}</span></div>
        <div className="home-wrap"><Discovery compact /></div>
        <section className="home-how" id="how-it-works"><div className="home-wrap home-section"><span className="home-eyebrow">{translate("LESS ADMIN. MORE APPETITE.")}</span><h2>{translate("Your meals, in three easy steps.")}</h2><div className="home-steps">{[["Create your account", "Join as a member or owner. Your owner can assign a subscription to your registered account."], ["See what’s cooking", "Browse upcoming meals and photos. Skip a meal or add a guest before the cutoff."], ["Keep everything in view", "Check your meal history and current bill. Owners see headcounts to plan the kitchen."]].map(([title, text], index) => <article key={title}><span className="home-step-number">0{translate(index + 1)}</span><h3>{translate(title)}</h3><p>{translate(text)}</p></article>)}</div></div></section>
        <section className="home-section home-wrap" id="features"><div className="home-section-top"><div><span className="home-eyebrow">{translate("MADE FOR BOTH SIDES OF THE TABLE")}</span><h2>{translate("A happier mess.")}<br />{translate("A simpler day.")}</h2></div><Link className="home-secondary" to="/signup">{translate("Join Smart Mess ↗")}</Link></div><div className="home-features">{[["01", "A menu you can picture", "Food photos alongside the menu make choosing your next meal feel a little more delicious."], ["02", "Plans that follow your day", "Heading out? Skip before cutoff. Bringing someone along? Add a guest in a few taps."], ["03", "Bills without the guesswork", "See your subscription, skip deductions and guest charges together in your current bill."], ["04", "A kitchen that can plan ahead", "Owners publish menus, manage subscriptions and see expected meal counts in one place."]].map(([number, title, text]) => <article key={number}><span>{translate(number)}</span><h3>{translate(title)}</h3><p>{translate(text)}</p></article>)}</div></section>
        <section className="home-faq home-wrap home-section" id="faq"><div><span className="home-eyebrow">{translate("A FEW THINGS YOU MIGHT WONDER")}</span><h2>{translate("Let’s clear")}<br />{translate("the table.")}</h2><p>{translate("Everything you need to get started.")}</p></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{translate(question)}</summary><p>{translate(answer)}</p></details>)}</div></section>
        <section className="home-cta home-wrap"><span className="home-eyebrow">{translate("YOUR NEXT MEAL STARTS HERE")}</span><h2>{translate("Good food. Less fuss.")}</h2><p>{translate("Make room for a simpler everyday routine.")}</p><Link className="home-button" to={signedIn ? dashboard : "/signup"}>{translate(signedIn ? "Open my dashboard" : "Create your account")} ↗</Link></section>
      </main>
      <footer className="home-footer home-wrap"><Link className="home-brand" to="/">{translate("Smart Mess")}</Link><p>{translate("Fresh meals. Less waste.")}</p><nav aria-label={translate("Footer navigation")}><a href="#live-menu">{translate("Menu")}</a><a href="#faq">{translate("FAQs")}</a><Link to="/owner/login">{translate("For mess owners")}</Link><Link to="/signup">{translate("Create account")}</Link></nav></footer>
    </div>);

}
