import { useTranslation } from '../i18n/useTranslation';
import ExtraLines from './ExtraLines';

// These are presentation subtotals only. Payable totals and receipts come from the API.
export default function BillBreakdown({ bill, showBalance = true }) {
  const t = useTranslation();
  const cents = value => Math.round(Number(value || 0) * 100);
  const extras = cents(bill.extras_total);
  const dishes = (bill.extra_lines || []).reduce((sum, line) => sum + cents(line.total), 0);
  const canSeparate = Array.isArray(bill.extra_lines) && dishes <= extras;
  const money = value => `₹${Number(value || 0).toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const row = (label, amount, total = false) => <div className={total ? 'bill-breakdown-total' : undefined} key={label}><dt>{t(label)}</dt><dd>{money(amount)}</dd></div>;
  return <div className="bill-breakdown">
    <dl aria-label={t('Charge breakdown')}>
      {row(bill.kind === 'meal' ? 'Meal price' : 'Base Plan', bill.base_amount)}
      {Number(bill.deductions) > 0 && row('Historical Skip Deductions', -Number(bill.deductions))}
      {canSeparate ? <>{row('Guest charges', (extras - dishes) / 100)}{row('Extra dishes', dishes / 100)}</> : row('Guests & extra dishes', bill.extras_total)}
      {row('Total', bill.final_amount, true)}
      {showBalance && bill.status !== 'cancelled' && <>{row('Confirmed payments', bill.amount_paid)}{row('Amount due', bill.balance_due, true)}{Number(bill.credit) > 0 && row('Credit', bill.credit)}</>}
    </dl>
    <ExtraLines lines={bill.extra_lines} />
  </div>;
}
