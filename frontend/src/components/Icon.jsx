const paths = {
  home: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  people: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-3a4 4 0 0 0-3-3.87 M16 2.13a4 4 0 0 1 0 7.75',
  meal: 'M4 3v6a3 3 0 0 0 6 0V3 M7 3v18 M20 3c-4 3-5 8 0 9v9 M20 3v9',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M8 15h2 M14 15h2',
  bill: 'M5 3h14v18l-3-2-4 2-4-2-3 2z M9 8h6 M9 12h6 M9 16h3',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  refresh: 'M20 7a8 8 0 1 0 1 8 M20 3v5h-5',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  pause: 'M8 4v16 M16 4v16',
};
export default function Icon({ name = 'meal', size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.meal} /></svg>;
}

