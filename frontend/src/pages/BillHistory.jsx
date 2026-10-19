import BillBreakdown from "../components/BillBreakdown";
import CustomerPage from "../components/CustomerPage";
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

  const [loading, setLoading] =
  useState(true);

  const [error, setError] =
  useState("");

  const loadBills = useCallback(
    async () => {
      setError("");

      try {
        const [current, issued] = await Promise.allSettled([api.get("/bills/current"), api.get("/bills/issued")]);
        if (current.status === "fulfilled") setCurrentBill(current.value.data);else
        if (current.reason.response?.status === 404) setCurrentBill(null);else
        throw current.reason;
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

        <CustomerPage>
          <div className="loading-card" role="status">{translate(" Loading bills... ")}

          </div>
        </CustomerPage>
      </>);

  }

  return (
    <>
      <Navbar title={translate("Bills")} />

      <CustomerPage>
        <section className="welcome bills-heading"><div><p className="eyebrow">{translate("TRANSPARENT BILLING")}</p><h1>{translate("Your Bills")}</h1><p>{translate("View your bills, payment confirmations and receipts.")}</p></div><div className="bills-pending-total" role="status" aria-live="polite"><span>{translate("Pending to pay owner")}</span><strong>{amountDue === null ? translate("Unavailable") : `₹${amountDue.toFixed(2)}`}</strong>{amountDue === 0 && <small>{translate("No payment pending")}</small>}</div></section>
        <BillWorkflow onUpdate={loadBills} payOnCheckout /><PaymentHistory />

        {error &&
        <div className="alert error" role="alert">
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

          <div className="bill-summary"><p>{currentBill.extension_days || 0}{translate(" extra subscription days · ")}{currentBill.skipped_meals || 0}{translate(" skipped meals · Subscription ends ")}{currentBill.end_date}</p>
              <BillBreakdown bill={currentBill} />
            </div>
          }
        </section>


      </CustomerPage>
    </>);

}

export default BillHistory;
