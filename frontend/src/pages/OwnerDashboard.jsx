import OwnerMealFeedback from "../components/OwnerMealFeedback";
import { useTranslation } from "../i18n/useTranslation";
import PendingRequestsSummary from "../components/PendingRequestsSummary";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";


import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";

function OwnerDashboard() {
  const translate = useTranslation();
  const { hash } = useLocation();
  const [headcount, setHeadcount] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [headcountResult, profileResult] = await Promise.allSettled([
        api.get("/dashboard/headcount"),
        api.get("/owner/mess-profile"),
      ]);
      if (profileResult.status === "fulfilled") setPublicProfile(profileResult.value.data);
      if (headcountResult.status === "rejected") throw headcountResult.reason;
      setHeadcount(headcountResult.value.data);
    } catch (err) {
      setError(
        errorMessage(err, "Unable to load owner dashboard.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {loadDashboard();}, 0);
      return () => clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    window.addEventListener("subscription-updated", loadDashboard);
    return () => window.removeEventListener("subscription-updated", loadDashboard);
  }, [loadDashboard]);

  const meals = headcount?.meals || [];
  const publicPageReady = publicProfile?.address?.trim() && publicProfile?.contact?.trim()
    && (publicProfile?.hours?.trim() || publicProfile?.timings?.length);

  const totalExpected = meals.reduce(
    (total, meal) =>
    total + (meal.expected_headcount || 0),
    0
  );

  const totalSkips = meals.reduce(
    (total, meal) =>
    total + (meal.skipped_subscribers || 0),
    0
  );

  const totalGuests = meals.reduce(
    (total, meal) =>
    total + (meal.guests || 0),
    0
  );

  const legacyTabs = { "#mess-settings": "/owner/settings", "#customer-requests": "/owner/requests", "#subscription-plans": "/owner/plans", "#owner-plan-requests": "/owner/requests" };
  if (legacyTabs[hash]) return <Navigate to={legacyTabs[hash]} replace />;

  return (
    <>
      <Navbar title={translate("Owner Dashboard")} />

      <main className="dashboard owner-dashboard">
        {publicProfile && !publicPageReady && <section className="owner-public-start">
          <div><p className="eyebrow">{translate("START HERE · STEP 1")}</p><h2>{translate("Set up your public mess page")}</h2><p>{translate("Help customers find your mess. Add your address, contact details and meal timings before sharing your join link.")}</p></div>
          <Link className="btn btn-primary" to="/owner/public-page">{translate("Set up public page")} <span aria-hidden="true">↗</span></Link>
        </section>}
        <section className="welcome owner-welcome">
          <div>
            <p className="eyebrow">{translate(" OPERATIONS CENTER ")}

            </p>

            <h1>{translate(" Tomorrow's preparation at a glance. ")}

            </h1>

            <p>{translate(" Live customer actions are reflected in your expected meal headcount. ")}


            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={loadDashboard}>{translate(" Refresh ")}


          </button>
        </section>

        {error &&
        <div className="alert error">
            {translate(error)}
          </div>
        }



        <PendingRequestsSummary />
        {loading ?
        <div className="loading-card">{translate(" Loading owner dashboard... ")}

        </div> :

        <>
            <div className="stats-grid" id="owner-overview">
              <StatCard
              label="Expected Meals"
              value={totalExpected}
              description="Tomorrow" />
            

              <StatCard
              label="Confirmed Skips"
              value={totalSkips}
              description="Already deducted" />
            

              <StatCard
              label="Guests"
              value={totalGuests}
              description="Additional meals" />
            
            </div>

            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{translate(" LIVE HEADCOUNT ")}

                </p>

                  <h2>{translate(" Tomorrow's Meal Plan ")}

                </h2>
                </div>

                <span>
                  {translate(headcount?.date || "")}
                </span>
              </div>

              <div className="meal-grid">
                {meals.length === 0 ?
              <div className="empty-card">{translate(" No meals scheduled for tomorrow. ")}

              </div> :

              meals.map((meal) =>
              <article
                className="headcount-card"
                key={meal.meal_id}>
                
                      <span className="meal-type">
                        {translate(meal.meal_type)}
                      </span>

                      <strong className="big-number">
                        {translate(meal.expected_headcount)}
                      </strong>

                      <span className="big-number-label">{translate(" expected meals ")}

                </span>

                      <div className="headcount-details">
                        <div>
                          <span>{translate("Active")}</span>
                          <strong>
                            {translate(meal.active_subscribers)}
                          </strong>
                        </div>

                        <div>
                          <span>{translate("Skipped")}</span>
                          <strong>
                            {translate(meal.skipped_subscribers)}
                          </strong>
                        </div>

                        <div>
                          <span>{translate("Guests")}</span>
                          <strong>
                            {translate(meal.guests)}
                          </strong>
                        </div>
                      </div>
                    </article>
              )
              }
              </div>
            </section>


          </>
        }
        <OwnerMealFeedback />
      </main>
    </>);

}

function StatCard({
  label,
  value,
  description
}) {
  const translate = useTranslation();
  return (
    <article className="stat-card">
      <span>{translate(label)}</span>
      <strong>{translate(value)}</strong>
      <p>{translate(description)}</p>
    </article>);

}

export default OwnerDashboard;
