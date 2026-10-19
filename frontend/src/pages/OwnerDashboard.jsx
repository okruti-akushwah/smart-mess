import ExtraOrderList from "../components/ExtraOrderList";
import ActionBoard from "../components/ActionBoard";
import OwnerPage from "../components/OwnerPage";
import DynamicText from "../components/DynamicText";
import PersonalOrders from "../components/PersonalOrders";
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
  const [showMoreMeals, setShowMoreMeals] = useState(false);


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
  const shownMeals = !showMoreMeals ? visibleMeals.filter(meal => meal.date === today) : dayFilter === 'all' ? visibleMeals : visibleMeals.filter(meal => meal.date === dayFilter);
  const days = [0, 1, 2].map(offset => { const d = new Date(now); d.setDate(d.getDate() + offset); return { date: localDay(d), label: ['Today', 'Tomorrow', 'Day after'][offset] }; });
  const statistics = mealStatistics([...latestMeals, ...meals], now);
  const selectedMeal = statistics.meal;
  const formatTime = time => new Date(time).toLocaleString(translate.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const remainingMinutes = Math.max(0, Math.ceil((statistics.switchAt - now) / 60000));
  const publicPageReady = publicProfile?.address?.trim() && publicProfile?.contact?.trim()
    && (publicProfile?.hours?.trim() || publicProfile?.timings?.length);

  const legacyTabs = { "#mess-settings": "/owner/settings", "#customer-requests": "/owner/requests", "#subscription-plans": "/owner/plans", "#owner-plan-requests": "/owner/requests" };
  if (legacyTabs[hash]) return <Navigate to={legacyTabs[hash]} replace />;

  return (
    <>
      <Navbar title={translate("Owner Dashboard")} />

      <OwnerPage className="owner-dashboard">
        <section className="owner-dashboard-heading">
          <div>
            <p className="eyebrow">{translate("YOUR KITCHEN · LIVE")}

            </p>

            <h1>{translate("Welcome")}{publicProfile?.owner_name?.trim() ? `, ${publicProfile.owner_name.trim()}` : ''}!

            </h1>

            {publicProfile?.name?.trim() && <h2>{publicProfile.name.trim()}</h2>}

            <p>{translate("Meals, guests and orders. One clear view.")}


            </p>
          </div><div className="dashboard-header-mark" aria-hidden="true"><Icon name="meal" size={32} /><span><Icon name="people" size={20} /></span></div>
        </section>
        {error &&
        <div className="alert error" role="alert">
            {translate(error)}
          </div>
        }



        {loading ?
        <div className="loading-card" role="status">{translate(" Loading owner dashboard... ")}

        </div> :

        <>
            {!meals.length && !latestMeals.length && <details className="owner-public-start owner-onboarding-start" open={!publicPageReady}>
              <summary>{translate(publicPageReady ? "OWNER SETUP GUIDE" : "START HERE · OWNER SETUP")}</summary>
              <div><h2>{translate("Set up your mess, one step at a time")}</h2><p>{translate("Answer a few simple setup questions to prepare your public page, weekly menu, plans and payments, then invite members.")}</p></div>
              <Link className="btn btn-primary" to="/owner/onboarding">{translate("Continue setup")} <span aria-hidden="true">↗</span></Link>
            </details>}
            {selectedMeal && <section className="management-card current-meal-summary" aria-label={translate("Current meal statistics")}>
              <h2>{selectedMeal ? `${translate(selectedMeal.meal_type)} · ${selectedMeal.date}` : translate("No meal statistics available")}</h2>
              {selectedMeal ? <><p><DynamicText kind="meal" id={selectedMeal.id} field="menu_description" source={selectedMeal.menu_description} /></p><p><span className="status-badge">{statistics.phase === 'closed' ? translate("Cutoff passed") : translate("Live preview")}</span> · {remainingMinutes}{translate(" min ")}{statistics.phase === 'closed' ? translate("until next meal") : translate("until cutoff")}</p><details className="timing-note"><summary>{statistics.phase === 'closed' ? translate("Next switch") : translate("Cutoff")} · {formatTime(statistics.switchAt)}</summary><p>{translate("Statistics stay visible for 2 hours after cutoff, then switch to the next meal. ")}{statistics.next ? `${translate("Next")}: ${translate(statistics.next.meal_type)} · ${statistics.next.date}.` : ''}{translate(" Counts update as orders are confirmed.")}</p></details></> : <p className="muted">{translate("No current meal. Publish your next menu to see its counts.")}</p>}
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

            }
            <PendingRequestsSummary />
            <ActionBoard role="owner" />
            {(meals.length > 0 || latestMeals.length > 0) && <details className="owner-public-start owner-onboarding-start" open={!publicPageReady}>
              <summary>{translate(publicPageReady ? "OWNER SETUP GUIDE" : "START HERE · OWNER SETUP")}</summary>
              <div><h2>{translate("Set up your mess, one step at a time")}</h2><p>{translate("Answer a few simple setup questions to prepare your public page, weekly menu, plans and payments, then invite members.")}</p></div>
              <Link className="btn btn-primary" to="/owner/onboarding">{translate("Continue setup")} <span aria-hidden="true">↗</span></Link>
            </details>}
            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{translate(" LIVE HEADCOUNT ")}

                </p>

                  <h2>{translate(showMoreMeals ? "Today and the next 2 days" : "Today's menu")}

                </h2>
                </div>

                <span>
                  {translate("Refreshes every 5 seconds")}
                </span>
              </div>

              {showMoreMeals && <div className="day-switch" aria-label={translate("Filter meals by day")}><button aria-pressed={dayFilter === 'all'} onClick={() => setDayFilter('all')}>{translate("All 3 days")}</button>{days.map(day => <button key={day.date} aria-pressed={dayFilter === day.date} onClick={() => setDayFilter(day.date)}>{translate(day.label)}</button>)}</div>}
              <div className="meal-grid" id="owner-preparation-grid">
                {shownMeals.length === 0 ?
              <div className="empty-card">{translate(showMoreMeals ? "No meals scheduled for today or the next 2 days." : "No meals scheduled for today.")}

              </div> :

              shownMeals.map((meal) =>
              <article
                className="headcount-card"
                key={meal.meal_id}>
                
                      <header className="headcount-heading"><span className="meal-type"><Icon name="meal" size={16} />{translate(meal.meal_type)}</span><time dateTime={meal.date}>{new Date(`${meal.date}T00:00:00`).toLocaleDateString(translate.locale, { day: "numeric", month: "short" })}</time></header>

                      <h3 className="headcount-menu"><DynamicText kind="meal" id={meal.id} field="menu_description" source={meal.menu_description} /></h3><p className="headcount-cutoff"><span className={`headcount-state ${meal.changes_closed ? "is-closed" : "is-open"}`}>{meal.changes_closed ? translate("Changes closed") : translate("Open until")}</span>{meal.cutoff_time && <time>{new Date(meal.cutoff_time.endsWith("Z") ? meal.cutoff_time : `${meal.cutoff_time}Z`).toLocaleTimeString(translate.locale, { hour: "numeric", minute: "2-digit" })}</time>}</p>
                      <div className="headcount-extras">{meal.extra_items?.length > 0 && <><strong>{translate("Extras to prepare")}</strong><ul>{meal.extra_items.map(item => <li key={`${item.item_id}-${item.name}`}>{translate.locale === "hi-IN" && item.name_hi?.trim() ? item.name_hi : item.name} × {Number(item.quantity).toLocaleString(translate.locale)}</li>)}</ul></>}</div><div className="headcount-total"><strong className="big-number">
                        {translate(meal.expected_headcount)}
                      </strong>

                      <span className="big-number-label">{translate(" expected meals ")}

                </span></div>
                      <div className="meal-mix" role="img" aria-label={`${translate("Expected Meals")}: ${meal.expected_headcount} · ${translate("Personal orders")}: ${meal.personal_orders} · ${translate("Guests")}: ${meal.guests}`}><span style={{ flex: Math.max(0, meal.expected_headcount - meal.personal_orders - meal.guests) }} /><span style={{ flex: meal.personal_orders || 0 }} /><span style={{ flex: meal.guests || 0 }} /></div>

                      <div className="headcount-details"><div><a href="#today-personal-orders" onClick={event => { event.preventDefault(); document.getElementById("today-personal-orders")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`${translate("Personal orders")}: ${translate(meal.personal_orders)}`}><span>{translate("Personal orders")}<Icon name="arrow" size={16} /></span><strong>{translate(meal.personal_orders)}</strong></a></div>
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
              <button className="btn btn-outline headcount-more" type="button" aria-expanded={showMoreMeals} aria-controls="owner-preparation-grid" onClick={() => { setShowMoreMeals(value => !value); setDayFilter('all'); }}>{translate(showMoreMeals ? "Show less" : "Show more")}</button>
            </section>


          </>
        }
        <ExtraOrderList owner />
        <PersonalOrders onUpdate={loadDashboard} />
        <section className="management-card order-records completed-meal-records"><h2>{translate("Latest completed meal statistics")}</h2>{latestMeals.length ? <div className="order-record-grid">{latestMeals.map(meal => <article className="meal-order-card" key={meal.meal_id}>
          <header className="meal-order-heading"><div><h3>{translate(meal.meal_type)}</h3><span className="meal-order-meta"><Icon name="calendar" size={16}/><time dateTime={meal.date}>{new Date(`${meal.date}T00:00:00`).toLocaleDateString(translate.locale,{day:'numeric',month:'short',year:'numeric'})}</time></span></div></header>
          <p className="meal-order-menu"><DynamicText kind="meal" id={meal.id} field="menu_description" source={meal.menu_description}/></p>
          <dl className="completed-meal-counts">{[["Meals",meal.expected_headcount],["Skipped",meal.skipped_subscribers],["Guests",meal.guests],["Personal orders",meal.personal_orders]].map(([label,value])=><div key={label}><dt>{translate(label)}</dt><dd>{Number(value).toLocaleString(translate.locale)}</dd></div>)}</dl>
        </article>)}</div> : <p>{translate("No completed meals yet.")}</p>}</section>
      </OwnerPage>
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
