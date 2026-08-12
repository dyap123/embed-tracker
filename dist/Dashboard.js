/* EmbedYap — Dashboard: KPIs, installed-over-time, by-area, by-sequence, next pour, exports */
function Dashboard({
  embeds,
  zones = [],
  isPhone
}) {
  const [seqFilter, setSeqFilter] = React.useState('all'); // scope every metric to one pour sequence
  const view = seqFilter === 'all' ? embeds : embeds.filter(e => e.sequence === seqFilter);
  const k = kpis(view);
  const series = installSeries(view);
  const [toast, setToast] = React.useState(null);
  async function exp(kind) {
    const f = await window.exportEmbeds(view, kind);
    if (f) {
      setToast(f);
      setTimeout(() => setToast(null), 2600);
    }
  }
  const dCounts = {
    delivered: view.filter(e => deliveryState(e) === 'delivered').length,
    transit: view.filter(e => deliveryState(e) === 'transit').length,
    none: view.filter(e => deliveryState(e) === 'none').length
  };
  const dSummary = window.deliverySummary(view);
  const byArea = AREAS.map(a => {
    const list = view.filter(e => e.area === a);
    return {
      a,
      pinned: list.length,
      installed: list.filter(e => e.installed).length
    };
  });
  const bySeq = SEQUENCES.map(s => {
    const list = view.filter(e => e.sequence === s);
    return {
      s,
      pinned: list.length,
      installed: list.filter(e => e.installed).length
    };
  });
  // next pour = embeds tagged on the plan (zone "Next pour" toggle)
  const nextPins = view.filter(e => e.nextPour);
  const nextRemaining = nextPins.filter(e => !e.installed).length;
  // scheduled next-pour zones (carry the date); count live embeds inside by area+sequence(+phase)
  const cnt = z => {
    const inst = view.filter(e => e.nextPour && e.area === z.area && String(e.sequence) === String(z.pour) && String(e.phase || '1') === String(z.phase || '1'));
    return {
      total: inst.length,
      done: inst.filter(e => e.installed).length
    };
  };
  const nextGroups = (zones || []).filter(z => z.nextPour).map(z => {
    const c = cnt(z);
    return {
      key: `${seqLabel(z.pour)} · Ph ${z.phase || '1'} · ${z.area}`,
      date: z.date || '',
      layer: z.layer || 'PWJV',
      ...c
    };
  }).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.key.localeCompare(b.key, undefined, {
    numeric: true
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ey-fade",
    style: {
      maxWidth: 1180,
      margin: '0 auto',
      padding: isPhone ? '18px 14px 90px' : '28px 30px 60px'
    }
  }, /*#__PURE__*/React.createElement(Header, {
    title: "Dashboard",
    sub: `Embed install + delivery — live status${seqFilter !== 'all' ? ' · ' + seqLabel(seqFilter) : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (seqFilter !== 'all' ? 'rgba(126,120,240,.5)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 8px',
      height: 32
    },
    title: "Scope every tile + chart to one pour sequence"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "filter",
    size: 13,
    style: {
      color: seqFilter !== 'all' ? '#A6A0FF' : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: seqFilter,
    onChange: e => setSeqFilter(e.target.value),
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: seqFilter !== 'all' ? '#fff' : T.color.steel200,
      fontFamily: T.font.mono,
      fontSize: 12,
      colorScheme: 'dark',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All sequences"), SEQUENCES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, seqLabel(s))))), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "export",
    onClick: () => exp('csv')
  }, "CSV"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "export",
    onClick: () => exp('xlsx')
  }, "Excel"), /*#__PURE__*/React.createElement(Btn, {
    kind: "navy",
    size: "sm",
    icon: "export",
    onClick: () => exp('pdf')
  }, "PDF")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${isPhone ? 2 : 7},1fr)`,
      gap: 12,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Kpi, {
    label: "Expected",
    value: k.expected,
    sub: "design count"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Pinned",
    value: k.pinned,
    sub: "placed on plan",
    accent: T.color.blue
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Delivered",
    value: dCounts.delivered,
    sub: "on site",
    accent: T.color.green
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "On the way",
    value: dCounts.transit,
    sub: "in transit",
    accent: T.color.yellow
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Installed",
    value: k.installed,
    sub: "cast & set",
    accent: T.color.green
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Complete",
    value: k.pct + '%',
    sub: "of pinned",
    accent: T.color.amber,
    ring: k.pct
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Notes",
    value: k.noted,
    sub: "embeds flagged",
    accent: T.color.amberHot
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr',
      gap: 14,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Install by area",
    note: "installed / placed"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      marginTop: 14
    }
  }, byArea.map(r => /*#__PURE__*/React.createElement(BarRow, {
    key: r.a,
    label: 'Area ' + r.a,
    value: r.installed,
    max: r.pinned,
    color: ['#2FD6A6', '#4FA3F2', '#C45CCB', '#F0556B'][AREAS.indexOf(r.a)]
  })))), /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Installed by sequence",
    note: "installed / placed"
  }), /*#__PURE__*/React.createElement(SeqBars, {
    data: bySeq
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : '1.6fr 1fr',
      gap: 14,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Delivery by sequence",
    note: "delivered / placed"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      marginTop: 14
    }
  }, dSummary.rows.map(r => /*#__PURE__*/React.createElement(BarRow, {
    key: r.seq,
    label: seqLabel(r.seq),
    value: r.delivered,
    max: r.placed,
    color: T.color.green,
    note: r.transit ? `+${r.transit} on the way` : null
  })))), /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Delivery status",
    note: "all placed embeds"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Ring, {
    pct: dSummary.total.pct,
    color: T.color.green,
    size: 64
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 32,
      lineHeight: .9,
      color: T.color.green
    }
  }, dSummary.total.pct, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400,
      marginTop: 4
    }
  }, "delivered on site"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(DelivStatRow, {
    color: T.color.green,
    label: "Delivered",
    value: dCounts.delivered
  }), /*#__PURE__*/React.createElement(DelivStatRow, {
    color: T.color.yellow,
    label: "On the way",
    value: dCounts.transit
  }), /*#__PURE__*/React.createElement(DelivStatRow, {
    color: T.color.red,
    label: "Not delivered",
    value: dCounts.none
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : '1.6fr 1fr',
      gap: 14,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Installed over time",
    note: `${series.length} pour days · cumulative`
  }), /*#__PURE__*/React.createElement(AreaChart, {
    series: series,
    total: k.pinned
  })), /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Next pour",
    note: "tagged on the plan"
  }), nextPins.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 13,
      color: T.color.steel400,
      lineHeight: 1.55
    }
  }, "No next pour tagged yet. On the ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, "Plan"), ", draw a markup and turn on ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: T.color.cyan
    }
  }, "Next pour"), " (set a pour date) to flag the embeds for the upcoming pour.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 40,
      lineHeight: .9,
      color: T.color.cyan
    }
  }, nextRemaining), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: T.color.steel300
    }
  }, "embeds to set", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400
    }
  }, nextPins.length, " tagged total"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 14
    }
  }, nextGroups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '9px 12px',
      borderRadius: T.radius.md,
      background: 'rgba(82,230,224,.08)',
      border: '1px solid rgba(82,230,224,.3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 14
    }
  }, g.key), g.date && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.cyan,
      marginLeft: 8
    }
  }, window.shortDate(g.date)), (g.layer === 'WCG' || g.layer === 'Pours' || g.layer === 'WCG Pours') && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      color: T.color.steel400,
      marginLeft: 6
    }
  }, "WCG Pours")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 13,
      color: g.done === g.total && g.total > 0 ? T.color.green : T.color.steel200
    }
  }, g.done, "/", g.total, " set"))), nextGroups.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.color.steel400
    }
  }, "Tagged embeds exist but no next-pour markup found \u2014 re-tag on the plan to attach a date."))))), /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    glow: true,
    style: {
      marginTop: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px 0'
    }
  }, /*#__PURE__*/React.createElement(ChartHead, {
    title: "Anchor bolts by sequence",
    note: "count per mark \xB7 installed / total"
  })), /*#__PURE__*/React.createElement(SeqMatrix, {
    embeds: view,
    isPhone: isPhone
  }))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: isPhone ? 80 : 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60,
      background: steelPlate('#1B2433', '#0E141D'),
      border: '1px solid rgba(47,214,166,.4)',
      borderRadius: T.radius.md,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: T.shadow.panel,
      animation: 'panelInUp .3s both'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    style: {
      color: T.color.green
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.body,
      fontSize: 14
    }
  }, "Exported ", /*#__PURE__*/React.createElement("b", null, toast))));
}
function Header({
  title,
  sub,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, sub), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 34,
      margin: '6px 0 0',
      textTransform: 'uppercase',
      letterSpacing: '.01em'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-end'
    }
  }, children));
}
function ChartHead({
  title,
  note
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 17,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400,
      letterSpacing: '.06em'
    }
  }, note));
}
function Kpi({
  label,
  value,
  sub,
  accent = T.color.steel200,
  ring
}) {
  return /*#__PURE__*/React.createElement(Card, {
    pad: 16,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -10,
      right: -10,
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${accent}22, transparent 70%)`
    }
  }), /*#__PURE__*/React.createElement(Kicker, null, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 38,
      lineHeight: .9,
      color: accent === '#9DAAC0' ? '#fff' : accent
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: T.color.steel400,
      marginTop: 6,
      fontFamily: T.font.mono,
      letterSpacing: '.04em'
    }
  }, sub), ring != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 14,
      right: 14
    }
  }, /*#__PURE__*/React.createElement(Ring, {
    pct: ring,
    color: accent
  })));
}
function Ring({
  pct,
  color,
  size = 34
}) {
  const r = (size - 5) / 2,
    c = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "rgba(150,170,205,.18)",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: "4",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct / 100),
    style: {
      transition: 'stroke-dashoffset 1s ease'
    }
  }));
}
function AreaChart({
  series,
  total
}) {
  const W = 560,
    H = 180,
    pad = 8;
  const max = series[series.length - 1]?.cum || 1;
  const xs = series.map((_, i) => pad + (W - 2 * pad) * (i / Math.max(1, series.length - 1)));
  const ys = series.map(d => H - pad - (H - 2 * pad) * (d.cum / max));
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length - 1]} ${H - pad} L${xs[0]} ${H - pad} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: '100%',
      height: 'auto',
      marginTop: 10,
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "ag",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#2FD6A6",
    stopOpacity: ".42"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#2FD6A6",
    stopOpacity: "0"
  }))), [0, .25, .5, .75, 1].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: pad,
    x2: W - pad,
    y1: pad + (H - 2 * pad) * g,
    y2: pad + (H - 2 * pad) * g,
    stroke: "rgba(150,170,205,.1)",
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "url(#ag)"
  }), /*#__PURE__*/React.createElement("path", {
    d: path,
    fill: "none",
    stroke: "#2FD6A6",
    strokeWidth: "2.4",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), xs.map((x, i) => i % 4 === 0 || i === xs.length - 1 ? /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: x,
    cy: ys[i],
    r: "3",
    fill: "#0C111A",
    stroke: "#2FD6A6",
    strokeWidth: "2"
  }) : null), /*#__PURE__*/React.createElement("text", {
    x: pad,
    y: pad + 10,
    fill: T.color.steel400,
    fontSize: "11",
    fontFamily: "'JetBrains Mono',monospace"
  }, max, " installed"));
}
function BarRow({
  label,
  value,
  max,
  color,
  note
}) {
  const pct = max ? Math.round(value / max * 100) : 0;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      letterSpacing: '.02em'
    }
  }, label, note && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.yellow,
      marginLeft: 8
    }
  }, note)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      color: T.color.steel300,
      fontSize: 12
    }
  }, value, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.steel400
    }
  }, "/", max, " \xB7 ", pct, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      borderRadius: 6,
      background: 'rgba(0,0,0,.32)',
      overflow: 'hidden',
      border: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      background: `linear-gradient(90deg,${color}cc,${color})`,
      borderRadius: 6,
      transition: 'width .9s cubic-bezier(.2,.8,.2,1)',
      boxShadow: `0 0 12px -2px ${color}`
    }
  })));
}

/* delivery status legend row — colored dot + label + count */
function DelivStatRow({
  color,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: color,
      flex: '0 0 auto',
      boxShadow: `0 0 8px -1px ${color}`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: T.color.offwhite
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 15,
      color
    }
  }, value));
}

/* anchor-bolt mark × sequence count matrix (installed / total per cell) */
function SeqMatrix({
  embeds,
  isPhone
}) {
  const {
    seqs,
    marks,
    seqTotals
  } = embedsBySequence(embeds);
  const cols = `120px repeat(${seqs.length}, 1fr) 64px`;
  const cell = {
    textAlign: 'center',
    fontFamily: T.font.mono,
    fontSize: 12.5,
    padding: '8px 4px'
  };
  const head = {
    ...cell,
    fontSize: 10.5,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: T.color.steel400
  };
  if (!marks.length) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px',
      color: T.color.steel400,
      fontFamily: T.font.mono,
      fontSize: 12.5
    }
  }, "No embeds yet.");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      maxHeight: 340,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      alignItems: 'center',
      borderBottom: '1px solid ' + T.color.line,
      position: 'sticky',
      top: 0,
      background: steelPlate('#161D29', '#10151E'),
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...head,
      textAlign: 'left',
      paddingLeft: 20
    }
  }, "Mark"), seqs.map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: head
  }, seqLabel(s))), /*#__PURE__*/React.createElement("span", {
    style: {
      ...head,
      paddingRight: 16
    }
  }, "Total")), marks.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: m.mark,
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      alignItems: 'center',
      borderBottom: i < marks.length - 1 ? '1px solid ' + T.color.lineSoft : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...cell,
      textAlign: 'left',
      paddingLeft: 20,
      color: T.color.amberHot,
      fontWeight: 700
    }
  }, m.mark), seqs.map(s => {
    const c = m.seq[s] || {
      pinned: 0,
      inst: 0
    };
    const done = c.pinned > 0 && c.inst === c.pinned;
    return /*#__PURE__*/React.createElement("span", {
      key: s,
      style: {
        ...cell,
        color: c.pinned ? done ? T.color.green : '#fff' : T.color.steel600
      }
    }, c.pinned ? /*#__PURE__*/React.createElement("span", null, c.inst, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.steel400
      }
    }, "/", c.pinned)) : '·');
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...cell,
      paddingRight: 16,
      fontWeight: 700
    }
  }, m.inst, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.steel400
    }
  }, "/", m.total)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      alignItems: 'center',
      borderTop: '1px solid ' + T.color.line,
      background: 'rgba(30,58,107,.14)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...cell,
      textAlign: 'left',
      paddingLeft: 20,
      fontWeight: 700,
      textTransform: 'uppercase',
      fontSize: 11
    }
  }, "Total"), seqs.map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: {
      ...cell,
      fontWeight: 700
    }
  }, seqTotals[s].inst, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.steel400
    }
  }, "/", seqTotals[s].pinned))), /*#__PURE__*/React.createElement("span", {
    style: {
      ...cell,
      paddingRight: 16,
      fontWeight: 700
    }
  }, marks.reduce((a, m) => a + m.inst, 0), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.steel400
    }
  }, "/", marks.reduce((a, m) => a + m.total, 0)))));
}
function SeqBars({
  data
}) {
  const max = Math.max(...data.map(d => d.pinned), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 14,
      height: 172,
      marginTop: 14,
      padding: '0 4px'
    }
  }, data.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.s,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: '100%',
      maxWidth: 54,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    title: `${d.pinned} pinned`,
    style: {
      height: d.pinned / max * 100 + '%',
      minHeight: 4,
      background: 'rgba(79,163,242,.18)',
      border: '1px solid rgba(79,163,242,.35)',
      borderRadius: '6px 6px 0 0',
      position: 'relative',
      transformOrigin: 'bottom',
      animation: 'growBar .8s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: (d.installed / d.pinned * 100 || 0) + '%',
      background: 'linear-gradient(180deg,#2FD6A6,#1f9e7e)',
      borderRadius: '0 0 0 0',
      boxShadow: '0 0 14px -2px #2FD6A6'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -20,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: T.font.mono,
      fontSize: 11.5,
      fontWeight: 700,
      color: T.color.green
    }
  }, d.installed))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 13.5,
      color: T.color.steel200,
      textAlign: 'center',
      lineHeight: 1.05
    }
  }, seqLabel(d.s)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel400,
      marginTop: -4
    }
  }, d.installed, "/", d.pinned))));
}
Object.assign(window, {
  Dashboard,
  Header,
  Kpi
});