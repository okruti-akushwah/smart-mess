export function incomingMessageCursor(conversations) {
  return Math.max(0, ...conversations.map(row => Number(row.last_incoming_id) || 0));
}

export function hasIncomingMessage(previous, current) {
  return previous !== undefined && current > previous;
}
