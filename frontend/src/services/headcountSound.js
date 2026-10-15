export function headcountSnapshot(meals = []) {
  return new Map(meals.map(meal => [String(meal.meal_id), Number(meal.expected_headcount)]));
}

export function headcountIncreased(previous, current) {
  if (!previous) return false;
  return [...current].some(([id, count]) => previous.has(id) && count > previous.get(id));
}
