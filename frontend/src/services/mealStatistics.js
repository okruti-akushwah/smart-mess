const WINDOW_MS = 2 * 60 * 60 * 1000;

export function mealStatistics(meals, now = Date.now()) {
  const scheduled = meals.map(meal => {
    const raw = meal.cutoff_time;
    const cutoff = raw ? Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}Z`) : NaN;
    return { meal, cutoff };
  }).filter(item => Number.isFinite(item.cutoff)).sort((a, b) => a.cutoff - b.cutoff || a.meal.meal_id - b.meal.meal_id);
  // Keep an earlier meal visible for its full window if cutoffs overlap.
  const active = scheduled.find(item => item.cutoff <= now && now < item.cutoff + WINDOW_MS);
  const upcoming = scheduled.find(item => item.cutoff > now);
  if (active) return { meal: active.meal, phase: 'closed', switchAt: active.cutoff + WINDOW_MS, next: scheduled.find(item => item.cutoff > active.cutoff)?.meal || null };
  if (upcoming) return { meal: upcoming.meal, phase: 'upcoming', switchAt: upcoming.cutoff, next: null };
  return { meal: null, phase: 'empty', switchAt: null, next: null };
}
