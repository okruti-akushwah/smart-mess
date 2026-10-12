import test from 'node:test';
import assert from 'node:assert/strict';
import { mealStatistics } from './mealStatistics.js';

const breakfast = { meal_id: 1, cutoff_time: '2026-10-12T04:30:00', meal_type: 'breakfast' };
const lunch = { meal_id: 2, cutoff_time: '2026-10-12T08:30:00Z', meal_type: 'lunch' };
const at = time => Date.parse(`2026-10-12T${time}Z`);

test('shows upcoming preview before cutoff and starts window exactly at cutoff', () => {
  assert.equal(mealStatistics([lunch, breakfast], at('04:29:59')).phase, 'upcoming');
  const result = mealStatistics([lunch, breakfast], at('04:30:00'));
  assert.equal(result.meal.meal_id, 1);
  assert.equal(result.phase, 'closed');
  assert.equal(result.switchAt, at('06:30:00'));
});
test('switches to next preview exactly two hours later', () => {
  assert.equal(mealStatistics([breakfast, lunch], at('06:29:59')).meal.meal_id, 1);
  const result = mealStatistics([breakfast, lunch], at('06:30:00'));
  assert.equal(result.meal.meal_id, 2);
  assert.equal(result.phase, 'upcoming');
  assert.equal(mealStatistics([breakfast, lunch], at('08:30:00')).phase, 'closed');
});
test('handles overlapping windows, missing cutoffs and expired meals', () => {
  const closeLunch = { ...lunch, cutoff_time: '2026-10-12T05:30:00+00:00' };
  assert.equal(mealStatistics([closeLunch, breakfast], at('06:00:00')).meal.meal_id, 1);
  assert.equal(mealStatistics([closeLunch, breakfast], at('06:30:00')).meal.meal_id, 2);
  assert.equal(mealStatistics([breakfast, { meal_id: 3 }], at('10:30:00')).phase, 'empty');
  assert.equal(mealStatistics([], at('04:30:00')).meal, null);
});
