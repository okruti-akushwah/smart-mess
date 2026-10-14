import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedGet } from './sharedGet.js';

test('deduplicates concurrent reads but refreshes after resolution', async () => {
  let calls = 0;
  const get = sharedGet(async () => {calls++; return {data: ['live']};}, () => ['user-a','mess-a']);
  const first = get('/bills/issued');
  assert.equal(first, get('/bills/issued'));
  await first;
  await get('/bills/issued');
  assert.equal(calls, 2);
});
test('never shares across users, messes or request parameters', async () => {
  let identity = 'a', calls = 0;
  const get = sharedGet(async () => {calls++; return {};}, () => identity);
  const first = get('/customer/activity');
  identity = 'b';
  const second = get('/customer/activity');
  const third = get('/customer/activity', {params: {day: 'tomorrow'}});
  await Promise.all([first,second,third]);
  assert.equal(calls, 3);
});
test('failed reads can be retried and abortable reads stay independent', async () => {
  let calls = 0;
  const get = sharedGet(async () => {calls++; throw new Error('offline');}, () => 'a');
  await assert.rejects(get('/public/messes'));
  await assert.rejects(get('/public/messes'));
  assert.equal(calls, 2);
  const controller = new AbortController();
  await Promise.allSettled([get('/public/messes', {signal: controller.signal}),get('/public/messes', {signal: controller.signal})]);
  assert.equal(calls, 4);
});
