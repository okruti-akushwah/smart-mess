import { useTranslation } from "../i18n/useTranslation";
import Navbar from "../components/Navbar";
import DeliveryPanel from "../components/DeliveryPanel";
export default function Delivery() {
  const translate = useTranslation();return <><Navbar title={translate("Delivery")} /><main className="dashboard"><DeliveryPanel owner={localStorage.getItem("role") === "owner"} /></main></>;}
