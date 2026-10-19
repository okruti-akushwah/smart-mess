// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ChooseFood from './ChooseFood';
import JoinMess from './JoinMess';
import PurchaseSteps from '../components/PurchaseSteps';
import api from '../services/api';

vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, errorMessage: error => error.message }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>; }

it('does not expose a payment destination before a checkout exists', () => {
  render(<MemoryRouter initialEntries={['/customer/choose?type=meal']}><PurchaseSteps /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: /Complete payment/ })).toBeNull();
  expect(screen.getByText('Choose your food before proceeding to payment.')).toBeTruthy();
});

it('retries a failed catalog read without retrying checkout or leaving a loading claim on the error screen', async () => {
  api.get.mockRejectedValue(new Error('Catalog unavailable'));
  render(<MemoryRouter initialEntries={['/customer/choose']}><ChooseFood /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Retry' });
  expect(screen.queryByText('Loading meals…')).toBeNull();
  catalogData();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('heading', { name: 'Lunch 1' });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('keeps the selected meal hash when an approved member continues', async () => {
  localStorage.setItem('token', 'demo'); localStorage.setItem('role', 'customer');
  api.get.mockImplementation(async url => ({ data: url.startsWith('/join/') ? { mess_name: 'Annapurna' } : [{ join_token: 'demo', status: 'approved' }] }));
  render(<MemoryRouter initialEntries={['/join/demo?next=%2Fcustomer%2Fchoose%23meal-8']}><Routes><Route path="/join/:token" element={<JoinMess />} /></Routes><Location /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Continue to your mess' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to selected meal' }));
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/customer/choose#meal-8'));
  expect(localStorage.getItem('activeMessToken')).toBe('demo');
  expect(api.post).not.toHaveBeenCalled();
});

function catalogData(subscriptions = []) {
  const meals = [1, 2, 3, 4].map(day => ({ id: day, date: `2099-01-0${day}`, meal_type: 'lunch', menu_description: `Lunch ${day}`, single_price: 100, booked: day === 1, can_manage: day === 1, status: 'confirmed' }));
  api.get.mockImplementation(async url => ({ data: url === '/meals/upcoming' ? meals : url === '/public/plans' ? [{ id: 5, name: 'Monthly', price: 1000, duration_days: 30, meal_types: ['lunch'] }] : url === '/customer/activity' ? { purchases: [] } : subscriptions }));
}

it('keeps the booked meal identity when returning to management',async()=>{
 catalogData();
 render(<MemoryRouter initialEntries={['/customer/choose']}><ChooseFood/></MemoryRouter>);
 expect((await screen.findByRole('link',{name:'Manage booked meals'})).getAttribute('href')).toBe('/customer#meal-1');
});

it('bounds the initial menu and retains all records through date expansion and filter recovery', async () => {
  catalogData();
  render(<MemoryRouter initialEntries={['/customer/choose']}><ChooseFood /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Lunch 1' });
  expect(screen.queryByRole('heading', { name: 'Lunch 4' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show all menu dates' }));
  expect(screen.getByRole('heading', { name: 'Lunch 4' })).toBeTruthy();
  fireEvent.click(screen.getByText('Filter meals', { selector: 'summary' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Booking status' }), { target: { value: 'booked' } });
  expect(screen.queryByRole('heading', { name: 'Lunch 2' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Meal type' }), { target: { value: 'dinner' } });
  expect(screen.getByText('No meals match these filters.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(document.activeElement).toBe(screen.getByText('Filter meals', { selector: 'summary' }));
  expect(screen.getByRole('heading', { name: 'Lunch 4' })).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it('changes the plan date only through the explicit non-overlap helper', async () => {
  catalogData([{ id: 1, name: 'Current', start_date: '2020-01-01', end_date: '2099-01-04', offer_id: 5 }]);
  render(<MemoryRouter initialEntries={['/customer/plans/browse']}><ChooseFood subscriptionsOnly /></MemoryRouter>);
  const helper = await screen.findByRole('button', { name: /Start after my current plans/ });
  expect(screen.getByRole('button', { name: 'Already subscribed' }).disabled).toBe(true);
  fireEvent.click(helper);
  expect(screen.getByLabelText('Subscription start date').value).toBe('2099-01-05');
  expect(screen.getByRole('button', { name: 'Buy plan & pay →' }).disabled).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
});
