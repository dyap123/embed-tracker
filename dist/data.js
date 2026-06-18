/* EmbedYap — mock data layer
   Shapes mirror a Firebase collection so a real data layer drops in cleanly.
   Embeds carry normalized coords (nx,ny in 0..1) over the blueprint image. */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

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
function pickWeighted(rng, items) {
  let r = rng();
  for (const it of items) {
    if ((r -= it.w) <= 0) return it;
  }
  return items[items.length - 1];
}

// area by quadrant of the plan; pour ties sequence to a concrete placement
function areaFor(cx, cy) {
  const left = cx < (GRID_COLS.length - 1) / 2;
  const top = cy < (GRID_ROWS.length - 1) / 2;
  if (top && left) return 'A';
  if (top && !left) return 'B';
  if (!top && left) return 'C';
  return 'D';
}
// progressively less complete A→D so the dashboard tells a story
const AREA_PROGRESS = {
  A: 0.86,
  B: 0.62,
  C: 0.40,
  D: 0.17
};
function buildEmbeds() {
  const rng = mulberry32(20260603);
  const out = [];
  let n = {};
  for (let ci = 0; ci < GRID_COLS.length; ci++) {
    for (let ri = 0; ri < GRID_ROWS.length; ri++) {
      // skip roughly half the intersections to leave aisles / openings (~340 pins)
      if (rng() < 0.48) continue;
      const area = areaFor(ci, ri);
      const tp = pickWeighted(rng, EMBED_TYPES);
      const jx = (rng() - 0.5) * 0.018,
        jy = (rng() - 0.5) * 0.020;
      const nx = colX(ci) + jx,
        ny = rowY(ri) + jy;
      const code = tp.code;
      n[code] = (n[code] || 0) + 1;
      const id = `${code}-${String(n[code]).padStart(3, '0')}`;
      const sequence = SEQUENCES[Math.floor(rng() * SEQUENCES.length)];
      const phase = PHASES[Math.min(3, Math.floor(rng() * 4))];
      const installed = rng() < AREA_PROGRESS[area];
      const hasKnife = tp.key === 'knife' || rng() < 0.10;
      const hasStub = tp.key === 'stub' || rng() < 0.08;
      out.push({
        id,
        type: tp.key,
        typeLabel: tp.label,
        code,
        grid: `${GRID_COLS[ci]}-${GRID_ROWS[ri]}`,
        nx: +nx.toFixed(4),
        ny: +ny.toFixed(4),
        sequence,
        phase,
        area,
        pour: `${area}·P${sequence}`,
        installed,
        hasKnife,
        hasStub,
        installedAt: installed ? dayOffset(rng) : null,
        rfi: null
      });
    }
  }
  return out;
}
function dayOffset(rng) {
  // a date within the last ~40 days
  const d = new Date(2026, 4, 3);
  d.setDate(d.getDate() - Math.floor(rng() * 40));
  return d.toISOString().slice(0, 10);
}
let EMBEDS = buildEmbeds();

// attach a handful of RFIs
const RFI_SEED = [{
  status: 'Open',
  description: 'Anchor pattern conflicts with PT tendon at column. Need revised bolt layout from EOR.',
  links: [{
    label: 'RFI-218 · BIM 360',
    url: 'https://acc.autodesk.com/rfi/218'
  }]
}, {
  status: 'Answered',
  description: 'Knife plate slot orientation — confirm rotation 90° per detail 7/S-501.',
  links: [{
    label: 'Detail 7/S-501',
    url: 'https://drive.google.com/file/d/1abc'
  }, {
    label: 'RFI-204',
    url: 'https://acc.autodesk.com/rfi/204'
  }]
}, {
  status: 'Closed',
  description: 'Embed post elevation revised +1.5" to match topping slab. Resolved in field.',
  links: []
}, {
  status: 'Open',
  description: 'Coupler thread spec mismatch with rebar submittal — hold pour until verified.',
  links: [{
    label: 'Submittal 03-21',
    url: 'https://drive.google.com/file/d/2def'
  }]
}, {
  status: 'Open',
  description: 'Stub column baseplate weld access tight against form. Requesting clarification.',
  links: [{
    label: 'Photo set',
    url: 'https://drive.google.com/drive/folders/3ghi'
  }]
}];
(function seedRFI() {
  const rng = mulberry32(7);
  let assigned = 0;
  for (const e of EMBEDS) {
    if (assigned >= RFI_SEED.length) break;
    if (rng() < 0.03) {
      const s = RFI_SEED[assigned];
      e.rfi = {
        number: `RFI-${218 - assigned}`,
        ...s
      };
      assigned++;
    }
  }
})();

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

// ---- inventory ----------------------------------------------------------
function buildInventory() {
  const by = {};
  for (const t of EMBED_TYPES) by[t.key] = {
    type: t.label,
    code: t.code,
    pinned: 0,
    installed: 0
  };
  for (const e of EMBEDS) {
    by[e.type].pinned++;
    if (e.installed) by[e.type].installed++;
  }
  const expected = {
    anchor: 430,
    knife: 230,
    post: 170,
    coupler: 150,
    stub: 110
  };
  return EMBED_TYPES.map(t => {
    const row = by[t.key];
    const exp = expected[t.key];
    return {
      ...row,
      expected: exp,
      remaining: exp - row.installed
    };
  });
}
const INVENTORY = buildInventory();

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
// date an embed was received on site — its explicit delivered date, or (for already-installed pins) the install date
function receivedAt(e) {
  return e.deliveredAt || (e.installed ? e.installedAt : null);
}
function kpis(embeds) {
  const pinned = embeds.length;
  const installed = embeds.filter(e => e.installed).length;
  const expected = pinned; // real takeoff: every embed is pinned
  const openRFI = embeds.filter(e => e.rfi && e.rfi.status === 'Open').length;
  return {
    expected,
    pinned,
    installed,
    pct: pinned ? Math.round(installed / pinned * 100) : 0,
    openRFI
  };
}

/* ---- Firebase pin → design embed shape (real extracted data) ----------
   Firebase `pins` carry {embedId(mark), x,y(0..1), sequence, area, installed,
   knifePlate, installedAt, rfi}. Map each onto the editable blueprint grid
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
    rfi: p.rfi || null,
    delivery: p.delivery || 'none',
    // delivery-to-site status (see deliveryState)
    deliveredAt: dat,
    deliveredBy: p.deliveredBy || null // when/who received it on site (set when marked delivered)
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
  rfi: ['RFI flagged — good catch.', 'Question logged. Saves a callback.', 'Sharp eye — RFI on the board.'],
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
const POURS = [{
  id: 'B·P2',
  area: 'B',
  seq: '2',
  date: '2026-06-05',
  label: 'Area B · Pour 2',
  embeds: 0
}, {
  id: 'C·P1',
  area: 'C',
  seq: '1',
  date: '2026-06-09',
  label: 'Area C · Pour 1',
  embeds: 0
}, {
  id: 'D·P1',
  area: 'D',
  seq: '1',
  date: '2026-06-14',
  label: 'Area D · Pour 1',
  embeds: 0
}];
POURS.forEach(p => {
  p.embeds = EMBEDS.filter(e => e.area === p.area && e.sequence === p.seq && !e.installed).length;
});
Object.assign(window, {
  EMBEDS,
  CREW,
  INVENTORY,
  EMBED_TYPES,
  SEQUENCES,
  PHASES,
  AREAS,
  GRID_COLS,
  GRID_ROWS,
  PLAN,
  POURS,
  pinState,
  deliveryState,
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