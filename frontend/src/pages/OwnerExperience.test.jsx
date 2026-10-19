// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OwnerDashboard from './OwnerDashboard';
import CustomerDirectory from '../components/CustomerDirectory';
import api from '../services/api';
import { localDay } from '../services/dates';

vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../components/PersonalOrders', () => ({ default: () => <section>Personal order tools</section> }));
vi.mock('../components/PendingRequestsSummary', () => ({ default: () => <section>Member request tools</section> }));
vi.mock('../services/api', () => ({ default: { get: vi.fn() }, errorMessage: error => error.message }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

it('restores member records after an empty search without losing delivery or subscription details', async () => {
  api.get.mockResolvedValue({ data: [{ id: 1, name: 'Aarav', phone: '9000000002', membership_status: 'approved', address: 'Room 201, Pune', instructions: 'Reception', subscriptions: [{ id: 2, name: 'Homestyle', status: 'active', start_date: '2026-10-01', end_date: '2026-11-01', extension_days: 3, meal_types: ['lunch'] }] }] });
  render(<CustomerDirectory />);
  await screen.findByRole('heading', { name: 'Aarav' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), { target: { value: 'unmatched' } });
  expect(screen.getByText('No matching members.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search members' }));
  expect(screen.getByRole('heading', { name: 'Aarav' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '9000000002' }).getAttribute('href')).toBe('tel:9000000002');
  expect(screen.getByText(/Room 201, Pune/)).toBeTruthy();
  expect(screen.getByText('Homestyle')).toBeTruthy();
  expect(screen.getByText(/extra days from skips or pauses/)).toBeTruthy();
});

it.each([true, false])('keeps the setup guide available with profile ready=%s', async ready => {
  api.get.mockImplementation(async url => ({ data: url === '/owner/a-la-carte/orders' ? [] : url === '/owner/mess-profile'
    ? { owner_name: 'Rajesh', name: 'Annapurna', address: ready ? 'Pune' : '', contact: '9000000001', hours: 'Lunch' }
    : { preparation: [], latest_meals: [] } }));
  render(<MemoryRouter><OwnerDashboard /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Welcome, Rajesh!' });
  const summary = screen.getByText(ready ? 'OWNER SETUP GUIDE' : 'START HERE · OWNER SETUP');
  await waitFor(() => expect(summary.closest('details').open).toBe(!ready));
  if (ready) fireEvent.click(summary);
  expect(summary.closest('details').open).toBe(true);
  expect(screen.getByRole('link', { name: /Continue setup/ }).getAttribute('href')).toBe('/owner/onboarding');
  expect(screen.getByText('Member request tools')).toBeTruthy();
  expect(screen.getByText('Personal order tools')).toBeTruthy();
});


it('shows today first and reveals future preparation through Show more', async () => {
  const preparation = [0, 1, 2].map(offset => {
    const date = new Date(); date.setDate(date.getDate() + offset);
    return { id: offset + 1, meal_id: offset + 1, date: localDay(date), meal_type: 'lunch', menu_description: ['Today dal', 'Tomorrow paneer', 'Later poha'][offset], expected_headcount: 10, active_subscribers: 10, skipped_subscribers: 0, personal_orders: 0, guests: 0 };
  });
  api.get.mockImplementation(async url => ({ data: url === '/owner/a-la-carte/orders' ? [] : url === '/owner/mess-profile' ? { name: 'Annapurna' } : { preparation, latest_meals: [] } }));
  render(<MemoryRouter><OwnerDashboard /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Today dal', level: 3 });
  expect(screen.queryByRole('heading', { name: 'Tomorrow paneer', level: 3 })).toBeNull();
  const more = screen.getByRole('button', { name: 'Show more', exact: true });
  expect(more.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(more);
  expect(screen.getByRole('heading', { name: 'Tomorrow paneer', level: 3 })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Later poha', level: 3 })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tomorrow', exact: true }));
  expect(screen.queryByRole('heading', { name: 'Today dal', level: 3 })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show less', exact: true }));
  expect(screen.getByRole('heading', { name: 'Today dal', level: 3 })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Tomorrow paneer', level: 3 })).toBeNull();
});
