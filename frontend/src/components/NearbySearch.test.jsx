// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import NearbySearch from './NearbySearch';
vi.mock('../i18n/useTranslation', () => ({useTranslation: () => Object.assign(v => v, {locale:'en-IN'})}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('locates only after a click and clears the selected radius', async () => {
  vi.stubGlobal('navigator', {geolocation:{getCurrentPosition: resolve => resolve({coords:{latitude:0, longitude:0, accuracy:15}})}});
  render(<NearbySearch onChange={() => {}} />);
  expect(screen.queryByText('Location ready')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Within 4 km'}));
  await waitFor(() => expect(screen.getByRole('button', {name:'Within 4 km'}).getAttribute('aria-pressed')).toBe('true'));
  expect(screen.getByText('Location ready')).toBeTruthy();
  expect(screen.queryByText(/accuracy|approximate/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Clear location'}));
  expect(screen.getByRole('button', {name:'All distances'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('button', {name:'Clear location'})).toBeNull();
});

test('denied permission leaves the all-distance selection usable', async () => {
  vi.stubGlobal('navigator', {geolocation:{getCurrentPosition: (_, reject) => reject({code:1})}});
  render(<NearbySearch onChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', {name:'Within 10 km'}));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', {name:'All distances'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', {name:'Use my location'}).disabled).toBe(false);
});

test('clearing a pending location ignores its late result',async()=>{
  let resolveLocation;
  vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:resolve=>{resolveLocation=resolve;}}});
  render(<NearbySearch onChange={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Within 4 km'}));
  fireEvent.click(screen.getByRole('button',{name:'Clear location'}));
  resolveLocation({coords:{latitude:0,longitude:0,accuracy:10}});
  await waitFor(()=>expect(screen.queryByText('Location ready')).toBeNull());
  expect(screen.getByRole('button',{name:'All distances'}).getAttribute('aria-pressed')).toBe('true');
});
