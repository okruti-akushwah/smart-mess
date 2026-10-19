// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillNotification from './BillNotification';
import LanguageProvider from '../i18n/LanguageProvider';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/api', () => ({ default: apiMock }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function mount() {
  return render(<MemoryRouter><LanguageProvider><BillNotification /></LanguageProvider></MemoryRouter>);
}

it('shows an accessible bell badge only for unread bills', async () => {
  apiMock.get.mockResolvedValue({ data: [{ id: 1, seen: false, status: 'issued' }, { id: 2, seen: true, status: 'issued' }] });
  mount();
  const notification = await screen.findByRole('link');
  expect(notification.getAttribute('href')).toBe('/customer/bills');
  expect(notification.textContent).toBe('1');
});

it('does not render a notification when all bills are seen', async () => {
  apiMock.get.mockResolvedValue({ data: [{ id: 1, seen: true, status: 'issued' }] });
  mount();
  await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/bills/issued'));
  expect(screen.queryByRole('link')).toBeNull();
});
