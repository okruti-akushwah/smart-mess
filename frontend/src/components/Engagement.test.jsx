// @vitest-environment jsdom
import { it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PurchaseSteps from './PurchaseSteps';
import ActionBoard from './ActionBoard';
afterEach(cleanup);
it('retains the bill query in the active payment step without claiming completion', () => {
  render(<MemoryRouter initialEntries={['/customer/checkout?bill=42']}><PurchaseSteps /></MemoryRouter>);
  const active = screen.getByRole('link', { current: 'step' });
  expect(active.getAttribute('href')).toBe('/customer/checkout?bill=42');
  expect(screen.getAllByRole('link')).toHaveLength(3);
});
it('does not insert an order journey into unrelated pages', () => {
  render(<MemoryRouter initialEntries={['/customer/history']}><PurchaseSteps /></MemoryRouter>);
  expect(screen.queryByRole('navigation')).toBeNull();
});
it('keeps customer shortcuts linked to existing actions including the meal query', () => {
  render(<MemoryRouter><ActionBoard role="customer" /></MemoryRouter>);
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/customer/choose?type=meal', '/customer/plans/browse', '/customer/pause', '/customer/bills']);
});
