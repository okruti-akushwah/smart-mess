// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerCheckout from './CustomerCheckout';
import ChooseFood from './ChooseFood';
import api from '../services/api';

vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../components/BillWorkflow', () => ({ default: ({ targetBillId }) => <section aria-label="Payment workflow">Bill {targetBillId}</section> }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, errorMessage: error => error.message }));
vi.mock('../services/dynamicTranslations', () => ({ translateSaved: vi.fn(async (_kind, _id, _field, source) => source) }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

it.each([
  ['pending_payment', 120, 'Scan the QR below'],
  ['pending_acceptance', 0, 'Waiting for the owner'],
  ['active', 0, 'Your booking is active'],
  ['cancelled', 120, 'This checkout was cancelled.'],
])('retains %s checkout meaning and keeps payment controls outside the summary', async (status, balance_due, copy) => {
  api.get.mockResolvedValue({ data: { purchases: [{ id: 42, plan_id: 9, kind: 'meal', meal_id: 5, menu: 'Dal & rice', start_date: '2026-10-16', final_amount: 120, amount_paid: 120 - balance_due, balance_due, status }] } });
  render(<MemoryRouter initialEntries={['/customer/checkout?bill=42']}><CustomerCheckout /></MemoryRouter>);
  await screen.findByText(new RegExp(copy));
  const payment = screen.queryByRole('region', { name: 'Payment workflow' });
  if (status === 'cancelled') expect(payment).toBeNull();
  else {
    expect(payment.textContent).toContain('42');
    expect(payment.closest('.welcome')).toBeNull();
  }
  expect(Boolean(screen.queryByRole('button', { name: 'Cancel unpaid checkout' }))).toBe(status === 'pending_payment');
  expect(api.post).not.toHaveBeenCalled();
});

it('retains cutoff, subscription inclusion and missing-price guards on meal cards', async () => {
  const meals = [
    { id: 1, meal_type: 'lunch', date: '2099-01-01', menu_description: 'Booked dal', booked: true, can_manage: true, status: 'confirmed', single_price: 120 },
    { id: 2, meal_type: 'dinner', date: '2020-01-01', menu_description: 'Closed meal', booked: false, cutoff_time: '2020-01-01T10:00:00Z', single_price: 120 },
    { id: 3, meal_type: 'breakfast', date: '2099-01-01', menu_description: 'Unpriced meal', booked: false, single_price: null },
  ];
  api.get.mockImplementation(async url => ({ data: url === '/customer/activity' ? { purchases: [] } : url === '/meals/upcoming' ? meals : [] }));
  render(<MemoryRouter initialEntries={['/customer/choose?type=meal']}><ChooseFood /></MemoryRouter>);
  for (const label of ['Included in your subscription', 'Ordering closed', 'Price not set by owner']) {
    expect((await screen.findByRole('button', { name: label })).disabled).toBe(true);
  }
  expect(api.post).not.toHaveBeenCalled();
});
