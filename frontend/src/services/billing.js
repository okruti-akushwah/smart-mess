export function pendingBalance(issuedBills, currentBill = null) {
  const latest = new Map();
  for (const bill of issuedBills) {
    if (bill.status === "cancelled") continue;
    const previous = latest.get(bill.plan_id);
    if (!previous || bill.id > previous.id) latest.set(bill.plan_id, bill);
  }
  if (currentBill) latest.set(currentBill.plan_id, currentBill);
  return [...latest.values()].reduce((cents, bill) => cents + Math.round(Math.max(0, Number(bill.balance_due)) * 100), 0) / 100;
}
