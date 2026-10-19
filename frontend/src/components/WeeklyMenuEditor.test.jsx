// @vitest-environment jsdom
import {it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, waitFor, cleanup} from '@testing-library/react';
import {useState} from 'react';
import WeeklyMenuEditor from './WeeklyMenuEditor';
import api from '../services/api';
vi.mock('../services/api', () => ({default: {get: vi.fn(), put: vi.fn()}, errorMessage: () => 'Please retry'}));
vi.mock('./MenuPhotoEditor', () => ({default: () => <div>Photo controls</div>}));
vi.mock('./MenuItemPicker', () => ({default: ({value, onChange}) => <input aria-label="Dishes" value={value} onChange={e => onChange(e.target.value)} />}));
afterEach(() => {cleanup();vi.clearAllMocks();});
it('preserves other weekly slots and their photos when saving a changed meal', async () => {
  api.get.mockResolvedValue({data: [
    {weekday: 0, meal_type: 'breakfast', menu_description: 'Poha', cutoff_time: '02:00', image_url: '/photo1.jpg'},
    {weekday: 1, meal_type: 'dinner', menu_description: 'Dal', cutoff_time: '12:00', image_url: '/photo2.jpg'}
  ]});
  api.put.mockResolvedValue({data: {message: 'Saved'}});
  render(<WeeklyMenuEditor />);
  const input = await screen.findByRole('textbox', {name: 'Dishes'});
  fireEvent.change(input, {target: {value: 'Idli'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save weekly menu'}));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  const items = api.put.mock.calls[0][1].items;
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({menu_description: 'Idli', image_url: null});
  expect(items[1]).toMatchObject({menu_description: 'Dal', image_url: '/photo2.jpg'});
});
it('uses the date submit handler and retains the weekly draft when switching modes', async () => {
  api.get.mockResolvedValue({data: []});
  const onSubmit = vi.fn(e => e.preventDefault());
  function Editor() {
    const [mode, setMode] = useState('weekly');
    return <WeeklyMenuEditor mode={mode} onModeChange={setMode} oneTime={{form: {date: '2026-10-20', meal_type: 'lunch', menu_description: 'Rice', cutoff_time: '10:00', single_price: ''}, onSubmit, onChange: vi.fn(), editingId: null}} />;
  }
  render(<Editor />);
  await screen.findByRole('button', {name: 'Edit Monday breakfast'});
  expect(screen.queryByRole('textbox', {name: 'Dishes'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Edit Monday breakfast'}));
  const input = screen.getByRole('textbox', {name: 'Dishes'});
  fireEvent.change(input, {target: {value: 'Poha'}});
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  fireEvent.click(screen.getByRole('button', {name: 'Add a one-time meal'}));
  expect(screen.getByRole('textbox', {name: 'Dishes'}).value).toBe('Rice');
  fireEvent.click(screen.getByRole('button', {name: 'Create Meal'}));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Weekly repeat'}));
  expect(screen.queryByRole('textbox', {name: 'Dishes'})).toBeNull();
});

it('shows the week first and cancel discards an unsaved meal edit', async () => {
  api.get.mockResolvedValue({data: [{weekday: 0, meal_type: 'breakfast', menu_description: 'Idli', cutoff_time: '02:00'}]});
  render(<WeeklyMenuEditor oneTime={{saving: false}} />);
  await screen.findByText('Idli');
  expect(screen.queryByRole('textbox', {name: 'Dishes'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Edit Monday breakfast'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Dishes'}), {target: {value: 'Poha'}});
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  expect(screen.queryByRole('textbox', {name: 'Dishes'})).toBeNull();
  expect(screen.getByText('Idli')).toBeTruthy();
  expect(api.put).not.toHaveBeenCalled();
});
