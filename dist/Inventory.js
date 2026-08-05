/* EmbedYap — Inventory by embed MARK (201A, 218A…) with editable per-type info + delivery tracking */
const INV_COLS = '1.4fr .58fr .58fr .72fr .72fr 1.05fr 28px'; // mark·desc | qty | pinned | delivered | installed | remaining | chevron
const SELECT_OPT = {
  background: '#10151E',
  color: '#E9EEF5'
}; // readable <option> rows on the dark dropdowns
const SELECT_STYLE = {
  background: '#10151E',
  border: 'none',
  outline: 'none',
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
  colorScheme: 'dark',
  cursor: 'pointer'
};
/* Delivery status is now three INDEPENDENT show/hide switches, not one scope picker.
 *
 * The dropdown could only ever say "show me exactly one of these", so the combination the
 * yard actually asks for — everything that is NOT on site, i.e. not-delivered AND on-the-way
 * together — needed its own pre-baked entry ("Outstanding"), and any other pairing was
 * unreachable. Three toggles express all of it, including the old presets: all on = All,
 * none+transit = Outstanding, none alone = Not delivered, and so on.
 */
const DELIV_STATES = [{
  key: 'none',
  label: 'Not delivered',
  color: '#F4674F'
},
// not on site / not ordered
{
  key: 'transit',
  label: 'On the way',
  color: '#F5C24B'
},
// shipped, not landed
{
  key: 'delivered',
  label: 'Delivered',
  color: '#3FBF7F'
} // on site
];
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
const todayISO = () => new Date().toISOString().slice(0, 10);
// deliveries are DERIVED from the live plan: a pin counts as "delivered on D" when deliveryState==='delivered'
// and receivedAt() gives its date. No separate receipts log — marking delivered IS the log.
function delivPins(pins) {
  const dS = window.deliveryState;
  return (pins || []).filter(e => dS(e) === 'delivered');
}
function delivByDate(pins) {
  const m = {};
  delivPins(pins).forEach(e => {
    const d = window.receivedAt(e) || '';
    (m[d] || (m[d] = {
      date: d,
      qty: 0,
      ids: []
    })).qty++;
    m[d].ids.push(e.id);
  });
  return m;
}
function delivLast(pins) {
  let d = '';
  delivPins(pins).forEach(e => {
    const x = window.receivedAt(e) || '';
    if (x > d) d = x;
  });
  return d;
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
  userName,
  seqMeta = {},
  onSetSeqNeeded,
  wcgPours = []
}) {
  const [open, setOpen] = React.useState(null); // expanded mark
  const [q, setQ] = React.useState(''); // search
  const [seqMode, setSeqMode] = React.useState('pwjv'); // 'pwjv' (embed.sequence) | 'wcg' (which WCG pour it sits in)
  const [seqFilter, setSeqFilter] = React.useState('all'); // scope counts + check-off to one sequence / pour
  // which delivery states are SHOWN — all three on by default (see DELIV_STATES)
  const [delivShow, setDelivShow] = React.useState({
    none: true,
    transit: true,
    delivered: true
  });
  const toggleDeliv = k => setDelivShow(s => {
    const n = {
      ...s,
      [k]: !s[k]
    };
    // never let the last one off — an empty inventory reads as "no data", not as "you hid it all"
    return Object.values(n).some(Boolean) ? n : s;
  });
  const [sortBy, setSortBy] = React.useState('mark'); // 'mark' | 'recvDesc' | 'recvAsc'
  const [viewMode, setViewMode] = React.useState('table'); // 'table' (by mark) | 'summary' (grouped cards)
  const [groupBy, setGroupBy] = React.useState('sequence'); // summary grouping: 'sequence' | 'area' | 'delivery' | 'attr'
  const [deadlinesOpen, setDeadlinesOpen] = React.useState(false); // sequences/deadlines panel
  const [adding, setAdding] = React.useState(false);
  const [newMark, setNewMark] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const dState = window.deliveryState;

  // sequence matcher (PWJV by embed.sequence, WCG by which pour zone the embed sits in)
  const matchSeq = e => seqFilter === 'all' ? true : seqMode === 'wcg' ? e.wcgPour === seqFilter : e.sequence === seqFilter;
  const seqLabelOf = v => seqMode === 'wcg' ? (wcgPours.find(w => w.id === v) || {}).label || v : seqLabel(v);
  // delivery-status matcher — straight lookup against the three show/hide switches
  const matchDeliv = e => !!delivShow[dState(e)];
  const delivAll = DELIV_STATES.every(s => delivShow[s.key]);
  const delivSubLabel = delivAll ? '' : ' · ' + DELIV_STATES.filter(s => delivShow[s.key]).map(s => s.label).join(' + ');
  const anyFilter = seqFilter !== 'all' || !delivAll;
  // pins in scope of the sequence + delivery filters (drives every count + the bulk check-off)
  const scoped = embeds.filter(e => matchSeq(e) && matchDeliv(e));
  // scoped pins grouped by mark — source for per-mark counts, by-date delivery history, and bulk check-off
  const markPins = {};
  scoped.forEach(e => {
    (markPins[e.mark] || (markPins[e.mark] = [])).push(e);
  });

  // headline stats for the scope — "how many embeds / types in the selected region"
  const stats = {
    embeds: scoped.length,
    types: new Set(scoped.map(e => e.mark).filter(Boolean)).size,
    delivered: scoped.filter(e => dState(e) === 'delivered').length,
    transit: scoped.filter(e => dState(e) === 'transit').length,
    installed: scoped.filter(e => e.installed).length
  };

  // per-sequence "needed by" deadline + what's still needed (drives the sequence bar). WCG defaults to its pour date.
  const curWcg = seqMode === 'wcg' && seqFilter !== 'all' ? wcgPours.find(w => w.id === seqFilter) : null;
  const seqNeeded = seqFilter === 'all' ? '' : (seqMeta[seqFilter] || {}).needed || (curWcg ? curWcg.date : '') || '';
  const seqNi = neededInfo(seqNeeded);
  const sStat = (() => {
    if (seqFilter === 'all') return null;
    let none = 0,
      transit = 0,
      deliv = 0;
    embeds.forEach(e => {
      if (!matchSeq(e)) return;
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
  // sort by latest delivered date: never-delivered rows sink to the bottom; ISO dates compare chronologically
  const byDeliv = dir => (a, b) => {
    const ra = delivLast(markPins[a.id]),
      rb = delivLast(markPins[b.id]);
    if (ra === rb) return byMarkSort(a, b);
    if (!ra) return 1;
    if (!rb) return -1;
    return dir === 'desc' ? rb < ra ? -1 : 1 : ra < rb ? -1 : 1;
  };
  const sortFn = sortBy === 'recvDesc' ? byDeliv('desc') : sortBy === 'recvAsc' ? byDeliv('asc') : byMarkSort;
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
    return (markPins[id] || []).map(e => e.id);
  }
  // mark N not-yet-delivered pins of a mark as delivered on a date (the streamlined "log a delivery" action)
  function markDelivered(mark, qty, date) {
    const ps = markPins[mark] || [];
    const avail = ps.filter(e => dState(e) !== 'delivered').map(e => e.id);
    const nn = Math.min(Math.max(1, Math.round(+qty || avail.length)), avail.length);
    if (nn > 0 && onBulkDelivery) onBulkDelivery(avail.slice(0, nn), 'delivered', date || todayISO());
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
      const dd = delivByDate(markPins[r.id]); // delivered, grouped by date → export "Receiving Log" rows
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
        received: n.delv,
        receivedOn: delivLast(markPins[r.id]) || '',
        remaining: Math.max(0, n.qty - n.inst),
        pct: n.qty ? Math.round(n.inst / n.qty * 100) : 0,
        bolts: r.bolts,
        plate: r.plate,
        len: r.len,
        supplier: r.supplier,
        seq,
        receipts: Object.values(dd).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(x => ({
          date: x.date,
          qty: x.qty
        }))
      };
    });
    window.exportInventory(data, kind, SEQS);
  }

  /* ── the 11x17 delivery list ────────────────────────────────────────────────
   *
   * Built from the PINS, not from the inventory rows. A row's counts are per mark, and the
   * guys receiving a truck need the mark AND where it lands — so this walks the individual
   * embeds, keeps only those that are not on site, and re-groups them by sequence.
   *
   * Deliberately ignores the delivery show/hide switches: the sheet is BY DEFINITION the
   * not-on-site list, and inheriting a filter that happened to be set to "Delivered" would
   * print an empty page with no hint why. The sequence filter and the search box ARE honoured
   * — those are the "which part of the job am I looking at" controls, which is exactly the
   * scope you would want on paper.
   */
  function printDelivery() {
    const sState = window.stubDeliveryState;
    /* Scoped on siteDeliveryState — the WORST of the bolt and its stub column — not on the
     * bolt alone.
     *
     * The bolt's own state was wrong here, and wrong in the direction that matters. A stub
     * column is set on the anchors AFTER the pour, so a cast-in bolt says nothing about
     * whether its stub column has landed; filtering on the bolt dropped every
     * bolt-on-site-stub-still-missing location off the sheet, which is the most common way to
     * be short. Now an embed prints if EITHER item is still to come, and the two are counted
     * in their own columns because they arrive on their own trucks. */
    const out = embeds.filter(e => matchSeq(e) && matchEmbed(e) && window.siteDeliveryState(e) !== 'delivered');
    const byS = {};
    out.forEach(e => {
      const s = seqMode === 'wcg' ? e.wcgPour || '—' : e.sequence || '—';
      byS[s] || (byS[s] = {});
      const m = byS[s][e.mark] || (byS[s][e.mark] = {
        mark: e.mark,
        desc: e.typeLabel,
        bNone: 0,
        bTransit: 0,
        sNone: 0,
        sTransit: 0,
        grids: [],
        areas: new Set(),
        knife: 0,
        stubTypes: new Set()
      });
      const b = dState(e);
      if (b === 'transit') m.bTransit++;else if (b !== 'delivered') m.bNone++;
      const st = sState(e); // null when this embed has no stub column
      if (st === 'transit') m.sTransit++;else if (st === 'none') m.sNone++;
      if (e.grid) m.grids.push(e.grid);
      if (e.area) m.areas.add(e.area);
      if (e.hasKnife) m.knife++;
      if (e.hasStub && e.stubType) m.stubTypes.add(e.stubType);
    });
    const groups = Object.keys(byS).map(s => {
      const meta = seqMeta[s] || {};
      const wcg = wcgPours.find(w => w.id === s);
      const needed = meta.needed || (wcg ? wcg.date : '') || '';
      const ni = needed ? neededInfo(needed) : null;
      const rowsOut = Object.values(byS[s]).map(m => ({
        mark: m.mark,
        desc: m.desc,
        bolts: m.bNone + m.bTransit,
        bNone: m.bNone,
        bTransit: m.bTransit,
        stubs: m.sNone + m.sTransit,
        sNone: m.sNone,
        sTransit: m.sTransit,
        qty: m.bNone + m.bTransit + m.sNone + m.sTransit,
        // a long grid list is noise on paper — show the first dozen and say how many more
        locations: m.grids.length > 12 ? m.grids.slice(0, 12).join(', ') + ' +' + (m.grids.length - 12) + ' more' : m.grids.join(', '),
        areas: Array.from(m.areas).sort().join(', '),
        note: [m.knife ? m.knife + ' knife pl.' : '', Array.from(m.stubTypes).sort().join('/')].filter(Boolean).join(' · ')
      })).sort((a, b) => b.bNone + b.sNone - (a.bNone + a.sNone) || String(a.mark).localeCompare(String(b.mark), undefined, {
        numeric: true
      }));
      return {
        key: s,
        label: seqLabelOf(s),
        needed,
        daysLeft: ni ? ni.days : null,
        rows: rowsOut
      };
    })
    // soonest deadline first; anything with no date sinks to the bottom rather than sorting as year 0
    .sort((a, b) => (a.needed ? 0 : 1) - (b.needed ? 0 : 1) || String(a.needed).localeCompare(String(b.needed)) || String(a.label).localeCompare(String(b.label)));
    window.printDeliveryList(groups, {
      project: 'LA Convention Center · A101',
      scope: (seqFilter === 'all' ? 'All sequences' : (seqMode === 'wcg' ? 'WCG ' : '') + seqLabelOf(seqFilter)) + (q.trim() ? ` · search "${q.trim()}"` : ''),
      date: todayISO()
    });
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
        undeliveredIds: [],
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
      if (dl === 'delivered') b.delivered++;else {
        b.undeliveredIds.push(e.id);
      }
      if (dl === 'transit') b.transit++;
      if (e.installed) b.installed++;
      const mk = e.mark || '—';
      const mm = b.byMark[mk] || (b.byMark[mk] = {
        mark: mk,
        ids: [],
        undeliveredIds: [],
        embeds: 0,
        delivered: 0,
        transit: 0,
        installed: 0
      });
      mm.embeds++;
      mm.ids.push(e.id);
      if (dl === 'delivered') mm.delivered++;else {
        mm.undeliveredIds.push(e.id);
        if (dl === 'transit') mm.transit++;
      }
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
        undeliveredIds: b.undeliveredIds,
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
    sub: `By embed type · ${rows.length} marks${seqFilter !== 'all' ? ' · ' + (seqMode === 'wcg' ? 'WCG ' : '') + seqLabelOf(seqFilter) : ''}${delivSubLabel}`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (seqFilter !== 'all' ? 'rgba(126,120,240,.5)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 6px 0 8px',
      height: 32
    },
    title: "Filter to a PWJV sequence or a WCG pour"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "filter",
    size: 13,
    style: {
      color: seqFilter !== 'all' ? '#A6A0FF' : T.color.steel400
    }
  }), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: seqMode,
    onChange: m => {
      setSeqMode(m);
      setSeqFilter('all');
    },
    options: [{
      value: 'pwjv',
      label: 'PWJV'
    }, {
      value: 'wcg',
      label: 'WCG'
    }]
  }), /*#__PURE__*/React.createElement("select", {
    value: seqFilter,
    onChange: e => setSeqFilter(e.target.value),
    style: {
      ...SELECT_STYLE,
      color: seqFilter !== 'all' ? '#fff' : T.color.steel200,
      maxWidth: 150
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all",
    style: SELECT_OPT
  }, seqMode === 'wcg' ? 'All WCG pours' : 'All sequences'), (seqMode === 'wcg' ? wcgPours.map(w => [w.id, w.label]) : SEQS.map(s => [s, seqLabel(s)])).map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v,
    style: SELECT_OPT
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(0,0,0,.3)',
      border: '1px solid ' + (!delivAll ? 'rgba(245,194,75,.55)' : T.color.line),
      borderRadius: T.radius.md,
      padding: '0 8px',
      height: 32
    },
    title: "Show or hide each delivery status \u2014 they are independent, so Not delivered + On the way gives you everything still to come"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "inventory",
    size: 14,
    style: {
      color: !delivAll ? '#F5C24B' : T.color.steel400
    }
  }), DELIV_STATES.map(s => {
    const on = !!delivShow[s.key];
    return /*#__PURE__*/React.createElement("span", {
      key: s.key,
      onClick: () => toggleDeliv(s.key),
      title: (on ? 'Hide ' : 'Show ') + s.label,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        userSelect: 'none',
        padding: '3px 8px',
        borderRadius: T.radius.sm,
        whiteSpace: 'nowrap',
        background: on ? 'rgba(255,255,255,.07)' : 'transparent',
        border: '1px solid ' + (on ? s.color + '88' : 'transparent'),
        color: on ? '#fff' : T.color.steel500,
        fontSize: 11.5,
        textDecoration: on ? 'none' : 'line-through',
        opacity: on ? 1 : .6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: on ? s.color : T.color.steel500,
        flexShrink: 0
      }
    }), s.label);
  })), /*#__PURE__*/React.createElement("div", {
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
    }, {
      value: 'log',
      label: 'Deliveries'
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
      ...SELECT_STYLE,
      color: sortBy !== 'mark' ? '#fff' : T.color.steel200
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "mark",
    style: SELECT_OPT
  }, "Sort: Mark"), /*#__PURE__*/React.createElement("option", {
    value: "recvDesc",
    style: SELECT_OPT
  }, "Sort: Delivered (newest)"), /*#__PURE__*/React.createElement("option", {
    value: "recvAsc",
    style: SELECT_OPT
  }, "Sort: Delivered (oldest)"))), /*#__PURE__*/React.createElement(Btn, {
    kind: deadlinesOpen ? 'primary' : 'ghost',
    size: "sm",
    icon: "calendar",
    onClick: () => setDeadlinesOpen(o => !o),
    title: "Needed-by dates for every sequence"
  }, "Deadlines"), canEdit && /*#__PURE__*/React.createElement(Btn, {
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
    icon: "inventory",
    onClick: printDelivery,
    title: "Print an 11x17 sheet of every anchor bolt not yet on site \u2014 grouped by sequence, with tick boxes for the yard"
  }, "Delivery list 11\xD717"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "export",
    onClick: () => expInv('csv')
  }, "CSV"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    size: "sm",
    icon: "export",
    onClick: () => expInv('xlsx')
  }, "Excel"), /*#__PURE__*/React.createElement(Btn, {
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
  }, "Cancel")), deadlinesOpen && /*#__PURE__*/React.createElement(SequencesPanel, {
    embeds: embeds,
    seqMeta: seqMeta,
    onSetSeqNeeded: onSetSeqNeeded,
    wcgPours: wcgPours,
    isPhone: isPhone
  }), seqFilter !== 'all' && sStat && /*#__PURE__*/React.createElement("div", {
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
  }, seqMode === 'wcg' ? 'WCG · ' : '', seqLabelOf(seqFilter))), /*#__PURE__*/React.createElement("div", {
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
  })), viewMode === 'log' ? /*#__PURE__*/React.createElement(DeliveriesView, {
    embeds: embeds.filter(e => matchSeq(e) && matchEmbed(e)),
    isPhone: isPhone,
    onBulkDelivery: onBulkDelivery,
    canEdit: canEdit,
    scopeLabel: seqFilter !== 'all' ? (seqMode === 'wcg' ? 'WCG · ' : '') + seqLabelOf(seqFilter) : ''
  }) : viewMode === 'summary' ? /*#__PURE__*/React.createElement(SummaryGrid, {
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
    }, r.seq ? seqLabel(r.seq) : '—', r.plate ? ' · ' + r.plate : '', n.delv > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.green
      }
    }, " \xB7 Delivered ", n.delv, "/", n.qty, delivLast(markPins[r.id]) ? ' · ' + window.shortDate(delivLast(markPins[r.id])) : '') : ''))), /*#__PURE__*/React.createElement(Num, {
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
      pins: markPins[r.id] || [],
      seqFilter: seqFilter,
      onBulkDelivery: onBulkDelivery,
      isPhone: isPhone
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

/* per-mark delivery — set HOW MANY are delivered / on the way / not delivered (quantities, not all-or-nothing).
   Newly-delivered get the chosen date; existing dated deliveries are preserved. Open to all signed-in users. */
function DeliveryControls({
  pins,
  seqFilter,
  onBulkDelivery,
  isPhone
}) {
  const dS = window.deliveryState;
  const arr = pins || [];
  const total = arr.length;
  const installedN = arr.filter(e => e.installed).length; // installed pins are locked-delivered
  const curDeliv = arr.filter(e => dS(e) === 'delivered').length;
  const curTransit = arr.filter(e => dS(e) === 'transit').length;
  const curNone = total - curDeliv - curTransit;
  const scope = seqFilter === 'all' ? 'all sequences' : seqLabel(seqFilter);
  const [qD, setQD] = React.useState(String(curDeliv));
  const [qT, setQT] = React.useState(String(curTransit));
  const [date, setDate] = React.useState(todayISO);
  // re-sync the inputs to live counts (e.g. another user marks something while this is open)
  React.useEffect(() => {
    setQD(String(curDeliv));
    setQT(String(curTransit));
  }, [curDeliv, curTransit, total]);
  const D = Math.max(installedN, Math.min(total, Math.round(+qD || 0))); // delivered ≥ installed
  const Tq = Math.max(0, Math.min(total - D, Math.round(+qT || 0))); // NB: not `T` — that's the global design tokens
  const N = total - D - Tq;
  const dirty = D !== curDeliv || Tq !== curTransit;
  const setNot = v => {
    const n = Math.max(0, Math.min(total - D, Math.round(+v || 0)));
    setQT(String(total - D - n));
  };
  function apply() {
    if (!dirty || !onBulkDelivery) return;
    const movable = arr.filter(e => !e.installed);
    const need = {
      delivered: D - installedN,
      transit: Tq,
      none: N
    };
    const tgt = new Map();
    for (const e of movable) {
      const s = dS(e);
      if (need[s] > 0) {
        tgt.set(e.id, s);
        need[s]--;
      }
    } // keep in place (preserves dates)
    for (const e of movable) {
      if (tgt.has(e.id)) continue;
      for (const s of ['delivered', 'transit', 'none']) {
        if (need[s] > 0) {
          tgt.set(e.id, s);
          need[s]--;
          break;
        }
      }
    }
    const toD = [],
      toT = [],
      toN = [];
    for (const e of movable) {
      const t = tgt.get(e.id),
        c = dS(e);
      if (t === 'delivered') {
        if (c !== 'delivered' || !window.receivedAt(e)) toD.push(e.id);
      } // newly delivered, or legacy w/ no date → stamp
      else if (t !== c) {
        (t === 'transit' ? toT : toN).push(e.id);
      }
    }
    if (toD.length) onBulkDelivery(toD, 'delivered', date || todayISO());
    if (toT.length) onBulkDelivery(toT, 'transit');
    if (toN.length) onBulkDelivery(toN, 'none');
  }
  const hist = Object.values(delivByDate(pins)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const Fld = (label, val, onCh, rgb, extra) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 110px',
      minWidth: 96
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 9,
      letterSpacing: '.09em',
      textTransform: 'uppercase',
      color: `rgb(${rgb})`,
      marginBottom: 5
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: total,
    value: val,
    onChange: e => onCh(e.target.value),
    disabled: !total,
    style: {
      ...inputStyle,
      width: '100%',
      padding: '9px 8px',
      fontSize: 17,
      fontFamily: T.font.mono,
      fontWeight: 700,
      textAlign: 'center',
      color: `rgb(${rgb})`,
      border: `1px solid rgba(${rgb},.45)`,
      background: `rgba(${rgb},.07)`
    }
  }), extra);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "How many are\u2026 \xB7 ", total, " pins \xB7 ", scope), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 9,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, Fld('Qty delivered', qD, setQD, '47,214,166', /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: date,
    onChange: setDate
  }))), Fld('Qty on the way', qT, setQT, '245,194,75'), Fld('Qty not delivered', String(N), setNot, '240,85,107')), installedN > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10,
      color: T.color.steel500,
      marginTop: 7
    }
  }, installedN, " already installed \u2014 always counts as delivered."), /*#__PURE__*/React.createElement("button", {
    onClick: apply,
    disabled: !dirty,
    style: {
      width: '100%',
      marginTop: 12,
      padding: '14px 0',
      borderRadius: T.radius.md,
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 15,
      letterSpacing: '.03em',
      background: dirty ? 'linear-gradient(180deg,#3FE3B0,#1FBE86)' : 'rgba(47,214,166,.16)',
      color: dirty ? '#06140e' : 'rgba(47,214,166,.55)',
      border: '1px solid ' + (dirty ? '#2FD6A6' : 'rgba(47,214,166,.3)'),
      boxShadow: dirty ? '0 8px 22px -8px rgba(47,214,166,.75)' : 'none',
      cursor: dirty ? 'pointer' : 'default',
      transition: 'all .15s'
    }
  }, dirty ? `Mark delivered — ${D} delivered · ${Tq} on the way · ${N} not` : 'Up to date'), dirty && date && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10,
      color: T.color.steel400,
      marginTop: 6,
      textAlign: 'center'
    }
  }, "New deliveries dated ", window.shortDate(date), " \xB7 colors the plan dots"), hist.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 14,
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, "Delivered on"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 8
    }
  }, hist.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.date || '—',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 6px 5px 11px',
      borderRadius: T.radius.pill,
      background: 'rgba(47,214,166,.08)',
      border: '1px solid rgba(47,214,166,.25)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12,
      color: '#fff'
    }
  }, window.shortDate(h.date) || 'No date'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 12.5,
      color: T.color.green
    }
  }, "\xD7", h.qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => onBulkDelivery && onBulkDelivery(h.ids, 'none'),
    title: "Undo this delivery (set those pins back to not delivered)",
    style: {
      width: 20,
      height: 20,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 5,
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 12
  })))))));
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

/* Deadlines panel — every sequence (PWJV + WCG pour) with an editable needed-by date, days-left, and what's outstanding */
function SequencesPanel({
  embeds,
  seqMeta = {},
  onSetSeqNeeded,
  wcgPours = [],
  isPhone
}) {
  const dS = window.deliveryState;
  const SEQS = window.SEQUENCES || ['1', '2', '3', '4'];
  const count = pred => {
    let total = 0,
      out = 0,
      inst = 0;
    embeds.forEach(e => {
      if (!pred(e)) return;
      total++;
      if (dS(e) !== 'delivered') out++;
      if (e.installed) inst++;
    });
    return {
      total,
      out,
      inst
    };
  };
  const rows = [...SEQS.map(s => ({
    key: s,
    label: seqLabel(s),
    kind: 'PWJV',
    defDate: '',
    ...count(e => e.sequence === s)
  })), ...wcgPours.map(w => ({
    key: w.id,
    label: w.label,
    kind: 'WCG',
    defDate: w.date || '',
    ...count(e => e.wcgPour === w.id)
  }))];
  const COLS = isPhone ? '1fr 150px' : '74px minmax(0,1fr) 176px 70px 84px 96px';
  const head = {
    fontFamily: T.font.mono,
    fontSize: 9,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: T.color.steel400
  };
  return /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    glow: true,
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 18px',
      borderBottom: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, "Sequence deadlines"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel400
    }
  }, "needed-by per sequence \xB7 WCG defaults to its pour date")), !isPhone && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: COLS,
      gap: 12,
      padding: '9px 18px',
      borderBottom: '1px solid ' + T.color.lineSoft,
      ...head
    }
  }, /*#__PURE__*/React.createElement("span", null, "Layer"), /*#__PURE__*/React.createElement("span", null, "Sequence \xB7 pour"), /*#__PURE__*/React.createElement("span", null, "Needed by"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Days"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Not deliv"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Installed")), rows.map((r, i) => {
    const needed = (seqMeta[r.key] || {}).needed || r.defDate || '';
    const ni = neededInfo(needed);
    return /*#__PURE__*/React.createElement("div", {
      key: r.kind + r.key,
      style: {
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 12,
        padding: isPhone ? '11px 14px' : '10px 18px',
        alignItems: 'center',
        borderBottom: i < rows.length - 1 ? '1px solid ' + T.color.lineSoft : 'none'
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      color: r.kind === 'WCG' ? T.color.cyan : T.color.amberHot,
      style: {
        fontSize: 9
      }
    }, r.kind), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 14.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, r.label, r.total ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel400
      }
    }, " \xB7 ", r.total, " embeds") : null), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 170
      }
    }, /*#__PURE__*/React.createElement(DatePopover, {
      value: needed,
      onChange: d => onSetSeqNeeded && onSetSeqNeeded(r.key, d)
    })), !isPhone && /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontSize: 12,
        fontWeight: 700,
        color: ni ? ni.col : T.color.steel600
      }
    }, ni ? ni.lbl : '—'), !isPhone && /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontSize: 13,
        color: r.out ? T.color.red : T.color.steel600
      }
    }, r.out), !isPhone && /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontSize: 13,
        color: T.color.green
      }
    }, r.inst, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.steel500
      }
    }, "/", r.total)));
  }));
}

/* Deliveries view — every delivery derived live from the plan (deliveryState). Two views: "By date" groups
   into "Delivery — ___" cards; "All" is a flat, sortable list of every line item. Sort newest/oldest. */
function DeliveriesView({
  embeds,
  isPhone,
  onBulkDelivery,
  canEdit,
  scopeLabel
}) {
  const dS = window.deliveryState;
  const [sortDir, setSortDir] = React.useState('desc');
  const [viewMode, setViewMode] = React.useState('date'); // 'date' grouped cards | 'all' flat line items
  const [open, setOpen] = React.useState(null);
  const delivered = (embeds || []).filter(e => dS(e) === 'delivered');
  // group delivered pins by the date they arrived → { date, total, by:{name}, byMark:{mark:{qty,ids,desc,by}} }
  const byDate = {};
  delivered.forEach(e => {
    const d = window.receivedAt(e) || '';
    const g = byDate[d] || (byDate[d] = {
      date: d,
      total: 0,
      ids: [],
      by: {},
      byMark: {}
    });
    g.total++;
    g.ids.push(e.id);
    if (e.deliveredBy) g.by[e.deliveredBy] = 1;
    const mk = e.mark || '—';
    const m = g.byMark[mk] || (g.byMark[mk] = {
      mark: mk,
      desc: e.typeLabel,
      qty: 0,
      ids: [],
      by: {}
    });
    m.qty++;
    m.ids.push(e.id);
    if (e.deliveredBy) m.by[e.deliveredBy] = 1;
  });
  const byDateAsc = (a, b) => sortDir === 'desc' ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
  let dates = Object.keys(byDate).filter(d => d !== '');
  dates.sort(byDateAsc);
  if (byDate['']) dates.push(''); // undated deliveries always sink to the bottom
  // flat line items (one per date × mark) for the "All" view — undated forced last in both directions
  const lineItems = [];
  Object.values(byDate).forEach(g => Object.values(g.byMark).forEach(m => lineItems.push({
    date: g.date,
    mark: m.mark,
    desc: m.desc,
    qty: m.qty,
    ids: m.ids,
    by: Object.keys(m.by)
  })));
  lineItems.sort((a, b) => {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    return byDateAsc(a.date, b.date) || String(a.mark).localeCompare(String(b.mark), undefined, {
      numeric: true
    });
  });
  if (!delivered.length) return /*#__PURE__*/React.createElement(Card, {
    pad: 22,
    glow: true,
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12.5,
      color: T.color.steel400,
      lineHeight: 1.6
    }
  }, "No deliveries yet. Mark what's arrived from a mark's row (", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, "Table"), " \u2192 expand a mark \u2192 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, "Mark delivered"), ") or from the ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, "Summary"), " view \u2014 each one shows up here grouped by the date it arrived."));
  const MCOLS = '1fr 56px 30px';
  const LCOLS = isPhone ? '138px 1fr 34px 24px' : '160px 1.3fr 56px 0.9fr 30px'; // All-view: date (editable) | mark·type | qty | by | undo
  const badge = {
    width: 42,
    height: 27,
    borderRadius: 7,
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    background: steelPlate('#26313F', '#1A2230'),
    border: '1px solid ' + T.color.line,
    fontFamily: T.font.mono,
    fontWeight: 700,
    fontSize: 12,
    color: T.color.amberHot
  };
  return /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    glow: true,
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap',
      padding: '14px 20px',
      borderBottom: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 16,
      textTransform: 'uppercase',
      letterSpacing: '.03em'
    }
  }, "Deliveries"), scopeLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11,
      color: T.color.steel400,
      marginLeft: 8
    }
  }, "\xB7 ", scopeLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11.5,
      color: T.color.steel400
    }
  }, viewMode === 'all' ? `${lineItems.length} line items` : `${dates.length} ${dates.length === 1 ? 'delivery' : 'deliveries'}`, " \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: T.color.green
    }
  }, delivered.length), " on site"), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: viewMode,
    onChange: setViewMode,
    options: [{
      value: 'date',
      label: 'By date'
    }, {
      value: 'all',
      label: 'All'
    }]
  }), /*#__PURE__*/React.createElement(Segmented, {
    size: "sm",
    value: sortDir,
    onChange: setSortDir,
    options: [{
      value: 'desc',
      label: 'Newest'
    }, {
      value: 'asc',
      label: 'Oldest'
    }]
  }))), viewMode === 'all' && /*#__PURE__*/React.createElement(React.Fragment, null, !isPhone && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: LCOLS,
      gap: 12,
      padding: '10px 20px',
      borderBottom: '1px solid ' + T.color.lineSoft,
      fontFamily: T.font.mono,
      fontSize: 9.5,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: T.color.steel400
    }
  }, /*#__PURE__*/React.createElement("span", null, "Date"), /*#__PURE__*/React.createElement("span", null, "Mark \xB7 type"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Qty"), /*#__PURE__*/React.createElement("span", null, "Logged by"), /*#__PURE__*/React.createElement("span", null)), lineItems.map((li, i) => /*#__PURE__*/React.createElement("div", {
    key: (li.date || '—') + '|' + li.mark,
    style: {
      display: 'grid',
      gridTemplateColumns: LCOLS,
      gap: isPhone ? 8 : 12,
      alignItems: 'center',
      padding: isPhone ? '10px 14px' : '10px 20px',
      borderBottom: i < lineItems.length - 1 ? '1px solid ' + T.color.lineSoft : 'none'
    }
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: li.date,
    onChange: d => {
      if (d && onBulkDelivery) onBulkDelivery(li.ids, 'delivered', d);
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: badge
  }, li.mark), !isPhone && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 600,
      fontSize: 13.5,
      color: T.color.steel200,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, li.desc || 'Anchor Bolt')), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: T.font.mono,
      fontWeight: 700,
      fontSize: 14,
      color: T.color.green
    }
  }, li.qty), !isPhone && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12,
      color: li.by.length ? T.color.steel200 : T.color.steel600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, li.by.join(', ') || '—'), /*#__PURE__*/React.createElement("button", {
    onClick: () => onBulkDelivery && onBulkDelivery(li.ids, 'none'),
    title: `Undo — set ${li.mark} (${li.qty}) back to not delivered`,
    style: {
      color: T.color.steel400,
      justifySelf: 'end',
      padding: 3
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 14
  }))))), viewMode === 'date' && dates.map(d => {
    const g = byDate[d];
    const key = d || '—';
    const isOpen = open === key;
    const marks = Object.values(g.byMark).sort((a, b) => String(a.mark).localeCompare(String(b.mark), undefined, {
      numeric: true
    }));
    const who = Object.keys(g.by);
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        borderBottom: '1px solid ' + T.color.lineSoft
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setOpen(isOpen ? null : key),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        padding: isPhone ? '13px 16px' : '14px 20px',
        background: isOpen ? 'rgba(126,120,240,.06)' : d ? 'transparent' : 'rgba(245,194,75,.05)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: d ? 'inventory' : 'calendar',
      size: 16,
      style: {
        color: d ? T.color.green : T.color.yellow
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: 15.5,
        color: d ? '#fff' : T.color.yellow
      }
    }, d ? `Delivery — ${window.shortDate(d)}` : 'No date set — tap to assign'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel400
      }
    }, marks.length, " ", marks.length === 1 ? 'type' : 'types', who.length ? ' · ' + who.join(', ') : '')), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 13,
        color: T.color.green,
        background: 'rgba(47,214,166,.12)',
        border: '1px solid rgba(47,214,166,.3)',
        borderRadius: T.radius.pill,
        padding: '3px 11px',
        whiteSpace: 'nowrap'
      }
    }, g.total, " embeds"), /*#__PURE__*/React.createElement(Icon, {
      name: "chevronDown",
      size: 16,
      style: {
        color: T.color.steel400,
        transform: isOpen ? 'rotate(180deg)' : 'none',
        transition: 'transform .2s'
      }
    })), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: isPhone ? '2px 16px 14px' : '2px 20px 16px',
        background: 'rgba(0,0,0,.16)'
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(DeliveryDateAssign, {
      date: d,
      ids: g.ids,
      onBulkDelivery: onBulkDelivery
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: MCOLS,
        gap: 10,
        fontFamily: T.font.mono,
        fontSize: 8.5,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: T.color.steel400,
        padding: '8px 0 6px'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Mark \xB7 type \xB7 ", marks.length, " ", marks.length === 1 ? 'type' : 'types'), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Qty"), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, marks.map(m => /*#__PURE__*/React.createElement("div", {
      key: m.mark,
      style: {
        display: 'grid',
        gridTemplateColumns: MCOLS,
        gap: 10,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 42,
        height: 27,
        borderRadius: 7,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        background: steelPlate('#26313F', '#1A2230'),
        border: '1px solid ' + T.color.line,
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 12,
        color: T.color.amberHot
      }
    }, m.mark), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 13.5,
        color: T.color.steel200,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, m.desc || 'Anchor Bolt')), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 14,
        color: T.color.green
      }
    }, m.qty), /*#__PURE__*/React.createElement("button", {
      onClick: () => onBulkDelivery && onBulkDelivery(m.ids, 'none'),
      title: `Undo — set ${m.mark} (${m.qty}) back to not delivered`,
      style: {
        color: T.color.steel400,
        justifySelf: 'end',
        padding: 3
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "close",
      size: 14
    })))))));
  }));
}

/* assign / change the date on a whole delivery (restamps every pin in the group) — fixes legacy dateless ones */
function DeliveryDateAssign({
  date,
  ids,
  onBulkDelivery
}) {
  const [d, setD] = React.useState(() => date || todayISO());
  const changed = (d || '') !== (date || '');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexWrap: 'wrap',
      padding: '9px 11px',
      margin: '8px 0 4px',
      borderRadius: T.radius.md,
      background: date ? 'rgba(126,120,240,.06)' : 'rgba(245,194,75,.07)',
      border: '1px solid ' + (date ? T.color.line : 'rgba(245,194,75,.35)')
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel300
    }
  }, date ? 'Delivery date' : 'Set the date this arrived'), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 160
    }
  }, /*#__PURE__*/React.createElement(DatePopover, {
    value: d,
    onChange: setD
  })), /*#__PURE__*/React.createElement(Btn, {
    size: "sm",
    kind: "primary",
    icon: "check",
    disabled: !d || !changed,
    onClick: () => {
      if (d && ids && ids.length && onBulkDelivery) onBulkDelivery(ids, 'delivered', d);
    },
    style: {
      marginLeft: 'auto'
    }
  }, date ? 'Update date' : 'Set date'));
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
  const [secDate, setSecDate] = React.useState(() => new Date().toISOString().slice(0, 10)); // date for "delivered on" + receipt logs
  const [secQty, setSecQty] = React.useState(''); // partial qty to mark delivered for the open section
  const [logKey, setLogKey] = React.useState(null); // 'groupKey|mark' of the open per-mark receipt logger
  const [logQty, setLogQty] = React.useState('');
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
  const MARK_COLS = 'minmax(0,1fr) 48px 26px 116px'; // mark | delivered/total | installed | per-mark actions (3 status + log)
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 9,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: T.color.steel400
      }
    }, "Mark all ", g.embeds, " embeds"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10,
        color: T.color.steel400
      }
    }, "on"), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 150
      }
    }, /*#__PURE__*/React.createElement(DatePopover, {
      value: secDate,
      onChange: setSecDate
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: 12
      }
    }, [['delivered', 'Delivered', '47,214,166'], ['transit', 'On the way', '245,194,75'], ['none', 'Not', '240,85,107']].map(([st, lbl, rgb]) => /*#__PURE__*/React.createElement("button", {
      key: st,
      onClick: () => g.ids.length && onBulkDelivery && onBulkDelivery(g.ids, st, st === 'delivered' ? secDate : undefined),
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
    }, "Installed")), g.undeliveredIds && g.undeliveredIds.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap',
        marginBottom: 12,
        padding: '8px 10px',
        borderRadius: T.radius.md,
        background: 'rgba(47,214,166,.07)',
        border: '1px solid rgba(47,214,166,.25)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel300
      }
    }, "Or mark"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "1",
      max: g.undeliveredIds.length,
      value: secQty,
      onChange: e => setSecQty(e.target.value),
      placeholder: g.undeliveredIds.length,
      style: {
        ...inputStyle,
        width: 62,
        padding: '6px 8px',
        fontSize: 12.5,
        fontFamily: T.font.mono
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel400
      }
    }, "of ", g.undeliveredIds.length, " not delivered, on ", window.shortDate(secDate)), /*#__PURE__*/React.createElement(Btn, {
      size: "sm",
      kind: "primary",
      icon: "check",
      style: {
        marginLeft: 'auto'
      },
      onClick: () => {
        const avail = g.undeliveredIds || [];
        const nn = Math.min(Math.max(1, Math.round(+secQty || avail.length)), avail.length);
        if (nn > 0 && onBulkDelivery) onBulkDelivery(avail.slice(0, nn), 'delivered', secDate);
        setSecQty('');
      }
    }, "Mark delivered")), /*#__PURE__*/React.createElement("div", {
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
        maxHeight: 320,
        overflowY: 'auto'
      }
    }, g.marksList.map(m => {
      const lk = g.key + '|' + m.mark;
      const logOpen = logKey === lk;
      return /*#__PURE__*/React.createElement(React.Fragment, {
        key: m.mark
      }, /*#__PURE__*/React.createElement("div", {
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
        onClick: () => m.ids.length && onBulkDelivery && onBulkDelivery(m.ids, st, st === 'delivered' ? secDate : undefined),
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
      }))), /*#__PURE__*/React.createElement("button", {
        title: `Mark a quantity of ${m.mark} delivered on a date`,
        onClick: () => {
          setLogKey(logOpen ? null : lk);
          setLogQty('');
        },
        style: {
          width: 23,
          height: 23,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          background: logOpen ? 'rgba(245,194,75,.3)' : 'rgba(245,194,75,.14)',
          border: '1px solid rgba(245,194,75,.5)',
          color: '#F5C24B'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "calendar",
        size: 12
      })))), logOpen && (() => {
        const avail = m.undeliveredIds || [];
        const markN = () => {
          const nn = Math.min(Math.max(1, Math.round(+logQty || avail.length)), avail.length);
          if (nn > 0 && onBulkDelivery) onBulkDelivery(avail.slice(0, nn), 'delivered', secDate);
          setLogKey(null);
          setLogQty('');
        };
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '2px 2px 6px',
            flexWrap: 'wrap'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.color.steel400
          }
        }, "Mark"), /*#__PURE__*/React.createElement("input", {
          type: "number",
          min: "1",
          max: avail.length,
          value: logQty,
          onChange: e => setLogQty(e.target.value),
          placeholder: avail.length,
          autoFocus: true,
          disabled: !avail.length,
          onKeyDown: e => {
            if (e.key === 'Enter') markN();
          },
          style: {
            ...inputStyle,
            width: 64,
            padding: '6px 8px',
            fontSize: 12.5,
            fontFamily: T.font.mono,
            opacity: avail.length ? 1 : .5
          }
        }), /*#__PURE__*/React.createElement("span", {
          style: {
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.color.steel400
          }
        }, "of ", avail.length, " delivered on"), /*#__PURE__*/React.createElement("div", {
          style: {
            width: 150
          }
        }, /*#__PURE__*/React.createElement(DatePopover, {
          value: secDate,
          onChange: setSecDate
        })), /*#__PURE__*/React.createElement(Btn, {
          size: "sm",
          kind: "primary",
          icon: "check",
          disabled: !avail.length,
          onClick: markN
        }, "Mark"));
      })());
    }))));
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