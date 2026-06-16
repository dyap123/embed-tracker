/* EmbedYap — app shell: nav, routing, responsive, Firebase-backed embed state */
function useIsPhone() {
  const [p, setP] = React.useState(typeof window !== 'undefined' && window.innerWidth <= 760);
  React.useEffect(() => {
    const h = () => setP(window.innerWidth <= 760);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return p;
}
const NAV = [{
  id: 'map',
  label: 'Plan',
  icon: 'map'
}, {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'dash'
}, {
  id: 'inventory',
  label: 'Inventory',
  icon: 'inventory'
}, {
  id: 'crew',
  label: 'Crew',
  icon: 'crew'
}, {
  id: 'arcade',
  label: 'Arcade',
  icon: 'game'
}];
const today = () => new Date().toISOString().slice(0, 10);
function App() {
  const isPhone = useIsPhone();
  const [user, setUser] = React.useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('embedyap_user')) || null;
    } catch (e) {
      return null;
    }
  });
  const [screen, setScreen] = React.useState('map');
  const [pins, setPins] = React.useState({}); // raw Firebase pins
  const [master, setMaster] = React.useState({}); // Firebase embeds master (per-mark types)
  const [crew, setCrew] = React.useState([]); // Firebase users
  const [zones, setZones] = React.useState([]); // Firebase zones
  const [grid, setGrid] = React.useState(null); // Firebase editable grid config
  const [toast, setToast] = React.useState(null);
  const [railOpen, setRailOpen] = React.useState(true);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const userRef = React.useRef(user);
  userRef.current = user;

  // ---- live Firebase subscriptions + one-time crew seed ----
  React.useEffect(() => {
    window.fb.listen('pins', v => setPins(v || {}));
    window.fb.listen('embeds', v => setMaster(v || {}));
    window.fb.listen('zones', v => setZones(Object.entries(v || {}).map(([k, z]) => ({
      ...z,
      id: k
    }))));
    window.fb.listen('grid', v => {
      setGridCfg(v);
      setGrid(v || null);
    });
    window.fb.listen('users', v => {
      const arr = Object.values(v || {}).filter(Boolean);
      setCrew(arr.length ? arr : CREW);
      window.CREW = arr.length ? arr : CREW; // SignIn/Crew read window.CREW
      // keep the signed-in user synced with Firebase (profile edits, points…)
      setUser(u => {
        if (!u) return u;
        const live = arr.find(c => c.id === u.id);
        return live ? {
          ...u,
          ...live
        } : u;
      });
    });
    window.fb.get('users').then(v => {
      if (!v || !Object.keys(v).length) {
        CREW.forEach(c => window.fb.set('users/' + c.id, {
          ...c,
          updates: 0
        }));
      }
    });
  }, []);

  // live grid-edit draft — while editing, the blueprint + embed snapping preview it
  const [gridDraft, setGridDraft] = React.useState(null);
  const effGrid = gridDraft || grid;
  setGridCfg(effGrid); // keep the global grid math (colX/rowY/gridIdx) in sync with the draft

  const embeds = React.useMemo(() => {
    const base = Object.entries(pins).map(([k, p]) => pinToEmbed(k, p)).filter(e => e.mark);
    // "next pour" highlight is derived live from any zone tagged nextPour (no stale pin flags)
    const npPolys = typeof zonePts === 'function' ? (zones || []).filter(z => z.nextPour).map(z => zonePts(z)) : [];
    base.forEach(e => {
      e.nextPour = npPolys.length > 0 && npPolys.some(pts => pointInPoly(e.nx, e.ny, pts));
    });
    return base;
  }, [pins, zones, gridDraft, grid]);
  function saveGrid(cfg) {
    setGridDraft(null);
    setGridCfg(cfg || null);
    setGrid(cfg || null);
    window.fb.set('grid', cfg || null);
  }
  function flash(msg) {
    setToast(msg);
    clearTimeout(flash._t);
    flash._t = setTimeout(() => setToast(null), 2600);
  }
  function track(kind) {
    const u = userRef.current;
    if (u && u.id) window.fb.inc('users/' + u.id + '/updates', 1);
    flash(remarkFor(kind));
  }
  function updateEmbed(id, patch) {
    const p = {
      ...patch
    };
    let kind = 'edit';
    if ('installed' in p) {
      kind = p.installed ? 'install' : 'uninstall';
      const u = userRef.current;
      if (p.installed) {
        if (!p.installedAt) p.installedAt = today();
        p.installedBy = u ? u.name : null;
      } else {
        p.installedAt = null;
        p.installedBy = null;
      }
      if (u && u.id) {
        window.fb.inc('users/' + u.id + '/points', p.installed ? 10 : -10);
        window.fb.inc('users/' + u.id + '/installs', p.installed ? 1 : -1);
      }
    } else if ('rfi' in p) {
      kind = 'rfi';
    } else if ('delivery' in p) {
      kind = 'delivery';
    }
    window.fb.update('pins/' + id, p);
    track(kind);
  }
  function bulkUpdate(ids, patch) {
    ids.forEach(id => window.fb.update('pins/' + id, patch));
    track('zone');
  }
  // set delivery-to-site status on a group of pins (no points — logistics, not install credit)
  function bulkSetDelivery(ids, status) {
    ids.forEach(id => window.fb.update('pins/' + id, {
      delivery: status
    }));
    track('delivery');
  }
  // mark a group installed / to-install (credits points for the net change, one toast)
  function bulkInstall(ids, val) {
    const u = userRef.current;
    let d = 0;
    ids.forEach(id => {
      const e = embeds.find(x => x.id === id);
      if (!e || !!e.installed === !!val) return;
      window.fb.update('pins/' + id, {
        installed: !!val,
        installedAt: val ? today() : null,
        installedBy: val ? u ? u.name : null : null
      });
      d += val ? 1 : -1;
    });
    if (u && u.id && d) {
      window.fb.inc('users/' + u.id + '/points', d * 10);
      window.fb.inc('users/' + u.id + '/installs', d);
      window.fb.inc('users/' + u.id + '/updates', Math.abs(d));
    }
    flash(remarkFor(val ? 'install' : 'uninstall'));
  }

  // ---- embed pin CRUD (manager, via plan editing) ----
  function addPin(p) {
    const key = 'P' + Math.random().toString(36).slice(2, 9);
    window.fb.set('pins/' + key, {
      embedId: p.embedId || 'NEW',
      x: +(p.x || 0).toFixed(4),
      y: +(p.y || 0).toFixed(4),
      exact: true,
      sequence: p.sequence || '1',
      phase: p.phase || '1',
      area: p.area || 'A',
      knifePlate: !!p.knifePlate,
      stubColumn: !!p.stubColumn,
      installed: false,
      createdAt: Date.now()
    });
    track('edit');
    return key;
  }
  function removePin(id) {
    const e = embeds.find(x => x.id === id);
    if (e && e.installed) {
      const u = userRef.current;
      if (u && u.id) {
        window.fb.inc('users/' + u.id + '/points', -10);
        window.fb.inc('users/' + u.id + '/installs', -1);
      }
    }
    window.fb.remove('pins/' + id);
    track('edit');
  }
  function restorePin(id, data) {
    window.fb.set('pins/' + id, {
      ...data,
      createdAt: Date.now()
    });
  } // undo of delete
  function movePins(moves) {
    moves.forEach(m => window.fb.update('pins/' + m.id, {
      x: +(+m.x).toFixed(4),
      y: +(+m.y).toFixed(4),
      exact: true
    }));
    track('edit');
  }

  // ---- zones (Firebase-backed; pour-sequence highlight + mark-complete) ----
  function addZone(z) {
    const key = 'Z' + Math.random().toString(36).slice(2, 9);
    window.fb.set('zones/' + key, {
      ...z,
      createdAt: Date.now()
    });
    return key;
  }
  function updateZone(id, patch) {
    window.fb.update('zones/' + id, patch);
    if (patch.done) track('seqdone');
  }
  function removeZone(id) {
    window.fb.remove('zones/' + id);
  }
  function restoreZone(id, z) {
    const {
      id: _drop,
      ...rest
    } = z || {};
    window.fb.set('zones/' + id, rest);
  } // for undo

  // ---- crew (Firebase users) — add a new member from the badge-in screen ----
  function addCrew(c) {
    if (!c || !c.id) return;
    window.fb.set('users/' + c.id, {
      ...c,
      updates: 0,
      installs: 0,
      points: 0
    });
  }
  function signIn(u) {
    setUser(u);
    try {
      sessionStorage.setItem('embedyap_user', JSON.stringify(u));
    } catch (e) {}
  }
  function saveProfile(patch) {
    if (!userRef.current) return;
    const id = userRef.current.id;
    window.fb.update('users/' + id, patch);
    setUser(u => {
      const nu = {
        ...u,
        ...patch
      };
      try {
        sessionStorage.setItem('embedyap_user', JSON.stringify(nu));
      } catch (e) {}
      return nu;
    });
    flash(remarkFor('edit'));
  }
  function signOut() {
    setUser(null);
    sessionStorage.removeItem('embedyap_user');
    setScreen('map');
  }
  if (!user) return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SignIn, {
    onSignIn: signIn,
    onAddCrew: addCrew,
    crew: crew,
    embeds: embeds
  }), toast && /*#__PURE__*/React.createElement(RemarkToast, {
    msg: toast
  }));
  const mapProps = {
    embeds,
    updateEmbed,
    bulkUpdate,
    user,
    isPhone,
    zones,
    onAddZone: addZone,
    onUpdateZone: updateZone,
    onRemoveZone: removeZone,
    onRestoreZone: restoreZone,
    onAddPin: addPin,
    onRemovePin: removePin,
    onRestorePin: restorePin,
    onMovePins: movePins,
    onBulkInstall: bulkInstall,
    onBulkDelivery: bulkSetDelivery,
    grid: effGrid,
    savedGrid: grid,
    gridDraft,
    onGridDraft: setGridDraft,
    onSaveGrid: saveGrid
  };
  const screenEl = {
    map: /*#__PURE__*/React.createElement(MapScreen, mapProps),
    dashboard: /*#__PURE__*/React.createElement(Dashboard, {
      embeds: embeds,
      zones: zones,
      isPhone: isPhone
    }),
    inventory: /*#__PURE__*/React.createElement(Inventory, {
      embeds: embeds,
      isPhone: isPhone,
      types: master,
      canEdit: !!user.manager,
      onBulkDelivery: bulkSetDelivery,
      onEditType: (mark, patch) => {
        window.fb.update('embeds/' + mark, patch);
        track('edit');
      },
      onAddType: (id, patch) => {
        if (id) {
          window.fb.set('embeds/' + id, {
            id,
            ...(patch || {})
          });
          track('edit');
        }
      },
      onDeleteType: id => {
        window.fb.remove('embeds/' + id);
        track('edit');
      },
      onSyncQtys: () => {
        const marks = new Set([...Object.keys(master || {}), ...embeds.map(e => e.mark)]);
        marks.forEach(m => {
          if (!m) return;
          const c = embeds.filter(e => e.mark === m).length;
          window.fb.update('embeds/' + m, {
            id: m,
            qty: c
          });
        });
        track('edit');
      }
    }),
    crew: /*#__PURE__*/React.createElement(Crew, {
      embeds: embeds,
      user: user,
      isPhone: isPhone,
      crew: crew
    }),
    arcade: /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ey-fade",
      style: {
        maxWidth: 980,
        margin: '0 auto',
        padding: isPhone ? '16px 12px 90px' : '24px 28px 48px'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 800,
        fontSize: 26,
        margin: '0 0 4px',
        textTransform: 'uppercase',
        letterSpacing: '.02em'
      }
    }, "Ironworker Run"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 12,
        color: T.color.steel400,
        marginBottom: 14
      }
    }, "BREAK-TIME ARCADE \xB7 DODGE THE EMBEDS"), /*#__PURE__*/React.createElement("div", {
      style: {
        height: isPhone ? 440 : 'min(560px,72vh)'
      }
    }, /*#__PURE__*/React.createElement(Game, {
      user: user,
      isPhone: isPhone
    }))))
  }[screen];
  if (isPhone) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: T.color.graphite
      }
    }, /*#__PURE__*/React.createElement(PhoneHeader, {
      user: user,
      screen: screen,
      onSignOut: signOut,
      onProfile: () => setProfileOpen(true)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        flex: 1,
        minHeight: 0
      }
    }, screenEl), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        borderTop: '1px solid ' + T.color.line,
        background: steelPlate('#141A24', '#0C111A')
      }
    }, NAV.map(n => {
      const on = screen === n.id;
      return /*#__PURE__*/React.createElement("button", {
        key: n.id,
        onClick: () => setScreen(n.id),
        style: {
          flex: 1,
          padding: '9px 0 11px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          color: on ? '#fff' : T.color.steel400,
          position: 'relative'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: n.icon,
        size: 21,
        stroke: on ? 2.2 : 1.8,
        style: {
          color: on ? '#fff' : T.color.steel400
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: T.font.display,
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '.04em',
          textTransform: 'uppercase'
        }
      }, n.label));
    })), toast && /*#__PURE__*/React.createElement(RemarkToast, {
      msg: toast
    }), profileOpen && /*#__PURE__*/React.createElement(Profile, {
      user: user,
      onClose: () => setProfileOpen(false),
      onSave: saveProfile
    }));
  }
  const railW = railOpen ? 196 : 70;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      background: T.color.graphite
    }
  }, toast && /*#__PURE__*/React.createElement(RemarkToast, {
    msg: toast
  }), /*#__PURE__*/React.createElement("aside", {
    style: {
      width: railW,
      flex: `0 0 ${railW}px`,
      display: 'flex',
      flexDirection: 'column',
      padding: railOpen ? '18px 14px' : '18px 0',
      borderRight: '1px solid ' + T.color.line,
      background: steelPlate('#10161F', '#0A0E15'),
      position: 'relative',
      zIndex: 8,
      transition: 'width .22s cubic-bezier(.3,.8,.3,1), flex-basis .22s cubic-bezier(.3,.8,.3,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: TEX.brushed,
      opacity: .4,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      justifyContent: railOpen ? 'flex-start' : 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setRailOpen(o => !o),
    title: railOpen ? 'Collapse menu' : 'Expand menu',
    style: {
      width: 38,
      height: 38,
      flex: '0 0 auto',
      borderRadius: T.radius.md,
      display: 'grid',
      placeItems: 'center',
      color: T.color.steel200,
      border: '1px solid ' + T.color.line,
      background: 'rgba(146,164,196,.06)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  })), railOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 30
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 17,
      letterSpacing: '.01em',
      textTransform: 'uppercase',
      lineHeight: 1
    }
  }, "Embed", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.amberHot
    }
  }, "Yap")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 8.5,
      color: T.color.steel400,
      letterSpacing: '.12em',
      marginTop: 3
    }
  }, "LACC \xB7 A101")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      height: 1,
      background: T.color.line,
      margin: railOpen ? '16px 2px 14px' : '16px 12px 14px'
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      zIndex: 1,
      alignItems: railOpen ? 'stretch' : 'center'
    }
  }, NAV.map(n => {
    const on = screen === n.id;
    const base = {
      borderRadius: T.radius.md,
      color: on ? '#fff' : '#D6DDEC',
      background: on ? 'linear-gradient(180deg,#2B3A52,#18212e)' : railOpen ? 'transparent' : 'rgba(146,164,196,.10)',
      border: '1px solid ' + (on ? T.color.line : railOpen ? 'transparent' : T.color.line),
      transition: 'all .15s'
    };
    const style = railOpen ? {
      ...base,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      textAlign: 'left'
    } : {
      ...base,
      display: 'grid',
      placeItems: 'center',
      width: 46,
      height: 46
    };
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => setScreen(n.id),
      title: n.label,
      style: style
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: railOpen ? 20 : 23,
      stroke: on ? 2.4 : 2.2,
      style: {
        color: on ? '#fff' : '#D6DDEC'
      }
    }), railOpen && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 13,
        letterSpacing: '.04em',
        textTransform: 'uppercase'
      }
    }, n.label));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: railOpen ? '12px 8px 2px' : '12px 0 2px',
      justifyContent: railOpen ? 'flex-start' : 'center',
      borderTop: '1px solid ' + T.color.line,
      marginInline: railOpen ? 0 : 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setProfileOpen(true),
    title: "Edit profile",
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      flex: '0 0 auto',
      background: user.manager ? accentPlate : steelPlate('#26313F', '#1A2230'),
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: user.avatarEmoji ? 17 : 13,
      border: '1px solid ' + T.color.line,
      cursor: 'pointer'
    }
  }, user.avatarEmoji || user.initials), railOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setProfileOpen(true),
    style: {
      minWidth: 0,
      flex: 1,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.name, user.emojis && user.emojis.length ? ' ' + user.emojis.slice(0, 3).join('') : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      color: T.color.steel400,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.manager ? 'MANAGER' : user.role)), /*#__PURE__*/React.createElement("button", {
    onClick: signOut,
    title: "Sign out",
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      flex: '0 0 auto',
      display: 'grid',
      placeItems: 'center',
      color: T.color.steel400,
      border: '1px solid ' + T.color.line,
      background: 'rgba(0,0,0,.2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "power",
    size: 16
  })))), !railOpen && /*#__PURE__*/React.createElement("button", {
    onClick: signOut,
    title: "Sign out",
    style: {
      position: 'relative',
      zIndex: 1,
      margin: '8px auto 0',
      width: 30,
      height: 30,
      borderRadius: 8,
      display: 'grid',
      placeItems: 'center',
      color: T.color.steel400,
      border: '1px solid ' + T.color.line,
      background: 'rgba(0,0,0,.2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "power",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      position: 'relative'
    }
  }, screenEl), profileOpen && /*#__PURE__*/React.createElement(Profile, {
    user: user,
    onClose: () => setProfileOpen(false),
    onSave: saveProfile
  }));
}
function PhoneHeader({
  user,
  screen,
  onSignOut,
  onProfile
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '11px 16px',
      borderBottom: '1px solid ' + T.color.line,
      background: steelPlate('#10151E', '#0B0F16'),
      zIndex: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 19,
      textTransform: 'uppercase'
    }
  }, "Embed", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.amberHot
    }
  }, "Yap")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onProfile,
    title: "Edit profile",
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: user.manager ? accentPlate : steelPlate('#26313F', '#1A2230'),
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: user.avatarEmoji ? 15 : 12,
      border: '1px solid ' + T.color.line
    }
  }, user.avatarEmoji || user.initials), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    style: {
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "power",
    size: 18
  }))));
}
/* motivational remark toast — fires after each tracked update */
function RemarkToast({
  msg
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ey-fade",
    style: {
      position: 'fixed',
      bottom: isPhoneNow() ? 78 : 22,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 120,
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '11px 18px',
      borderRadius: T.radius.pill,
      background: accentPlate,
      color: '#fff',
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 14,
      letterSpacing: '.02em',
      boxShadow: T.shadow.accentGlow,
      border: '1px solid rgba(255,255,255,.18)',
      maxWidth: '90vw',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), " ", msg);
}
function isPhoneNow() {
  return typeof window !== 'undefined' && window.innerWidth <= 760;
}
window.App = App;