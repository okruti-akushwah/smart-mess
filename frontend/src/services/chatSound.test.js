import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingMessageCursor, hasIncomingMessage } from './chatSound.js';

test('initial history and repeated polls stay silent', () => {
  assert.equal(hasIncomingMessage(undefined, 10), false);
  assert.equal(hasIncomingMessage(10, 10), false);
  assert.equal(hasIncomingMessage(10, 0), false);
});
test('incoming messages sound independently of read status or outgoing replies', () => {
  const cursor = incomingMessageCursor([{ last_incoming_id: 12, unread: 0, last_message: { id: 15, from_owner: true } }]);
  assert.equal(cursor, 12);
  assert.equal(hasIncomingMessage(10, cursor), true);
  assert.equal(hasIncomingMessage(cursor, incomingMessageCursor([{ last_incoming_id: 12, last_message: { id: 20 } }])), false);
});
test('tracks new incoming messages across multiple conversations', () => {
  assert.equal(incomingMessageCursor([]), 0);
  assert.equal(incomingMessageCursor([{ last_incoming_id: 5 }, { last_incoming_id: 18 }]), 18);
});
