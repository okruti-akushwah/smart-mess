import { pendingBalance } from "../services/billing";
import "../components/customerJourney.css";
import { useTranslation } from "../i18n/useTranslation";
import BillWorkflow from "../components/BillWorkflow";
import {
  useCallback,
  useEffect,
  useState } from
"react";

import Navbar from "../components/Navbar";
import PaymentHistory from "../components/PaymentHistory";
import api, { errorMessage } from "../services/api";

function BillHistory() {
  const translate = useTranslation();
  const [currentBill, setCurrentBill] =
  useState(null);

  const [amountDue, setAmountDue] = useState(null);

  const [history, setHistory] =
  useState([]);

  const [loading, setLoading] =
  useState(true);

  const [error, setError] =
  useState("");

  const loadBills = useCallback(
    async () => {
      setError("");

      try {
        const [current, previous, issued] = await Promise.allSettled([api.get("/bills/current"), api.get("/bills/history"), api.get("/bills/issued")]);
        if (current.status === "fulfilled") setCurrentBill(current.value.data);else
        if (current.reason.response?.status === 404) setCurrentBill(null);else
        throw current.reason;
        if (previous.status === "fulfilled") setHistory(previous.value.data);else
        throw previous.reason;
        if (issued.status === "rejected") throw issued.reason;
        setAmountDue(pendingBalance(issued.value.data, current.status === "fulfilled" ? current.value.data : null));
      } catch (err) {
        console.error(err);

        setError(
          errorMessage(err, "Unable to load billing information.")
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {loadBills();}, 0);
    const interval = setInterval(loadBills, 15000);
    window.addEventListener("focus", loadBills);
    return () => {clearTimeout(timer);clearInterval(interval);window.removeEventListener("focus", loadBills);};
  }, [loadBills]);

  if (loading) {
    return (
      <>
        <Navbar title={translate("Bills")} />

        <main className="dashboard">
          <div className="loading-card">{translate(" Loading bills... ")}

          </div>
        </main>
      </>);

  }

  return (
    <>
      <Navbar title={translate("Bills")} />

      <main className="dashboard">
        <section className="welcome bills-heading"><div><p className="eyebrow">TRANSPARENT BILLING</p><h1>{translate("Your Bills")}</h1><p>{translate("View your bills, payment confirmations and receipts.")}</p></div><div className="bills-pending-total" role="status" aria-live="polite"><span>{translate("Pending to pay owner")}</span><strong>{amountDue === null ? translate("Unavailable") : `₹${amountDue.toFixed(2)}`}</strong>{amountDue === 0 && <small>{translate("No payment pending")}</small>}</div></section>
        <BillWorkflow onUpdate={loadBills} payOnCheckout /><PaymentHistory />

        {error &&
        <div className="alert error">
            {translate(error)}
          </div>
        }

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{translate(" CURRENT SUBSCRIPTION ")}

              </p>

              <h2>{translate("Live Bill")}</h2>
            </div>
          </div>

          {!currentBill ?
          <div className="empty-card">{translate(" No active bill available. ")}

          </div> :

          <div className="bill-summary"><p>{currentBill.extension_days || 0} extra subscription days · {currentBill.skipped_meals || 0} skipped meals · Subscription ends {currentBill.end_date}</p>
              <BillStat
              label="Base Plan"
              value={
              currentBill.base_amount
              } />
            

              <BillStat
              label="Historical Skip Deductions"
              value={
              currentBill.deductions
              }
              prefix="-" />
            

              <BillStat
              label="Extras"
              value={
              currentBill.extras_total
              }
              prefix="+" />
            

              <div className="bill-summary-total">
                <span>{translate(" Current Total ")}

              </span>

                <strong>
                  ₹
                  {translate(Number(
                  currentBill.final_amount ||
                  0
                ).toFixed(2))}
                </strong>
              </div>
            </div>
          }
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{translate(" PREVIOUS MONTHS ")}

              </p>

              <h2>{translate("Bill History")}</h2>
            </div>
          </div>

          {history.length === 0 ?
          <div className="empty-card">{translate(" Previous finalized bills will appear here. ")}


          </div> :

          <div className="history-list">
              {history.map((bill) =>
            <article
              className="history-row"
              key={bill.id}>
              
                  <div>
                    <span className="meal-type">{translate(" BILL ")}

                </span>

                    <h3>
                      {translate(bill.month ||
                  `Bill #${bill.id}`)}
                    </h3>
                  </div>

                  <div className="history-cost">
                    <span>{translate(" Final amount ")}

                </span>

                    <strong>
                      ₹
                      {translate(Number(
                    bill.final_amount ??
                    bill.amount ??
                    0
                  ).toFixed(2))}
                    </strong>
                  </div>
                </article>
            )}
            </div>
          }
        </section>
      </main>
    </>);

}

function BillStat({
  label,
  value,
  prefix = ""
}) {
  const translate = useTranslation();
  return (
    <div className="bill-stat">
      <span>{translate(label)}</span>

      <strong>
        {translate(prefix)}₹
        {translate(Number(value || 0).toFixed(2))}
      </strong>
    </div>);

}

export default BillHistory;
