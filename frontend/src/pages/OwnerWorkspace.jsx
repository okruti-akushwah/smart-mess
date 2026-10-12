import Navbar from "../components/Navbar";
import JoinManager from "../components/JoinManager";
import OfferManager from "../components/OfferManager";
import SubscriptionManager from "../components/SubscriptionManager";
import BillWorkflow from "../components/BillWorkflow";
import PaymentOptions from "../components/PaymentOptions";
import { useTranslation } from "../i18n/useTranslation";

const sections = {
  requests: ["Requests", "Review customer join requests, subscription requests and payment confirmations."],
  plans: ["Plans & subscriptions", "Publish your meal plans and assign customer subscriptions."],
  bills: ["Bills", "Generate customer bills from subscriptions, skips and guest charges."],
  settings: ["Settings", "Manage guest pricing and the payment details your customers use."],
};

export default function OwnerWorkspace({ section }) {
  const translate = useTranslation();
  const [title, description] = sections[section];
  return <><Navbar title={translate(title)} /><main className="dashboard owner-dashboard">
    <section className="welcome owner-welcome"><div><p className="eyebrow">{translate("YOUR MESS WORKSPACE")}</p><h1>{translate(title)}</h1><p>{translate(description)}</p></div></section>
    {section === "requests" && <><JoinManager /><OfferManager view="requests" /><section id="payment-confirmations" style={{ scrollMarginTop: 180 }}><BillWorkflow owner view="payments" pendingOnly /></section></>}
    {section === "plans" && <><OfferManager view="plans" /><SubscriptionManager /></>}
    {section === "bills" && <BillWorkflow owner view="bills" />}
    {section === "settings" && <PaymentOptions owner />}
  </main></>;
}
