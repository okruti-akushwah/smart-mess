// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PersonalOrders from './PersonalOrders';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, errorMessage: error => error.message }));
vi.mock('./DynamicText', () => ({ default: ({ source }) => source }));
const showModal = HTMLDialogElement.prototype.showModal;
const close = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterAll(() => { HTMLDialogElement.prototype.showModal = showModal; HTMLDialogElement.prototype.close = close; });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);
const order = { plan_id: 42, customer_name: 'Aarav', meal_type: 'lunch', start_date: '2026-10-16', menu: 'Dal & rice', final_amount: 120, amount_paid: 120, balance_due: 0, status: 'pending_acceptance', accepted: false };

it('allows dismissal of a paid-order dialog without accepting the order', async () => {
  api.get.mockResolvedValue({ data: [order] });
  render(<PersonalOrders />);
  const dialog = await screen.findByRole('dialog', { name: 'Paid meal order ready to accept' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close notification' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Accept order' }).disabled).toBe(false);
});

it('keeps unpaid orders outside the paid-order dialog and prevents acceptance', async () => {
  api.get.mockResolvedValue({ data: [{ ...order, amount_paid: 0, balance_due: 120, status: 'pending_payment' }] });
  render(<PersonalOrders />);
  expect((await screen.findByRole('button', { name: 'Accept order' })).disabled).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
