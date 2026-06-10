function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* EmbedYap — shared UI primitives */

function Btn({
  children,
  kind = 'ghost',
  size = 'md',
  icon,
  iconRight,
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: T.font.display,
    fontWeight: 600,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    borderRadius: T.radius.md,
    cursor: 'pointer',
    transition: 'transform .12s, background .15s, box-shadow .15s, border-color .15s',
    border: '1px solid transparent',
    userSelect: 'none'
  };
  const sizes = {
    sm: {
      padding: '7px 12px',
      fontSize: 13
    },
    md: {
      padding: '10px 16px',
      fontSize: 14.5
    },
    lg: {
      padding: '14px 22px',
      fontSize: 16
    }
  };
  const kinds = {
    primary: {
      background: accentPlate,
      color: '#fff',
      boxShadow: T.shadow.amber,
      fontWeight: 700,
      border: '1px solid rgba(166,160,255,.5)'
    },
    navy: {
      background: navyPlate,
      color: T.color.white,
      border: '1px solid rgba(146,164,196,.18)',
      boxShadow: T.shadow.raised
    },
    solid: {
      background: T.color.steel700,
      color: T.color.offwhite,
      border: '1px solid ' + T.color.line
    },
    ghost: {
      background: 'rgba(146,164,196,.06)',
      color: T.color.steel200,
      border: '1px solid ' + T.color.line
    },
    danger: {
      background: 'rgba(229,72,77,.12)',
      color: '#ff9a9d',
      border: '1px solid rgba(229,72,77,.3)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    onMouseDown: e => e.currentTarget.style.transform = 'translateY(1px)',
    onMouseUp: e => e.currentTarget.style.transform = '',
    onMouseLeave: e => e.currentTarget.style.transform = '',
    style: {
      ...base,
      ...sizes[size],
      ...kinds[kind],
      ...style
    }
  }), icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 15 : 17
  }), children, iconRight && /*#__PURE__*/React.createElement(Icon, {
    name: iconRight,
    size: size === 'sm' ? 15 : 17
  }));
}
function Card({
  children,
  style,
  pad = 20,
  glow = false,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      background: steelPlate('#161D29', '#0F141C'),
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      boxShadow: T.shadow.card,
      padding: pad,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: TEX.grain,
      opacity: .05,
      pointerEvents: 'none',
      mixBlendMode: 'overlay'
    }
  }), glow && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -1,
      left: 18,
      right: 18,
      height: 1,
      background: 'linear-gradient(90deg,transparent,rgba(146,164,196,.4),transparent)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, children));
}
function Dot({
  color,
  size = 10,
  pulse = false,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 0 2px rgba(0,0,0,.35), 0 0 7px ${color}88`,
      display: 'inline-block',
      animation: pulse ? 'pinPulse 1.8s infinite' : 'none',
      ...style
    }
  });
}
function Badge({
  children,
  color = T.color.steel300,
  fill = false,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: T.font.mono,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      padding: '3px 8px',
      borderRadius: T.radius.sm,
      color: fill ? '#11151C' : color,
      background: fill ? color : `${color}1a`,
      border: `1px solid ${color}${fill ? '' : '44'}`,
      ...style
    }
  }, children);
}
function Segmented({
  options,
  value,
  onChange,
  size = 'md',
  style
}) {
  const pad = size === 'sm' ? '6px 10px' : '9px 14px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(0,0,0,.28)',
      borderRadius: T.radius.md,
      padding: 3,
      border: '1px solid ' + T.color.line,
      gap: 2,
      ...style
    }
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const lab = typeof o === 'object' ? o.label : o;
    const on = v === value;
    return /*#__PURE__*/React.createElement("button", {
      key: String(v),
      onClick: () => onChange(v),
      style: {
        padding: pad,
        borderRadius: T.radius.sm - 1,
        fontFamily: T.font.display,
        fontWeight: 600,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        fontSize: size === 'sm' ? 12.5 : 14,
        color: on ? T.color.white : T.color.steel300,
        background: on ? 'linear-gradient(180deg,#243047,#1b2330)' : 'transparent',
        boxShadow: on ? '0 1px 0 rgba(255,255,255,.06) inset, 0 2px 8px -3px rgba(0,0,0,.7)' : 'none',
        border: on ? '1px solid ' + T.color.line : '1px solid transparent',
        transition: 'all .15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap'
      }
    }, lab);
  }));
}
function Toggle({
  on,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!on),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 27,
      borderRadius: 999,
      padding: 3,
      transition: 'background .2s',
      background: on ? T.color.green : 'rgba(0,0,0,.4)',
      border: '1px solid ' + (on ? '#2FD6A677' : T.color.line),
      boxShadow: on ? '0 0 14px -2px #2FD6A699' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: 21,
      height: 21,
      borderRadius: '50%',
      background: on ? '#fff' : T.color.steel300,
      transform: on ? 'translateX(21px)' : 'translateX(0)',
      transition: 'transform .2s',
      boxShadow: '0 2px 5px rgba(0,0,0,.5)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      letterSpacing: '.03em',
      color: on ? T.color.white : T.color.steel300
    }
  }, label));
}
function Field({
  label,
  children,
  hint
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: T.color.steel300,
      marginBottom: 7
    }
  }, label), children, hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: T.color.steel400,
      marginTop: 5
    }
  }, hint));
}
const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,.3)',
  border: '1px solid ' + T.color.line,
  borderRadius: T.radius.md,
  padding: '11px 13px',
  color: T.color.white,
  fontFamily: T.font.body,
  fontSize: 14,
  outline: 'none'
};

// section label (mono kicker)
function Kicker({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      letterSpacing: '.22em',
      textTransform: 'uppercase',
      color: T.color.steel400,
      ...style
    }
  }, children);
}
Object.assign(window, {
  Btn,
  Card,
  Dot,
  Badge,
  Segmented,
  Toggle,
  Field,
  inputStyle,
  Kicker
});