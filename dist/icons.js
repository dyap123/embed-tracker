function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* EmbedYap — icon set (simple stroke SVGs, currentColor) */
function Icon({
  name,
  size = 18,
  stroke = 2,
  style,
  ...rest
}) {
  const p = ICONS[name] || ICONS.dot;
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: '0 0 auto',
      display: 'block',
      ...style
    }
  }, rest), p);
}
const ICONS = {
  dot: /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }),
  map: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s6.5-6 6.5-11.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "9.5",
    r: "2.4"
  })),
  dash: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 21h18"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "10",
    width: "3.6",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.2",
    y: "4.5",
    width: "3.6",
    height: "14.5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "15.4",
    y: "13",
    width: "3.6",
    height: "6",
    rx: "1"
  })),
  inventory: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "4.5",
    width: "16",
    height: "6.6",
    rx: "1.3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "12.9",
    width: "16",
    height: "6.6",
    rx: "1.3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.5 7.8h5M9.5 16.2h5"
  })),
  crew: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "8",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 5.5a3 3 0 0 1 0 5M17 14c2.5.6 4 2.8 4 6"
  })),
  game: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "2.5",
    y: "7.5",
    width: "19",
    height: "10",
    rx: "4.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 10.6v3.8M5.1 12.5h3.8"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "11.3",
    r: "1.15"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18.4",
    cy: "13.8",
    r: "1.15"
  })),
  gear: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"
  })),
  close: /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6 6 18"
  }),
  plus: /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }),
  minus: /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }),
  link: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5"
  })),
  trash: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
  })),
  check: /*#__PURE__*/React.createElement("path", {
    d: "M5 12.5 10 17 19 7"
  }),
  target: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v3M12 19v3M2 12h3M19 12h3"
  })),
  zone: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "1",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "1.4",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "21",
    cy: "3",
    r: "1.4",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "21",
    r: "1.4",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "21",
    cy: "21",
    r: "1.4",
    fill: "currentColor"
  })),
  export: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 15V3M8 7l4-4 4 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
  })),
  hardhat: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 18a9 9 0 0 1 18 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 9.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 18h20"
  })),
  search: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  })),
  chevron: /*#__PURE__*/React.createElement("path", {
    d: "m9 6 6 6-6 6"
  }),
  chevronDown: /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }),
  arrowRight: /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 6l6 6-6 6"
  }),
  lock: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "11",
    width: "14",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V8a4 4 0 0 1 8 0v3"
  })),
  rfi: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 4V5a1 1 0 0 1 1-1Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8.5a1.5 1.5 0 1 1 1.5 1.5v1M12.5 13.5h.01"
  })),
  bolt: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v7M12 14v7"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "9",
    width: "6",
    height: "6",
    rx: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 11H7m10 0h-2M9 13H7m10 0h-2"
  })),
  layers: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "m12 3 9 5-9 5-9-5 9-5Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m3 13 9 5 9-5"
  })),
  filter: /*#__PURE__*/React.createElement("path", {
    d: "M3 5h18l-7 8v6l-4 2v-8L3 5Z"
  }),
  pin: /*#__PURE__*/React.createElement("path", {
    d: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"
  }),
  flame: /*#__PURE__*/React.createElement("path", {
    d: "M12 3c1 3-2 4-2 7a2 2 0 1 0 4 0c0-.7-.2-1.3-.4-1.8C15 10 17 12 17 15a5 5 0 0 1-10 0c0-4 3-5 5-12Z"
  }),
  trophy: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M7 4h10v4a5 5 0 0 1-10 0V4Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 16h6M8 20h8M12 13v3"
  })),
  clock: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8v4l2.5 2"
  })),
  calendar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 3v4M16 3v4"
  })),
  drag: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "7",
    r: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "12",
    r: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "12",
    r: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "17",
    r: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "17",
    r: "1",
    fill: "currentColor"
  })),
  power: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 7a8 8 0 1 0 11 0"
  })),
  maximize: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
  })),
  minimize: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
  })),
  grid: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 3v18M15 3v18M3 9h18M3 15h18"
  })),
  polygon: /*#__PURE__*/React.createElement("path", {
    d: "M12 3 21 9.5 17.5 20h-11L3 9.5 12 3Z"
  }),
  pinAdd: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s6-5.4 6-10a6 6 0 0 0-9.9-4.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 9.5a6 6 0 0 0 .2 1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 4.5v5M2.5 7h5"
  })),
  panelLeft: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 4v16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14.5 9.5 12 12l2.5 2.5"
  })),
  panelRight: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 4v16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11.5 9.5 14 12l-2.5 2.5"
  })),
  menu: /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M3 12h18M3 18h18"
  }),
  clipboard: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "4",
    width: "12",
    height: "17",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V4Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 11l2 2 4-4"
  })),
  eye: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  })),
  eyeOff: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M2 12s3.6-7 10-7c2.1 0 3.9.6 5.4 1.5M22 12s-3.6 7-10 7c-2.1 0-3.9-.6-5.4-1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.6 9.6a3 3 0 0 0 4.2 4.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 3l18 18"
  }))
};
window.Icon = Icon;