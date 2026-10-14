import PersonalOrders from "../components/PersonalOrders";
import OwnerMealFeedback from "../components/OwnerMealFeedback";
import { useTranslation } from "../i18n/useTranslation";
import PendingRequestsSummary from "../components/PendingRequestsSummary";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";


import Navbar from "../components/Navbar";
import api, { errorMessage } from "../services/api";
import { mealStatistics } from "../services/mealStatistics";
import { localDay } from "../services/dates";
import Icon from "../components/Icon";

function OwnerDashboard() {
  const translate = useTranslation();
  const { hash } = useLocation();
  const [headcount, setHeadcount] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [dayFilter, setDayFilter] = useState('all');

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
  const today = localDay(new Date(now));
  const lastDay = new Date(now);
  lastDay.setDate(lastDay.getDate() + 2);
  const visibleMeals = meals.filter(meal => meal.date >= today && meal.date <= localDay(lastDay));
  const shownMeals = dayFilter === 'all' ? visibleMeals : visibleMeals.filter(meal => meal.date === dayFilter);
  const days = [0, 1, 2].map(offset => { const d = new Date(now); d.setDate(d.getDate() + offset); return { date: localDay(d), label: ['Today', 'Tomorrow', 'Day after'][offset] }; });
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
        <section className="owner-public-start owner-onboarding-start">
          <div><p className="eyebrow">{translate(publicPageReady ? "OWNER SETUP GUIDE" : "START HERE · OWNER SETUP")}</p><h2>{translate("Set up your mess, one step at a time")}</h2><p>{translate("Answer a few simple setup questions to prepare your public page, weekly menu, plans and payments, then invite members.")}</p></div>
          <Link className="btn btn-primary" to="/owner/onboarding">{translate("Continue setup")} <span aria-hidden="true">↗</span></Link>
        </section>
        <section className="welcome owner-welcome">
          <div>
            <p className="eyebrow">{translate("YOUR KITCHEN · LIVE")}

            </p>

            <h1>{translate("Good food. Great flow.")}

            </h1>

            <p>{translate("Meals, guests and orders. One clear view.")}


            </p>
          </div>

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
              {selectedMeal ? <><p>{selectedMeal.menu_description}</p><p><span className="status-badge">{statistics.phase === 'closed' ? 'Cutoff passed' : 'Live preview'}</span> · {remainingMinutes} min {statistics.phase === 'closed' ? 'until next meal' : 'until cutoff'}</p><details className="timing-note"><summary>{statistics.phase === 'closed' ? 'Next switch' : 'Cutoff'} · {formatTime(statistics.switchAt)}</summary><p>Statistics stay visible for 2 hours after cutoff, then switch to the next meal. {statistics.next ? `Next: ${statistics.next.meal_type} · ${statistics.next.date}.` : ''} Counts update as orders are confirmed.</p></details></> : <p className="muted">No current meal. Publish your next menu to see its counts.</p>}
            <div className="stats-grid" id="owner-overview">
              <StatCard
              label="Expected Meals"
              icon="meal"
              value={selectedMeal?.expected_headcount ?? "—"}
              description={statistics.phase === 'closed' ? "After cutoff" : "Next meal estimate"} />
            

              <StatCard
              label="Confirmed Skips"
              icon="calendar"
              value={selectedMeal?.skipped_subscribers ?? "—"}
              description="Subscription days added" />
            

              <StatCard
              label="Guests"
              icon="people"
              value={selectedMeal?.guests ?? "—"}
              description="Additional meals" />
            
            </div>
            </section>

            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{translate(" LIVE HEADCOUNT ")}

                </p>

                  <h2>{translate("Today and the next 2 days")}

                </h2>
                </div>

                <span>
                  {translate("Refreshes every 5 seconds")}
                </span>
              </div>

              <div className="day-switch" aria-label="Filter meals by day"><button aria-pressed={dayFilter === 'all'} onClick={() => setDayFilter('all')}>All 3 days</button>{days.map(day => <button key={day.date} aria-pressed={dayFilter === day.date} onClick={() => setDayFilter(day.date)}>{day.label} <span>· {visibleMeals.filter(meal => meal.date === day.date).length}</span></button>)}</div>
              <div className="meal-grid">
                {shownMeals.length === 0 ?
              <div className="empty-card">{translate("No meals scheduled for today or the next 2 days.")}

              </div> :

              shownMeals.map((meal) =>
              <article
                className="headcount-card"
                key={meal.meal_id}>
                
                      <span className="meal-type">
                        <Icon name="meal" size={16} />{translate(meal.meal_type)} · {meal.date}
                      </span>

                      <p>{meal.menu_description}</p><p>{meal.changes_closed ? "Changes closed" : "Open until"}{meal.cutoff_time ? ` · ${new Date(meal.cutoff_time.endsWith("Z") ? meal.cutoff_time : `${meal.cutoff_time}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</p>
                      <strong className="big-number">
                        {translate(meal.expected_headcount)}
                      </strong>

                      <span className="big-number-label">{translate(" expected meals ")}

                </span>
                      <div className="meal-mix" role="img" aria-label={`${meal.expected_headcount} expected meals: ${meal.personal_orders} personal orders, ${meal.guests} guests, remaining subscription meals`}><span style={{ flex: Math.max(0, meal.expected_headcount - meal.personal_orders - meal.guests) }} /><span style={{ flex: meal.personal_orders || 0 }} /><span style={{ flex: meal.guests || 0 }} /></div>

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
  description,
  icon
}) {
  const translate = useTranslation();
  return (
    <article className="stat-card">
      <span className="stat-icon"><Icon name={icon} size={22} /></span>
      <span>{translate(label)}</span>
      <strong>{translate(value)}</strong>
      <p>{translate(description)}</p>
    </article>);

}

export default OwnerDashboard;
