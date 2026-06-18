/* EmbedYap — Inventory by embed MARK (201A, 218A…) with editable per-type info + delivery tracking */
const INV_COLS = '1.4fr .58fr .58fr .72fr .72fr 1.05fr 28px'; // mark·desc | qty | pinned | delivered | installed | remaining | chevron
const DELIV_FILTERS = [
// delivery-status scope for the inventory page
{
  value: 'all',
  label: 'All deliveries'
}, {
  value: 'transit',
  label: 'Incoming'
},
// on the way — what's coming in to check off
{
  value: 'none',
  label: 'Not delivered'
},
// not on site yet / not ordered
{
  value: 'outstanding',
  label: 'Outstanding'
},
// anything not fully delivered
{
  value: 'delivered',
  label: 'Delivered'
}];
// urgency for a sequence "needed by" date — parses the ISO as a LOCAL date (like inspDaysUntil in MapScreen)
function neededInfo(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]),
    n = new Date();
  n.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d - n) / 86400000);
  const col = days < 0 ? T.color.red : days <= 7 ? T.color.yellow : T.color.steel300;
  const lbl = days < 0 ? `${-days}d overdue` : days === 0 ? 'due today' : days === 1 ? 'tomorrow' : `${days}d`;
  return {
    days,
    col,
    lbl
  };
}
function Inventory({
  embeds,
  isPhone,
  types,
  onEditType,
  onAddType,
  onDeleteType,
  onSyncQtys,
  onBulkDelivery,
  onBulkInstall,
  canEdit,
  seqMeta = {},
  onSetSeqNeeded
}) {
  const [open, setOpen] = React.useState(null); // expanded mark
  const [q, setQ] = React.useState(''); // search
  const [seqFilter, setSeqFilter] = React.useState('all'); // scope counts + check-off to one sequence
  const [delivFilter, setDelivFilter] = React.useState('all'); // scope to a delivery status (incoming / awaiting / delivered)
  const [sortBy, setSortBy] = React.useState('mark'); // 'mark' | 'recvDesc' | 'recvAsc'
  const [viewMode, setViewMode] = React.useState('table'); // 'table' (by mark) | 'summary' (grouped cards)
  const [groupBy, setGroupBy] = React.useState('sequence'); // summary grouping: 'sequence' | 'area' | 'delivery' | 'attr'
  const [adding, setAdding] = React.useState(false);
  const [newMark, setNewMark] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const dState = window.deliveryState;

  // delivery-status matcher: incoming = on the way, awaiting = not delivered yet, outstanding = anything not fully delivered
  const matchDeliv = e => delivFilter === 'all' ? true : delivFilter === 'transit' ? dState(e) === 'transit' : delivFilter === 'none' ? dState(e) === 'none' : delivFilter === 'delivered' ? dState(e) === 'delivered' : delivFilter === 'outstanding' ? dState(e) !== 'delivered' : true;
  const anyFilter = seqFilter !== 'all' || delivFilter !== 'all';
  // pins in scope of the sequence + delivery filters (drives every count + the bulk check-off)
  const scoped = embeds.filter(e => (seqFilter === 'all' || e.sequence === seqFilter) && matchDeliv(e));

  // headline stats for the scope — "how many embeds / types in the selected region"
  const stats = {
    embeds: scoped.length,
    types: new Set(scoped.map(e => e.mark).filter(Boolean)).size,
    delivered: scoped.filter(e => dState(e) === 'delivered').length,
    transit: scoped.filter(e => dState(e) === 'transit').length,
    installed: scoped.filter(e => e.installed).length
  };

  // per-sequence "needed by" deadline + what's still needed (drives the sequence bar)
  const seqNeeded = seqFilter !== 'all' ? (seqMeta[seqFilter] || {}).needed || '' : '';
  const seqNi = neededInfo(seqNeeded);
  const sStat = (() => {
    if (seqFilter === 'all') return null;
    let none = 0,
      transit = 0,
      deliv = 0;
    embeds.forEach(e => {
      if (e.sequence !== seqFilter) return;
      const d = dState(e);
      if (d === 'delivered') deliv++;else if (d === 'transit') transit++;else none++;
    });
    return {
      none,
      transit,
      deliv
    };
  })();

  // build a row per mark from the master (types) + live pins (counts respect the sequence filter)
  const byMark = {};
  Object.values(types || {}).forEach(t => {
    if (t && t.id) byMark[t.id] = {
      ...t
    };
  });
  scoped.forEach(e => {
    const m = byMark[e.mark] || (byMark[e.mark] = {
      id: e.mark,
      desc: e.typeLabel,
      seq: e.sequence
    });
    m._pinned = (m._pinned || 0) + 1;
    if (e.installed) m._inst = (m._inst || 0) + 1;
    const dl = dState(e);
    if (dl === 'delivered') m._delv = (m._delv || 0) + 1;else if (dl === 'transit') m._transit = (m._transit || 0) + 1;
    if (e.hasKnife) m.knifePlate = true;
    if (e.hasStub) m.stubColumn = true;
  });
  // received date lives on the type record in the inventory (embeds/{mark}.receivedAt) — independent of the plan
  const ql = q.trim().toLowerCase();
  // tokenized search — every space-separated term must match somewhere (mark, desc, supplier, plate, notes, sequence)
  const terms = ql.split(/\s+/).filter(Boolean);
  const matchRow = r => {
    if (!terms.length) return true;
    const hay = [r.id, r.desc, r.supplier, r.plate, r.notes, r.seq && seqLabel(r.seq)].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  };
  const matchEmbed = e => {
    if (!terms.length) return true;
    const hay = [e.mark, e.grid, e.typeLabel, e.area, e.stubType, seqLabel(e.sequence)].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  };
  const byMarkSort = (a, b) => String(a.id).localeCompare(String(b.id), undefined, {
    numeric: true
  });
  // received sort: not-yet-received rows always sink to the bottom; otherwise ISO dates compare chronologically
  const byRecv = dir => (a, b) => {
    const ra = a.receivedAt,
      rb = b.receivedAt;
    if (ra === rb) return byMarkSort(a, b);
    if (!ra) return 1;
    if (!rb) return -1;
    return dir === 'desc' ? rb < ra ? -1 : 1 : ra < rb ? -1 : 1;
  };
  const sortFn = sortBy === 'recvDesc' ? byRecv('desc') : sortBy === 'recvAsc' ? byRecv('asc') : byMarkSort;
  const rows = Object.values(byMark).filter(r => !anyFilter || (r._pinned || 0) > 0) // hide marks with nothing in the active filter scope
  .filter(matchRow).sort(sortFn);
  // with no scope filter the "design qty" baseline is the master total; otherwise it's the in-scope placed count
  const num = r => ({
    qty: !anyFilter && r.qty != null ? r.qty : r._pinned || 0,
    pinned: r._pinned || 0,
    inst: r._inst || 0,
    delv: r._delv || 0,
    transit: r._transit || 0
  });
  const tot = rows.reduce((a, r) => {
    const n = num(r);
    return {
      qty: a.qty + n.qty,
      pinned: a.pinned + n.pinned,
      inst: a.inst + n.inst,
      delv: a.delv + n.delv,
      transit: a.transit + n.transit
    };
  }, {
    qty: 0,
    pinned: 0,
    inst: 0,
    delv: 0,
    transit: 0
  });
  // per-mark × sequence breakdowns (full set — the expander shows every sequence regardless of the filter)
  const SEQS = window.SEQUENCES || ['1', '2', '3', '4'];
  const seqInfo = {};
  window.embedsBySequence(embeds).marks.forEach(m => seqInfo[m.mark] = m);
  const delivInfo = {}; // mark -> { seq: { s: {placed, delivered, transit} } }
  embeds.forEach(e => {
    const mk = e.mark;
    if (!mk) return;
    const di = delivInfo[mk] || (delivInfo[mk] = {
      seq: {}
    });
    const c = di.seq[e.sequence] || (di.seq[e.sequence] = {
      placed: 0,
      delivered: 0,
      transit: 0
    });
    c.placed++;
    const dl = dState(e);
    if (dl === 'delivered') c.delivered++;else if (dl === 'transit') c.transit++;
  });
  // pin ids for a mark within the current sequence scope — used by the bulk check-off buttons
  function markIds(id) {
    return scoped.filter(e => e.mark === id).map(e => e.id);
  }
  function expInv(kind) {
    const data = rows.map(r => {
      const n = num(r);
      const info = seqInfo[r.id];
      const di = delivInfo[r.id];
      const seq = {};
      SEQS.forEach(s => {
        const c = info && info.seq[s] || {
          pinned: 0,
          inst: 0
        };
        seq[s] = c;
      });
      return {
        id: r.id,
        desc: r.desc,
        seqLabel: r.seq,
        qty: n.qty,
        pinned: n.pinned,
        inst: n.inst,
        delivered: n.delv,
        transit: n.transit,
        notDelivered: Math.max(0, n.qty - n.delv - n.transit),
        received: r.receivedAt || '',
        remaining: Math.max(0, n.qty - n.inst),
        pct: n.qty ? Math.round(n.inst / n.qty * 100) : 0,
        bolts: r.bolts,
        plate: r.plate,
        len: r.len,
        supplier: r.supplier,
        seq
      };
    });
    window.exportInventory(data, kind, SEQS);
  }

  // ---- summary view: group the in-scope pins and tally embeds / types / delivered / installed ----
  const groups = React.useMemo(() => {
    const visible = scoped.filter(matchEmbed);
    const buckets = {};
    const keyOf = e => groupBy === 'sequence' ? e.sequence : groupBy === 'area' ? e.area : groupBy === 'delivery' ? dState(e) : e.hasKnife ? 'knife' : e.hasStub ? 'stub' : 'plain'; // 'attr'
    visible.forEach(e => {
      const k = keyOf(e);
      const b = buckets[k] || (buckets[k] = {
        key: k,
        marks: new Set(),
        ids: [],
        embeds: 0,
        delivered: 0,
        transit: 0,
        installed: 0,
        byMark: {}
      });
      b.embeds++;
      b.marks.add(e.mark);
      b.ids.push(e.id);
      const dl = dState(e);
      if (dl === 'delivered') b.delivered++;else if (dl === 'transit') b.transit++;
      if (e.installed) b.installed++;
      const mk = e.mark || '—';
      const mm = b.byMark[mk] || (b.byMark[mk] = {
        mark: mk,
        ids: [],
        embeds: 0,
        delivered: 0,
        transit: 0,
        installed: 0
      });
      mm.embeds++;
      mm.ids.push(e.id);
      if (dl === 'delivered') mm.delivered++;else if (dl === 'transit') mm.transit++;
      if (e.installed) mm.installed++;
    });
    const order = groupBy === 'sequence' ? SEQS : groupBy === 'area' ? window.AREAS || ['A', 'B', 'C', 'D'] : groupBy === 'delivery' ? window.DELIVERY_ORDER || ['delivered', 'transit', 'none'] : ['plain', 'knife', 'stub'];
    const label = k => groupBy === 'sequence' ? seqLabel(k) : groupBy === 'area' ? 'Area ' + k : groupBy === 'delivery' ? window.DELIVERY[k] ? window.DELIVERY[k].label : k : k === 'knife' ? 'Knife plate' : k === 'stub' ? 'Stub column' : 'Plain anchor';
    const color = k => groupBy === 'delivery' ? window.DELIVERY[k] ? window.DELIVERY[k].color : T.color.steel300 : groupBy === 'attr' ? k === 'knife' ? T.color.blue : k === 'stub' ? '#FF9650' : T.color.steel300 : T.color.amberHot;
    const keys = Object.keys(buckets).sort((a, b) => {
      const ia = order.indexOf(a),
        ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b), undefined, {
        numeric: true
      });
    });
    return keys.map(k => {
      const b = buckets[k];
      return {
        key: k,
        label: label(k),
        color: color(k),
        ids: b.ids,
        embeds: b.embeds,
        types: b.marks.size,
        delivered: b.delivered,
        transit: b.transit,
        installed: b.installed,
        marksList: Object.values(b.byMark).sort((a, b2) => String(a.mark).localeCompare(String(b2.mark), undefined, {
          numeric: true
        }))
      };
    });
  }, [scoped, groupBy, ql]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ey-fade",
    style: {
      maxWidth: 1080,
      margin: '0 auto',
      padding: isPhone ? '18px 14px 90px' : '28px 30px 60px'
    }
  }, /*#__PURE__*/React.createElement(Header, {
    title: "Inventory",
    sub: `By embed type · ${rows.length} marks${seqFilter !== 'all' ? ' · ' + seqLabel(seqFilter) : ''}${delivFilter !== 'all' ? ' · ' + DELIV_FILTERS.find(f => f.value === delivFilter).label : ''}`
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
    title: "Filter quantities + check-off to one pour sequence"
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
  }, "All sequences"), SEQS.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, seqLabel(s))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (delivFilter !== 'all' ? 'rgba(245,194,75,.55)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 8px',
      height: 32
    },
    title: "Filter to a delivery status \u2014 pick Incoming to check off what's coming in"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "inventory",
    size: 14,
    style: {
      color: delivFilter !== 'all' ? '#F5C24B' : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: delivFilter,
    onChange: e => setDelivFilter(e.target.value),
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: delivFilter !== 'all' ? '#fff' : T.color.steel200,
      fontFamily: T.font.mono,
      fontSize: 12,
      colorScheme: 'dark',
      cursor: 'pointer'
    }
  }, DELIV_FILTERS.map(f => /*#__PURE__*/React.createElement("option", {
    key: f.value,
    value: f.value
  }, f.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (q ? 'rgba(126,120,240,.5)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 10px',
      height: 32
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    style: {
      color: q ? '#A6A0FF' : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search marks, types, supplier, grid\u2026",
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: '#fff',
      fontFamily: T.font.mono,
      fontSize: 12.5,
      width: isPhone ? 140 : 210
    }
  }), q && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400,
      whiteSpace: 'nowrap'
    }
  }, rows.length), q && /*#__PURE__*/React.createElement("button", {
    onClick: () => setQ(''),
    title: "Clear",
    style: {
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 12
  }))), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: viewMode,
    onChange: setViewMode,
    options: [{
      value: 'table',
      label: 'Table'
    }, {
      value: 'summary',
      label: 'Summary'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (sortBy !== 'mark' ? 'rgba(126,120,240,.5)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 8px',
      height: 32
    },
    title: "Sort the inventory"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "filter",
    size: 13,
    style: {
      color: sortBy !== 'mark' ? '#A6A0FF' : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: sortBy,
    onChange: e => setSortBy(e.target.value),
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: sortBy !== 'mark' ? '#fff' : T.color.steel200,
      fontFamily: T.font.mono,
      fontSize: 12,
      colorScheme: 'dark',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "mark"
  }, "Sort: Mark"), /*#__PURE__*/React.createElement("option", {
    value: "recvDesc"
  }, "Sort: Received (newest)"), /*#__PURE__*/React.createElement("option", {
    value: "recvAsc"
  }, "Sort: Received (oldest)"))), canEdit && /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "bolt",
    onClick: () => onSyncQtys && onSyncQtys(),
    title: "Set every type's quantity to its current placed count on the plan"
  }, "Sync to map"), canEdit && /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "plus",
    onClick: () => setAdding(a => !a)
  }, "Add type"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "export",
    onClick: () => expInv('csv')
  }, "CSV"), /*#__PURE__*/React.createElement(Btn, {
    kind: "navy",
    size: "sm",
    icon: "export",
    onClick: () => expInv('pdf')
  }, "PDF")), adding && canEdit && /*#__PURE__*/React.createElement(Card, {
    pad: 14,
    glow: true,
    style: {
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: newMark,
    onChange: e => setNewMark(e.target.value),
    placeholder: "Mark (e.g. 201A)",
    onKeyDown: e => {
      if (e.key === 'Enter' && newMark.trim()) {
        onAddType(newMark.trim(), {
          desc: newDesc.trim()
        });
        setNewMark('');
        setNewDesc('');
        setAdding(false);
      }
    },
    style: {
      ...inputStyle,
      width: 140,
      fontFamily: T.font.mono,
      fontSize: 13,
      padding: '8px 10px'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: newDesc,
    onChange: e => setNewDesc(e.target.value),
    placeholder: "Description (optional)",
    style: {
      ...inputStyle,
      flex: '1 1 200px',
      fontSize: 13,
      padding: '8px 10px'
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    size: "sm",
    icon: "check",
    disabled: !newMark.trim(),
    onClick: () => {
      if (newMark.trim()) {
        onAddType(newMark.trim(), {
          desc: newDesc.trim()
        });
        setNewMark('');
        setNewDesc('');
        setAdding(false);
      }
    }
  }, "Add"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    onClick: () => {
      setAdding(false);
      setNewMark('');
      setNewDesc('');
    }
  }, "Cancel")), seqFilter !== 'all' && sStat && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      marginTop: 16,
      padding: '12px 16px',
      borderRadius: T.radius.lg,
      background: 'rgba(126,120,240,.07)',
      border: '1px solid ' + (seqNi ? seqNi.col + '66' : T.color.line)
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 16,
    style: {
      color: T.color.amberHot
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16
    }
  }, seqLabel(seqFilter))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Needed by"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 168
    }
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: seqNeeded,
    onChange: d => onSetSeqNeeded && onSetSeqNeeded(seqFilter, d)
  })), seqNi && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 12,
      color: seqNi.col
    }
  }, seqNi.lbl)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 14,
      fontFamily: T.font.mono,
      fontSize: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.red
    }
  }, /*#__PURE__*/React.createElement("b", null, sStat.none), " not delivered"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.yellow
    }
  }, /*#__PURE__*/React.createElement("b", null, sStat.transit), " on the way"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.green
    }
  }, /*#__PURE__*/React.createElement("b", null, sStat.deliv), " delivered"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${isPhone ? 2 : 5},1fr)`,
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Embeds",
    value: stats.embeds,
    sub: "placed in scope"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Types",
    value: stats.types,
    sub: "distinct marks",
    accent: T.color.amberHot
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Delivered",
    value: stats.delivered,
    sub: "on site",
    accent: T.color.green
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "On the way",
    value: stats.transit,
    sub: "in transit",
    accent: T.color.yellow
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Installed",
    value: stats.installed,
    sub: "cast & set",
    accent: T.color.green
  })), viewMode === 'summary' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Group by"), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: groupBy,
    onChange: setGroupBy,
    options: [{
      value: 'sequence',
      label: 'Sequence'
    }, {
      value: 'area',
      label: 'Area'
    }, {
      value: 'delivery',
      label: 'Delivery'
    }, {
      value: 'attr',
      label: 'Type'
    }]
  })), viewMode === 'summary' ? /*#__PURE__*/React.createElement(SummaryGrid, {
    groups: groups,
    isPhone: isPhone,
    onBulkDelivery: onBulkDelivery,
    onBulkInstall: onBulkInstall,
    seqMeta: seqMeta,
    groupBy: groupBy
  }) : /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    glow: true,
    style: {
      marginTop: 18
    }
  }, !isPhone && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: INV_COLS,
      gap: 12,
      padding: '13px 20px',
      borderBottom: '1px solid ' + T.color.line,
      fontFamily: T.font.mono,
      fontSize: 10.5,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mark \xB7 description"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Qty"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Pinned"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Delivered"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Installed"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Remaining"), /*#__PURE__*/React.createElement("span", null)), rows.map((r, i) => {
    const n = num(r);
    const remaining = Math.max(0, n.qty - n.inst);
    const pct = n.qty ? Math.round(n.inst / n.qty * 100) : 0;
    const isOpen = open === r.id;
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      style: {
        borderBottom: i < rows.length - 1 ? '1px solid ' + T.color.lineSoft : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setOpen(isOpen ? null : r.id),
      style: {
        display: 'grid',
        cursor: 'pointer',
        gridTemplateColumns: isPhone ? '1fr 1fr 1fr' : INV_COLS,
        gap: 12,
        padding: isPhone ? '14px 16px' : '15px 20px',
        alignItems: 'center',
        background: isOpen ? 'rgba(126,120,240,.06)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        gridColumn: isPhone ? '1 / -1' : 'auto',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 42,
        height: 30,
        borderRadius: 7,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        background: steelPlate('#26313F', '#1A2230'),
        border: '1px solid ' + T.color.line,
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 12.5,
        color: T.color.amberHot
      }
    }, r.id), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 15.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.desc || 'Anchor Bolt', r.knifePlate && /*#__PURE__*/React.createElement(Badge, {
      color: T.color.blue,
      style: {
        marginLeft: 8,
        fontSize: 9
      }
    }, "KP"), r.stubColumn && /*#__PURE__*/React.createElement(Badge, {
      color: "#FF9650",
      style: {
        marginLeft: 4,
        fontSize: 9
      }
    }, "SC")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel400
      }
    }, r.seq ? seqLabel(r.seq) : '—', r.plate ? ' · ' + r.plate : '', r.receivedAt ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.green
      }
    }, " \xB7 Rec\u2019d ", window.shortDate(r.receivedAt)) : ''))), /*#__PURE__*/React.createElement(Num, {
      label: isPhone ? 'Qty' : null,
      v: n.qty
    }), !isPhone && /*#__PURE__*/React.createElement(Num, {
      v: n.pinned,
      color: T.color.blue
    }), /*#__PURE__*/React.createElement(DelivCell, {
      delv: n.delv,
      transit: n.transit,
      isPhone: isPhone
    }), /*#__PURE__*/React.createElement(Num, {
      label: isPhone ? 'Installed' : null,
      v: n.inst,
      color: T.color.green
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        gridColumn: isPhone ? '1 / -1' : 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: T.font.mono,
        fontSize: 12,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.steel300
      }
    }, remaining, " left"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: pct >= 100 ? T.color.green : T.color.steel400
      }
    }, pct, "%")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 8,
        borderRadius: 5,
        background: 'rgba(0,0,0,.32)',
        overflow: 'hidden',
        border: '1px solid ' + T.color.line
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: Math.min(100, pct) + '%',
        height: '100%',
        background: 'linear-gradient(90deg,#2FD6A6cc,#2FD6A6)',
        transition: 'width .9s ease'
      }
    }))), !isPhone && /*#__PURE__*/React.createElement(Icon, {
      name: "chevronDown",
      size: 16,
      style: {
        color: T.color.steel400,
        transform: isOpen ? 'rotate(180deg)' : 'none',
        transition: 'transform .2s',
        justifySelf: 'end'
      }
    })), isOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DeliveryControls, {
      n: n,
      ids: markIds(r.id),
      seqFilter: seqFilter,
      onBulkDelivery: onBulkDelivery,
      received: r.receivedAt,
      onSetReceived: d => onEditType(r.id, {
        id: r.id,
        receivedAt: d || null
      })
    }), /*#__PURE__*/React.createElement(SeqBreakdown, {
      info: seqInfo[r.id],
      deliv: delivInfo[r.id],
      seqs: SEQS
    }), /*#__PURE__*/React.createElement(TypeEditor, {
      row: r,
      qty: n.qty,
      canEdit: canEdit,
      onSave: patch => onEditType(r.id, patch),
      onDelete: onDeleteType ? () => {
        onDeleteType(r.id);
        setOpen(null);
      } : null
    })));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr 1fr 1fr' : INV_COLS,
      gap: 12,
      padding: isPhone ? '14px 16px' : '15px 20px',
      alignItems: 'center',
      borderTop: '1px solid ' + T.color.line,
      background: 'rgba(30,58,107,.14)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 15,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      gridColumn: isPhone ? '1 / -1' : 'auto'
    }
  }, "Total"), /*#__PURE__*/React.createElement(Num, {
    v: tot.qty
  }), !isPhone && /*#__PURE__*/React.createElement(Num, {
    v: tot.pinned,
    color: T.color.blue
  }), /*#__PURE__*/React.createElement(DelivCell, {
    delv: tot.delv,
    transit: tot.transit,
    isPhone: isPhone
  }), /*#__PURE__*/React.createElement(Num, {
    v: tot.inst,
    color: T.color.green
  }), !isPhone && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Num, {
    v: Math.max(0, tot.qty - tot.inst),
    suffix: " left"
  }), /*#__PURE__*/React.createElement("span", null))))));
}

/* per-mark sequence breakdown — installed / placed AND delivered / placed per sequence */
function SeqBreakdown({
  info,
  deliv,
  seqs
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "By sequence \xB7 installed / placed"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, seqs.map(s => {
    const c = info && info.seq[s] || {
      pinned: 0,
      inst: 0
    };
    const done = c.pinned > 0 && c.inst === c.pinned;
    return /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 11px',
        borderRadius: T.radius.pill,
        background: c.pinned ? 'rgba(126,120,240,.12)' : 'rgba(0,0,0,.2)',
        border: '1px solid ' + (c.pinned ? 'rgba(126,120,240,.4)' : T.color.line)
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        letterSpacing: '.08em',
        color: T.color.steel300
      }
    }, seqLabel(s)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 13,
        color: c.pinned ? done ? T.color.green : '#fff' : T.color.steel600
      }
    }, c.inst, "/", c.pinned));
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 12,
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "By sequence \xB7 delivered / placed"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, seqs.map(s => {
    const c = deliv && deliv.seq[s] || {
      placed: 0,
      delivered: 0,
      transit: 0
    };
    const done = c.placed > 0 && c.delivered === c.placed;
    return /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 11px',
        borderRadius: T.radius.pill,
        background: c.placed ? 'rgba(47,214,166,.10)' : 'rgba(0,0,0,.2)',
        border: '1px solid ' + (c.placed ? 'rgba(47,214,166,.32)' : T.color.line)
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        letterSpacing: '.08em',
        color: T.color.steel300
      }
    }, seqLabel(s)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 13,
        color: c.placed ? done ? T.color.green : '#fff' : T.color.steel600
      }
    }, c.delivered, "/", c.placed), c.transit > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.yellow
      },
      title: "on the way"
    }, "+", c.transit));
  })));
}

/* compact delivered count cell (green) with an in-transit "+N" hint (yellow) */
function DelivCell({
  delv,
  transit,
  isPhone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: isPhone ? 'left' : 'right'
    }
  }, isPhone && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400,
      marginBottom: 2
    }
  }, "Delivered"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 500,
      fontSize: 16,
      color: T.color.green
    }
  }, delv), transit > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.yellow,
      marginLeft: 4
    },
    title: "on the way"
  }, "+", transit));
}

/* bulk delivery check-off for a mark (scoped to the current sequence filter) — open to all signed-in users */
function DeliveryControls({
  n,
  ids,
  seqFilter,
  onBulkDelivery,
  received,
  onSetReceived
}) {
  const notDel = Math.max(0, (n.qty || n.pinned || 0) - n.delv - n.transit);
  const scope = seqFilter === 'all' ? 'all sequences' : seqLabel(seqFilter);
  const todayIso = () => new Date().toISOString().slice(0, 10);
  // delivery-status buttons set the per-pin status (drives the map); "Delivered" also stamps the type's received date
  const B = (status, label, rgb, after) => /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (ids.length && onBulkDelivery) onBulkDelivery(ids, status, status === 'delivered' ? received || todayIso() : undefined);
      if (after) after();
    },
    style: {
      flex: 1,
      padding: '9px 0',
      borderRadius: T.radius.md,
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: '.03em',
      background: `rgba(${rgb},.14)`,
      border: `1px solid rgba(${rgb},.5)`,
      color: `rgb(${rgb})`,
      cursor: 'pointer'
    }
  }, label);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Received on"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 170
    }
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: received || '',
    onChange: d => onSetReceived && onSetReceived(d)
  })), received && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.green
    }
  }, "\u2713 ", window.shortDate(received))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Delivery status \xB7 ", ids.length, " pins \xB7 ", scope), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginTop: 8
    }
  }, B('delivered', 'Delivered', '47,214,166', () => onSetReceived && onSetReceived(received || todayIso())), B('transit', 'On the way', '245,194,75'), B('none', 'Not delivered', '240,85,107')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel400,
      marginTop: 8
    }
  }, "Delivered ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: T.color.green
    }
  }, n.delv), " \xB7 On the way ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: T.color.yellow
    }
  }, n.transit), " \xB7 Not delivered ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: T.color.red
    }
  }, notDel)));
}

/* expandable per-type editor — input info for each embed mark */
function TypeEditor({
  row,
  qty,
  canEdit,
  onSave,
  onDelete
}) {
  const F = ({
    k,
    label,
    type = 'text',
    w
  }) => /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      width: w || 'auto',
      flex: w ? 'none' : '1 1 120px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    defaultValue: row[k] != null ? row[k] : '',
    disabled: !canEdit,
    onBlur: e => {
      const v = type === 'number' ? e.target.value === '' ? null : +e.target.value : e.target.value;
      if (v !== row[k]) onSave({
        [k]: v
      });
    },
    style: {
      ...inputStyle,
      padding: '8px 10px',
      fontSize: 13,
      opacity: canEdit ? 1 : .6
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 18px',
      background: 'rgba(0,0,0,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(F, {
    k: "desc",
    label: "Description"
  }), /*#__PURE__*/React.createElement(F, {
    k: "qty",
    label: "Quantity",
    type: "number",
    w: 110
  }), /*#__PURE__*/React.createElement(F, {
    k: "bolts",
    label: "# Bolts",
    type: "number",
    w: 90
  }), /*#__PURE__*/React.createElement(F, {
    k: "plate",
    label: "Plate",
    w: 110
  }), /*#__PURE__*/React.createElement(F, {
    k: "len",
    label: "Length (in)",
    type: "number",
    w: 110
  }), /*#__PURE__*/React.createElement(F, {
    k: "supplier",
    label: "Supplier"
  })), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Notes"), /*#__PURE__*/React.createElement("textarea", {
    defaultValue: row.notes || '',
    disabled: !canEdit,
    rows: 2,
    onBlur: e => {
      if (e.target.value !== (row.notes || '')) onSave({
        notes: e.target.value
      });
    },
    style: {
      ...inputStyle,
      padding: '8px 10px',
      fontSize: 13,
      resize: 'vertical',
      opacity: canEdit ? 1 : .6
    }
  })), !canEdit && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400,
      marginTop: 8
    }
  }, "Sign in as a manager to edit type info."), canEdit && onDelete && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    size: "sm",
    icon: "trash",
    onClick: () => {
      if (confirm('Delete embed type ' + row.id + '? Pins already on the plan stay; only the type record is removed.')) onDelete();
    }
  }, "Delete type")));
}

/* headline stat tile (embeds / types / delivered / installed) */
function StatTile({
  label,
  value,
  sub,
  accent = '#fff'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(0,0,0,.22)',
      border: '1px solid ' + T.color.line,
      borderRadius: T.radius.lg,
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 26,
      lineHeight: 1,
      marginTop: 4,
      color: accent
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      color: T.color.steel400,
      marginTop: 3
    }
  }, sub));
}

/* summary view — one card per group (sequence / area / delivery / type); click a card to drill into its marks */
function SummaryGrid({
  groups,
  isPhone,
  onBulkDelivery,
  onBulkInstall,
  seqMeta = {},
  groupBy
}) {
  const [openKey, setOpenKey] = React.useState(null);
  if (!groups.length) return /*#__PURE__*/React.createElement(Card, {
    pad: 20,
    glow: true,
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12.5,
      color: T.color.steel400
    }
  }, "No embeds in scope."));
  const MARK_COLS = 'minmax(0,1fr) 54px 30px 86px'; // mark | delivered/total | installed | per-mark actions
  // auto-fit: few groups stretch to fill the width (more room to check off); many settle at ~340px and wrap
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
      gap: 12,
      marginTop: 18,
      alignItems: 'start'
    }
  }, groups.map(g => {
    const dpct = g.embeds ? Math.round(g.delivered / g.embeds * 100) : 0;
    const ipct = g.embeds ? Math.round(g.installed / g.embeds * 100) : 0;
    const isOpen = openKey === g.key;
    const needed = groupBy === 'sequence' ? (seqMeta[g.key] || {}).needed || '' : ''; // per-sequence deadline
    const ni = neededInfo(needed);
    const outstanding = g.embeds - g.delivered; // not yet on site (none + on the way)
    return /*#__PURE__*/React.createElement(Card, {
      key: g.key,
      pad: 16,
      glow: true,
      onClick: () => setOpenKey(isOpen ? null : g.key),
      style: {
        cursor: 'pointer',
        border: '1px solid ' + (isOpen ? 'rgba(126,120,240,.45)' : T.color.line),
        transition: 'border-color .15s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: g.color,
        flex: '0 0 auto',
        boxShadow: `0 0 8px -1px ${g.color}`
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: 17,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, g.label)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 12,
        color: T.color.amberHot,
        background: 'rgba(166,160,255,.12)',
        border: '1px solid rgba(166,160,255,.3)',
        borderRadius: T.radius.pill,
        padding: '2px 9px',
        whiteSpace: 'nowrap'
      }
    }, g.embeds, " pins"), /*#__PURE__*/React.createElement(Icon, {
      name: "chevronDown",
      size: 15,
      style: {
        color: T.color.steel400,
        transform: isOpen ? 'rotate(180deg)' : 'none',
        transition: 'transform .2s'
      }
    }))), groupBy === 'sequence' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        fontFamily: T.font.mono,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "calendar",
      size: 12,
      style: {
        color: ni ? ni.col : T.color.steel400
      }
    }), needed ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: ni ? ni.col : T.color.steel300
      }
    }, "Needed ", window.shortDate(needed), ni ? ' · ' + ni.lbl : '') : /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.steel500
      }
    }, "No deadline set"), outstanding > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        color: T.color.red
      }
    }, outstanding, " not on site")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 18,
        marginTop: 13
      }
    }, /*#__PURE__*/React.createElement(SumStat, {
      label: "Embeds",
      v: g.embeds
    }), /*#__PURE__*/React.createElement(SumStat, {
      label: "Types",
      v: g.types,
      color: T.color.amberHot
    }), /*#__PURE__*/React.createElement(SumStat, {
      label: "Delivered",
      v: g.delivered,
      color: T.color.green
    }), /*#__PURE__*/React.createElement(SumStat, {
      label: "Installed",
      v: g.installed,
      color: T.color.green
    })), /*#__PURE__*/React.createElement(MiniBar, {
      label: "Delivered",
      pct: dpct,
      note: g.transit ? `+${g.transit} on the way` : null,
      color: T.color.green
    }), /*#__PURE__*/React.createElement(MiniBar, {
      label: "Installed",
      pct: ipct,
      color: T.color.green
    }), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 13,
        paddingTop: 12,
        borderTop: '1px solid ' + T.color.lineSoft
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 9,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: T.color.steel400,
        marginBottom: 7
      }
    }, "Mark all ", g.embeds, " embeds"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: 12
      }
    }, [['delivered', 'Delivered', '47,214,166'], ['transit', 'On the way', '245,194,75'], ['none', 'Not', '240,85,107']].map(([st, lbl, rgb]) => /*#__PURE__*/React.createElement("button", {
      key: st,
      onClick: () => g.ids.length && onBulkDelivery && onBulkDelivery(g.ids, st),
      style: {
        flex: '1 1 auto',
        padding: '7px 8px',
        borderRadius: T.radius.md,
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '.02em',
        whiteSpace: 'nowrap',
        background: `rgba(${rgb},.16)`,
        border: `1px solid rgba(${rgb},.5)`,
        color: `rgb(${rgb})`
      }
    }, lbl)), /*#__PURE__*/React.createElement("button", {
      onClick: () => g.ids.length && onBulkInstall && onBulkInstall(g.ids, true),
      style: {
        flex: '1 1 auto',
        padding: '7px 8px',
        borderRadius: T.radius.md,
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '.02em',
        whiteSpace: 'nowrap',
        background: 'rgba(79,163,242,.16)',
        border: '1px solid rgba(79,163,242,.5)',
        color: T.color.blue
      }
    }, "Installed")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: MARK_COLS,
        gap: 8,
        fontFamily: T.font.mono,
        fontSize: 8.5,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: T.color.steel400,
        paddingBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", null, "Mark \xB7 ", g.types, " types"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Deliv"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Inst"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Set")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 300,
        overflowY: 'auto'
      }
    }, g.marksList.map(m => /*#__PURE__*/React.createElement("div", {
      key: m.mark,
      style: {
        display: 'grid',
        gridTemplateColumns: MARK_COLS,
        gap: 8,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 11.5,
        color: T.color.amberHot,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, m.mark), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontSize: 12,
        color: T.color.green
      }
    }, m.delivered, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.steel500
      }
    }, "/", m.embeds), m.transit ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.yellow
      }
    }, " +", m.transit) : null), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontSize: 12,
        color: T.color.green
      }
    }, m.installed), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        justifyContent: 'flex-end'
      }
    }, [['delivered', 'check', '47,214,166', 'delivered'], ['transit', 'clock', '245,194,75', 'on the way'], ['none', 'close', '240,85,107', 'not delivered']].map(([st, ic, rgb, word]) => /*#__PURE__*/React.createElement("button", {
      key: st,
      title: `Mark ${m.mark} ${word}`,
      onClick: () => m.ids.length && onBulkDelivery && onBulkDelivery(m.ids, st),
      style: {
        width: 23,
        height: 23,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 6,
        background: `rgba(${rgb},.14)`,
        border: `1px solid rgba(${rgb},.45)`,
        color: `rgb(${rgb})`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 13
    })))))))));
  }));
}
function SumStat({
  label,
  v,
  color = '#fff'
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 18,
      color,
      marginTop: 2
    }
  }, v));
}
function MiniBar({
  label,
  pct,
  note,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: T.font.mono,
      fontSize: 10.5,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.steel300
    }
  }, label, note && /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.color.yellow,
      marginLeft: 6
    }
  }, note)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: pct >= 100 ? T.color.green : T.color.steel400
    }
  }, pct, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 7,
      borderRadius: 5,
      background: 'rgba(0,0,0,.32)',
      overflow: 'hidden',
      border: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: Math.min(100, pct) + '%',
      height: '100%',
      background: `linear-gradient(90deg,${color}cc,${color})`,
      transition: 'width .9s ease'
    }
  })));
}
function Num({
  v,
  color = '#fff',
  label,
  suffix = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: label ? 'left' : 'right'
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400,
      marginBottom: 2
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 500,
      fontSize: 16,
      color
    }
  }, v, suffix));
}
window.Inventory = Inventory;