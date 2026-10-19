const paths = {
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  close: 'M6 6l12 12 M18 6L6 18',
  eye: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'M3 3l18 18 M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17.7 17.7 0 0 1-3.3 3.8 M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.5-.8 M14.1 14.1a3 3 0 0 1-4.2-4.2',
  inbox: 'M4 4h16l2 10v6H2v-6L4 4Z M2 14h6l2 3h4l2-3h6',
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 9 0 0 1 18 0 M8 10h8 M8 14h5',
  home: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  people: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-3a4 4 0 0 0-3-3.87 M16 2.13a4 4 0 0 1 0 7.75',
  meal: 'M4 3v6a3 3 0 0 0 6 0V3 M7 3v18 M20 3c-4 3-5 8 0 9v9 M20 3v9',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M8 15h2 M14 15h2',
  bill: 'M5 3h14v18l-3-2-4 2-4-2-3 2z M9 8h6 M9 12h6 M9 16h3',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  wand: 'M4 20l-1-1a1 1 0 0 1 0-1L15 6l3 3L6 21a1 1 0 0 1-1 0z M12 9l3 3 M6 2v4 M4 4h4 M20 13v4 M18 15h4 M18 1v3 M16.5 2.5h3',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  refresh: 'M20 7a8 8 0 1 0 1 8 M20 3v5h-5',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  pause: 'M8 4v16 M16 4v16',
};
export default function Icon({ name = 'meal', size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.meal} /></svg>;
}

