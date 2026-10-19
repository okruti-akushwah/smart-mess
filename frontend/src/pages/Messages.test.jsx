// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Messages from './Messages';
import api from '../services/api';
vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, errorMessage: () => 'Please retry' }));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('role', 'customer');
  Element.prototype.scrollIntoView = vi.fn();
  api.get.mockImplementation(async path => ({ data: path === '/chat/conversations'
    ? [{ customer_id: 2, name: 'Mess owner', mess_name: 'Sample kitchen', unread: 0 }]
    : { messages: [], has_more: false } }));
  api.patch.mockResolvedValue({ data: { read: 0 } });
});
afterEach(cleanup);
it('scrolls new conversation content inside the log without moving ancestor panels', async () => {
  api.get.mockImplementation(async path => ({ data: path === '/chat/conversations'
    ? [{ customer_id: 2, name: 'Mess owner', mess_name: 'Sample kitchen', unread: 0 }]
    : { messages: [{ id: 1, body: 'Dinner is ready', from_owner: true, created_at: '2026-10-15T12:00:00Z' }], has_more: false } }));
  render(<Messages />);
  await screen.findByText('Dinner is ready');
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  expect(screen.getByRole('log', { name: 'Conversation' })).toBeTruthy();
});
it('sends on Enter while Shift Enter and composition do not submit', async () => {
  api.post.mockResolvedValue({ data: { id: 2, body: 'Please confirm my payment', from_owner: false, created_at: '2026-10-15T12:00:00Z' } });
  render(<Messages />);
  const input = await screen.findByRole('textbox', { name: 'Your message' });
  fireEvent.change(input, { target: { value: 'Please confirm my payment' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(input.value).toBe(''));
});
it('keeps failed drafts and retries with the same deduplication key', async () => {
  api.post.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ data: {
    id: 1, body: 'Is dinner available?', from_owner: false, created_at: '2026-10-15T12:00:00Z',
  } });
  render(<Messages />);
  const input = await screen.findByRole('textbox', { name: 'Your message' });
  fireEvent.change(input, { target: { value: 'Is dinner available?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');
  expect(input.value).toBe('Is dinner available?');
  const originalKey = api.post.mock.calls[0][1].client_key;
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(input.value).toBe(''));
  expect(api.post.mock.calls[1][1].client_key).toBe(originalKey);
  expect(screen.getAllByText('Is dinner available?')).toHaveLength(1);
});
