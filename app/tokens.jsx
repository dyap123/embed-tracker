/* ============================================================
   EmbedYap — DESIGN TOKENS
   Portable token block. A Firebase data layer drops in under
   the same component API; visuals live entirely here.
   ============================================================ */
const T = {
  color: {
    // core neutrals
    white:      '#FFFFFF',
    offwhite:   '#E7ECF6',   // body text on dark
    paper:      '#F3F5FA',   // light surface tint
    // brand deep indigo-navy
    navy:       '#19223D',
    navy2:      '#28355C',
    navyGlow:   '#3A4a86',
    // cool charcoal-slate structure (dark -> light)
    graphite:   '#0A0C12',   // page void
    gunmetal:   '#0E1118',
    steel900:   '#141823',
    steel800:   '#191F2C',
    steel700:   '#212838',
    steel600:   '#2C3445',
    steel500:   '#3B4559',
    steel400:   '#56607A',
    steel300:   '#828FAA',
    steel200:   '#A2AEC6',
    // pin / state colors (cool jewel tones)
    green:      '#2FD6A6',   // installed  (mint)
    red:        '#F0556B',   // to install (coral)
    yellow:     '#F5C24B',   // current sequence (gold-yellow)
    pink:       '#FF6FB5',   // next pour (pink)
    blue:       '#4FA3F2',   // has knife plate (cyan-blue)
    // primary accent — periwinkle/indigo (futuristic). action / brand.
    amber:      '#7E78F0',
    amberHot:   '#A6A0FF',
    magenta:    '#C45CCB',
    cyan:       '#52E6E0',
    onAccent:   '#0A0B16',   // text on accent
    line:       'rgba(150,166,210,0.16)', // hairline divider on dark
    lineSoft:   'rgba(150,166,210,0.10)',
  },
  font: {
    display: "'Rajdhani', 'Saira Condensed', sans-serif",     // futuristic display
    body:    "'Archivo', system-ui, sans-serif",              // clean grotesk
    mono:    "'JetBrains Mono', ui-monospace, monospace",     // data / IDs
  },
  // type scale (px)
  size: { xs:11, sm:12.5, base:14, md:16, lg:19, xl:24, xxl:32, huge:46, mega:68 },
  space: { 1:4, 2:8, 3:12, 4:16, 5:24, 6:32, 7:48, 8:64 },
  radius: { sm:6, md:10, lg:14, xl:20, pill:999 },
  shadow: {
    card:   '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px -12px rgba(0,0,0,0.6)',
    panel:  '0 24px 70px -24px rgba(0,0,0,0.7), 0 0 0 1px rgba(146,164,196,0.10)',
    raised: '0 2px 0 rgba(0,0,0,0.4), 0 10px 30px -12px rgba(0,0,0,0.7)',
    amber:  '0 8px 26px -10px rgba(126,120,240,0.6)',
  },
};
// surface texture: faint brushed-steel grain (data-uri noise) + metallic sheen helpers
const TEX = {
  grain:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>\")",
  // vertical brushed sheen for plates / headers
  brushed: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 3px)',
};

// metallic panel background (steel plate look)
const steelPlate = (a='#1A2230', b='#11151C') =>
  `linear-gradient(155deg, ${a} 0%, ${b} 70%)`;

// navy brand gradient (cool indigo)
const navyPlate = 'linear-gradient(150deg, #2A3A6B 0%, #1A2547 55%, #11182F 100%)';
// accent gradient for futuristic glows / buttons
const accentPlate = 'linear-gradient(135deg, #8E88FF 0%, #6E68E6 60%, #5A54D6 100%)';

const STATE = {
  installed: { key:'installed', label:'Installed',        color:T.color.green,  dot:T.color.green },
  todo:      { key:'todo',      label:'To install',       color:T.color.red,    dot:T.color.red },
  current:   { key:'current',   label:'Current sequence', color:T.color.yellow, dot:T.color.yellow },
  next:      { key:'next',      label:'Next pour',        color:T.color.pink,   dot:T.color.pink },
  knife:     { key:'knife',     label:'Knife plate',      color:T.color.blue,   dot:T.color.blue },
};

Object.assign(window, { T, TEX, steelPlate, navyPlate, accentPlate, STATE });
