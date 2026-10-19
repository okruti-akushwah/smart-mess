// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerDashboard from './CustomerDashboard';
import api from '../services/api';

vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../components/LatestMealReview', () => ({ default: () => null }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, errorMessage: error => error.message }));
vi.mock('../services/dynamicTranslations', () => ({ translateSaved: vi.fn(async (_kind, _id, _field, source) => source) }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T09:00:00Z'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('exposes a stable target for the selected booked meal',async()=>{
 api.get.mockImplementation(async url=>({data:url==='/meals/upcoming'?meals:url==='/customer/account'?{mess_name:'Annapurna',paused_dates:[]}:[]}));
 render(<MemoryRouter initialEntries={['/customer#meal-2']}><CustomerDashboard/></MemoryRouter>);
 const card=(await screen.findByRole('heading',{name:'Evening paneer'})).closest('article');
 expect(card.id).toBe('meal-2');
});

const meals = [
  { id: 1, date: '2026-10-16', meal_type: 'breakfast', menu_description: 'Morning poha', cutoff_time: '2026-10-16T01:00:00Z', booked: true, status: 'confirmed', can_manage: true, single_price: 60 },
  { id: 2, date: '2026-10-16', meal_type: 'dinner', menu_description: 'Evening paneer', cutoff_time: '2026-10-16T18:00:00Z', booked: true, status: 'confirmed', can_manage: true, single_price: 100 },
];

it('puts open meal changes first while retaining closed meals, action guards and shortcut destinations', async () => {
  api.get.mockImplementation(async url => ({ data: url === '/meals/upcoming' ? meals : url === '/customer/account' ? { mess_name: 'Annapurna', customer_name: 'Aarav', paused_dates: [] } : [] }));
  render(<MemoryRouter><CustomerDashboard /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Evening paneer' });
  const today = screen.getByRole('heading', { name: "Today's menu" }).closest('section');
  const cards = within(today).getAllByRole('article');
  expect(within(cards[0]).getByRole('heading').textContent).toBe('Evening paneer');
  expect(within(cards[0]).getByRole('button', { name: 'Skip meal' }).disabled).toBe(false);
  expect(within(cards[1]).getByRole('button', { name: 'Skip meal' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'lunch', exact: true }));
  expect(within(today).getByText('No meals in this selection yet.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'All meals', exact: true }));
  expect(within(today).getAllByRole('article')).toHaveLength(2);
  const shortcuts = screen.getByRole('navigation', { name: 'Your meal shortcuts' });
  expect(within(shortcuts).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
    '/customer/choose?type=meal', '/customer/plans/browse', '/customer/pause', '/customer/bills',
  ]);
  expect(api.post).not.toHaveBeenCalled();
});

it('retains failed-load feedback and a reachable retry with no fabricated meals', async () => {
  api.get.mockRejectedValue(new Error('Dashboard unavailable'));
  render(<MemoryRouter><CustomerDashboard /></MemoryRouter>);
  expect(screen.getByText("Loading today's menu…").closest('[role="status"]').getAttribute('aria-busy')).toBe('true');
  await screen.findAllByRole('alert');
  expect(screen.getAllByRole('alert').every(node => node.textContent.includes('Dashboard unavailable'))).toBe(true);
  expect(screen.getByText('No meals in this selection yet.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  expect(api.post).not.toHaveBeenCalled();
});
