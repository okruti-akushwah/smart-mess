// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LanguageProvider from '../i18n/LanguageProvider';
import i18n from '../i18n/i18n';
import api from '../services/api';
import MessDirectory from './MessDirectory';
import MessPublic from './MessPublic';
import Login from './Login';
import Signup from './Signup';
import SignupOtp from '../components/SignupOtp';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: '/api' } }, errorMessage: (error, fallback) => error.message || fallback }));
vi.mock('../services/dynamicTranslations', () => ({ translateSaved: vi.fn(async (_kind, _id, _field, source) => source) }));
const messes = [
  { name: 'Annapurna', name_hi: 'अन्नपूर्णा', city: 'Pune', area: 'College Road', join_token: 'demo' },
  { name: 'Saffron', city: 'Jaipur', area: 'University Road', join_token: 'second' },
];
beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks();
  await i18n.changeLanguage('en');
  api.get.mockImplementation(async url => ({ data: url === '/auth/signup/settings' ? { demo_registration: true } : url === '/public/messes' ? messes : [] }));
});
afterEach(cleanup);
function Location() { const location = useLocation(); return <output data-testid="destination">{location.pathname}{location.search}{location.hash}</output>; }
function mount(component, path = '/') { return render(<MemoryRouter initialEntries={[path]}><LanguageProvider>{component}<Location /></LanguageProvider></MemoryRouter>); }

it('offers owner registration in the public header and keeps owner intent through sign-in', async () => {
  const view = mount(<MessDirectory />);
  await screen.findByRole('heading', {name:'Annapurna'});
  expect(screen.getByRole('banner').querySelector('a[href="/owner/register"]')).toBeTruthy();
  view.unmount();
  mount(<Login />, '/login?role=owner&next=%2Fjoin%2Fdemo');
  expect(screen.getByRole('link',{name:'Create an account'}).getAttribute('href')).toBe('/register?role=owner&next=%2Fjoin%2Fdemo');
});

it('filters discovery by existing city/area data and restores results with Clear search', async () => {
  mount(<MessDirectory />);
  await screen.findByRole('heading', { name: 'Annapurna' });
  fireEvent.click(screen.getByRole('button', { name: 'Jaipur', exact: true }));
  expect(screen.getByRole('button', { name: 'Jaipur', exact: true }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('heading', { name: 'Annapurna' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Saffron' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('heading', { name: 'Annapurna' })).toBeTruthy();
  expect(screen.getByLabelText('Search messes').value).toBe('');
});

it('distinguishes no search matches from no registered messes', async () => {
  const view = mount(<MessDirectory />);
  await screen.findByRole('heading', { name: 'Annapurna' });
  fireEvent.change(screen.getByLabelText('Search messes'), { target: { value: 'No matching city' } });
  expect(screen.getByText('No matching mess. Try another name.')).toBeTruthy();
  view.unmount(); api.get.mockResolvedValue({ data: [] });
  mount(<MessDirectory />);
  await screen.findByText('Messes will appear here once their owners register. Check back soon.');
  expect(screen.queryByText('No matching mess. Try another name.')).toBeNull();
});

it('retries the existing public request after a load failure', async () => {
  api.get.mockRejectedValueOnce(new Error('Kitchen list unavailable'));
  mount(<MessDirectory />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('heading', { name: 'Annapurna' });
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.get.mock.calls.every(([url]) => url === '/public/messes')).toBe(true);
});

it('uses explicit Hindi mess names with one reachable homepage language control', async () => {
  await i18n.changeLanguage('hi'); mount(<MessDirectory />);
  await screen.findByRole('heading', { name: 'अन्नपूर्णा' });
  expect(screen.getAllByLabelText('भाषा / Language')).toHaveLength(1);
});

it('preserves a typed mess search and matching results when changing language',async()=>{
 mount(<MessDirectory/>);await screen.findByRole('heading',{name:'Annapurna'});
 fireEvent.change(screen.getByLabelText('Search messes'),{target:{value:'Annapurna'}});
 fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'hi'}});
 await screen.findByRole('heading',{name:'अन्नपूर्णा'});
 expect(screen.getByLabelText('मेस खोजें').value).toBe('Annapurna');
});

it('keeps the selected meal and mess in public order handoff links', async () => {
  api.get.mockImplementation(async url => ({ data: url.startsWith('/public/mess/') ? { name: 'Annapurna', join_token: 'demo', owner_id: 1 } : url === '/public/menu' ? [{ id: 8, date: '2026-10-16', meal_type: 'lunch', menu_description: 'Dal and roti', single_price: 60 }] : [] }));
  mount(<Routes><Route path="/mess/:token" element={<MessPublic />} /></Routes>, '/mess/demo');
  await screen.findByRole('heading', { name: 'Annapurna', level: 1 });
  expect(screen.getByRole('link', { name: 'View meal and availability' }).getAttribute('href')).toBe('/join/demo?next=%2Fcustomer%2Fchoose%23meal-8');
  expect(screen.getByText('₹60 · Single meal')).toBeTruthy();
  expect(screen.getByText('Illustrative meal photo')).toBeTruthy();
});

it('keeps entered login values while switching language and preserves a join return destination', async () => {
  api.post.mockResolvedValue({ data: { access_token: 'demo-token', role: 'customer' } });
  const target = '/join/demo?next=%2Fcustomer%2Fchoose%23meal-8';
  mount(<Login />, `/login?next=${encodeURIComponent(target)}`);
  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '9000000002' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Demo1234!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').type).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByLabelText('Password').type).toBe('password');
  fireEvent.change(screen.getByLabelText('भाषा / Language'), { target: { value: 'hi' } });
  await waitFor(() => expect(i18n.resolvedLanguage).toBe('hi'));
  expect(document.getElementById('login-phone').value).toBe('9000000002');
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => expect(screen.getByTestId('destination').textContent).toBe(target));
  expect(api.post).toHaveBeenCalledWith('/auth/login', { phone: '9000000002', password: 'Demo1234!' });
});

it('preserves owner registration payload and onboarding login handoff in demo mode', async () => {
  api.post.mockResolvedValue({ data: {} });
  mount(<Signup />, '/register?role=owner');
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Phone number / login ID'), { target: { value: '9000000103' } });
  await screen.findByLabelText('Your name');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Demo owner' } });
  fireEvent.change(screen.getByLabelText('Mess name'), { target: { value: 'Demo kitchen' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Demo1234!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').type).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByLabelText('Password').type).toBe('password');
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => expect(screen.getByTestId('destination').textContent).toBe('/login'));
  expect(api.post).toHaveBeenCalledWith('/auth/signup', { name: 'Demo owner', mess_name: 'Demo kitchen', phone: '9000000103', password: 'Demo1234!', role: 'owner', verification_id: null });
});

it('preserves OTP challenge and verification requests inside the existing parent form', async () => {
  api.post.mockResolvedValueOnce({ data: { otp_required: true, challenge_id: 'demo-challenge', resend_after: 30, message: 'Code sent' } }).mockResolvedValueOnce({ data: { verification_id: 'verified-demo' } });
  const verified = vi.fn();
  mount(<form onSubmit={event => event.preventDefault()}><SignupOtp inline phone="9000000103" role="owner" onVerified={verified} /></form>, '/register');
  fireEvent.click(screen.getByRole('button', { name: 'Send signup OTP' }));
  await screen.findByLabelText('6-digit OTP');
  expect(document.querySelectorAll('form')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('6-digit OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
  await waitFor(() => expect(verified).toHaveBeenCalledWith('verified-demo'));
  expect(api.post).toHaveBeenNthCalledWith(1, '/auth/signup/otp', { phone: '9000000103', join_token: null, role: 'owner' });
  expect(api.post).toHaveBeenNthCalledWith(2, '/auth/signup/verify-otp', { challenge_id: 'demo-challenge', code: '123456' });
});
