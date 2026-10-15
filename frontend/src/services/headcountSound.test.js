import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headcountSnapshot, headcountIncreased } from './headcountSound.js';

const snapshot = counts => headcountSnapshot(counts.map(([meal_id, expected_headcount]) => ({ meal_id, expected_headcount })));

test('initial load, unchanged counts, decreases and new meals stay silent', () => {
  const current = snapshot([[1, 5]]);
  assert.equal(headcountIncreased(null, current), false);
  assert.equal(headcountIncreased(current, snapshot([[1, 5]])), false);
  assert.equal(headcountIncreased(current, snapshot([[1, 4]])), false);
  assert.equal(headcountIncreased(current, snapshot([[1, 5], [2, 20]])), false);
});

test('an increase sounds even when another meal decreases by more', () => {
  assert.equal(headcountIncreased(snapshot([[1, 5], [2, 10]]), snapshot([[2, 3], [1, 6]])), true);
});

test('meal identifiers compare consistently and repeat snapshots stay silent', () => {
  const before = snapshot([[1, 5]]);
  const after = snapshot([['1', 6]]);
  assert.equal(headcountIncreased(before, after), true);
  assert.equal(headcountIncreased(after, after), false);
});
