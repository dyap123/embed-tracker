/* ====================================================================
   OpenEmbed — LACC embed install tracker.
   Interactive plan-map (the SME drawing PNGs) with placeable, colour-coded
   embed pins. Tap a pin to check off the install or attach an RFI. Embed
   master is seeded once into Firebase; the crew signs in (roster + PIN) and
   earns points → leaderboard + Dino arcade. Shares the Firebase project with
   OpenBreak / CUP (namespace 'embed-tracker').
==================================================================== */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ---- built-in embed master (seeded into Firebase on first run) ----
   From the LACC embed takeoff. seq: 'CUP'(=0) | '1'..'4'. qty = pieces. */
const SEED_EMBEDS = [
  // ---- CUP / Sequence 0 ----
  { id: '51A', seq: 'CUP', desc: 'CUP Foundation Anchor Rod', qty: 4,  bolts: 4, len: 25, plate: 'SP-13' },
  { id: '52A', seq: 'CUP', desc: 'CUP Foundation Anchor Rod', qty: 26, bolts: 4, len: 16, plate: 'SP-14' },
  { id: '53A', seq: 'CUP', desc: 'CUP Foundation Anchor Rod', qty: 1,  bolts: 6, len: 34, plate: 'SP-15' },
  { id: '56A', seq: 'CUP', desc: 'CUP Foundation Anchor Rod', qty: 3,  bolts: 4, len: 16, plate: 'SP-14' },
  { id: '57A', seq: 'CUP', desc: 'CUP Foundation Anchor Rod', qty: 1,  bolts: 4, len: 16, plate: 'SP-14' },
  { id: '86A', seq: 'CUP', desc: 'Additional Anchor Rod',     qty: 1,  bolts: 6, len: 31, plate: 'SP-20' },
  { id: '87A', seq: 'CUP', desc: 'Additional Anchor Rod',     qty: 1,  bolts: 6, len: 31, plate: 'SP-20' },
  { id: '88A', seq: 'CUP', desc: 'Additional Anchor Rod',     qty: 1,  bolts: 6, len: 31, plate: 'SP-20' },
  { id: '89A', seq: 'CUP', desc: 'Additional Anchor Rod',     qty: 1,  bolts: 6, len: 31, plate: 'SP-20' },
  { id: '90A', seq: 'CUP', desc: 'Embed Post — W14X605',      qty: 1,  bolts: 0, len: 22, plate: '' },
  // ---- Sequence 1 ----
  { id: '201A', seq: '1', desc: 'Knife Plate Embed', qty: 13, bolts: 4, len: 18, plate: 'KP-1' },
  { id: '206A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-1' },
  { id: '207A', seq: '1', desc: 'Knife Plate Embed', qty: 2,  bolts: 4, len: 18, plate: 'KP-1' },
  { id: '212A', seq: '1', desc: 'Knife Plate Embed', qty: 2,  bolts: 4, len: 18, plate: 'KP-2' },
  { id: '217A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-2' },
  { id: '218A', seq: '1', desc: 'Knife Plate Embed', qty: 14, bolts: 4, len: 18, plate: 'KP-2' },
  { id: '220A', seq: '1', desc: 'Knife Plate Embed', qty: 6,  bolts: 4, len: 18, plate: 'KP-3' },
  { id: '224A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-3' },
  { id: '228A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-3' },
  { id: '231A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-4' },
  { id: '232A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-4' },
  { id: '255A', seq: '1', desc: 'Knife Plate Embed', qty: 3,  bolts: 4, len: 18, plate: 'KP-4' },
  { id: '257A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-5' },
  { id: '267A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-5' },
  { id: '271A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-5' },
  { id: '289A', seq: '1', desc: 'Knife Plate Embed', qty: 1,  bolts: 4, len: 18, plate: 'KP-5' },
];
const SEQS = ['CUP', '1', '2', '3', '4'];
const MAPS = [
  { id: 'anchor', label: 'Anchor Bolt Map', src: 'assets/maps/anchor-bolt.png' },
  { id: 'knife', label: 'Knife Plate Map', src: 'assets/maps/knife-plate.png' },
];
const AREA_HUE = { A: 155, B: 70, C: 205, D: 290 };           // green / amber / cyan / violet
const SEQ_ORDER = ['CUP', '1', '2', '3', '4'];
/* Pin colour per the field scheme:
   installed → GREEN · knife plate → BLUE · a later (next) sequence → YELLOW ·
   otherwise (still to install in the current sequence) → RED. */
function pinColor(p, activeSeq) {
  if (p.installed) return { c: 'oklch(.78 .16 152)', label: 'Installed' };
  if (p.knifePlate) return { c: 'oklch(.70 .15 250)', label: 'Has knife plate' };
  if (SEQ_ORDER.indexOf(p.sequence) > SEQ_ORDER.indexOf(activeSeq)) return { c: 'oklch(.85 .16 88)', label: 'Next sequence (Seq ' + p.sequence + ')' };
  return { c: 'oklch(.62 .22 25)', label: 'To install' };
}
const pid = () => 'P' + Math.random().toString(36).slice(2, 9);
const now = () => Date.now();
const dayOf = (ms) => ms ? new Date(ms).toISOString().slice(0, 10) : '';
const today = () => new Date().toISOString().slice(0, 10);

/* installs grouped by calendar day → [{date, count, cumulative}] */
function installsByDate(pins) {
  const m = {};
  pins.filter((p) => p.installed && p.installedAt).forEach((p) => { const d = dayOf(p.installedAt); m[d] = (m[d] || 0) + 1; });
  let cum = 0;
  return Object.keys(m).sort().map((d) => { cum += m[d]; return { date: d, count: m[d], cumulative: cum }; });
}

/* ---- Excel export: progress workbook (Embeds / By Date / By Type) ---- */
function exportExcel(pins) {
  const XLSX = window.XLSX; const wb = XLSX.utils.book_new();
  const pinRows = pins.map((p) => ({
    Embed: p.embedId, Sequence: p.sequence, Area: p.area || '', Map: p.mapId,
    Installed: p.installed ? 'YES' : '', 'Installed By': p.installedBy || '', 'Installed Date': dayOf(p.installedAt),
    'Knife Plate': p.knifePlate ? 'YES' : '', RFI: p.rfi ? (p.rfi.number || 'Y') : '', 'RFI Status': p.rfi ? p.rfi.status : '', Notes: p.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pinRows), 'Embeds');
  const dr = installsByDate(pins).map((r) => ({ Date: r.date, 'Installed (day)': r.count, 'Cumulative': r.cumulative }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dr.length ? dr : [{ Date: '(none yet)', 'Installed (day)': 0, Cumulative: 0 }]), 'By Date');
  const t = {}; pins.forEach((p) => { const v = t[p.embedId] || (t[p.embedId] = { q: 0, i: 0 }); v.q++; if (p.installed) v.i++; });
  const tr = Object.keys(t).sort().map((k) => ({ Type: k, Pinned: t[k].q, Installed: t[k].i, Remaining: t[k].q - t[k].i }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tr), 'By Type');
  XLSX.writeFile(wb, 'OpenEmbed_progress_' + today() + '.xlsx');
}

/* ---- PDF export: dated progress summary ---- */
function exportPDF(pins) {
  const { jsPDF } = window.jspdf; const doc = new jsPDF();
  const total = pins.length, inst = pins.filter((p) => p.installed).length, kp = pins.filter((p) => p.knifePlate).length, rfi = pins.filter((p) => p.rfi).length;
  doc.setFontSize(17); doc.setTextColor(20); doc.text('OpenEmbed — Embed Install Progress', 14, 18);
  doc.setFontSize(10); doc.setTextColor(110); doc.text('As of ' + new Date().toLocaleString(), 14, 25);
  doc.setFontSize(12); doc.setTextColor(20);
  doc.text(`Installed ${inst} of ${total}  (${total ? Math.round(inst / total * 100) : 0}%)    Knife plates ${kp}    Open RFIs ${rfi}`, 14, 34);
  const dr = installsByDate(pins);
  doc.autoTable({ startY: 42, head: [['Date', 'Installed', 'Cumulative', '% complete']],
    body: (dr.length ? dr : [{ date: '(none yet)', count: 0, cumulative: 0 }]).map((r) => [r.date, r.count, r.cumulative, total ? Math.round(r.cumulative / total * 100) + '%' : '0%']),
    headStyles: { fillColor: [20, 30, 70] }, styles: { fontSize: 9 } });
  const bySeq = SEQS.map((s) => { const ps = pins.filter((p) => p.sequence === s); return [s, ps.length, ps.filter((p) => p.installed).length]; }).filter((r) => r[1]);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, head: [['Sequence', 'Pinned', 'Installed']], body: bySeq, headStyles: { fillColor: [20, 30, 70] }, styles: { fontSize: 9 } });
  doc.save('OpenEmbed_progress_' + today() + '.pdf');
}

/* ============================ APP ============================ */
function App() {
  const [users, setUsers] = useState({});
  const [embeds, setEmbeds] = useState({});
  const [pins, setPins] = useState({});
  const [zones, setZones] = useState({});
  const [currentId, setCurrentId] = useState(() => localStorage.getItem('oe_user') || null);
  const [view, setView] = useState('map');
  const [toast, setToast] = useState('');
  const [cupPour, setCupPour] = useState(null);

  // live Firebase subscriptions
  useEffect(() => {
    window.fb.listen('users', (v) => setUsers(v || {}));
    window.fb.listen('embeds', (v) => setEmbeds(v || {}));
    window.fb.listen('pins', (v) => setPins(v || {}));
    window.fb.listen('zones', (v) => setZones(v || {}));
    // read CUP's live pour (shared root paths) — best effort, read-only
    window.fb.rootGet('active-pour').then((v) => setCupPour(v)).catch(() => {});
  }, []);

  // one-time seed of the embed master + a mission manager
  useEffect(() => {
    window.fb.get('embeds').then((v) => {
      if (!v || !Object.keys(v).length) {
        SEED_EMBEDS.forEach((e) => window.fb.set('embeds/' + e.id, e));
      }
    });
    window.fb.get('users').then((v) => {
      const has = v && Object.values(v).some((u) => u && u.role === 'manager');
      if (!has) window.fb.set('users/danzel', { id: 'danzel', name: 'Danzel', role: 'manager', points: 0, dinoHi: 0, joined: now() });
    });
  }, []);

  const flash = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2400); }, []);

  const usersArr = useMemo(() => Object.values(users).filter(Boolean), [users]);
  const embedsArr = useMemo(() => Object.values(embeds).filter(Boolean).sort((a, b) => (a.id > b.id ? 1 : -1)), [embeds]);
  const pinsArr = useMemo(() => Object.entries(pins).map(([k, v]) => ({ ...v, key: k })).filter((p) => p && p.embedId), [pins]);
  const zonesArr = useMemo(() => Object.entries(zones).map(([k, v]) => ({ ...v, key: k })).filter(Boolean), [zones]);
  const currentUser = currentId ? users[currentId] : null;
  const isManager = currentUser && currentUser.role === 'manager';

  // auth actions
  const signIn = useCallback((id) => { setCurrentId(id); localStorage.setItem('oe_user', id); }, []);
  const signOut = useCallback(() => { setCurrentId(null); localStorage.removeItem('oe_user'); }, []);
  const addUser = useCallback((name) => {
    const id = 'u' + Math.random().toString(36).slice(2, 8);
    window.fb.set('users/' + id, { id, name, role: 'intern', points: 0, dinoHi: 0, joined: now() });
    signIn(id);
  }, [signIn]);
  const saveDinoHi = useCallback((s) => {
    if (!currentId) return;
    window.fb.max('users/' + currentId + '/dinoHi', s);
    if (window.OEGame && currentUser) window.OEGame.submit(currentUser, s);  // Ironworker Run backend
  }, [currentId, currentUser]);

  // pin mutations
  const addPin = useCallback((p) => { const key = pid(); window.fb.set('pins/' + key, { ...p, createdAt: now(), updatedAt: now() }); flash('Pin placed'); }, [flash]);
  const updatePin = useCallback((key, patch) => window.fb.update('pins/' + key, { ...patch, updatedAt: now() }), []);
  const removePin = useCallback((key) => window.fb.remove('pins/' + key), []);
  const addZone = useCallback((z) => { const key = 'Z' + Math.random().toString(36).slice(2, 9); window.fb.set('zones/' + key, { ...z, createdAt: now() }); return key; }, []);
  const updateZone = useCallback((key, patch) => window.fb.update('zones/' + key, patch), []);
  const removeZone = useCallback((key) => window.fb.remove('zones/' + key), []);
  const toggleInstall = useCallback((p) => {
    const installed = !p.installed;
    updatePin(p.key, { installed, status: installed ? 'installed' : (p.rfi ? 'rfi' : 'planned'), installedBy: installed ? (currentUser && currentUser.name) : null, installedAt: installed ? now() : null });
    if (installed && currentId) { window.fb.inc('users/' + currentId + '/points', 1); window.celebrate({ word: 'INSTALLED', sub: p.embedId }); }
    else if (!installed && currentId) window.fb.inc('users/' + currentId + '/points', -1);
  }, [updatePin, currentId, currentUser]);

  if (!currentId || !currentUser) return <window.AuthGate users={usersArr} onSignIn={signIn} onAddUser={addUser} />;

  return (
    <div className="oe">
      <Header view={view} setView={setView} user={currentUser} onSignOut={signOut} />
      <main className="oe-main">
        {view === 'map' && <MapTab embeds={embedsArr} pins={pinsArr} zones={zonesArr} isManager={isManager}
          onAddPin={addPin} onUpdatePin={updatePin} onRemovePin={removePin} onToggleInstall={toggleInstall}
          onAddZone={addZone} onUpdateZone={updateZone} onRemoveZone={removeZone} user={currentUser} flash={flash} />}
        {view === 'dash' && <Dashboard embeds={embedsArr} pins={pinsArr} cupPour={cupPour} />}
        {view === 'inv' && <Inventory embeds={embedsArr} pins={pinsArr} />}
        {view === 'crew' && <Crew users={usersArr} pins={pinsArr} currentUser={currentUser} onHi={saveDinoHi} />}
      </main>
      {toast && <div className="oe-toast glass">{toast}</div>}
      <AppStyle />
    </div>
  );
}

/* ---------------------------- Header / nav ---------------------------- */
function Header({ view, setView, user, onSignOut }) {
  const tabs = [['map', '🗺', 'Map'], ['dash', '▤', 'Dashboard'], ['inv', '▦', 'Inventory'], ['crew', '★', 'Crew']];
  return (
    <header className="oe-head glass">
      <div className="oe-brand"><span className="brand-mark"><span></span></span>
        <div><div className="oe-name disp">OpenEmbed</div><div className="oe-sub mono">LACC · embed install tracker</div></div>
      </div>
      <nav className="oe-tabs">
        {tabs.map(([id, ic, lab]) => (
          <button key={id} className={'oe-tab' + (view === id ? ' on' : '')} onClick={() => setView(id)}>
            <span className="oe-tab-ic">{ic}</span><span className="oe-tab-lab">{lab}</span>
          </button>
        ))}
      </nav>
      <div className="oe-who">
        <window.Avatar name={user.name} size={30} manager={user.role === 'manager'} />
        <div className="oe-who-info"><div className="oe-who-name">{user.name}</div><div className="oe-who-pts mono">{user.points || 0} pts</div></div>
        <button className="oe-out" onClick={onSignOut} title="Sign out">⏻</button>
      </div>
    </header>
  );
}

/* ---------------------------- MAP TAB ---------------------------- */
function MapTab({ embeds, pins, zones, isManager, onAddPin, onUpdatePin, onRemovePin, onToggleInstall, onAddZone, onUpdateZone, onRemoveZone, user, flash }) {
  const [mapId, setMapId] = useState('anchor');
  const [seqF, setSeqF] = useState('all');
  const [areaF, setAreaF] = useState('all');
  const [mode, setMode] = useState('view');           // view | place | zone
  const [placeEmbed, setPlaceEmbed] = useState(SEED_EMBEDS[0].id);
  const [placeArea, setPlaceArea] = useState('A');
  const [sel, setSel] = useState(null);                // selected pin key
  const [selZone, setSelZone] = useState(null);        // selected zone key
  const [activeSeq, setActiveSeq] = useState('1');     // current sequence; later seqs render yellow

  const wrapRef = useRef(null);
  const layerRef = useRef(null);
  const view = useRef({ s: 0.15, x: 40, y: 14 });      // scale + translate (px)
  const [, force] = useState(0);
  const drag = useRef(null);
  const previewRef = useRef(null);
  const zt = useRef(null);
  const reflow = () => { clearTimeout(zt.current); zt.current = setTimeout(() => force((n) => n + 1), 90); };

  const apply = () => { const l = layerRef.current; if (l) l.style.transform = `translate(${view.current.x}px,${view.current.y}px) scale(${view.current.s})`; };
  useEffect(apply);
  // fit the whole drawing to the viewport width (called on image load + reset)
  const fit = () => {
    const wrap = wrapRef.current, img = layerRef.current && layerRef.current.querySelector('img');
    if (!wrap || !img || !img.naturalWidth) return;
    const s = Math.min(wrap.clientWidth / img.naturalWidth, wrap.clientHeight / img.naturalHeight) * 0.97;
    view.current = { s, x: (wrap.clientWidth - img.naturalWidth * s) / 2, y: (wrap.clientHeight - img.naturalHeight * s) / 2 };
    apply(); force((n) => n + 1);
  };
  const imgRect = () => layerRef.current.querySelector('img').getBoundingClientRect();
  const norm = (cx, cy) => { const r = imgRect(); return [(cx - r.left) / r.width, (cy - r.top) / r.height]; };

  const mapPins = pins.filter((p) => p.mapId === mapId
    && (seqF === 'all' || p.sequence === seqF) && (areaF === 'all' || p.area === areaF));

  // wheel zoom around cursor
  const onWheel = (e) => {
    e.preventDefault();
    const r = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const v = view.current; const ns = Math.min(3, Math.max(0.05, v.s * (e.deltaY < 0 ? 1.12 : 0.89)));
    v.x = mx - (mx - v.x) * (ns / v.s); v.y = my - (my - v.y) * (ns / v.s); v.s = ns; apply(); reflow();
  };
  const setPreview = (x0, y0, x1, y1) => {
    const el = previewRef.current; if (!el) return;
    if (x0 == null) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = Math.min(x0, x1) * 100 + '%'; el.style.top = Math.min(y0, y1) * 100 + '%';
    el.style.width = Math.abs(x1 - x0) * 100 + '%'; el.style.height = Math.abs(y1 - y0) * 100 + '%';
  };
  const onDown = (e) => {
    if (mode === 'zone') { const [x, y] = norm(e.clientX, e.clientY); drag.current = { zone: true, x0: x, y0: y }; setPreview(x, y, x, y); return; }
    drag.current = { x: e.clientX, y: e.clientY, ox: view.current.x, oy: view.current.y, moved: 0 };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    if (drag.current.zone) { const [x, y] = norm(e.clientX, e.clientY); setPreview(drag.current.x0, drag.current.y0, x, y); return; }
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    view.current.x = drag.current.ox + dx; view.current.y = drag.current.oy + dy; apply();
  };
  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    if (d && d.zone) {
      setPreview(null);
      const [x1, y1] = norm(e.clientX, e.clientY);
      const x = Math.min(d.x0, x1), y = Math.min(d.y0, y1), w = Math.abs(x1 - d.x0), h = Math.abs(y1 - d.y0);
      if (w > 0.02 && h > 0.02) { const key = onAddZone({ mapId, x, y, w, h, area: 'A', sequence: '', pour: '', label: '' }); setMode('view'); setSelZone(key); }
      return;
    }
    if (!d || d.moved > 6) return;                     // was a pan, not a click
    if (mode !== 'place') return;
    const [x, y] = norm(e.clientX, e.clientY);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const em = embeds.find((z) => z.id === placeEmbed);
    onAddPin({ embedId: placeEmbed, sequence: em ? em.seq : 'CUP', area: placeArea, mapId, x, y, installed: false, status: 'planned' });
  };
  const zoom = (f) => { view.current.s = Math.min(3, Math.max(0.05, view.current.s * f)); apply(); reflow(); };
  const reset = () => fit();

  const selPin = sel ? pins.find((p) => p.key === sel) : null;
  const counts = { total: mapPins.length, installed: mapPins.filter((p) => p.installed).length, rfi: mapPins.filter((p) => p.rfi).length };

  return (
    <div className="map-tab">
      <div className="map-bar glass">
        <div className="mb-grp">
          {MAPS.map((m) => <button key={m.id} className={'chip' + (mapId === m.id ? ' on' : '')} onClick={() => setMapId(m.id)}>{m.label}</button>)}
        </div>
        <div className="mb-grp">
          <span className="mb-lab mono">SEQ</span>
          <button className={'chip sm' + (seqF === 'all' ? ' on' : '')} onClick={() => setSeqF('all')}>All</button>
          {SEQS.map((s) => <button key={s} className={'chip sm' + (seqF === s ? ' on' : '')} onClick={() => setSeqF(s)}>{s}</button>)}
        </div>
        <div className="mb-grp">
          <span className="mb-lab mono">AREA</span>
          <button className={'chip sm' + (areaF === 'all' ? ' on' : '')} onClick={() => setAreaF('all')}>All</button>
          {window.AREAS.map((a) => <button key={a} className={'chip sm area-' + a + (areaF === a ? ' on' : '')} onClick={() => setAreaF(a)} style={{ '--h': AREA_HUE[a] }}>{a}</button>)}
        </div>
        <div className="mb-grp"><span className="mb-lab mono">NOW</span>
          <select className="mb-sel" value={activeSeq} onChange={(e) => setActiveSeq(e.target.value)} title="Current sequence — later sequences show yellow">{SEQS.map((s) => <option key={s} value={s}>Seq {s}</option>)}</select></div>
        <div className="mb-spacer" />
        <div className="mb-legend mono">
          <span><i style={{ background: 'oklch(.78 .16 152)' }} />Installed</span>
          <span><i style={{ background: 'oklch(.62 .22 25)' }} />To install</span>
          <span><i style={{ background: 'oklch(.85 .16 88)' }} />Next seq</span>
          <span><i style={{ background: 'oklch(.70 .15 250)' }} />Knife plate</span>
        </div>
        <div className="mb-count mono">{counts.installed}/{counts.total} installed</div>
        {isManager && <button className={'chip' + (mode === 'place' ? ' on hot' : '')} onClick={() => setMode(mode === 'place' ? 'view' : 'place')}>{mode === 'place' ? '✓ Placing…' : '+ Pin'}</button>}
        {isManager && <button className={'chip' + (mode === 'zone' ? ' on hot' : '')} onClick={() => setMode(mode === 'zone' ? 'view' : 'zone')}>{mode === 'zone' ? '✓ Draw a box…' : '▭ Zone'}</button>}
      </div>

      {mode === 'place' && (
        <div className="place-bar glass">
          <span className="mono">Drop a pin →</span>
          <select value={placeEmbed} onChange={(e) => setPlaceEmbed(e.target.value)}>
            {SEQS.map((s) => <optgroup key={s} label={'Seq ' + s}>{embeds.filter((z) => z.seq === s).map((z) => <option key={z.id} value={z.id}>{z.id} · {z.desc}</option>)}</optgroup>)}
          </select>
          <span className="mono">Area</span>
          <select value={placeArea} onChange={(e) => setPlaceArea(e.target.value)}>{window.AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <span className="place-hint mono">tap the drawing to drop · drag to pan</span>
        </div>
      )}
      {mode === 'zone' && (
        <div className="place-bar glass"><span className="mono">▭ Draw a box over an area</span>
          <span className="place-hint mono">drag a rectangle on the drawing, then set its Area / Pour and apply to the pins inside</span></div>
      )}

      <div className="map-wrap" ref={wrapRef} onWheel={onWheel}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { drag.current = null; setPreview(null); }}
        style={{ cursor: mode === 'place' ? 'crosshair' : mode === 'zone' ? 'cell' : 'grab' }}>
        <div className="map-layer" ref={layerRef}>
          <img src={MAPS.find((m) => m.id === mapId).src} draggable="false" alt="plan" onLoad={fit} />
          {zones.filter((z) => z.mapId === mapId).map((z) => (
            <div key={z.key} className="zone" style={{ left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.w * 100 + '%', height: z.h * 100 + '%', '--h': AREA_HUE[z.area] || 220 }}
              onPointerDown={(e) => { if (mode === 'view') e.stopPropagation(); }} onClick={(e) => { if (mode === 'view') { e.stopPropagation(); setSelZone(z.key); } }}>
              <span className="zone-tag" style={{ transform: `scale(${Math.min(7, 1 / view.current.s)})` }}>{z.area ? 'Area ' + z.area : 'Zone'}{z.pour ? ' · ' + z.pour : ''}</span>
            </div>
          ))}
          <div className="zone-preview" ref={previewRef} style={{ display: 'none' }} />
          {mapPins.map((p) => {
            const col = pinColor(p, activeSeq).c;
            const k = Math.min(7, 1 / view.current.s);        // keep dots small/constant; shrink when zoomed far out
            const showLab = view.current.s >= 0.4 || sel === p.key;
            return (
              <button key={p.key} className={'pin' + (showLab ? ' lab' : '') + (sel === p.key ? ' sel' : '')}
                style={{ left: p.x * 100 + '%', top: p.y * 100 + '%', transform: `translate(-50%,-50%) scale(${k})`, '--c': col }}
                onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSel(p.key); }}
                title={p.embedId + ' · ' + pinColor(p, activeSeq).label}>
                <span className="pin-dot">{p.installed && <span className="pin-check">✓</span>}{p.rfi && <span className="pin-rfi">!</span>}</span>
                <span className="pin-lab">{p.embedId}</span>
              </button>
            );
          })}
        </div>
        <div className="map-zoom">
          <button onClick={() => zoom(1.25)}>+</button><button onClick={() => zoom(0.8)}>−</button><button onClick={reset} title="Reset">⤢</button>
        </div>
        {!mapPins.length && <div className="map-empty glass">No pins on this map/filter yet.{isManager ? ' Tap “+ Place” to start.' : ''}</div>}
      </div>

      {selPin && <PinPopup pin={selPin} embed={embeds.find((z) => z.id === selPin.embedId)} isManager={isManager} activeSeq={activeSeq}
        onClose={() => setSel(null)} onToggle={() => onToggleInstall(selPin)}
        onSaveRFI={(rfi) => onUpdatePin(selPin.key, { rfi: rfi || null, status: selPin.installed ? 'installed' : (rfi ? 'rfi' : 'planned') })}
        onNotes={(notes) => onUpdatePin(selPin.key, { notes })}
        onMeta={(patch) => onUpdatePin(selPin.key, patch)}
        onRemove={() => { onRemovePin(selPin.key); setSel(null); }} />}

      {selZone && (() => {
        const z = zones.find((q) => q.key === selZone); if (!z) return null;
        const inside = pins.filter((p) => p.mapId === z.mapId && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
        return <ZoneEditor zone={z} count={inside.length} onClose={() => setSelZone(null)}
          onChange={(patch) => onUpdateZone(z.key, patch)}
          onApply={() => { const patch = {}; if (z.area) patch.area = z.area; if (z.sequence) patch.sequence = z.sequence; if (z.pour) patch.pour = z.pour; inside.forEach((p) => onUpdatePin(p.key, patch)); flash(`Applied to ${inside.length} pins`); setSelZone(null); }}
          onDelete={() => { onRemoveZone(z.key); setSelZone(null); }} />;
      })()}
    </div>
  );
}

/* ---------------------------- Zone editor (area / pour overlay) ---------------------------- */
function ZoneEditor({ zone, count, onClose, onChange, onApply, onDelete }) {
  return (
    <div className="pop-back" onClick={onClose}>
      <div className="pop glass" onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px,94vw)' }}>
        <div className="pop-head"><div className="pop-id disp" style={{ fontSize: 18 }}>Zone</div><button className="pop-x" onClick={onClose}>✕</button></div>
        <label className="ze-lab">Area</label>
        <div className="ze-chips">{window.AREAS.map((a) => <button key={a} className={'chip sm area-' + a + (zone.area === a ? ' on' : '')} style={{ '--h': AREA_HUE[a] }} onClick={() => onChange({ area: a })}>{a}</button>)}</div>
        <label className="ze-lab">Sequence</label>
        <div className="ze-chips">{SEQS.map((s) => <button key={s} className={'chip sm' + (zone.sequence === s ? ' on' : '')} onClick={() => onChange({ sequence: s })}>{s}</button>)}</div>
        <label className="ze-lab">Pour</label>
        <input className="ze-in" placeholder="e.g. Pour 12 · 6/19" defaultValue={zone.pour || ''} onBlur={(e) => onChange({ pour: e.target.value })} />
        <label className="ze-lab">Label (optional)</label>
        <input className="ze-in" placeholder="zone label" defaultValue={zone.label || ''} onBlur={(e) => onChange({ label: e.target.value })} />
        <button className="btn-primary ze-apply" onClick={onApply}>Apply Area/Seq/Pour to {count} pins inside</button>
        <button className="pop-del" onClick={onDelete}>Delete zone</button>
      </div>
    </div>
  );
}

/* ---------------------------- Pin popup (check-off + RFI) ---------------------------- */
function PinPopup({ pin, embed, isManager, activeSeq, onClose, onToggle, onSaveRFI, onNotes, onMeta, onRemove }) {
  const [rfiOpen, setRfiOpen] = useState(!!pin.rfi);
  const [rfi, setRfi] = useState(pin.rfi || { number: '', title: '', status: 'Open', desc: '', links: [] });
  const setLink = (i, k, v) => { const links = (rfi.links || []).slice(); links[i] = { ...links[i], [k]: v }; setRfi({ ...rfi, links }); };
  const addLink = () => setRfi({ ...rfi, links: [...(rfi.links || []), { label: '', url: '' }] });
  const removeLink = (i) => setRfi({ ...rfi, links: (rfi.links || []).filter((_, j) => j !== i) });
  const st = { color: pinColor(pin, activeSeq).c, label: pinColor(pin, activeSeq).label };
  return (
    <div className="pop-back" onClick={onClose}>
      <div className="pop glass" onClick={(e) => e.stopPropagation()}>
        <div className="pop-head">
          <div><div className="pop-id disp">{pin.embedId}</div>
            <div className="pop-desc mono">{embed ? embed.desc : ''}{embed && embed.plate ? ' · ' + embed.plate : ''}</div></div>
          <button className="pop-x" onClick={onClose}>✕</button>
        </div>
        <div className="pop-status" style={{ color: st.color }}>● {st.label}{pin.installedBy ? ` · by ${pin.installedBy}` : ''}</div>

        <div className="pop-meta">
          <div className="pm-row"><span className="pm-lab">Sequence</span><div className="pm-chips">{SEQS.map((s) => <button key={s} className={'chip sm' + (pin.sequence === s ? ' on' : '')} onClick={() => onMeta({ sequence: s })}>{s}</button>)}</div></div>
          <div className="pm-row"><span className="pm-lab">Area</span><div className="pm-chips">{window.AREAS.map((a) => <button key={a} className={'chip sm area-' + a + (pin.area === a ? ' on' : '')} style={{ '--h': AREA_HUE[a] }} onClick={() => onMeta({ area: a })}>{a}</button>)}</div></div>
        </div>

        <button className={'pop-install' + (pin.installed ? ' on' : '')} onClick={onToggle}>
          {pin.installed ? '✓ Installed — tap to undo' : 'Mark installed'}
        </button>

        <button className="pop-rfi-toggle" onClick={() => setRfiOpen(!rfiOpen)}>{rfiOpen ? '▾' : '▸'} RFI {pin.rfi ? `· #${pin.rfi.number || '—'} (${pin.rfi.status || 'Open'})` : '(attach)'}</button>
        {rfiOpen && (
          <div className="pop-rfi">
            <div className="pr-row"><input placeholder="RFI #" value={rfi.number} onChange={(e) => setRfi({ ...rfi, number: e.target.value })} />
              <select value={rfi.status} onChange={(e) => setRfi({ ...rfi, status: e.target.value })}><option>Open</option><option>Answered</option><option>Closed</option></select></div>
            <input placeholder="Title" value={rfi.title} onChange={(e) => setRfi({ ...rfi, title: e.target.value })} />
            <textarea placeholder="Description / general info" value={rfi.desc} onChange={(e) => setRfi({ ...rfi, desc: e.target.value })} rows={2} />
            {(rfi.links || []).map((l, i) => (
              <div className="pr-row" key={i}>
                <input placeholder="Doc label" value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} />
                <input placeholder="Drive / URL" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} />
                <button className="pr-del" title="Remove link" onClick={() => removeLink(i)}>✕</button>
              </div>))}
            <div className="pr-acts">
              <button className="btn-ghost" onClick={addLink}>+ link</button>
              {pin.rfi && <button className="btn-ghost danger" onClick={() => { onSaveRFI(null); setRfi({ number: '', title: '', status: 'Open', desc: '', links: [] }); setRfiOpen(false); }}>Remove RFI</button>}
              <button className="btn-primary" onClick={() => { onSaveRFI(rfi); }}>Save RFI</button>
            </div>
          </div>
        )}

        <textarea className="pop-notes" placeholder="Notes…" defaultValue={pin.notes || ''} onBlur={(e) => onNotes(e.target.value)} rows={2} />
        {(pin.rfi && (pin.rfi.links || []).some((l) => l.url)) && (
          <div className="pop-links">{pin.rfi.links.filter((l) => l.url).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer">🔗 {l.label || l.url}</a>)}</div>
        )}
        {isManager && <button className="pop-del" onClick={onRemove}>Delete pin</button>}
      </div>
    </div>
  );
}

/* ---------------------------- DASHBOARD ---------------------------- */
function Dashboard({ embeds, pins, cupPour }) {
  const expected = embeds.reduce((s, e) => s + (e.qty || 0), 0);
  const placed = pins.length;
  const installed = pins.filter((p) => p.installed).length;
  const rfis = pins.filter((p) => p.rfi).length;
  const pct = placed ? Math.round((installed / placed) * 100) : 0;

  const byArea = window.AREAS.map((a) => ({ a, placed: pins.filter((p) => p.area === a).length, inst: pins.filter((p) => p.area === a && p.installed).length }));
  const bySeq = SEQS.map((s) => ({ s, exp: embeds.filter((e) => e.seq === s).reduce((x, e) => x + (e.qty || 0), 0), inst: pins.filter((p) => p.sequence === s && p.installed).length }));

  const areaData = {
    labels: byArea.map((x) => 'Area ' + x.a),
    datasets: [
      { label: 'Placed', data: byArea.map((x) => x.placed), backgroundColor: 'rgba(150,160,200,.5)', borderRadius: 6 },
      { label: 'Installed', data: byArea.map((x) => x.inst), backgroundColor: 'oklch(.8 .15 155 / .85)', borderRadius: 6 },
    ],
  };
  const seqData = {
    labels: bySeq.map((x) => 'Seq ' + x.s),
    datasets: [
      { label: 'Expected', data: bySeq.map((x) => x.exp), backgroundColor: 'rgba(150,160,200,.45)', borderRadius: 6 },
      { label: 'Installed', data: bySeq.map((x) => x.inst), backgroundColor: 'oklch(.72 .16 290 / .85)', borderRadius: 6 },
    ],
  };
  const opts = { plugins: { legend: { labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };

  const byDate = installsByDate(pins);
  const trendData = {
    labels: byDate.map((r) => r.date),
    datasets: [{ label: 'Installed (cumulative)', data: byDate.map((r) => r.cumulative),
      borderColor: 'oklch(.78 .16 152)', backgroundColor: 'oklch(.78 .16 152 / .18)', fill: true, tension: 0.3, pointRadius: 3 }],
  };
  return (
    <div className="dash scrollY">
      <div className="dash-top">
        <div className="kpis">
          <Kpi label="Expected (takeoff)" val={expected} />
          <Kpi label="Pinned on map" val={placed} />
          <Kpi label="Installed" val={installed} accent="155" />
          <Kpi label="% of pinned" val={pct + '%'} accent="205" />
          <Kpi label="Open RFIs" val={rfis} accent="60" />
        </div>
        <div className="dash-export">
          <button className="btn-ghost" onClick={() => exportExcel(pins)}>⭳ Excel</button>
          <button className="btn-primary" onClick={() => exportPDF(pins)}>⭳ PDF report</button>
        </div>
      </div>
      <div className="card glass" style={{ marginBottom: 14 }}>
        <div className="card-h">Installed over time</div>
        {byDate.length ? <window.ChartCanvas type="line" data={trendData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} height={220} />
          : <div className="np-empty mono">No installs logged yet — mark embeds installed on the Map and the dated progress curve fills in here (and in the Excel/PDF export).</div>}
      </div>
      <div className="dash-grid">
        <div className="card glass"><div className="card-h">Install progress by Area</div><window.ChartCanvas type="bar" data={areaData} options={opts} height={260} /></div>
        <div className="card glass"><div className="card-h">Expected vs Installed by Sequence</div><window.ChartCanvas type="bar" data={seqData} options={opts} height={260} /></div>
      </div>
      <div className="card glass next-pour">
        <div className="card-h">Next pour <span className="mono np-src">· from CUP dashboard</span></div>
        {cupPour ? (
          <div className="np-body mono">{typeof cupPour === 'object' ? JSON.stringify(cupPour) : String(cupPour)}</div>
        ) : (
          <div className="np-empty mono">No active pour found on the CUP dashboard yet. When you set one there, it shows up here (shared Firebase).</div>
        )}
      </div>
    </div>
  );
}
function Kpi({ label, val, accent }) {
  return <div className="kpi glass" style={accent ? { '--h': accent } : {}}><div className="kpi-v disp">{val}</div><div className="kpi-l mono">{label}</div></div>;
}

/* ---------------------------- INVENTORY ---------------------------- */
function Inventory({ embeds, pins }) {
  const rows = embeds.map((e) => {
    const ps = pins.filter((p) => p.embedId === e.id);
    return { ...e, placed: ps.length, installed: ps.filter((p) => p.installed).length };
  });
  return (
    <div className="inv scrollY">
      <table className="inv-tbl">
        <thead><tr><th>Embed</th><th>Seq</th><th>Description</th><th>Plate</th><th>Qty</th><th>Pinned</th><th>Installed</th><th>Remaining</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.id}</td><td>{r.seq}</td><td>{r.desc}</td><td className="mono">{r.plate || '—'}</td>
              <td>{r.qty}</td><td>{r.placed}</td><td style={{ color: 'oklch(.8 .15 155)' }}>{r.installed}</td>
              <td style={{ color: r.qty - r.installed > 0 ? 'var(--amber)' : 'var(--ink-faint)' }}>{Math.max(0, r.qty - r.installed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------- CREW + ARCADE ---------------------------- */
function Crew({ users, pins, currentUser, onHi }) {
  const ranked = users.slice().sort((a, b) => (b.points || 0) - (a.points || 0));
  const installsBy = (name) => pins.filter((p) => p.installed && p.installedBy === name).length;
  const [gameLb, setGameLb] = useState([]);
  useEffect(() => { if (window.OEGame) window.OEGame.listenLeaderboard(setGameLb); }, []);
  return (
    <div className="crew scrollY">
      <div className="crew-cols">
        <div className="card glass">
          <div className="card-h">Leaderboard <span className="mono" style={{ color: 'var(--ink-faint)' }}>· install points</span></div>
          {ranked.map((u, i) => {
            const rank = window.rankFor(u.points || 0);
            return (
              <div key={u.id} className={'lb-row' + (u.id === currentUser.id ? ' me' : '')}>
                <span className="lb-pos mono">{i + 1}</span>
                <window.Avatar name={u.name} size={32} manager={u.role === 'manager'} />
                <div className="lb-info"><div className="lb-name">{u.name}</div><div className="lb-rank mono">{rank.title} · {installsBy(u.name)} installs</div></div>
                <div className="lb-pts mono">{u.points || 0}<span>pts</span></div>
                {(u.dinoHi || 0) > 0 && <div className="lb-dino mono" title="Ironworker Run best">🏃 {u.dinoHi}</div>}
              </div>
            );
          })}
        </div>
        <div className="card glass">
          <div className="card-h">Ironworker Run <span className="mono" style={{ color: 'var(--ink-faint)' }}>· dodge the embeds</span></div>
          <window.DinoGame user={currentUser} onHi={onHi} />
          <p className="arcade-note mono">Backend live — scores save to the crew board. Themed game art lands with the new design.</p>
          {gameLb.length > 0 && (
            <div className="game-lb">
              <div className="game-lb-h mono">TOP RUNS</div>
              {gameLb.slice(0, 6).map((g, i) => (
                <div key={g.userId || i} className={'glb-row' + (g.userId === currentUser.id ? ' me' : '')}>
                  <span className="mono glb-pos">{i + 1}</span><span className="glb-name">{g.name}</span><span className="mono glb-score">{g.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- styles ---------------------------- */
function AppStyle() {
  return <style>{`
  .oe{height:100%;display:flex;flex-direction:column;}
  .brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;
    background:radial-gradient(circle at 30% 25%,var(--cyan),var(--violet) 70%,var(--magenta));box-shadow:0 0 22px -6px var(--glow-cyan);}
  .brand-mark span{width:11px;height:11px;border-radius:50%;background:#06122a;}
  .oe-head{display:flex;align-items:center;gap:18px;padding:10px 16px;border-bottom:1px solid var(--line);z-index:20;}
  .oe-brand{display:flex;align-items:center;gap:11px;}
  .oe-name{font-size:16px;letter-spacing:.04em;}.oe-sub{font-size:9px;color:var(--ink-faint);letter-spacing:.06em;}
  .oe-tabs{display:flex;gap:6px;}
  .oe-tab{display:flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;background:rgba(16,23,52,.4);border:1px solid var(--line);color:var(--ink-dim);font-size:13px;transition:.14s;}
  .oe-tab:hover{color:var(--ink);border-color:var(--line-strong);}
  .oe-tab.on{color:#06122a;background:linear-gradient(135deg,var(--cyan),var(--violet));border-color:transparent;font-weight:600;}
  .oe-tab-ic{font-size:14px;}
  .oe-who{margin-left:auto;display:flex;align-items:center;gap:10px;}
  .oe-who-info{text-align:right;}.oe-who-name{font-size:13px;}.oe-who-pts{font-size:10px;color:var(--cyan);}
  .oe-out{width:32px;height:32px;border-radius:9px;background:rgba(16,23,52,.5);border:1px solid var(--line);color:var(--ink-dim);font-size:14px;}
  .oe-out:hover{color:var(--red);border-color:var(--red);}
  .oe-main{flex:1;min-height:0;position:relative;}
  .oe-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:90;padding:11px 20px;border-radius:11px;font-size:13px;color:var(--ink);border:1px solid var(--line-strong);}
  .chip{padding:7px 13px;border-radius:9px;background:rgba(16,23,52,.5);border:1px solid var(--line);color:var(--ink-dim);font-size:12px;transition:.13s;white-space:nowrap;}
  .chip:hover{color:var(--ink);border-color:var(--line-strong);}
  .chip.on{color:#06122a;background:linear-gradient(135deg,var(--cyan),var(--violet));border-color:transparent;font-weight:600;}
  .chip.sm{padding:5px 10px;font-size:11px;}
  .chip.on.hot{background:linear-gradient(135deg,var(--amber),var(--magenta));}
  .chip.area-A.on{background:oklch(.8 .15 155);} .chip.area-B.on{background:oklch(.82 .14 70);}
  .chip.area-C.on{background:oklch(.8 .13 205);} .chip.area-D.on{background:oklch(.72 .16 290);}
  /* map */
  .map-tab{position:absolute;inset:0;display:flex;flex-direction:column;}
  .map-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--line);z-index:10;}
  .mb-grp{display:flex;align-items:center;gap:5px;}.mb-lab{font-size:9px;color:var(--ink-faint);margin-right:2px;}
  .mb-spacer{flex:1;}.mb-count{font-size:12px;color:var(--ink-dim);}
  .mb-sel{background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:8px;padding:5px 8px;color:var(--ink);font-size:12px;}
  .mb-legend{display:flex;gap:11px;font-size:10px;color:var(--ink-dim);}
  .mb-legend span{display:flex;align-items:center;gap:4px;}
  .mb-legend i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.4);}
  @media(max-width:900px){.mb-legend{display:none;}}
  .place-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--ink-dim);}
  .place-bar select{background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:8px;padding:6px 8px;color:var(--ink);font-size:12px;max-width:240px;}
  .place-hint{color:var(--ink-faint);font-size:10px;margin-left:auto;}
  .map-wrap{flex:1;min-height:0;position:relative;overflow:hidden;background:#0a0f22;touch-action:none;}
  .map-layer{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform;}
  .map-layer img{display:block;max-width:none;user-select:none;}
  .pin{position:absolute;z-index:2;background:none;border:none;display:flex;flex-direction:column;align-items:center;transform-origin:center;padding:0;}
  .pin-dot{position:relative;width:20px;height:20px;border-radius:50%;background:var(--c);border:2.5px solid rgba(255,255,255,.9);box-shadow:0 1px 4px rgba(0,0,0,.55);display:grid;place-items:center;transition:transform .1s;}
  .pin:hover{z-index:5;}.pin:hover .pin-dot,.pin.sel .pin-dot{transform:scale(1.25);box-shadow:0 0 0 3px rgba(255,255,255,.35);}
  .pin-check{color:#06150d;font-size:12px;font-weight:900;line-height:1;}
  .pin-rfi{position:absolute;top:-8px;right:-8px;width:15px;height:15px;border-radius:50%;background:var(--amber);color:#1a1200;font-weight:800;font-size:10px;display:grid;place-items:center;border:2px solid #fff;}
  .pin-lab{display:none;margin-top:2px;font-family:var(--font-m);font-size:10px;font-weight:700;color:#fff;background:rgba(6,10,24,.85);padding:1px 5px;border-radius:5px;white-space:nowrap;}
  .pin.lab .pin-lab{display:block;}
  .zone{position:absolute;z-index:1;border:2px dashed oklch(.8 .14 var(--h)/.9);background:oklch(.7 .14 var(--h)/.14);border-radius:4px;cursor:pointer;}
  .zone:hover{background:oklch(.7 .14 var(--h)/.22);}
  .zone-tag{position:absolute;left:0;top:0;transform-origin:0 0;font-family:var(--font-m);font-size:11px;font-weight:700;color:#fff;background:oklch(.45 .12 var(--h)/.92);padding:2px 7px;border-radius:0 0 6px 0;white-space:nowrap;}
  .zone-preview{position:absolute;z-index:6;border:2px dashed var(--cyan);background:oklch(.8 .13 205/.18);border-radius:4px;pointer-events:none;}
  .pop-meta{margin:12px 0;display:flex;flex-direction:column;gap:8px;}
  .pm-row{display:flex;align-items:center;gap:8px;}.pm-lab{font-size:11px;color:var(--ink-faint);width:64px;flex:none;}
  .pm-chips{display:flex;gap:5px;flex-wrap:wrap;}
  .pr-del{width:30px;flex:none;border-radius:8px;background:rgba(16,23,52,.5);border:1px solid var(--line);color:var(--ink-faint);font-size:11px;}
  .pr-del:hover{color:var(--red);border-color:var(--red);}
  .btn-ghost.danger:hover{color:var(--red);border-color:var(--red);}
  .ze-lab{display:block;font-size:11px;color:var(--ink-faint);margin:12px 0 6px;}
  .ze-chips{display:flex;gap:6px;flex-wrap:wrap;}
  .ze-in{width:100%;background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:8px;padding:9px 11px;color:var(--ink);font-size:13px;}
  .ze-apply{width:100%;margin-top:16px;justify-content:center;}
  .map-zoom{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;z-index:5;}
  .map-zoom button{width:38px;height:38px;border-radius:10px;background:var(--panel-solid);border:1px solid var(--line-strong);color:var(--ink);font-size:18px;}
  .map-zoom button:hover{border-color:var(--cyan);}
  .map-empty{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:14px 20px;border-radius:12px;font-size:13px;color:var(--ink-dim);border:1px solid var(--line);}
  /* pin popup */
  .pop-back{position:fixed;inset:0;z-index:80;background:rgba(4,7,18,.55);display:flex;align-items:center;justify-content:center;padding:18px;}
  .pop{width:min(420px,94vw);max-height:88vh;overflow:auto;border-radius:var(--r-lg);padding:18px;border:1px solid var(--line-strong);box-shadow:var(--shadow);}
  .pop-head{display:flex;justify-content:space-between;gap:10px;}
  .pop-id{font-size:22px;display:flex;align-items:center;gap:10px;}
  .pop-area{font-size:10px;font-family:var(--font-m);padding:3px 9px;border-radius:99px;background:oklch(.7 .14 var(--h)/.18);color:oklch(.85 .12 var(--h));border:1px solid oklch(.7 .14 var(--h)/.4);}
  .pop-desc{font-size:11px;color:var(--ink-faint);margin-top:4px;}
  .pop-x{width:30px;height:30px;border-radius:8px;background:rgba(16,23,52,.5);border:1px solid var(--line);color:var(--ink-dim);}
  .pop-status{font-size:12px;margin:12px 0;}
  .pop-install{width:100%;padding:13px;border-radius:11px;border:1px solid var(--line-strong);background:rgba(16,23,52,.5);color:var(--ink);font-size:14px;font-weight:600;transition:.15s;}
  .pop-install:hover{border-color:oklch(.8 .15 155);}
  .pop-install.on{background:oklch(.8 .15 155 / .2);border-color:oklch(.8 .15 155);color:oklch(.86 .13 155);}
  .pop-rfi-toggle{width:100%;text-align:left;margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(16,23,52,.4);border:1px solid var(--line);color:var(--ink-dim);font-size:13px;}
  .pop-rfi{margin-top:8px;display:flex;flex-direction:column;gap:7px;}
  .pop-rfi input,.pop-rfi textarea,.pop-rfi select{background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:8px;padding:8px 10px;color:var(--ink);font-size:12px;width:100%;}
  .pr-row{display:flex;gap:7px;}.pr-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:2px;}
  .pop-notes{margin-top:10px;background:rgba(8,12,28,.6);border:1px solid var(--line);border-radius:8px;padding:8px 10px;color:var(--ink);font-size:12px;width:100%;}
  .pop-links{display:flex;flex-direction:column;gap:5px;margin-top:9px;}
  .pop-links a{font-size:12px;color:var(--cyan);text-decoration:none;}.pop-links a:hover{text-decoration:underline;}
  .pop-del{margin-top:12px;width:100%;padding:9px;border-radius:9px;background:none;border:1px solid var(--line);color:var(--ink-faint);font-size:12px;}
  .pop-del:hover{color:var(--red);border-color:var(--red);}
  /* dashboard */
  .dash{position:absolute;inset:0;padding:18px;overflow:auto;}
  .dash-top{display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;}
  .dash-top .kpis{flex:1;margin-bottom:0;}
  .dash-export{display:flex;gap:8px;}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;}
  .kpi{padding:16px 18px;border-radius:var(--r-md);border:1px solid var(--line);}
  .kpi-v{font-size:30px;color:oklch(.85 .12 var(--h,205));}.kpi-l{font-size:10px;color:var(--ink-faint);letter-spacing:.05em;margin-top:4px;}
  .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;}
  .card{padding:16px;border-radius:var(--r-md);border:1px solid var(--line);}
  .card-h{font-size:13px;font-weight:600;margin-bottom:12px;color:var(--ink);}
  .next-pour{margin-top:14px;}.np-src{color:var(--ink-faint);font-size:10px;font-weight:400;}
  .np-empty,.np-body{font-size:12px;color:var(--ink-dim);line-height:1.6;}
  /* inventory */
  .inv{position:absolute;inset:0;padding:18px;overflow:auto;}
  .inv-tbl{width:100%;border-collapse:collapse;font-size:13px;}
  .inv-tbl th{text-align:left;padding:9px 12px;color:var(--ink-faint);font-size:10px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--space-900);}
  .inv-tbl td{padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink-dim);}
  .inv-tbl tr:hover td{background:rgba(16,23,52,.4);color:var(--ink);}
  /* crew */
  .crew{position:absolute;inset:0;padding:18px;overflow:auto;}
  .crew-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;align-items:start;}
  .lb-row{display:flex;align-items:center;gap:11px;padding:9px 6px;border-bottom:1px solid var(--line);}
  .lb-row.me{background:oklch(.8 .13 205/.08);border-radius:9px;}
  .lb-pos{width:20px;color:var(--ink-faint);font-size:12px;text-align:center;}
  .lb-info{flex:1;min-width:0;}.lb-name{font-size:14px;color:var(--ink);}.lb-rank{font-size:10px;color:var(--ink-faint);margin-top:2px;}
  .lb-pts{font-size:16px;color:var(--cyan);display:flex;flex-direction:column;align-items:flex-end;line-height:1;}.lb-pts span{font-size:8px;color:var(--ink-faint);}
  .lb-dino{font-size:11px;color:var(--ink-faint);margin-left:8px;}
  .arcade-note{font-size:10px;color:var(--ink-faint);margin-top:10px;text-align:center;}
  .game-lb{margin-top:14px;border-top:1px solid var(--line);padding-top:10px;}
  .game-lb-h{font-size:9px;letter-spacing:.14em;color:var(--ink-faint);margin-bottom:6px;}
  .glb-row{display:flex;align-items:center;gap:10px;padding:4px 4px;font-size:13px;border-radius:7px;}
  .glb-row.me{background:oklch(.8 .13 205/.1);}
  .glb-pos{width:16px;color:var(--ink-faint);font-size:11px;}.glb-name{flex:1;color:var(--ink);}
  .glb-score{color:var(--cyan);font-weight:600;}
  @media (max-width:680px){.oe-tab-lab{display:none;}.oe-sub{display:none;}.oe-head{gap:10px;}}
  `}</style>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
