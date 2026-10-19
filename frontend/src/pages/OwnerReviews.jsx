import OwnerPage from "../components/OwnerPage";
import Navbar from "../components/Navbar";
import OwnerMealFeedback from "../components/OwnerMealFeedback";
import { useTranslation } from "../i18n/useTranslation";

export default function OwnerReviews() {
  const translate = useTranslation();
  return <>
    <Navbar title={translate("Reviews")} />
    <OwnerPage className="owner-dashboard owner-reviews-page">
      <section className="welcome owner-welcome"><div><p className="eyebrow">{translate('FROM YOUR MEMBERS')}</p><h1>{translate('Reviews')}</h1><p>{translate('Meal ratings & suggestions')}</p></div></section>
      <OwnerMealFeedback />
    </OwnerPage>
  </>;
}
