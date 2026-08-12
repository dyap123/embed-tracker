/* EmbedYap — Sign in: full-screen immersive "badge-in" terminal */
const ADD_PIN = '050103'; // gate to add a new crew member from the badge-in screen
function SignIn({
  onSignIn,
  onAddCrew,
  crew,
  embeds = []
}) {
  const ROSTER = crew && crew.length ? crew : window.CREW || CREW;
  const [sel, setSel] = React.useState(null);
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(false);
  const user = ROSTER.find(c => c.id === sel);
  const needPin = user && user.manager;

  // add-crew flow
  const [adding, setAdding] = React.useState(false);
  const [nf, setNf] = React.useState({
    name: '',
    role: '',
    manager: false,
    pin: ''
  });
  const [apin, setApin] = React.useState('');
  const [aerr, setAerr] = React.useState('');
  function badgeIn() {
    if (!user) return;
    if (needPin && pin !== user.pin) {
      setErr(true);
      return;
    }
    onSignIn(user);
  }
  React.useEffect(() => {
    setPin('');
    setErr(false);
  }, [sel]);
  function initialsOf(name) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    const two = ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
    return (two || name.trim().slice(0, 2) || '?').toUpperCase();
  }
  function slugOf(name) {
    const base = (name.trim().toLowerCase().split(/\s+/)[0] || 'crew').replace(/[^a-z0-9]/g, '') || 'crew';
    const ids = new Set(ROSTER.map(c => c.id));
    let id = base,
      n = 2;
    while (ids.has(id)) {
      id = base + n;
      n++;
    }
    return id;
  }
  function createCrew() {
    if (apin !== ADD_PIN) {
      setAerr('Incorrect add PIN');
      return;
    }
    const name = nf.name.trim();
    if (!name) {
      setAerr('Enter a name');
      return;
    }
    if (nf.manager && nf.pin.length < 4) {
      setAerr('Manager needs a 4–6 digit PIN');
      return;
    }
    const c = {
      id: slugOf(name),
      name,
      role: nf.role.trim() || 'PWJV',
      initials: initialsOf(name),
      manager: !!nf.manager,
      pin: nf.manager ? nf.pin : null
    };
    onAddCrew && onAddCrew(c);
    setAdding(false);
    setNf({
      name: '',
      role: '',
      manager: false,
      pin: ''
    });
    setApin('');
    setAerr('');
    setSel(c.id);
  }
  const k = kpis(embeds);
  const nextCount = embeds.filter(e => e.nextPour).length;
  const ticker = [{
    dot: T.color.green,
    label: `${k.pct}% installed`
  }, {
    dot: T.color.blue,
    label: `${k.pinned} pinned`
  }, {
    dot: T.color.pink,
    label: `${nextCount} next pour`
  }, {
    dot: T.color.amberHot,
    label: `${k.noted} notes`
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'auto',
      background: 'radial-gradient(130% 100% at 50% -10%, #1A2740 0%, #0B0F18 55%, #070A11 100%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity: .55,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 45px, rgba(120,150,210,.08) 45px 46px), repeating-linear-gradient(90deg, transparent 0 45px, rgba(120,150,210,.08) 45px 46px)',
      animation: 'eyDrift 26s linear infinite'
    }
  }), [['12%', '22%', T.color.green, 0], ['82%', '18%', T.color.pink, .6], ['68%', '72%', T.color.blue, 1.2], ['22%', '78%', T.color.yellow, 1.8], ['46%', '34%', T.color.red, 2.4], ['90%', '58%', T.color.green, 3]].map(([l, t, c, d], i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: 'absolute',
      left: l,
      top: t,
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: c,
      boxShadow: `0 0 12px 2px ${c}`,
      opacity: .0,
      animation: `eyPulse 4s ${d}s ease-in-out infinite`,
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      boxShadow: 'inset 0 0 220px 40px rgba(0,0,0,.6)'
    }
  }), ['tl', 'tr', 'bl', 'br'].map(p => {
    const b = '2px solid rgba(166,160,255,.35)';
    const s = {
      position: 'absolute',
      width: 26,
      height: 26,
      pointerEvents: 'none'
    };
    const m = {
      tl: {
        top: 18,
        left: 18,
        borderTop: b,
        borderLeft: b
      },
      tr: {
        top: 18,
        right: 18,
        borderTop: b,
        borderRight: b
      },
      bl: {
        bottom: 18,
        left: 18,
        borderBottom: b,
        borderLeft: b
      },
      br: {
        bottom: 18,
        right: 18,
        borderBottom: b,
        borderRight: b
      }
    }[p];
    return /*#__PURE__*/React.createElement("div", {
      key: p,
      style: {
        ...s,
        ...m
      }
    });
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 40px',
      fontFamily: T.font.mono,
      fontSize: 11,
      letterSpacing: '.14em',
      color: 'rgba(180,200,235,.6)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "LA CONVENTION CENTER \xB7 FOUNDATIONS"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: T.color.green,
      boxShadow: `0 0 8px ${T.color.green}`,
      animation: 'eyPulse 2.4s ease-in-out infinite'
    }
  }), "SYSTEM ONLINE \xB7 EMB-1.0.0")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      padding: '72px 20px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      animation: 'eyRise .5s cubic-bezier(.2,.8,.2,1) both'
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 64
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 42,
      letterSpacing: '.02em',
      textTransform: 'uppercase',
      color: '#fff',
      lineHeight: 1
    }
  }, "Embed", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.amberHot
    }
  }, "Yap")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12,
      letterSpacing: '.22em',
      textTransform: 'uppercase',
      color: 'rgba(180,200,235,.55)'
    }
  }, "Embed install tracker")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      animation: 'eyRise .5s .05s cubic-bezier(.2,.8,.2,1) both'
    }
  }, ticker.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 14px',
      borderRadius: T.radius.pill,
      background: 'rgba(10,16,28,.55)',
      border: '1px solid rgba(146,164,196,.16)',
      fontFamily: T.font.mono,
      fontSize: 12.5,
      color: '#dbe3f2'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: s.dot,
      boxShadow: `0 0 8px ${s.dot}`
    }
  }), s.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(620px,100%)',
      marginTop: 8,
      background: 'linear-gradient(180deg, rgba(22,30,45,.9), rgba(12,17,26,.92))',
      border: '1px solid rgba(146,164,196,.18)',
      borderRadius: T.radius.xl,
      boxShadow: T.shadow.panel,
      overflow: 'hidden',
      backdropFilter: 'blur(8px)',
      animation: 'eyRise .5s .1s cubic-bezier(.2,.8,.2,1) both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 22px',
      borderBottom: '1px solid ' + T.color.line,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: '.05em'
    }
  }, "Badge in"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      letterSpacing: '.12em',
      color: T.color.steel400
    }
  }, "TAP YOUR NAME \xB7 CREW ", ROSTER.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 18,
      padding: '24px 22px'
    }
  }, ROSTER.map(c => {
    const on = c.id === sel;
    return /*#__PURE__*/React.createElement("button", {
      key: c.id,
      onClick: () => setSel(c.id),
      title: c.name,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: 88,
        transition: 'transform .15s',
        transform: on ? 'translateY(-2px)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        width: 60,
        height: 60,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: on ? accentPlate : steelPlate('#26313F', '#1A2230'),
        color: '#fff',
        fontFamily: T.font.display,
        fontWeight: 800,
        fontSize: c.avatarEmoji ? 28 : 22,
        border: '2px solid ' + (on ? '#fff' : 'rgba(146,164,196,.25)'),
        boxShadow: on ? `0 0 0 4px rgba(126,120,240,.35), 0 10px 26px -10px rgba(126,120,240,.8)` : '0 6px 18px -10px rgba(0,0,0,.8)'
      }
    }, c.avatarEmoji || c.initials, c.manager && /*#__PURE__*/React.createElement("span", {
      title: "Manager \xB7 PIN",
      style: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 19,
        height: 19,
        borderRadius: '50%',
        background: T.color.amber,
        border: '2px solid #11161f',
        display: 'grid',
        placeItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 9,
      style: {
        color: '#0A0B16'
      }
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 12.5,
        color: on ? '#fff' : T.color.steel300,
        textAlign: 'center',
        lineHeight: 1.15,
        whiteSpace: 'nowrap'
      }
    }, c.name.split(' ')[0], c.goat ? ' 🐐' : ''));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setAdding(true);
      setSel(null);
    },
    title: "Add crew member",
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      width: 88,
      transition: 'transform .15s',
      transform: adding ? 'translateY(-2px)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 60,
      height: 60,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(146,164,196,.06)',
      color: adding ? '#fff' : T.color.steel300,
      border: '2px dashed ' + (adding ? '#A6A0FF' : 'rgba(146,164,196,.4)')
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 26
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 12.5,
      color: adding ? '#fff' : T.color.steel300
    }
  }, "Add"))), adding ?
  /*#__PURE__*/
  /* add-crew form */
  React.createElement("div", {
    style: {
      borderTop: '1px solid ' + T.color.line,
      background: 'rgba(0,0,0,.22)',
      padding: '16px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, "New crew member"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setAdding(false);
      setAerr('');
    },
    style: {
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 200px'
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Name"
  }, /*#__PURE__*/React.createElement("input", {
    value: nf.name,
    autoFocus: true,
    onChange: e => {
      setAerr('');
      setNf(f => ({
        ...f,
        name: e.target.value
      }));
    },
    placeholder: "e.g. Danzel Yap",
    style: {
      ...inputStyle,
      padding: '9px 11px',
      fontSize: 14
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 200px'
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Role"
  }, /*#__PURE__*/React.createElement("input", {
    value: nf.role,
    onChange: e => setNf(f => ({
      ...f,
      role: e.target.value
    })),
    placeholder: "e.g. PWJV \xB7 PE",
    style: {
      ...inputStyle,
      padding: '9px 11px',
      fontSize: 14
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(0,0,0,.22)',
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 13.5,
      textTransform: 'uppercase',
      color: nf.manager ? T.color.amber : '#fff'
    }
  }, "Manager"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.color.steel300
    }
  }, "Needs a PIN to badge in")), /*#__PURE__*/React.createElement(Toggle, {
    on: nf.manager,
    onChange: () => setNf(f => ({
      ...f,
      manager: !f.manager
    }))
  })), nf.manager && /*#__PURE__*/React.createElement(Field, {
    label: "Manager PIN"
  }, /*#__PURE__*/React.createElement("input", {
    value: nf.pin,
    onChange: e => setNf(f => ({
      ...f,
      pin: e.target.value.replace(/\D/g, '').slice(0, 6)
    })),
    inputMode: "numeric",
    placeholder: "4\u20136 digits",
    style: {
      ...inputStyle,
      width: 140,
      fontFamily: T.font.mono,
      padding: '9px 11px',
      fontSize: 15,
      letterSpacing: '.12em'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Add PIN"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 16,
    style: {
      color: aerr ? T.color.red : T.color.steel300
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: apin,
    onChange: e => {
      setAerr('');
      setApin(e.target.value.replace(/\D/g, '').slice(0, 6));
    },
    inputMode: "numeric",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    maxLength: 6,
    onKeyDown: e => e.key === 'Enter' && createCrew(),
    style: {
      ...inputStyle,
      width: 150,
      fontFamily: T.font.mono,
      fontSize: 20,
      letterSpacing: '.24em',
      textAlign: 'center',
      padding: '9px 12px',
      borderColor: aerr ? T.color.red : T.color.line
    }
  }))), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    size: "lg",
    icon: "check",
    style: {
      marginLeft: 'auto'
    },
    onClick: createCrew
  }, "Create")), aerr ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.color.red,
      fontSize: 13,
      fontFamily: T.font.mono
    }
  }, "\u2715 ", aerr) : /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.color.steel400,
      fontSize: 12,
      fontFamily: T.font.mono
    }
  }, "Enter the add PIN to create this crew member.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid ' + T.color.line,
      background: 'rgba(0,0,0,.22)',
      padding: '16px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 160px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, user ? needPin ? 'Manager PIN required' : 'Ready to badge in' : 'Select a crew member'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 20,
      marginTop: 4,
      color: user ? '#fff' : T.color.steel400,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user ? user.name : '—'), user && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11.5,
      color: T.color.steel400,
      marginTop: 1
    }
  }, user.role)), needPin && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 17,
    style: {
      color: err ? T.color.red : T.color.steel300
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: pin,
    onChange: e => {
      setErr(false);
      setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
    },
    inputMode: "numeric",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    maxLength: 6,
    autoFocus: true,
    onKeyDown: e => e.key === 'Enter' && badgeIn(),
    style: {
      ...inputStyle,
      width: 150,
      fontFamily: T.font.mono,
      fontSize: 22,
      letterSpacing: '.28em',
      textAlign: 'center',
      padding: '9px 12px',
      borderColor: err ? T.color.red : T.color.line
    }
  })), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    size: "lg",
    icon: "power",
    disabled: !user,
    onClick: badgeIn,
    style: {
      opacity: user ? 1 : .5,
      cursor: user ? 'pointer' : 'not-allowed'
    }
  }, "Badge in")), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.color.red,
      fontSize: 13,
      padding: '0 22px 14px',
      fontFamily: T.font.mono
    }
  }, "\u2715 Incorrect PIN \u2014 try again."), needPin && !err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.color.steel400,
      fontSize: 12,
      padding: '0 22px 14px',
      fontFamily: T.font.mono
    }
  }, "Enter your 6-digit manager PIN")))), /*#__PURE__*/React.createElement("style", null, `
        @keyframes eyDrift { to { background-position: 46px 46px, 46px 46px; } }
        @keyframes eyPulse { 0%,100%{ opacity:.15; transform:scale(.8);} 50%{ opacity:.9; transform:scale(1.15);} }
        @keyframes eyRise { from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:translateY(0);} }
      `));
}
function LogoMark({
  size = 42
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: size * 0.26,
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      background: steelPlate('#1B2236', '#0F1320'),
      border: '1px solid rgba(126,120,240,.5)',
      boxShadow: '0 0 0 1px rgba(126,120,240,.12), 0 8px 24px -10px rgba(126,120,240,.7), inset 0 1px 0 rgba(255,255,255,.06)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: size * 0.26,
      background: 'radial-gradient(120% 120% at 30% 20%, rgba(126,120,240,.22), transparent 60%)'
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: size * 0.64,
    height: size * 0.64,
    viewBox: "0 0 24 24",
    fill: "none",
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z",
    stroke: "#A6A0FF",
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3.5",
    stroke: "#7E78F0",
    strokeWidth: "1.7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.05",
    fill: "#A6A0FF"
  })));
}
function Logo({
  size = 1
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 38 * size
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 27 * size,
      letterSpacing: '.02em',
      color: '#fff',
      textTransform: 'uppercase'
    }
  }, "Embed", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.amberHot
    }
  }, "Yap")));
}
Object.assign(window, {
  SignIn,
  Logo,
  LogoMark
});