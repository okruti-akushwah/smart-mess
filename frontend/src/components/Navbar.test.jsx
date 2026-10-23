// @vitest-environment jsdom
import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import LanguageProvider from '../i18n/LanguageProvider';
import i18n from '../i18n/i18n';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

vi.mock('./NotificationSound', () => ({ default: () => <button>Sound</button> }));
vi.mock('./BillNotification', () => ({ default: () => <a href="/customer/bills">Bill notification</a> }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(async () => ({ data: { mess_name: 'Annapurna' } })) } }));
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function () { this.setAttribute('open', ''); this.querySelector('button')?.focus(); });
  HTMLDialogElement.prototype.close = vi.fn(function () { this.removeAttribute('open'); queueMicrotask(() => this.dispatchEvent(new Event('close'))); });
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});
beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('role', 'owner');
  await i18n.changeLanguage('en');
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>; }
function mount(path = '/owner') {
  return render(<MemoryRouter initialEntries={[path]}><LanguageProvider><Navbar /><main>Workspace</main><Location /></LanguageProvider></MemoryRouter>);
}

it('retains all owner destinations and marks Requests active on its payment anchor', async () => {
  mount('/owner/requests#payment-confirmations');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  const nav = within(await screen.findByRole('dialog', { name: 'More options' })).getByRole('navigation', { name: 'Main navigation' });
  expect(within(nav).getAllByRole('link')).toHaveLength(10);
  expect(within(nav).getByRole('link', { name: 'Requests' }).getAttribute('aria-current')).toBe('page');
  expect(within(nav).getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/owner/settings');
});

it('keeps the desktop owner navigation focused on frequent tasks while More retains every destination', async () => {
  mount('/owner');
  const desktopNav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
  expect(within(desktopNav).getAllByRole('link')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  const drawerNav = within(await screen.findByRole('dialog', { name: 'More options' })).getByRole('navigation', { name: 'Main navigation' });
  expect(within(drawerNav).getAllByRole('link')).toHaveLength(10);
  expect(within(drawerNav).getByRole('link', { name: 'Payments' })).toBeTruthy();
});

it('marks subscriptions active while browsing the nested plan catalog', async () => {
  localStorage.setItem('role', 'customer');
  mount('/customer/plans/browse');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  expect((await screen.findByRole('link', { name: 'Subscriptions' })).getAttribute('aria-current')).toBe('page');
});

it('keeps navigation closed by default and reveals all routes only on demand', async () => {
  mount();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'More navigation' }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  expect(within(await screen.findByRole('dialog')).getAllByRole('link')).toHaveLength(10);
});

it('opens a right-side drawer, closes with Escape, and restores focus', async () => {
  mount();
  const trigger = screen.getByRole('button', { name: 'More navigation' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'More options' });
  expect(dialog.className).toContain('workspace-menu-drawer');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe('');
});

it('closes the navigation drawer when its backdrop is clicked', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  await screen.findByRole('dialog');
  fireEvent.click(document.querySelector('.ui-drawer-backdrop'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('navigates from the mobile menu and preserves customer order query strings', async () => {
  localStorage.setItem('role', 'customer');
  mount('/customer');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Order food' }));
  expect(screen.getByTestId('location').textContent).toBe('/customer/choose?type=meal');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('opens the meal menu from the Skip meals navigation tab', async () => {
  localStorage.setItem('role', 'customer');
  mount('/customer');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Skip meals' }));
  expect(screen.getByTestId('location').textContent).toBe('/customer#skip-meals');
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  const drawer = await screen.findByRole('dialog', { name: 'More options' });
  expect(within(drawer).getByRole('link', { name: 'Skip meals' }).getAttribute('aria-current')).toBe('page');
});

it('provides one workspace language control and translates an already-open menu', async () => {
  mount();
  expect(screen.getAllByLabelText('भाषा / Language')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
  await screen.findByRole('dialog');
  // Native modal makes the background inert in browsers; switching here exercises reactive translation.
  fireEvent.change(screen.getByLabelText('भाषा / Language'), { target: { value: 'hi' } });
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'More options' })).toBeTruthy());
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'विंडो बंद करें' })).toBeTruthy();
  expect(document.documentElement.lang).toBe('hi');
});

it('keeps logout behavior and removes all existing session keys', () => {
  ['token', 'user', 'activeMessToken'].forEach(key => localStorage.setItem(key, 'sample'));
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  ['token', 'role', 'user', 'activeMessToken'].forEach(key => expect(localStorage.getItem(key)).toBeNull());
  expect(screen.getByTestId('location').textContent).toBe('/login');
});

it('moves skip-link focus to the main landmark', () => {
  mount();
  fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }));
  expect(document.activeElement).toBe(screen.getByRole('main'));
});

it('hides the workspace header while scrolling down and reveals it while scrolling up', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
  let scrollY = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
  try {
    mount();
    scrollY = 90; fireEvent.scroll(window);
    expect(document.querySelector('.workspace-shell').className).toContain('workspace-shell-hidden');
    scrollY = 60; fireEvent.scroll(window);
    expect(document.querySelector('.workspace-shell').className).not.toContain('workspace-shell-hidden');
  } finally {
    if (descriptor) Object.defineProperty(window, 'scrollY', descriptor);
  }
});

it('keeps busy dialogs open and disables close while a submission is pending', () => {
  const close = vi.fn();
  render(<Dialog open busy title="Pending guest" onClose={close}><button>Submit</button></Dialog>);
  expect(screen.getByRole('button', { name: 'Close dialog' }).disabled).toBe(true);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
});

it('wraps forward and backward Tab at dialog boundaries', () => {
  render(<Dialog open title="Navigation test" onClose={() => {}}><a href="/owner">Last link</a></Dialog>);
  const dialog = screen.getByRole('dialog');
  const first = screen.getByRole('button', { name: 'Close dialog' });
  const last = screen.getByRole('link', { name: 'Last link' });
  // jsdom has no layout engine; mark these rendered controls as having a box.
  [first, last].forEach(node => { node.getClientRects = () => [{ width: 44, height: 44 }]; });
  last.focus(); fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
});

it('loading buttons cannot submit a second action', () => {
  const click = vi.fn();
  render(<Button loading onClick={click}>Saving</Button>);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  expect(click).not.toHaveBeenCalled();
});

it('does not dismiss a newly mounted dialog during StrictMode effect replay', async () => {
  const close = vi.fn();
  render(<StrictMode><Dialog open title="Guest form" onClose={close}><input aria-label="Guest count" /></Dialog></StrictMode>);
  await waitFor(() => expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true));
  expect(close).not.toHaveBeenCalled();
});
