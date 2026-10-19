// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MenuImage from './MenuImage';
import i18n from '../i18n/i18n';

vi.mock('../services/api', () => ({ default: { defaults: { baseURL: '/api' } } }));
vi.mock('../services/menuImages', () => ({ menuImage: () => ({ src: '/fallback.webp', label: 'Dal and rice' }) }));
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('replaces a failed remote photo with a clearly labeled illustration', () => {
  render(<MenuImage menu="Dal" imageUrl="/missing.jpg" className="food-cover" />);
  fireEvent.error(screen.getByRole('img', { name: 'Menu photo: Dal' }));
  const fallback = screen.getByRole('img', { name: 'Illustrative photo: Dal and rice' });
  expect(fallback.getAttribute('src')).toBe('/fallback.webp');
  expect(fallback.className).toBe('food-cover');
});
it('shows the existing empty-photo state if the fallback also fails', () => {
  render(<MenuImage menu="Dal" imageUrl="/missing.jpg" className="food-cover" />);
  fireEvent.error(screen.getByRole('img'));
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img', { name: 'No matching menu photo available' }).tagName).toBe('DIV');
  expect(screen.getByText('Menu photo coming soon')).toBeTruthy();
});
it('allows a newly supplied photo URL after an earlier image failed', () => {
  const view = render(<MenuImage menu="Dal" imageUrl="/missing.jpg" />);
  fireEvent.error(screen.getByRole('img'));
  view.rerender(<MenuImage menu="Dal" imageUrl="/replacement.jpg" />);
  expect(screen.getByRole('img').getAttribute('src')).toBe('/api/replacement.jpg');
});
