/* EmbedYap — mock data layer
   Shapes mirror a Firebase collection so a real data layer drops in cleanly.
   Embeds carry normalized coords (nx,ny in 0..1) over the blueprint image. */

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---- column grid (A–Z left→right, rows 33→8 top→bottom) -----------
const GRID_COLS = Array.from({length:26}, (_,i)=>String.fromCharCode(65+i)); // A..Z
const GRID_ROWS = [];
for (let r = 33; r >= 8; r--) GRID_ROWS.push(String(r));               // 33 (top) -> 8 (bottom)

// plan occupies this region inside the blueprint image
const PLAN = { x0: 0.085, x1: 0.945, y0: 0.10, y1: 0.93 };

/* ---- live, editable grid config (persisted to Firebase `grid`) --------
   GRID_CFG = { cols:[labels], rows:[labels], colW:[bay weights], rowH:[bay weights], plan:{x0,x1,y0,y1} }
   When null we fall back to the uniform A–Z / 33–8 default above. */
let GRID_CFG = null;
function setGridCfg(cfg){ GRID_CFG = (cfg && cfg.cols && cfg.rows) ? cfg : null; }
function gridCols(){ return (GRID_CFG && GRID_CFG.cols) || GRID_COLS; }
function gridRows(){ return (GRID_CFG && GRID_CFG.rows) || GRID_ROWS; }
function gridPlan(){ return (GRID_CFG && GRID_CFG.plan) || PLAN; }
// cumulative 0..1 positions for n gridlines given (n-1) bay weights; uniform if absent
function cumFrac(weights, n){
  if (n<=1) return [0];
  if (!weights || weights.length !== n-1) return Array.from({length:n},(_,i)=>i/(n-1));
  const tot = weights.reduce((a,b)=>a+(+b||0),0) || 1; let acc=0; const out=[0];
  for (let i=0;i<weights.length;i++){ acc+=(+weights[i]||0); out.push(acc/tot); }
  return out;
}
function colX(i){ const c=gridCols(), pl=gridPlan(); const f=cumFrac(GRID_CFG&&GRID_CFG.colW, c.length); return pl.x0 + (pl.x1-pl.x0)*(f[i]!=null?f[i]:0); }
function rowY(i){ const r=gridRows(), pl=gridPlan(); const f=cumFrac(GRID_CFG&&GRID_CFG.rowH, r.length); return pl.y0 + (pl.y1-pl.y0)*(f[i]!=null?f[i]:0); }

const EMBED_TYPES = [
  { key:'anchor',  code:'AR', label:'Anchor rod',  w:0.40 },
  { key:'knife',   code:'KP', label:'Knife plate', w:0.20 },
  { key:'post',    code:'EP', label:'Embed post',  w:0.16 },
  { key:'coupler', code:'CP', label:'Coupler',     w:0.14 },
  { key:'stub',    code:'SC', label:'Stub column', w:0.10 },
];
const SEQUENCES = ['CUP','1','2','3','4'];
const AREAS = ['A','B','C','D'];

function pickWeighted(rng, items){ let r=rng(); for(const it of items){ if((r-=it.w)<=0) return it; } return items[items.length-1]; }

// area by quadrant of the plan; pour ties sequence to a concrete placement
function areaFor(cx, cy){
  const left = cx < (GRID_COLS.length-1)/2;
  const top  = cy < (GRID_ROWS.length-1)/2;
  if (top && left) return 'A';
  if (top && !left) return 'B';
  if (!top && left) return 'C';
  return 'D';
}
// progressively less complete A→D so the dashboard tells a story
const AREA_PROGRESS = { A:0.86, B:0.62, C:0.40, D:0.17 };

function buildEmbeds(){
  const rng = mulberry32(20260603);
  const out = [];
  let n = {};
  for (let ci=0; ci<GRID_COLS.length; ci++){
    for (let ri=0; ri<GRID_ROWS.length; ri++){
      // skip roughly half the intersections to leave aisles / openings (~340 pins)
      if (rng() < 0.48) continue;
      const area = areaFor(ci, ri);
      const tp = pickWeighted(rng, EMBED_TYPES);
      const jx = (rng()-0.5)*0.018, jy=(rng()-0.5)*0.020;
      const nx = colX(ci)+jx, ny = rowY(ri)+jy;
      const code = tp.code;
      n[code] = (n[code]||0)+1;
      const id = `${code}-${String(n[code]).padStart(3,'0')}`;
      // sequence: core (CUP) near middle rows, phasing outward
      const band = ri/(GRID_ROWS.length-1);
      let sequence;
      if (band>0.40 && band<0.60 && ci>8 && ci<17) sequence='CUP';
      else sequence = SEQUENCES[1 + Math.min(3, Math.floor(rng()*4))];
      const installed = rng() < AREA_PROGRESS[area];
      const hasKnife = tp.key==='knife' || rng() < 0.10;
      out.push({
        id, type: tp.key, typeLabel: tp.label, code,
        grid: `${GRID_COLS[ci]}-${GRID_ROWS[ri]}`,
        nx:+nx.toFixed(4), ny:+ny.toFixed(4),
        sequence, area, pour: `${area}${sequence==='CUP'?'·CUP':'·P'+sequence}`,
        installed, hasKnife,
        installedAt: installed ? dayOffset(rng) : null,
        rfi: null,
      });
    }
  }
  return out;
}
function dayOffset(rng){ // a date within the last ~40 days
  const d = new Date(2026,4,3); d.setDate(d.getDate() - Math.floor(rng()*40)); return d.toISOString().slice(0,10);
}

let EMBEDS = buildEmbeds();

// attach a handful of RFIs
const RFI_SEED = [
  { status:'Open',     description:'Anchor pattern conflicts with PT tendon at column. Need revised bolt layout from EOR.', links:[{label:'RFI-218 · BIM 360', url:'https://acc.autodesk.com/rfi/218'}] },
  { status:'Answered', description:'Knife plate slot orientation — confirm rotation 90° per detail 7/S-501.', links:[{label:'Detail 7/S-501', url:'https://drive.google.com/file/d/1abc'},{label:'RFI-204', url:'https://acc.autodesk.com/rfi/204'}] },
  { status:'Closed',   description:'Embed post elevation revised +1.5" to match topping slab. Resolved in field.', links:[] },
  { status:'Open',     description:'Coupler thread spec mismatch with rebar submittal — hold pour until verified.', links:[{label:'Submittal 03-21', url:'https://drive.google.com/file/d/2def'}] },
  { status:'Open',     description:'Stub column baseplate weld access tight against form. Requesting clarification.', links:[{label:'Photo set', url:'https://drive.google.com/drive/folders/3ghi'}] },
];
(function seedRFI(){
  const rng = mulberry32(7); let assigned=0;
  for (const e of EMBEDS){ if(assigned>=RFI_SEED.length) break; if(rng()<0.03){ const s=RFI_SEED[assigned]; e.rfi={ number:`RFI-${218-assigned}`, ...s }; assigned++; } }
})();

// ---- crew ---------------------------------------------------------------
const CREW = [
  { id:'danzel', name:'Danzel Yap',     role:'PWJV · The GOAT 🐐',  pin:'050103', initials:'DY', installs:0, points:0, manager:true, goat:true },
  { id:'misael', name:'Misael Iniguez', role:"PWJV · Danzel's boss", pin:'050103', initials:'MI', installs:0, points:0, manager:true },
  { id:'kate',   name:'Kate Schuck',    role:'APM · PWJV',          pin:null,     initials:'KS', installs:0, points:0 },
  { id:'moises', name:'Moises Zuniga',  role:'PE · PWJV',           pin:null,     initials:'MZ', installs:0, points:0 },
  { id:'freddy', name:'Freddy',         role:'PE · SME',            pin:null,     initials:'FR', installs:0, points:0 },
];

// ---- inventory ----------------------------------------------------------
function buildInventory(){
  const by = {};
  for (const t of EMBED_TYPES) by[t.key]={ type:t.label, code:t.code, pinned:0, installed:0 };
  for (const e of EMBEDS){ by[e.type].pinned++; if(e.installed) by[e.type].installed++; }
  const expected = { anchor:430, knife:230, post:170, coupler:150, stub:110 };
  return EMBED_TYPES.map(t=>{
    const row = by[t.key]; const exp = expected[t.key];
    return { ...row, expected: exp, remaining: exp - row.installed };
  });
}
const INVENTORY = buildInventory();

// ---- derived helpers ----------------------------------------------------
function pinState(e, currentSeq){
  if (e.installed) return 'installed';
  if (e.nextPour) return 'next';                                  // pink — tagged as next pour (via a zone)
  if (currentSeq && e.sequence === currentSeq) return 'current';  // yellow — current sequence
  return 'todo';                                  // knife plate is an attribute (e.hasKnife), not a status
}
function kpis(embeds){
  const pinned = embeds.length;
  const installed = embeds.filter(e=>e.installed).length;
  const expected = pinned;                                  // real takeoff: every embed is pinned
  const openRFI = embeds.filter(e=>e.rfi && e.rfi.status==='Open').length;
  return { expected, pinned, installed, pct: pinned?Math.round(installed/pinned*100):0, openRFI };
}

/* ---- Firebase pin → design embed shape (real extracted data) ----------
   Firebase `pins` carry {embedId(mark), x,y(0..1), sequence, area, installed,
   knifePlate, installedAt, rfi}. Map each onto the editable blueprint grid
   (best-effort by relative position). */
function gridIdx(p){
  const C=gridCols(), R=gridRows();
  // snap to nearest gridline by the (possibly non-uniform) bay positions
  const fc=cumFrac(GRID_CFG&&GRID_CFG.colW, C.length), fr=cumFrac(GRID_CFG&&GRID_CFG.rowH, R.length);
  const near=(arr,v)=>{ let bi=0,bd=1e9; for(let i=0;i<arr.length;i++){ const d=Math.abs(arr[i]-v); if(d<bd){bd=d;bi=i;} } return bi; };
  return [ near(fc, p.x||0), near(fr, p.y||0) ];
}
function pinToEmbed(key, p){
  const C=gridCols(), R=gridRows();
  const [ci, ri] = gridIdx(p);
  const knife = !!p.knifePlate;                              // attribute: is there a knife plate at this anchor?
  const tp = EMBED_TYPES[0];                                 // every pin is an anchor bolt
  const seq = p.sequence || 'CUP', area = p.area || areaFor(ci, ri);
  const at = p.installedAt ? (typeof p.installedAt==='number' ? new Date(p.installedAt).toISOString().slice(0,10) : p.installedAt) : null;
  // manually-placed pins (exact:true) land exactly where dropped; bulk-extracted pins snap to the grid
  const clamp01 = v => +Math.max(0,Math.min(1,v||0)).toFixed(4);
  const nx = p.exact ? clamp01(p.x) : +colX(ci).toFixed(4);
  const ny = p.exact ? clamp01(p.y) : +rowY(ri).toFixed(4);
  return {
    id: key, mark: p.embedId || '—', type: tp.key, typeLabel: tp.label, code: tp.code,
    grid: `${C[ci]}-${R[ri]}`, nx, ny,
    sequence: seq, area, pour: p.pour || `${area}·${seq==='CUP'?'CUP':'P'+seq}`,
    installed: !!p.installed, hasKnife: knife, nextPour: !!p.nextPour, installedAt: at, rfi: p.rfi || null,
  };
}

/* ---- motivational remarks (shown after each tracked update) ---- */
const REMARKS = {
  install:  ['Steel set. 🔩', 'Locked in — clean work.', "That one's in the concrete for good.", 'Bolt down, boss.', 'Another one buried — keep stacking.', 'Set & forget. Nice.'],
  uninstall:['Backed it out — sort it and re-set.'],
  rfi:      ['RFI flagged — good catch.', 'Question logged. Saves a callback.', 'Sharp eye — RFI on the board.'],
  zone:     ["Zone tagged — crew's aligned.", 'Bulk move. Efficient.'],
  seqdone:  ['Pour wrapped — green across the board! 🟢', 'Sequence complete. On to the next.'],
  edit:     ['Updated.', 'Logged.', 'Got it.'],
};
function remarkFor(kind){ const a = REMARKS[kind] || REMARKS.edit; return a[Math.floor(Math.random()*a.length)]; }

Object.assign(window, { pinToEmbed, gridIdx, remarkFor, REMARKS });

// installed-over-time series (cumulative) for the dashboard chart
function installSeries(embeds){
  const counts = {};
  for (const e of embeds) if(e.installed && e.installedAt) counts[e.installedAt]=(counts[e.installedAt]||0)+1;
  const days = Object.keys(counts).sort();
  let cum=0; return days.map(d=>({ date:d, day:+d.slice(8), n:counts[d], cum:(cum+=counts[d]) }));
}

const POURS = [
  { id:'B·P2', area:'B', seq:'2', date:'2026-06-05', label:'Area B · Pour 2', embeds:0 },
  { id:'C·P1', area:'C', seq:'1', date:'2026-06-09', label:'Area C · Pour 1', embeds:0 },
  { id:'D·P1', area:'D', seq:'1', date:'2026-06-14', label:'Area D · Pour 1', embeds:0 },
];
POURS.forEach(p=>{ p.embeds = EMBEDS.filter(e=>e.area===p.area && e.sequence===p.seq && !e.installed).length; });

Object.assign(window, {
  EMBEDS, CREW, INVENTORY, EMBED_TYPES, SEQUENCES, AREAS, GRID_COLS, GRID_ROWS, PLAN, POURS,
  pinState, kpis, installSeries, colX, rowY,
  setGridCfg, gridCols, gridRows, gridPlan, cumFrac,
});
