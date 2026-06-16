/* EmbedYap — pin detail panel (sequence/area/install + RFI) and zone editor */

function PinDetail({
  embed,
  onClose,
  updateEmbed,
  isPhone,
  manager,
  onDelete
}) {
  const [celebrate, setCelebrate] = React.useState(false);
  const [mark, setMark] = React.useState(embed.mark || '');
  const st = pinState(embed);
  const ds = deliveryState(embed);
  function toggleInstall() {
    const now = !embed.installed;
    updateEmbed(embed.id, {
      installed: now
    }); // App stamps installedAt + credits the user
    if (now) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 900);
    }
  }
  function setRfiField(patch) {
    const base = embed.rfi || {
      number: `RFI-${300 + Math.floor(Math.random() * 99)}`,
      status: 'Open',
      description: '',
      links: []
    };
    updateEmbed(embed.id, {
      rfi: {
        ...base,
        ...patch
      }
    });
  }
  function addLink() {
    const base = embed.rfi || {
      number: `RFI-${300 + Math.floor(Math.random() * 99)}`,
      status: 'Open',
      description: '',
      links: []
    };
    setRfiField({
      links: [...base.links, {
        label: 'New link',
        url: 'https://'
      }]
    });
  }
  function editLink(i, patch) {
    const links = embed.rfi.links.map((l, k) => k === i ? {
      ...l,
      ...patch
    } : l);
    setRfiField({
      links
    });
  }
  function rmLink(i) {
    setRfiField({
      links: embed.rfi.links.filter((_, k) => k !== i)
    });
  }
  const wrap = isPhone ? {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '74%',
    borderRadius: '18px 18px 0 0',
    animation: 'panelInUp .3s cubic-bezier(.2,.8,.2,1) both'
  } : {
    position: 'absolute',
    top: 14,
    right: 14,
    bottom: 14,
    width: 380,
    borderRadius: T.radius.xl,
    animation: 'panelIn .3s cubic-bezier(.2,.8,.2,1) both'
  };
  return /*#__PURE__*/React.createElement("div", {
    "data-ui": true,
    style: {
      ...wrap,
      background: steelPlate('#171F2C', '#0E141D'),
      border: '1px solid ' + T.color.line,
      boxShadow: T.shadow.panel,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      borderBottom: '1px solid ' + T.color.line,
      position: 'relative',
      background: 'linear-gradient(180deg, rgba(30,58,107,.25), transparent)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Dot, {
    color: STATE[st].color,
    size: 11,
    pulse: st !== 'installed' && st === 'next'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12.5,
      color: T.color.steel300,
      letterSpacing: '.08em',
      whiteSpace: 'nowrap'
    }
  }, embed.grid)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 27,
      margin: '4px 0 0',
      letterSpacing: '.01em',
      whiteSpace: 'nowrap'
    }
  }, embed.mark || embed.id), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: T.color.steel200,
      marginTop: 2
    }
  }, embed.typeLabel)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: T.color.steel300,
      padding: 6,
      background: 'rgba(0,0,0,.25)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: STATE[st].color,
    fill: st === 'installed'
  }, STATE[st].label), /*#__PURE__*/React.createElement(Badge, {
    color: DELIVERY[ds].color,
    fill: ds === 'delivered'
  }, DELIVERY[ds].label), embed.hasKnife && /*#__PURE__*/React.createElement(Badge, {
    color: T.color.blue
  }, "Knife plate"), embed.hasStub && /*#__PURE__*/React.createElement(Badge, {
    color: "#FF9650"
  }, embed.stubType ? 'Stub · ' + embed.stubType : 'Stub column'), /*#__PURE__*/React.createElement(Badge, {
    color: T.color.steel300
  }, embed.pour)), celebrate && /*#__PURE__*/React.createElement(Celebrate, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, manager && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(0,0,0,.22)',
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 15,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "Edit embed"), onDelete && /*#__PURE__*/React.createElement(Btn, {
    size: "sm",
    kind: "danger",
    icon: "trash",
    onClick: onDelete
  }, "Delete")), /*#__PURE__*/React.createElement(Field, {
    label: "Mark"
  }, /*#__PURE__*/React.createElement("input", {
    value: mark,
    onChange: e => setMark(e.target.value),
    onBlur: () => {
      if (mark !== embed.mark) updateEmbed(embed.id, {
        embedId: mark
      });
    },
    onKeyDown: e => {
      if (e.key === 'Enter') e.currentTarget.blur();
    },
    style: {
      ...inputStyle,
      padding: '8px 10px',
      fontSize: 13,
      fontFamily: T.font.mono
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 14,
      color: embed.hasKnife ? T.color.blue : '#fff'
    }
  }, "Knife plate"), /*#__PURE__*/React.createElement(Toggle, {
    on: !!embed.hasKnife,
    onChange: () => updateEmbed(embed.id, {
      knifePlate: !embed.hasKnife
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 14,
      color: embed.hasStub ? '#FF9650' : '#fff'
    }
  }, "Stub column"), /*#__PURE__*/React.createElement(Toggle, {
    on: !!embed.hasStub,
    onChange: () => updateEmbed(embed.id, {
      stubColumn: !embed.hasStub
    })
  })), embed.hasStub && /*#__PURE__*/React.createElement(Field, {
    label: "Stub column type"
  }, /*#__PURE__*/React.createElement("input", {
    defaultValue: embed.stubType || '',
    list: "stubTypeList",
    placeholder: "e.g. SC-1 / W-column / HSS",
    onBlur: e => {
      if (e.target.value !== (embed.stubType || '')) updateEmbed(embed.id, {
        stubType: e.target.value
      });
    },
    onKeyDown: e => {
      if (e.key === 'Enter') e.currentTarget.blur();
    },
    style: {
      ...inputStyle,
      padding: '8px 10px',
      fontSize: 13,
      fontFamily: T.font.mono,
      borderColor: 'rgba(255,150,80,.45)'
    }
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "stubTypeList"
  }, (window.STUB_TYPES || []).map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Sequence"
  }, /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: embed.sequence,
    onChange: v => updateEmbed(embed.id, {
      sequence: v,
      pour: `${embed.area}·P${v}`
    }),
    options: SEQUENCES.map(s => ({
      value: s,
      label: s
    })),
    style: {
      display: 'flex',
      flexWrap: 'wrap'
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Phase"
  }, /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: embed.phase || '1',
    onChange: v => updateEmbed(embed.id, {
      phase: v
    }),
    options: PHASES.map(s => ({
      value: s,
      label: s
    })),
    style: {
      display: 'flex',
      flexWrap: 'wrap'
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Area"
  }, /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: embed.area,
    onChange: v => updateEmbed(embed.id, {
      area: v,
      pour: `${v}·P${embed.sequence}`
    }),
    options: AREAS.map(a => ({
      value: a,
      label: a
    }))
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(180deg,rgba(${ds === 'delivered' ? '47,214,166' : ds === 'transit' ? '245,194,75' : '240,85,107'},.14),rgba(0,0,0,.04))`,
      border: '1px solid ' + DELIVERY[ds].color + '55',
      borderRadius: T.radius.lg,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: embed.installed ? 0 : 11
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 17,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, "Delivery"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.color.steel300,
      marginTop: 2
    }
  }, embed.installed ? 'Installed — counts as delivered' : 'Track this embed to site')), /*#__PURE__*/React.createElement(Dot, {
    color: DELIVERY[ds].color,
    size: 12,
    pulse: ds === 'transit'
  })), !embed.installed && /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: embed.delivery || 'none',
    onChange: v => updateEmbed(embed.id, {
      delivery: v
    }),
    options: [{
      value: 'none',
      label: 'Not yet'
    }, {
      value: 'transit',
      label: 'On the way'
    }, {
      value: 'delivered',
      label: 'Delivered'
    }],
    style: {
      display: 'flex',
      flexWrap: 'wrap'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: embed.installed ? 'linear-gradient(180deg,rgba(47,214,166,.16),rgba(47,214,166,.04))' : 'rgba(0,0,0,.22)',
      border: '1px solid ' + (embed.installed ? 'rgba(47,214,166,.42)' : T.color.line),
      borderRadius: T.radius.lg,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 17,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, "Install"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.color.steel300,
      marginTop: 2
    }
  }, embed.installed ? `Cast & set · ${embed.installedAt || '—'}${embed.installedBy ? ' · by ' + embed.installedBy : ''}` : 'Mark when cast into concrete')), /*#__PURE__*/React.createElement(Toggle, {
    on: embed.installed,
    onChange: toggleInstall
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "rfi",
    size: 16,
    style: {
      color: T.color.steel300
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: '.04em'
    }
  }, "RFI")), !embed.rfi && /*#__PURE__*/React.createElement(Btn, {
    size: "sm",
    kind: "ghost",
    icon: "plus",
    onClick: () => setRfiField({})
  }, "Add RFI")), embed.rfi ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(0,0,0,.22)',
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: embed.rfi.number,
    onChange: e => setRfiField({
      number: e.target.value
    }),
    style: {
      ...inputStyle,
      width: 120,
      fontFamily: T.font.mono,
      fontSize: 13,
      padding: '7px 10px'
    }
  }), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: embed.rfi.status,
    onChange: v => setRfiField({
      status: v
    }),
    options: [{
      value: 'Open',
      label: 'Open'
    }, {
      value: 'Answered',
      label: 'Ans'
    }, {
      value: 'Closed',
      label: 'Closed'
    }]
  })), /*#__PURE__*/React.createElement("textarea", {
    value: embed.rfi.description,
    onChange: e => setRfiField({
      description: e.target.value
    }),
    rows: 3,
    placeholder: "Describe the request\u2026",
    style: {
      ...inputStyle,
      resize: 'vertical',
      fontSize: 13,
      lineHeight: 1.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, embed.rfi.links.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 14,
    style: {
      color: T.color.blue,
      flex: '0 0 auto'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: l.label,
    onChange: e => editLink(i, {
      label: e.target.value
    }),
    style: {
      ...inputStyle,
      padding: '6px 9px',
      fontSize: 12.5,
      flex: '1 1 0'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => rmLink(i),
    style: {
      color: T.color.steel400,
      padding: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: addLink,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      color: T.color.blue,
      fontSize: 12.5,
      fontFamily: T.font.mono,
      padding: '5px 0',
      letterSpacing: '.04em'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), " ADD DRIVE / URL LINK"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.color.steel400,
      padding: '10px 0'
    }
  }, "No open requests on this embed."))));
}
function Celebrate() {
  const sparks = Array.from({
    length: 9
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%) rotate(-14deg)',
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 34,
      letterSpacing: '.06em',
      color: T.color.green,
      border: '4px solid ' + T.color.green,
      padding: '4px 16px',
      borderRadius: 8,
      textTransform: 'uppercase',
      animation: 'stampIn .55s cubic-bezier(.2,.9,.25,1) both',
      background: 'rgba(8,16,12,.6)',
      boxShadow: '0 0 30px rgba(47,214,166,.5)'
    }
  }, "Installed"), sparks.map((_, i) => {
    const a = i / sparks.length * Math.PI * 2;
    const d = 70;
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: i % 2 ? T.color.green : T.color.cyan,
        boxShadow: '0 0 8px ' + T.color.green,
        transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`,
        animation: `spark .7s ${i * 0.02}s ease-out both`
      }
    });
  }));
}
const ZONE_COLORS = [['126,120,240', 'Indigo'], ['79,163,242', 'Blue'], ['82,230,224', 'Teal'], ['170,220,70', 'Lime'], ['245,194,75', 'Gold'], ['255,150,60', 'Orange'], ['196,92,203', 'Magenta'], ['240,85,107', 'Coral'], ['151,166,200', 'Steel']];
function ZoneEditor({
  zone,
  embeds = [],
  onApply,
  onCancel,
  onDelete,
  unplaced = []
}) {
  // how many embeds / distinct types fall inside the drawn region (best-effort; needs geometry)
  const region = React.useMemo(() => {
    try {
      const pts = zonePts(zone);
      if (!pts || pts.length < 3) return null;
      const inside = embeds.filter(e => pointInPoly(e.nx, e.ny, pts));
      const ds = window.deliveryState || (e => e.installed ? 'delivered' : e.delivery || 'none');
      return {
        count: inside.length,
        types: new Set(inside.map(e => e.mark).filter(Boolean)).size,
        installed: inside.filter(e => e.installed).length,
        delivered: inside.filter(e => ds(e) === 'delivered').length
      };
    } catch (_) {
      return null;
    }
  }, [zone, embeds]);
  const [area, setArea] = React.useState(zone.area || 'A');
  const [pour, setPour] = React.useState(zone.pour || '1');
  const [phase, setPhase] = React.useState(zone.phase || '1');
  const [done, setDone] = React.useState(!!zone.done);
  const [nextPour, setNextPour] = React.useState(!!zone.nextPour);
  const [assign, setAssign] = React.useState(!!zone.assign);
  const [color, setColor] = React.useState(zone.color || '126,120,240');
  const [layer, setLayer] = React.useState(zoneLayer(zone));
  const [date, setDate] = React.useState(zone.date || '');
  const [name, setName] = React.useState(zone.name || '');
  const [attachTo, setAttachTo] = React.useState(''); // '' = new pour; else id of an un-placed pour
  const canAttach = !!zone._new && unplaced.length > 0;
  const target = attachTo ? unplaced.find(p => p.id === attachTo) : null;
  const Tag = ({
    on,
    set,
    c,
    title,
    sub
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: on ? `linear-gradient(180deg,rgba(${c},.16),rgba(${c},.04))` : 'rgba(0,0,0,.22)',
      border: '1px solid ' + (on ? `rgba(${c},.5)` : T.color.line),
      borderRadius: T.radius.lg,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => set(v => !v),
    style: {
      cursor: 'pointer',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 15,
      textTransform: 'uppercase',
      letterSpacing: '.03em',
      color: on ? `rgb(${c})` : '#fff'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.color.steel300,
      marginTop: 2
    }
  }, sub)), /*#__PURE__*/React.createElement(Toggle, {
    on: on,
    onChange: () => set(v => !v)
  }));
  return /*#__PURE__*/React.createElement("div", {
    "data-ui": true,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(6,9,14,.55)',
      zIndex: 40,
      display: 'grid',
      placeItems: 'center',
      padding: 18
    },
    onClick: onCancel
  }, /*#__PURE__*/React.createElement(Card, {
    onClick: e => e.stopPropagation(),
    pad: 22,
    glow: true,
    style: {
      width: 'min(420px,100%)',
      maxHeight: '92%',
      overflowY: 'auto',
      boxShadow: T.shadow.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zone",
    size: 18,
    style: {
      color: T.color.amber
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 20,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, zone._new ? 'Tag zone' : 'Edit zone')), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: T.color.steel300,
      margin: '0 0 14px'
    }
  }, target ? 'Drop this box onto an existing pour to give it a location.' : 'Tag every embed inside this zone. Area & sequence stay as-is unless you choose to reassign them.'), region && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      margin: '0 0 16px',
      padding: '11px 14px',
      borderRadius: T.radius.lg,
      background: 'rgba(126,120,240,.08)',
      border: '1px solid rgba(126,120,240,.3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "target",
    size: 16,
    style: {
      color: T.color.amberHot,
      flex: '0 0 auto'
    }
  }), [['Embeds', region.count, '#fff'], ['Types', region.types, T.color.amberHot], ['Delivered', region.delivered, T.color.green], ['Installed', region.installed, T.color.green]].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 17,
      color: c,
      marginTop: 1
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, canAttach && /*#__PURE__*/React.createElement(Field, {
    label: "Pour"
  }, /*#__PURE__*/React.createElement("select", {
    value: attachTo,
    onChange: e => setAttachTo(e.target.value),
    style: {
      ...inputStyle,
      padding: '9px 11px',
      fontSize: 13.5,
      width: '100%',
      colorScheme: 'dark'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "+ New pour"), unplaced.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name || 'Pour ' + p.id.slice(-4), p.date ? ' · ' + window.shortDate(p.date) : '')))), target ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(82,230,224,.08)',
      border: '1px solid rgba(82,230,224,.4)',
      borderRadius: T.radius.lg,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16,
      color: T.color.cyan
    }
  }, target.name || 'Pour ' + target.id.slice(-4)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11.5,
      color: T.color.steel300,
      marginTop: 3
    }
  }, [seqLabel(target.pour), target.area && 'Area ' + target.area, target.phase && 'Ph ' + target.phase, target.date && window.shortDate(target.date), +target.cy ? +target.cy + ' CY' : null].filter(Boolean).join(' · ')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.color.steel300,
      marginTop: 8
    }
  }, "The box you drew will become this pour's location.")) : /*#__PURE__*/React.createElement(React.Fragment, null, zone._new && /*#__PURE__*/React.createElement(Field, {
    label: "Pour name (optional)"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. South footing pour",
    style: {
      ...inputStyle,
      padding: '9px 11px',
      fontSize: 13.5
    }
  })), /*#__PURE__*/React.createElement(Tag, {
    on: nextPour,
    set: setNextPour,
    c: "82,230,224",
    title: "Next pour",
    sub: "Cyan layer \xB7 flags everything inside as the next pour"
  }), /*#__PURE__*/React.createElement(Tag, {
    on: done,
    set: setDone,
    c: "47,214,166",
    title: "Pour complete",
    sub: "Green layer \xB7 marks every embed inside installed"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 130px'
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Layer"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: layer,
    onChange: setLayer,
    options: ['PWJV', 'WCG Pours']
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 150px'
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Pour date"
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: date,
    onChange: setDate
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid ' + T.color.line,
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    on: assign,
    set: setAssign,
    c: "126,120,240",
    title: "Set sequence \xB7 phase \xB7 area",
    sub: "Only if this zone should overwrite the embeds inside"
  }), assign && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Sequence"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: pour,
    onChange: setPour,
    options: SEQUENCES
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Phase"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: phase,
    onChange: setPhase,
    options: PHASES
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Area"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: area,
    onChange: setArea,
    options: AREAS
  })))), !nextPour && !done && /*#__PURE__*/React.createElement(Field, {
    label: "Highlight color"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, ZONE_COLORS.map(([c, nm]) => /*#__PURE__*/React.createElement("button", {
    key: c,
    title: nm,
    onClick: () => setColor(c),
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      cursor: 'pointer',
      background: `rgba(${c},.9)`,
      border: '2px solid ' + (color === c ? '#fff' : 'transparent'),
      boxShadow: color === c ? `0 0 0 2px rgba(${c},.6)` : 'none'
    }
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 22
    }
  }, onDelete && /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    icon: "trash",
    onClick: onDelete
  }, "Delete"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    onClick: onCancel,
    style: {
      marginLeft: onDelete ? 0 : 'auto'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    icon: "check",
    onClick: () => onApply(target ? {
      ...zone,
      attachTo
    } : {
      ...zone,
      name,
      area,
      pour,
      phase,
      done,
      nextPour,
      assign,
      color,
      layer,
      date
    }),
    style: {
      marginLeft: onDelete ? 'auto' : 0
    }
  }, target ? 'Place pour' : 'Apply'))));
}

/* manager: drop a brand-new embed pin on the plan */
function NewPinEditor({
  pos,
  onCreate,
  onCancel
}) {
  const [mark, setMark] = React.useState('');
  const [type, setType] = React.useState('anchor');
  const [sequence, setSequence] = React.useState('1');
  const [area, setArea] = React.useState('A');
  return /*#__PURE__*/React.createElement("div", {
    "data-ui": true,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(6,9,14,.55)',
      zIndex: 40,
      display: 'grid',
      placeItems: 'center',
      padding: 18
    },
    onClick: onCancel
  }, /*#__PURE__*/React.createElement(Card, {
    onClick: e => e.stopPropagation(),
    pad: 22,
    glow: true,
    style: {
      width: 'min(420px,100%)',
      boxShadow: T.shadow.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pinAdd",
    size: 18,
    style: {
      color: T.color.amber
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 20,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, "Add embed")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: T.color.steel300,
      margin: '0 0 18px'
    }
  }, "Dropped at ", Math.round(pos.x * 100), "%, ", Math.round(pos.y * 100), "% \u2014 it snaps to the nearest grid intersection."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Mark / piece"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: mark,
    onChange: e => setMark(e.target.value),
    placeholder: "e.g. 218A",
    onKeyDown: e => {
      if (e.key === 'Enter') onCreate({
        embedId: mark || 'NEW',
        knifePlate: type === 'knife',
        sequence,
        area
      });
    },
    style: {
      ...inputStyle,
      padding: '10px 12px',
      fontSize: 14,
      fontFamily: T.font.mono
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Type"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: type,
    onChange: setType,
    options: [{
      value: 'anchor',
      label: 'Anchor rod'
    }, {
      value: 'knife',
      label: 'Knife plate'
    }]
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Sequence"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: sequence,
    onChange: setSequence,
    options: SEQUENCES
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Area"
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: area,
    onChange: setArea,
    options: AREAS
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    onClick: onCancel,
    style: {
      marginLeft: 'auto'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    icon: "check",
    onClick: () => onCreate({
      embedId: mark || 'NEW',
      knifePlate: type === 'knife',
      sequence,
      area
    })
  }, "Add embed"))));
}

/* ---- clean date picker (calendar popover; writes 'YYYY-MM-DD') ---- */
const DP_WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DP_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dpParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? {
    y: +m[1],
    mo: +m[2],
    d: +m[3]
  } : null;
}
function dpPad(n) {
  return String(n).padStart(2, '0');
}
function DatePopover({
  value,
  onChange,
  disabled
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const sel = dpParts(value);
  const now = new Date();
  const [cur, setCur] = React.useState(() => sel ? {
    y: sel.y,
    mo: sel.mo
  } : {
    y: now.getFullYear(),
    mo: now.getMonth() + 1
  });
  React.useEffect(() => {
    if (open && sel) setCur({
      y: sel.y,
      mo: sel.mo
    });
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const startWd = new Date(cur.y, cur.mo - 1, 1).getDay();
  const days = new Date(cur.y, cur.mo, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const prev = () => setCur(c => {
    let mo = c.mo - 1,
      y = c.y;
    if (mo < 1) {
      mo = 12;
      y--;
    }
    return {
      y,
      mo
    };
  });
  const next = () => setCur(c => {
    let mo = c.mo + 1,
      y = c.y;
    if (mo > 12) {
      mo = 1;
      y++;
    }
    return {
      y,
      mo
    };
  });
  const pick = d => {
    onChange(`${cur.y}-${dpPad(cur.mo)}-${dpPad(d)}`);
    setOpen(false);
  };
  const tIso = `${now.getFullYear()}-${dpPad(now.getMonth() + 1)}-${dpPad(now.getDate())}`;
  const label = sel ? `${DP_MON[sel.mo - 1]} ${sel.d}, ${sel.y}` : 'Set date';
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    disabled: disabled,
    onClick: () => !disabled && setOpen(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      height: 34,
      padding: '0 11px',
      borderRadius: T.radius.md,
      background: 'rgba(0,0,0,.25)',
      border: '1px solid ' + (value ? 'rgba(82,230,224,.4)' : T.color.line),
      color: value ? '#fff' : T.color.steel400,
      cursor: disabled ? 'default' : 'pointer',
      fontFamily: T.font.mono,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 14,
    style: {
      color: value ? T.color.cyan : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, label), value && !disabled && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onChange('');
    },
    title: "Clear"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 12,
    style: {
      color: T.color.steel400
    }
  }))), open && /*#__PURE__*/React.createElement("div", {
    "data-ui": true,
    style: {
      position: 'absolute',
      top: 38,
      left: 0,
      zIndex: 60,
      width: 240,
      background: steelPlate('#161D29', '#0F141C'),
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      padding: 12,
      boxShadow: T.shadow.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: prev,
    style: {
      color: T.color.steel300,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 16,
    style: {
      transform: 'rotate(90deg)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 14
    }
  }, DP_MON[cur.mo - 1], " ", cur.y), /*#__PURE__*/React.createElement("button", {
    onClick: next,
    style: {
      color: T.color.steel300,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 16,
    style: {
      transform: 'rotate(-90deg)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2
    }
  }, DP_WD.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: 'w' + i,
    style: {
      textAlign: 'center',
      fontFamily: T.font.mono,
      fontSize: 9.5,
      color: T.color.steel400,
      padding: '2px 0'
    }
  }, w)), cells.map((d, i) => {
    if (d == null) return /*#__PURE__*/React.createElement("div", {
      key: 'e' + i
    });
    const iso = `${cur.y}-${dpPad(cur.mo)}-${dpPad(d)}`;
    const on = value === iso;
    const isToday = iso === tIso;
    return /*#__PURE__*/React.createElement("button", {
      key: 'd' + i,
      onClick: () => pick(d),
      style: {
        height: 28,
        borderRadius: 6,
        fontFamily: T.font.mono,
        fontSize: 12,
        background: on ? T.color.cyan : 'transparent',
        color: on ? '#06140e' : '#dfe7f2',
        fontWeight: on ? 700 : 400,
        border: '1px solid ' + (isToday && !on ? 'rgba(82,230,224,.5)' : 'transparent')
      }
    }, d);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 9,
      paddingTop: 9,
      borderTop: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onChange('');
      setOpen(false);
    },
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400
    }
  }, "Clear"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onChange(tIso);
      setOpen(false);
    },
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.cyan
    }
  }, "Today"))));
}
Object.assign(window, {
  PinDetail,
  ZoneEditor,
  Celebrate,
  NewPinEditor,
  DatePopover
});