import PersonalOrders from "../components/PersonalOrders";
import OwnerMealFeedback from "../components/OwnerMealFeedback";
import { useTranslation } from "../i18n/useTranslation";
import PendingRequestsSummary from "../components/PendingRequestsSummary";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";


import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import { mealStatistics } from "../services/mealStatistics";

function OwnerDashboard() {
  const translate = useTranslation();
  const { hash } = useLocation();
  const [headcount, setHeadcount] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {

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
    const interval = setInterval(loadDashboard, 5000);
    window.addEventListener("focus", loadDashboard);
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener("focus", loadDashboard); };
  }, [loadDashboard]);

  useEffect(() => {
    window.addEventListener("subscription-updated", loadDashboard);
    return () => window.removeEventListener("subscription-updated", loadDashboard);
  }, [loadDashboard]);

  const meals = headcount?.preparation || [];
  const latestMeals = headcount?.latest_meals || [];
  const statistics = mealStatistics([...latestMeals, ...meals], now);
  const selectedMeal = statistics.meal;
  const formatTime = time => new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const remainingMinutes = Math.max(0, Math.ceil((statistics.switchAt - now) / 60000));
  const publicPageReady = publicProfile?.address?.trim() && publicProfile?.contact?.trim()
    && (publicProfile?.hours?.trim() || publicProfile?.timings?.length);

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

            <h1>{translate(" Meal preparation at a glance. ")}

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
            <section className="management-card" aria-label="Current meal statistics">
              <h2>{selectedMeal ? `${translate(selectedMeal.meal_type)} · ${selectedMeal.date}` : "No meal statistics available"}</h2>
              {selectedMeal ? <><p>{selectedMeal.menu_description}</p><p><strong>{statistics.phase === 'closed' ? 'Cutoff passed · preparation statistics' : 'Next meal · live preview'}</strong></p><p className="muted">{statistics.phase === 'closed' ? `These statistics stay visible for 2 hours after cutoff, until ${formatTime(statistics.switchAt)} (${remainingMinutes} min remaining). After 2 hours, the next meal’s statistics will appear${statistics.next ? `: ${statistics.next.meal_type} · ${statistics.next.date}` : ' when another meal is scheduled'}.` : `Cutoff: ${formatTime(statistics.switchAt)} (${remainingMinutes} min remaining). These counts may change until cutoff. After cutoff, this meal’s statistics remain visible for 2 hours, then switch to the next meal.`}</p></> : <p className="muted">The previous meal’s 2-hour window has ended, or no meals with cutoff times are scheduled. Publish the next meal to see its statistics.</p>}
            <div className="stats-grid" id="owner-overview">
              <StatCard
              label="Expected Meals"
              value={selectedMeal?.expected_headcount ?? "—"}
              description={statistics.phase === 'closed' ? "After cutoff" : "Next meal estimate"} />
            

              <StatCard
              label="Confirmed Skips"
              value={selectedMeal?.skipped_subscribers ?? "—"}
              description="Subscription days added" />
            

              <StatCard
              label="Guests"
              value={selectedMeal?.guests ?? "—"}
              description="Additional meals" />
            
            </div>
            </section>

            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{translate(" LIVE HEADCOUNT ")}

                </p>

                  <h2>{translate(" Today's and Upcoming Meals ")}

                </h2>
                </div>

                <span>
                  {translate("Refreshes every 5 seconds")}
                </span>
              </div>

              <div className="meal-grid">
                {meals.length === 0 ?
              <div className="empty-card">{translate(" No meals scheduled yet. ")}

              </div> :

              meals.map((meal) =>
              <article
                className="headcount-card"
                key={meal.meal_id}>
                
                      <span className="meal-type">
                        {translate(meal.meal_type)} · {meal.date}
                      </span>

                      <p>{meal.menu_description}</p><p>{meal.changes_closed ? "Cutoff passed · changes closed" : "Live · changes open"}{meal.cutoff_time ? ` · ${new Date(meal.cutoff_time.endsWith("Z") ? meal.cutoff_time : `${meal.cutoff_time}Z`).toLocaleString()}` : ""}</p>
                      <strong className="big-number">
                        {translate(meal.expected_headcount)}
                      </strong>

                      <span className="big-number-label">{translate(" expected meals ")}

                </span>

                      <div className="headcount-details"><div><a href="#today-personal-orders" onClick={event => { event.preventDefault(); document.getElementById("today-personal-orders")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`${meal.personal_orders} personal orders — view today's orders`}><span>Personal orders</span><strong>{meal.personal_orders}</strong></a></div>
                        <div>
                          <span>{translate("Subscriptions")}</span>
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
        <PersonalOrders onUpdate={loadDashboard} />
        <section className="management-card"><h2>Latest completed meal statistics</h2>{latestMeals.length ? latestMeals.map(meal => <div className="request-row" key={meal.meal_id}><div><strong>{meal.date} · {meal.meal_type}</strong><p>{meal.menu_description}</p><p>{meal.expected_headcount} meals · {meal.skipped_subscribers} skips · {meal.guests} guests · {meal.personal_orders} personal orders</p></div></div>) : <p>No completed meals yet.</p>}</section>
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
