// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CustomerMesses from './CustomerMesses';
vi.mock('../components/Navbar', () => ({default: () => null}));
vi.mock('../services/api', () => ({default: {get: vi.fn(async () => ({data: [
  {owner_id: 1, mess_name: 'Kitchen A', status: 'approved', join_token: 'kitchen-a'},
  {owner_id: 2, mess_name: 'Kitchen B', status: 'approved', join_token: 'kitchen-b'},
]}))}, errorMessage: () => 'Unable to load'}));
function Destination() {const location = useLocation(); return <p>{location.pathname}</p>;}
beforeEach(() => {localStorage.clear();localStorage.setItem('token', 'sample-token');localStorage.setItem('role', 'customer');});
afterEach(cleanup);
it.each([['/', '/customer'], ['/customer/checkout?purchase=42', '/customer/checkout']])(
  'opens the selected mess from %s', async (from, expected) => {
    render(<MemoryRouter initialEntries={[{pathname:'/customer/messes',state:{from}}]}>
      <Routes><Route path="/customer/messes" element={<CustomerMesses/>}/><Route path="*" element={<Destination/>}/></Routes>
    </MemoryRouter>);
    const buttons=await screen.findAllByRole('button', {name:'Open mess'});
    fireEvent.click(buttons[1]);
    await screen.findByText(expected);
    expect(localStorage.getItem('activeMessToken')).toBe('kitchen-b');
  }
);
