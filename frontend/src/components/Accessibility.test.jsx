// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useState } from 'react';
import PublicSkipLink from './PublicSkipLink';
import StarRating from './StarRating';
import i18n from '../i18n/i18n';

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
it('skips public navigation without changing a return query or meal anchor', () => {
  render(<MemoryRouter initialEntries={['/mess/demo?next=meal#menu']}><PublicSkipLink /><main>Menu</main><Location /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }));
  expect(document.activeElement).toBe(screen.getByRole('main'));
  expect(screen.getByText('/mess/demo?next=meal#menu')).toBeTruthy();
});
it('leaves workspace skip-link ownership to Navbar', () => {
  render(<MemoryRouter initialEntries={['/owner']}><PublicSkipLink /><main>Workspace</main></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Skip to content' })).toBeNull();
});
it('localizes public skip access in Hindi', async () => {
  await i18n.changeLanguage('hi');
  render(<MemoryRouter><PublicSkipLink /><main>भोजन</main></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'मुख्य सामग्री पर जाएँ' })).toBeTruthy();
});
it('keeps multiple rating groups independent and retains the selected rating', () => {
  function Ratings() {
    const [one, setOne] = useState('2'), [two, setTwo] = useState('4');
    return <><StarRating value={one} onChange={setOne} /><StarRating value={two} onChange={setTwo} /></>;
  }
  render(<Ratings />);
  const groups = screen.getAllByRole('group', { name: 'Rating' });
  const first = within(groups[0]).getByRole('radio', { name: '5 out of 5 stars — Excellent' });
  fireEvent.click(first);
  expect(first.checked).toBe(true);
  expect(within(groups[1]).getByRole('radio', { name: '4 out of 5 stars — Very good' }).checked).toBe(true);
  expect(first.name).not.toBe(within(groups[1]).getAllByRole('radio')[0].name);
});
it('exposes read-only ratings as disabled native radios', () => {
  render(<StarRating value={4} disabled />);
  expect(screen.getByRole('group').disabled).toBe(true);
  expect(screen.getAllByRole('radio').every(radio => radio.matches(':disabled'))).toBe(true);
});
it('names rating choices and the selected result in Hindi', async () => {
  await i18n.changeLanguage('hi'); render(<StarRating value={4} disabled />);
  expect(screen.getByRole('radio', { name: '5 में से 4 तारे — बहुत अच्छा' }).checked).toBe(true);
  expect(screen.getByText('5 में से 4 · बहुत अच्छा')).toBeTruthy();
});
