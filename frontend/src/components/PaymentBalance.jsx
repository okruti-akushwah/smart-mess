import { useTranslation } from "../i18n/useTranslation";export default function PaymentBalance({ bill }) {
  const translate = useTranslation();
  if (!bill) return null;
  return <section className="bill-card"><div className="bill-row"><span>{translate("Paid directly to owner")}</span><strong>₹{translate(Number(bill.amount_paid || 0).toFixed(2))}</strong></div><div className="bill-row"><span>{translate("Balance to pay")}</span><strong>₹{translate(Number(bill.balance_due ?? bill.final_amount).toFixed(2))}</strong></div>{bill.credit > 0 && <div className="bill-row"><span>{translate("Credit to arrange with owner")}</span><strong>₹{translate(Number(bill.credit).toFixed(2))}</strong></div>}<p className="muted">{translate("Payments appear after your owner records them. Meal changes can update your balance.")}</p></section>;
}
