import Navbar from "../components/Navbar";
import JoinManager from "../components/JoinManager";
import OfferManager from "../components/OfferManager";
import SubscriptionManager from "../components/SubscriptionManager";
import BillWorkflow from "../components/BillWorkflow";
import PaymentOptions from "../components/PaymentOptions";
import CustomerDirectory from "../components/CustomerDirectory";
import { useTranslation } from "../i18n/useTranslation";

const sections = {
  customers: ["Members", "View your mess members, contact numbers, delivery addresses and subscription status."],
  requests: ["Requests", "Review member join requests and payment confirmations."],
  plans: ["Plans & subscriptions", "Publish your meal plans and assign member subscriptions."],
  bills: ["Bills", "Generate member bills from subscriptions, skips and guest charges."],
  settings: ["Settings", "Manage guest pricing and the payment details your members use."],
};

export default function OwnerWorkspace({ section }) {
  const translate = useTranslation();
  const [title, description] = sections[section];
  return <><Navbar title={translate(title)} /><main className="dashboard owner-dashboard">
    <section className="welcome owner-welcome"><div><p className="eyebrow">{translate("YOUR MESS WORKSPACE")}</p><h1>{translate(title)}</h1><p>{translate(description)}</p></div></section>
    {section === "requests" && <><JoinManager /><section id="payment-confirmations" style={{ scrollMarginTop: 180 }}><BillWorkflow owner view="payments" pendingOnly /></section></>}
    {section === "plans" && <><OfferManager /><SubscriptionManager /></>}
    {section === "customers" && <CustomerDirectory />}
    {section === "bills" && <BillWorkflow owner view="bills" />}
    {section === "settings" && <PaymentOptions owner />}
  </main></>;
}
