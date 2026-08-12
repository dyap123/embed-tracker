/* EmbedYap — data layer
   Live: pinToEmbed maps Firebase `pins` onto the UI embed shape; grid math
   (colX/rowY/gridIdx); KPI + summary derivations; crew seed; remarks.
   (The old procedural mock-embed generator was removed — it was unused; the
   app derives everything from Firebase `pins`.) */

// ---- column grid (A–Z left→right, rows 33→8 top→bottom) -----------
const GRID_COLS = Array.from({
  length: 26
}, (_, i) => String.fromCharCode(65 + i)); // A..Z
const GRID_ROWS = [];
for (let r = 33; r >= 8; r--) GRID_ROWS.push(String(r)); // 33 (top) -> 8 (bottom)

// plan occupies this region inside the blueprint image
const PLAN = {
  x0: 0.085,
  x1: 0.945,
  y0: 0.10,
  y1: 0.93
};

/* ---- live, editable grid config (persisted to Firebase `grid`) --------
   GRID_CFG = { cols:[labels], rows:[labels], colW:[bay weights], rowH:[bay weights], plan:{x0,x1,y0,y1} }
   When null we fall back to the uniform A–Z / 33–8 default above. */
let GRID_CFG = null;
function setGridCfg(cfg) {
  GRID_CFG = cfg && cfg.cols && cfg.rows ? cfg : null;
}
function gridCols() {
  return GRID_CFG && GRID_CFG.cols || GRID_COLS;
}
function gridRows() {
  return GRID_CFG && GRID_CFG.rows || GRID_ROWS;
}
function gridPlan() {
  return GRID_CFG && GRID_CFG.plan || PLAN;
}
// cumulative 0..1 positions for n gridlines given (n-1) bay weights; uniform if absent
function cumFrac(weights, n) {
  if (n <= 1) return [0];
  if (!weights || weights.length !== n - 1) return Array.from({
    length: n
  }, (_, i) => i / (n - 1));
  const tot = weights.reduce((a, b) => a + (+b || 0), 0) || 1;
  let acc = 0;
  const out = [0];
  for (let i = 0; i < weights.length; i++) {
    acc += +weights[i] || 0;
    out.push(acc / tot);
  }
  return out;
}
function colX(i) {
  const c = gridCols(),
    pl = gridPlan();
  const f = cumFrac(GRID_CFG && GRID_CFG.colW, c.length);
  return pl.x0 + (pl.x1 - pl.x0) * (f[i] != null ? f[i] : 0);
}
function rowY(i) {
  const r = gridRows(),
    pl = gridPlan();
  const f = cumFrac(GRID_CFG && GRID_CFG.rowH, r.length);
  return pl.y0 + (pl.y1 - pl.y0) * (f[i] != null ? f[i] : 0);
}
const EMBED_TYPES = [{
  key: 'anchor',
  code: 'AR',
  label: 'Anchor rod',
  w: 0.40
}, {
  key: 'knife',
  code: 'KP',
  label: 'Knife plate',
  w: 0.20
}, {
  key: 'post',
  code: 'EP',
  label: 'Embed post',
  w: 0.16
}, {
  key: 'coupler',
  code: 'CP',
  label: 'Coupler',
  w: 0.14
}, {
  key: 'stub',
  code: 'SC',
  label: 'Stub column',
  w: 0.10
}];
const SEQUENCES = ['1', '2', '3', '4', 'South Hall', 'CUP'];
const PHASES = ['1', '2', '3', '4'];
const AREAS = ['A', 'B', 'C', 'D'];
// numeric sequences read "Seq 3"; named ones (South Hall) show as-is
function seqLabel(s) {
  return s && /^\d+$/.test(String(s)) ? 'Seq ' + s : s || '';
}
window.seqLabel = seqLabel;

// area by quadrant of the plan; pour ties sequence to a concrete placement
function areaFor(cx, cy) {
  const left = cx < (GRID_COLS.length - 1) / 2;
  const top = cy < (GRID_ROWS.length - 1) / 2;
  if (top && left) return 'A';
  if (top && !left) return 'B';
  if (!top && left) return 'C';
  return 'D';
}

// ---- crew ---------------------------------------------------------------
const CREW = [{
  id: 'danzel',
  name: 'Danzel Yap',
  role: 'PWJV · The GOAT 🐐',
  pin: '050103',
  initials: 'DY',
  installs: 0,
  points: 0,
  manager: true,
  goat: true
}, {
  id: 'misael',
  name: 'Misael Iniguez',
  role: "PWJV · Danzel's boss",
  pin: '050103',
  initials: 'MI',
  installs: 0,
  points: 0,
  manager: true
}, {
  id: 'kate',
  name: 'Kate Schuck',
  role: 'APM · PWJV',
  pin: '050103',
  initials: 'KS',
  installs: 0,
  points: 0,
  manager: true
}, {
  id: 'moises',
  name: 'Moises Espinoza',
  role: 'PE · PWJV',
  pin: '050103',
  initials: 'ME',
  installs: 0,
  points: 0,
  manager: true
}, {
  id: 'freddy',
  name: 'Freddy',
  role: 'PE · SME',
  pin: '050103',
  initials: 'FR',
  installs: 0,
  points: 0,
  manager: true
}];

// ---- derived helpers ----------------------------------------------------
function pinState(e) {
  if (e.installed) return 'installed';
  if (e.nextPour) return 'next'; // cyan — tagged as next pour (via a zone)
  return 'todo'; // knife plate is an attribute (e.hasKnife), not a status
}
// delivery-to-site state: installed steel is by definition on site, so it always reads 'delivered'.
// Otherwise the pin's own delivery field drives it ('delivered' | 'transit' | 'none').
function deliveryState(e) {
  if (e.installed) return 'delivered';
  if (e.delivery === 'delivered') return 'delivered';
  if (e.delivery === 'transit') return 'transit';
  return 'none';
}
// stub-column delivery, tracked on its own field. Deliberately NOT implied by `installed`:
// the stub column is set on the anchor bolts AFTER the pour, so a cast-in anchor says
// nothing about whether its stub column has landed on site. null when there's no stub here.
function stubDeliveryState(e) {
  if (!e.hasStub) return null;
  if (e.stubDelivery === 'delivered') return 'delivered';
  if (e.stubDelivery === 'transit') return 'transit';
  return 'none';
}
// what the map paints for a pin: the WORST of the anchor bolt and (if there is one) its stub
// column — a delivered bolt whose stub column hasn't shown up still reads red, because the
// location isn't ready. Same three keys as deliveryState, so DELIVERY[...] works unchanged.
const DELIV_RANK = {
  delivered: 2,
  transit: 1,
  none: 0
};
function siteDeliveryState(e) {
  const a = deliveryState(e),
    s = stubDeliveryState(e);
  return s && DELIV_RANK[s] < DELIV_RANK[a] ? s : a;
}
// date an embed was received on site — its explicit delivered date, or (for already-installed pins) the install date
function receivedAt(e) {
  return e.deliveredAt || (e.installed ? e.installedAt : null);
}
function kpis(embeds) {
  const pinned = embeds.length;
  const installed = embeds.filter(e => e.installed).length;
  const expected = pinned; // real takeoff: every embed is pinned
  const noted = embeds.filter(e => e.note).length;
  return {
    expected,
    pinned,
    installed,
    pct: pinned ? Math.round(installed / pinned * 100) : 0,
    noted
  };
}

/* ---- Firebase pin → design embed shape (real extracted data) ----------
   Firebase `pins` carry {embedId(mark), x,y(0..1), sequence, area, installed,
   knifePlate, installedAt, note}. Map each onto the editable blueprint grid
   (best-effort by relative position). */
function gridIdx(p) {
  const C = gridCols(),
    R = gridRows();
  // snap to the nearest gridline by its ACTUAL blueprint position (colX/rowY include
  // the plan margins + non-uniform bays — comparing to raw cumFrac was off by the margin)
  const near = (fn, len, v) => {
    let bi = 0,
      bd = 1e9;
    for (let i = 0; i < len; i++) {
      const d = Math.abs(fn(i) - v);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  };
  return [near(colX, C.length, p.x || 0), near(rowY, R.length, p.y || 0)];
}
function pinToEmbed(key, p) {
  const C = gridCols(),
    R = gridRows();
  const [ci, ri] = gridIdx(p);
  const knife = !!p.knifePlate; // attribute: is there a knife plate at this anchor?
  const stub = !!p.stubColumn; // attribute: is there a stub column here?
  const tp = EMBED_TYPES[0]; // every pin is an anchor bolt
  const seq = p.sequence || '1',
    phase = p.phase || '1',
    area = p.area || areaFor(ci, ri);
  const at = p.installedAt ? typeof p.installedAt === 'number' ? new Date(p.installedAt).toISOString().slice(0, 10) : p.installedAt : null;
  const dat = p.deliveredAt ? typeof p.deliveredAt === 'number' ? new Date(p.deliveredAt).toISOString().slice(0, 10) : p.deliveredAt : null;
  const sdat = p.stubDeliveredAt ? typeof p.stubDeliveredAt === 'number' ? new Date(p.stubDeliveredAt).toISOString().slice(0, 10) : p.stubDeliveredAt : null;
  // manually-placed pins (exact:true) land exactly where dropped; bulk-extracted pins snap to the grid
  const clamp01 = v => +Math.max(0, Math.min(1, v || 0)).toFixed(4);
  const nx = p.exact ? clamp01(p.x) : +colX(ci).toFixed(4);
  const ny = p.exact ? clamp01(p.y) : +rowY(ri).toFixed(4);
  return {
    id: key,
    mark: p.embedId || '—',
    type: tp.key,
    typeLabel: tp.label,
    code: tp.code,
    grid: `${C[ci]}-${R[ri]}`,
    nx,
    ny,
    sequence: seq,
    phase,
    area,
    pour: p.pour || `${area}·P${seq}`,
    installed: !!p.installed,
    hasKnife: knife,
    hasStub: stub,
    stubType: p.stubType || '',
    nextPour: !!p.nextPour,
    installedAt: at,
    installedBy: p.installedBy || null,
    note: p.note || '',
    delivery: p.delivery || 'none',
    // delivery-to-site status (see deliveryState)
    deliveredAt: dat,
    deliveredBy: p.deliveredBy || null,
    // when/who received it on site (set when marked delivered)
    stubDelivery: p.stubDelivery || 'none',
    // stub-column delivery, tracked apart from the bolt
    stubDeliveredAt: sdat,
    stubDeliveredBy: p.stubDeliveredBy || null
  };
}

/* default pre-pour checklist items (editable per pour) */
const PREPOUR_DEFAULT = ['Bill Carr Surveyors', 'SME Bill Carr', 'Temperature sensors installed', 'ACC pre-pour checklist', 'LADBS inspection', 'LADBS Soils Inspection', 'Twining', 'Batch plant', 'WSP'];
// stub-column type suggestions (free-text still allowed) — replace with the real list
const STUB_TYPES = [];
window.STUB_TYPES = STUB_TYPES;
window.PREPOUR_DEFAULT = PREPOUR_DEFAULT;

/* short date for labels: 'YYYY-MM-DD' -> 'Mon D' (e.g. 'Jun 12') */
function shortDate(d) {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] || '';
  return `${mo} ${+m[3]}`;
}
window.shortDate = shortDate;

/* ---- motivational remarks (shown after each tracked update) ---- */
const REMARKS = {
  install: ['Steel set. 🔩', 'Locked in — clean work.', "That one's in the concrete for good.", 'Bolt down, boss.', 'Another one buried — keep stacking.', 'Set & forget. Nice.'],
  uninstall: ['Backed it out — sort it and re-set.'],
  note: ['Note saved — good catch.', 'Logged it for the crew.', 'Sharp eye — note on the board.'],
  delivery: ['Delivery logged. 🚚', 'Steel tracked to site.', 'Updated the delivery board.', 'Material status set.'],
  zone: ["Zone tagged — crew's aligned.", 'Bulk move. Efficient.'],
  seqdone: ['Pour wrapped — green across the board! 🟢', 'Sequence complete. On to the next.'],
  edit: ['Updated.', 'Logged.', 'Got it.']
};
function remarkFor(kind) {
  const a = REMARKS[kind] || REMARKS.edit;
  return a[Math.floor(Math.random() * a.length)];
}
Object.assign(window, {
  pinToEmbed,
  gridIdx,
  remarkFor,
  REMARKS
});

/* ---- per-mark × per-sequence breakdown (anchor bolts in each sequence) ---- */
function embedsBySequence(embeds) {
  const seqs = SEQUENCES; // ['CUP','1','2','3','4']
  const byMark = {};
  embeds.forEach(e => {
    const m = byMark[e.mark] || (byMark[e.mark] = {
      mark: e.mark,
      desc: e.typeLabel,
      total: 0,
      inst: 0,
      seq: {}
    });
    seqs.forEach(s => {
      if (!m.seq[s]) m.seq[s] = {
        pinned: 0,
        inst: 0
      };
    });
    if (!m.seq[e.sequence]) m.seq[e.sequence] = {
      pinned: 0,
      inst: 0
    };
    m.seq[e.sequence].pinned++;
    m.total++;
    if (e.installed) {
      m.seq[e.sequence].inst++;
      m.inst++;
    }
  });
  const marks = Object.values(byMark).sort((a, b) => String(a.mark).localeCompare(String(b.mark), undefined, {
    numeric: true
  }));
  const seqTotals = {};
  seqs.forEach(s => seqTotals[s] = {
    pinned: 0,
    inst: 0
  });
  marks.forEach(m => seqs.forEach(s => {
    const c = m.seq[s] || {
      pinned: 0,
      inst: 0
    };
    seqTotals[s].pinned += c.pinned;
    seqTotals[s].inst += c.inst;
  }));
  return {
    seqs,
    marks,
    seqTotals
  };
}
window.embedsBySequence = embedsBySequence;

/* ---- install summary by sequence (count placed / installed / remaining / %) ---- */
function seqSummary(embeds) {
  const rows = SEQUENCES.map(s => {
    const list = embeds.filter(e => e.sequence === s);
    const placed = list.length,
      installed = list.filter(e => e.installed).length;
    return {
      seq: s,
      placed,
      installed,
      remaining: placed - installed,
      pct: placed ? Math.round(installed / placed * 100) : 0
    };
  });
  const t = rows.reduce((a, r) => ({
    placed: a.placed + r.placed,
    installed: a.installed + r.installed
  }), {
    placed: 0,
    installed: 0
  });
  return {
    rows,
    total: {
      ...t,
      remaining: t.placed - t.installed,
      pct: t.placed ? Math.round(t.installed / t.placed * 100) : 0
    }
  };
}
window.seqSummary = seqSummary;

/* ---- delivery summary by sequence (placed / delivered / in-transit / not-delivered / %) ---- */
function deliverySummary(embeds) {
  const rows = SEQUENCES.map(s => {
    const list = embeds.filter(e => e.sequence === s);
    const placed = list.length;
    const delivered = list.filter(e => deliveryState(e) === 'delivered').length;
    const transit = list.filter(e => deliveryState(e) === 'transit').length;
    return {
      seq: s,
      placed,
      delivered,
      transit,
      none: placed - delivered - transit,
      pct: placed ? Math.round(delivered / placed * 100) : 0
    };
  });
  const t = rows.reduce((a, r) => ({
    placed: a.placed + r.placed,
    delivered: a.delivered + r.delivered,
    transit: a.transit + r.transit
  }), {
    placed: 0,
    delivered: 0,
    transit: 0
  });
  return {
    rows,
    total: {
      ...t,
      none: t.placed - t.delivered - t.transit,
      pct: t.placed ? Math.round(t.delivered / t.placed * 100) : 0
    }
  };
}
window.deliverySummary = deliverySummary;

// installed-over-time series (cumulative) for the dashboard chart
function installSeries(embeds) {
  const counts = {};
  for (const e of embeds) if (e.installed && e.installedAt) counts[e.installedAt] = (counts[e.installedAt] || 0) + 1;
  const days = Object.keys(counts).sort();
  let cum = 0;
  return days.map(d => ({
    date: d,
    day: +d.slice(8),
    n: counts[d],
    cum: cum += counts[d]
  }));
}
Object.assign(window, {
  CREW,
  EMBED_TYPES,
  SEQUENCES,
  PHASES,
  AREAS,
  GRID_COLS,
  GRID_ROWS,
  PLAN,
  pinState,
  deliveryState,
  stubDeliveryState,
  siteDeliveryState,
  receivedAt,
  kpis,
  installSeries,
  colX,
  rowY,
  setGridCfg,
  gridCols,
  gridRows,
  gridPlan,
  cumFrac
});