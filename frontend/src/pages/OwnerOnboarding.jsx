import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import MessProfileEditor from "../components/MessProfileEditor";
import WeeklyMenuEditor from "../components/WeeklyMenuEditor";
import OfferManager from "../components/OfferManager";
import PaymentOptions from "../components/PaymentOptions";
import api, { errorMessage } from "../services/api";
import { useTranslation } from "../i18n/useTranslation";
import "./owner-onboarding.css";

const steps = [
  { title: "What should members know about your mess?", hint: "Add the address, contact details and meal timings people need before joining.", label: "Your mess" },
  { title: "What will you serve each week?", hint: "Set a repeating menu once. Upcoming dated meals are created from it automatically, and you can edit it whenever needed.", label: "Weekly menu" },
  { title: "Which plans can members choose?", hint: "Publish the meal plans and prices you want to offer. You can update them later.", label: "Plans & prices" },
  { title: "How should members pay you?", hint: "Upload your payment QR and add the recipient details members should verify before paying.", label: "Payment QR" },
  { title: "Ready to invite your first members?", hint: "Share your public mess link. Members can view your details and send a request to join.", label: "Invite members" },
];

export default function OwnerOnboarding() {
  const translate = useTranslation();
  const [current, setCurrent] = useState(0);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const active = steps[current];

  useEffect(() => {
    let mounted = true;
    api.get("/owner/mess-profile")
      .then(({ data }) => { if (mounted) setProfile(data); })
      .catch((error) => { if (mounted) setProfileError(errorMessage(error, "Unable to load your invite link.")); });
    return () => { mounted = false; };
  }, []);

  const invitePath = profile?.join_token ? `/mess/${profile.join_token}` : "";
  const inviteUrl = invitePath ? `${window.location.origin}${invitePath}` : "";
  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return <>
    <Navbar title={translate("Owner setup guide")} />
    <main className="dashboard owner-dashboard owner-onboarding">
      <section className="owner-onboarding-hero">
        <div>
          <p className="eyebrow">{translate("A SIMPLE START FOR YOUR MESS")}</p>
          <h1>{translate("Let’s set up your kitchen.")}</h1>
          <p>{translate("We’ll take this one question at a time. Your answers are saved in the same tools you already use to manage your mess.")}</p>
        </div>
        <Link className="btn btn-outline" to="/owner">{translate("Back to dashboard")}</Link>
      </section>

      <section className="owner-onboarding-card" aria-label={translate("Owner setup steps")}>
        <div className="owner-onboarding-progress">
          <span>{translate("STEP ")}{current + 1}{translate(" OF ")}{steps.length}</span>
          <div className="owner-onboarding-track" role="progressbar" aria-valuemin="1" aria-valuemax={steps.length} aria-valuenow={current + 1} aria-label={translate("Setup progress")}>
            <span style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
          </div>
          <nav aria-label={translate("Setup sections")} className="owner-onboarding-step-list">
            {steps.map((step, index) => <button type="button" key={step.label} className={index === current ? "is-current" : ""}
              aria-current={index === current ? "step" : undefined} onClick={() => {setCurrent(index);setCopied(false);setCopyError(false);}}>
              <span>{index + 1}</span>{translate(step.label)}
            </button>)}
          </nav>
        </div>

        <div className="owner-onboarding-content">
          <header className="owner-onboarding-question">
            <p className="eyebrow">{translate("YOUR NEXT QUESTION")}</p>
            <h2>{translate(active.title)}</h2>
            <p>{translate(active.hint)}</p>
          </header>

          <div hidden={current !== 0}><MessProfileEditor /></div>
          <div hidden={current !== 1}><WeeklyMenuEditor /></div>
          <div hidden={current !== 2}><OfferManager /></div>
          <div hidden={current !== 3}><PaymentOptions owner /></div>
          <div hidden={current !== 4}><section className="management-card owner-onboarding-invite">
            <h3>{translate("Your public mess link")}</h3>
            <p>{translate("Share this link with people who want to see your mess and request to join.")}</p>
            {profileError && <p role="alert" className="alert error">{translate(profileError)}</p>}
            {inviteUrl ? <>
              <label className="form-field">{translate("Invite link")}<input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /></label>
              <div className="form-actions"><button type="button" className="btn btn-primary" onClick={copyInvite}>{translate(copied ? "Link copied" : "Copy invite link")}</button><a className="btn btn-outline" href={invitePath} target="_blank" rel="noreferrer">{translate("Preview public page")}</a></div>
              {copyError && <p className="muted" role="status">{translate("Copy is unavailable in this browser. Select the invite link above and copy it manually.")}</p>}
            </> : !profileError ? <p role="status">{translate("Loading your invite link…")}</p> : null}
            <p className="muted">{translate("You can review join requests later from Requests in your owner workspace.")}</p>
          </section></div>

          <div className="owner-onboarding-controls">
            <button type="button" className="btn btn-outline" disabled={current === 0} onClick={() => {setCurrent((value) => value - 1);setCopied(false);setCopyError(false);}}>{translate("Back")}</button>
            {current < steps.length - 1
              ? <button type="button" className="btn btn-primary" onClick={() => {setCurrent((value) => value + 1);setCopied(false);setCopyError(false);}}>{translate("Next question")} <span aria-hidden="true">→</span></button>
              : <Link className="btn btn-primary" to="/owner">{translate("Finish setup")} <span aria-hidden="true">✓</span></Link>}
          </div>
          <p className="owner-onboarding-note">{translate("You can return to any step and change these details later.")}</p>
        </div>
      </section>
    </main>
  </>;
}
