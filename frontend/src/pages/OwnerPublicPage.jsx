import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import MessProfileEditor from "../components/MessProfileEditor";
import { useTranslation } from "../i18n/useTranslation";

export default function OwnerPublicPage() {
  const translate = useTranslation();
  return <>
    <Navbar title={translate("Public page")} />
    <main className="dashboard owner-dashboard">

      <section className="welcome owner-welcome">
        <div><p className="eyebrow">{translate("STEP 1 · INTRODUCE YOUR MESS")}</p>
          <h1>{translate("Make your mess easy to discover.")}</h1>
          <p>{translate("Add your address, contact details and meal timings, then preview the page your members will see.")}</p>
        </div>
        <Link className="btn btn-outline" to="/owner">{translate("Back to dashboard")}</Link>
      </section>
      <MessProfileEditor />
    </main>
  </>;
}
