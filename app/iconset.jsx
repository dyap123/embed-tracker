/* EmbedYap — icon set (simple stroke SVGs, currentColor) */
function Icon({ name, size = 18, stroke = 2, style, ...rest }) {
  const p = ICONS[name] || ICONS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" style={{ flex: '0 0 auto', display: 'block', ...style }} {...rest}>
      {p}
    </svg>
  );
}
const ICONS = {
  dot: <circle cx="12" cy="12" r="3" />,
  map: <><path d="M12 21s6.5-6 6.5-11.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></>,
  dash: <><path d="M3 21h18" /><rect x="5" y="10" width="3.6" height="9" rx="1" /><rect x="10.2" y="4.5" width="3.6" height="14.5" rx="1" /><rect x="15.4" y="13" width="3.6" height="6" rx="1" /></>,
  inventory: <><rect x="4" y="4.5" width="16" height="6.6" rx="1.3" /><rect x="4" y="12.9" width="16" height="6.6" rx="1.3" /><path d="M9.5 7.8h5M9.5 16.2h5" /></>,
  crew: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.5a3 3 0 0 1 0 5M17 14c2.5.6 4 2.8 4 6" /></>,
  game: <><rect x="2.5" y="7.5" width="19" height="10" rx="4.5" /><path d="M7 10.6v3.8M5.1 12.5h3.8" /><circle cx="16" cy="11.3" r="1.15" /><circle cx="18.4" cy="13.8" r="1.15" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>,
  check: <path d="M5 12.5 10 17 19 7" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  zone: <><rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="3 3" /><circle cx="3" cy="3" r="1.4" fill="currentColor" /><circle cx="21" cy="3" r="1.4" fill="currentColor" /><circle cx="3" cy="21" r="1.4" fill="currentColor" /><circle cx="21" cy="21" r="1.4" fill="currentColor" /></>,
  export: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  hardhat: <><path d="M3 18a9 9 0 0 1 18 0" /><path d="M9 9.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.5" /><path d="M2 18h20" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  rfi: <><path d="M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 4V5a1 1 0 0 1 1-1Z" /><path d="M12 8.5a1.5 1.5 0 1 1 1.5 1.5v1M12.5 13.5h.01" /></>,
  bolt: <><path d="M12 3v7M12 14v7" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 11H7m10 0h-2M9 13H7m10 0h-2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  pin: <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 1 0 4 0c0-.7-.2-1.3-.4-1.8C15 10 17 12 17 15a5 5 0 0 1-10 0c0-4 3-5 5-12Z" />,
  trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 16h6M8 20h8M12 13v3" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  drag: <><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></>,
  power: <><path d="M12 3v9" /><path d="M6.5 7a8 8 0 1 0 11 0" /></>,
  maximize: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  minimize: <><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
  polygon: <path d="M12 3 21 9.5 17.5 20h-11L3 9.5 12 3Z" />,
  pinAdd: <><path d="M12 21s6-5.4 6-10a6 6 0 0 0-9.9-4.5" /><path d="M5 9.5a6 6 0 0 0 .2 1.6" /><path d="M5 4.5v5M2.5 7h5" /></>,
  panelLeft: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M14.5 9.5 12 12l2.5 2.5" /></>,
  panelRight: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M11.5 9.5 14 12l-2.5 2.5" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V4Z" /><path d="M9 11l2 2 4-4" /></>,

  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.6-7 10-7c2.1 0 3.9.6 5.4 1.5M22 12s-3.6 7-10 7c-2.1 0-3.9-.6-5.4-1.5" /><path d="M9.6 9.6a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></>,

};
window.Icon = Icon;
