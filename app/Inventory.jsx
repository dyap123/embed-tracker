/* EmbedYap — Inventory by embed MARK (201A, 218A…) with editable per-type info + delivery tracking */
const INV_COLS = '1.4fr .58fr .58fr .72fr .72fr 1.05fr 28px';   // mark·desc | qty | pinned | delivered | installed | remaining | chevron
const SELECT_OPT = { background:'#10151E', color:'#E9EEF5' };   // readable <option> rows on the dark dropdowns
const SELECT_STYLE = { background:'#10151E', border:'none', outline:'none', fontFamily:'JetBrains Mono, ui-monospace, monospace', fontSize:12, colorScheme:'dark', cursor:'pointer' };
const DELIV_FILTERS = [   // delivery-status scope for the inventory page
  { value:'all',         label:'All deliveries' },
  { value:'transit',     label:'Incoming' },        // on the way — what's coming in to check off
  { value:'none',        label:'Not delivered' },   // not on site yet / not ordered
  { value:'outstanding', label:'Outstanding' },     // anything not fully delivered
  { value:'delivered',   label:'Delivered' },
];
// urgency for a sequence "needed by" date — parses the ISO as a LOCAL date (like inspDaysUntil in MapScreen)
function neededInfo(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m) return null;
  const d=new Date(+m[1],+m[2]-1,+m[3]), n=new Date(); n.setHours(0,0,0,0); d.setHours(0,0,0,0);
  const days=Math.round((d-n)/86400000);
  const col = days<0 ? T.color.red : days<=7 ? T.color.yellow : T.color.steel300;
  const lbl = days<0 ? `${-days}d overdue` : days===0 ? 'due today' : days===1 ? 'tomorrow' : `${days}d`;
  return { days, col, lbl };
}
// per-type receiving log (embeds/{mark}.receipts = [{qty,date}, …]) — partial deliveries over time
function recvList(r){ const x=r&&r.receipts; if(!x) return []; const a=Array.isArray(x)?x:Object.values(x); return a.filter(e=>e&&e.qty!=null); }
function recvTotal(r){ return recvList(r).reduce((s,e)=>s+(+e.qty||0),0); }
function recvLast(r){ const d=recvList(r).map(e=>e.date).filter(Boolean).sort(); return d.length?d[d.length-1]:''; }
// received count, capped to the in-scope qty when a filter is active (receipts are per-mark, not per-seq)
function recvScoped(r, scopedQty, scoped){ const t=recvTotal(r); return scoped ? Math.min(t, scopedQty||0) : t; }
function Inventory({ embeds, isPhone, types, onEditType, onAddType, onDeleteType, onSyncQtys, onBulkDelivery, onBulkInstall, canEdit, userName, seqMeta={}, onSetSeqNeeded, wcgPours=[] }){
  const [open, setOpen] = React.useState(null);   // expanded mark
  const [q, setQ] = React.useState('');           // search
  const [seqMode, setSeqMode] = React.useState('pwjv');      // 'pwjv' (embed.sequence) | 'wcg' (which WCG pour it sits in)
  const [seqFilter, setSeqFilter] = React.useState('all');   // scope counts + check-off to one sequence / pour
  const [delivFilter, setDelivFilter] = React.useState('all');  // scope to a delivery status (incoming / awaiting / delivered)
  const [sortBy, setSortBy] = React.useState('mark');        // 'mark' | 'recvDesc' | 'recvAsc'
  const [viewMode, setViewMode] = React.useState('table');   // 'table' (by mark) | 'summary' (grouped cards)
  const [groupBy, setGroupBy] = React.useState('sequence');  // summary grouping: 'sequence' | 'area' | 'delivery' | 'attr'
  const [deadlinesOpen, setDeadlinesOpen] = React.useState(false);   // sequences/deadlines panel
  const [adding, setAdding] = React.useState(false);
  const [newMark, setNewMark] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const dState = window.deliveryState;

  // sequence matcher (PWJV by embed.sequence, WCG by which pour zone the embed sits in)
  const matchSeq = (e)=> seqFilter==='all' ? true : (seqMode==='wcg' ? e.wcgPour===seqFilter : e.sequence===seqFilter);
  const seqLabelOf = (v)=> seqMode==='wcg' ? ((wcgPours.find(w=>w.id===v)||{}).label||v) : seqLabel(v);
  // delivery-status matcher: incoming = on the way, awaiting = not delivered yet, outstanding = anything not fully delivered
  const matchDeliv = (e)=> delivFilter==='all' ? true
    : delivFilter==='transit'     ? dState(e)==='transit'
    : delivFilter==='none'        ? dState(e)==='none'
    : delivFilter==='delivered'   ? dState(e)==='delivered'
    : delivFilter==='outstanding' ? dState(e)!=='delivered'
    : true;
  const anyFilter = seqFilter!=='all' || delivFilter!=='all';
  // pins in scope of the sequence + delivery filters (drives every count + the bulk check-off)
  const scoped = embeds.filter(e=> matchSeq(e) && matchDeliv(e));

  // headline stats for the scope — "how many embeds / types in the selected region"
  const stats = { embeds: scoped.length, types: new Set(scoped.map(e=>e.mark).filter(Boolean)).size,
    delivered: scoped.filter(e=>dState(e)==='delivered').length,
    transit: scoped.filter(e=>dState(e)==='transit').length,
    installed: scoped.filter(e=>e.installed).length };

  // per-sequence "needed by" deadline + what's still needed (drives the sequence bar). WCG defaults to its pour date.
  const curWcg = seqMode==='wcg' && seqFilter!=='all' ? wcgPours.find(w=>w.id===seqFilter) : null;
  const seqNeeded = seqFilter==='all' ? '' : (((seqMeta[seqFilter]||{}).needed) || (curWcg?curWcg.date:'') || '');
  const seqNi = neededInfo(seqNeeded);
  const sStat = (()=>{ if(seqFilter==='all') return null; let none=0,transit=0,deliv=0;
    embeds.forEach(e=>{ if(!matchSeq(e)) return; const d=dState(e); if(d==='delivered')deliv++; else if(d==='transit')transit++; else none++; });
    return { none, transit, deliv }; })();

  // build a row per mark from the master (types) + live pins (counts respect the sequence filter)
  const byMark = {};
  Object.values(types||{}).forEach(t=>{ if(t&&t.id) byMark[t.id] = { ...t }; });
  scoped.forEach(e=>{ const m = byMark[e.mark] || (byMark[e.mark] = { id:e.mark, desc:e.typeLabel, seq:e.sequence });
    m._pinned = (m._pinned||0)+1; if(e.installed) m._inst = (m._inst||0)+1;
    const dl = dState(e); if(dl==='delivered') m._delv=(m._delv||0)+1; else if(dl==='transit') m._transit=(m._transit||0)+1;
    if(e.hasKnife) m.knifePlate = true; if(e.hasStub) m.stubColumn = true; });
  // received date lives on the type record in the inventory (embeds/{mark}.receivedAt) — independent of the plan
  const ql = q.trim().toLowerCase();
  // tokenized search — every space-separated term must match somewhere (mark, desc, supplier, plate, notes, sequence)
  const terms = ql.split(/\s+/).filter(Boolean);
  const matchRow = (r)=>{ if(!terms.length) return true; const hay=[r.id, r.desc, r.supplier, r.plate, r.notes, r.seq&&seqLabel(r.seq)].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t=>hay.includes(t)); };
  const matchEmbed = (e)=>{ if(!terms.length) return true; const hay=[e.mark, e.grid, e.typeLabel, e.area, e.stubType, seqLabel(e.sequence)].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t=>hay.includes(t)); };
  const byMarkSort = (a,b)=> String(a.id).localeCompare(String(b.id), undefined, {numeric:true});
  // received sort by latest receipt date: not-yet-received rows sink to the bottom; ISO dates compare chronologically
  const byRecv = (dir)=> (a,b)=>{ const ra=recvLast(a), rb=recvLast(b); if(ra===rb) return byMarkSort(a,b);
    if(!ra) return 1; if(!rb) return -1; return dir==='desc' ? (rb<ra?-1:1) : (ra<rb?-1:1); };
  const sortFn = sortBy==='recvDesc' ? byRecv('desc') : sortBy==='recvAsc' ? byRecv('asc') : byMarkSort;
  const rows = Object.values(byMark)
    .filter(r=> !anyFilter || (r._pinned||0)>0)   // hide marks with nothing in the active filter scope
    .filter(matchRow)
    .sort(sortFn);
  // with no scope filter the "design qty" baseline is the master total; otherwise it's the in-scope placed count
  const num = (r)=>({ qty: (!anyFilter && r.qty!=null)?r.qty:(r._pinned||0), pinned:r._pinned||0, inst:r._inst||0, delv:r._delv||0, transit:r._transit||0 });
  const tot = rows.reduce((a,r)=>{ const n=num(r); return { qty:a.qty+n.qty, pinned:a.pinned+n.pinned, inst:a.inst+n.inst, delv:a.delv+n.delv, transit:a.transit+n.transit }; }, {qty:0,pinned:0,inst:0,delv:0,transit:0});
  // per-mark × sequence breakdowns (full set — the expander shows every sequence regardless of the filter)
  const SEQS = window.SEQUENCES || ['1','2','3','4'];
  const seqInfo = {}; window.embedsBySequence(embeds).marks.forEach(m=> seqInfo[m.mark]=m);
  const delivInfo = {};   // mark -> { seq: { s: {placed, delivered, transit} } }
  embeds.forEach(e=>{ const mk=e.mark; if(!mk) return; const di=delivInfo[mk]||(delivInfo[mk]={ seq:{} });
    const c=di.seq[e.sequence]||(di.seq[e.sequence]={ placed:0, delivered:0, transit:0 });
    c.placed++; const dl=dState(e); if(dl==='delivered') c.delivered++; else if(dl==='transit') c.transit++; });
  // pin ids for a mark within the current sequence scope — used by the bulk check-off buttons
  function markIds(id){ return scoped.filter(e=>e.mark===id).map(e=>e.id); }
  // append a receipt to a mark's receiving log (used from the Summary drill-down + table); records who logged it
  function logReceipt(mark, qty, date){ const nq=Math.round(+qty); if(!mark || !nq || nq<=0) return;
    const cur = recvList({ receipts:(types[mark]||{}).receipts });
    onEditType(mark, { id:mark, receipts:[...cur, { qty:nq, date:date||new Date().toISOString().slice(0,10), by:userName||null }] }); }
  // remove receipt #i from a mark's log (used from the Log view)
  function removeReceipt(mark, i){ const cur=recvList({ receipts:(types[mark]||{}).receipts }); const next=cur.filter((_,k)=>k!==i);
    onEditType(mark, { id:mark, receipts: next.length?next:null }); }
  function expInv(kind){ const data = rows.map(r=>{ const n=num(r); const info=seqInfo[r.id]; const di=delivInfo[r.id];
    const seq={}; SEQS.forEach(s=>{ const c=(info&&info.seq[s])||{pinned:0,inst:0}; seq[s]=c; });
    return { id:r.id, desc:r.desc, seqLabel:r.seq, qty:n.qty, pinned:n.pinned, inst:n.inst,
      delivered:n.delv, transit:n.transit, notDelivered:Math.max(0,n.qty-n.delv-n.transit), received:recvScoped(r,n.qty,anyFilter), receivedOn:recvLast(r)||'',
      remaining:Math.max(0,n.qty-n.inst), pct:n.qty?Math.round(n.inst/n.qty*100):0,
      bolts:r.bolts, plate:r.plate, len:r.len, supplier:r.supplier, seq, receipts:recvList(r) }; });
    window.exportInventory(data, kind, SEQS); }

  // ---- summary view: group the in-scope pins and tally embeds / types / delivered / installed ----
  const groups = React.useMemo(()=>{
    const visible = scoped.filter(matchEmbed);
    const buckets = {};
    const keyOf = (e)=> groupBy==='sequence' ? e.sequence : groupBy==='area' ? e.area
      : groupBy==='delivery' ? dState(e) : (e.hasKnife?'knife':e.hasStub?'stub':'plain');   // 'attr'
    visible.forEach(e=>{ const k=keyOf(e); const b=buckets[k]||(buckets[k]={ key:k, marks:new Set(), ids:[], undeliveredIds:[], embeds:0, delivered:0, transit:0, installed:0, byMark:{} });
      b.embeds++; b.marks.add(e.mark); b.ids.push(e.id); const dl=dState(e); if(dl==='delivered') b.delivered++; else { b.undeliveredIds.push(e.id); } if(dl==='transit') b.transit++; if(e.installed) b.installed++;
      const mk=e.mark||'—'; const mm=b.byMark[mk]||(b.byMark[mk]={ mark:mk, ids:[], embeds:0, delivered:0, transit:0, installed:0 });
      mm.embeds++; mm.ids.push(e.id); if(dl==='delivered') mm.delivered++; else if(dl==='transit') mm.transit++; if(e.installed) mm.installed++; });
    const order = groupBy==='sequence' ? SEQS : groupBy==='area' ? (window.AREAS||['A','B','C','D'])
      : groupBy==='delivery' ? (window.DELIVERY_ORDER||['delivered','transit','none']) : ['plain','knife','stub'];
    const label = (k)=> groupBy==='sequence' ? seqLabel(k) : groupBy==='area' ? 'Area '+k
      : groupBy==='delivery' ? (window.DELIVERY[k]?window.DELIVERY[k].label:k)
      : (k==='knife'?'Knife plate':k==='stub'?'Stub column':'Plain anchor');
    const color = (k)=> groupBy==='delivery' ? (window.DELIVERY[k]?window.DELIVERY[k].color:T.color.steel300)
      : groupBy==='attr' ? (k==='knife'?T.color.blue:k==='stub'?'#FF9650':T.color.steel300) : T.color.amberHot;
    const keys = Object.keys(buckets).sort((a,b)=>{ const ia=order.indexOf(a), ib=order.indexOf(b);
      return (ia<0?99:ia)-(ib<0?99:ib) || String(a).localeCompare(String(b),undefined,{numeric:true}); });
    return keys.map(k=>{ const b=buckets[k]; return { key:k, label:label(k), color:color(k), ids:b.ids, undeliveredIds:b.undeliveredIds, embeds:b.embeds, types:b.marks.size, delivered:b.delivered, transit:b.transit, installed:b.installed,
      marksList: Object.values(b.byMark).sort((a,b2)=> String(a.mark).localeCompare(String(b2.mark), undefined, {numeric:true})) }; });
  }, [scoped, groupBy, ql]);

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
      <div className="ey-fade" style={{ maxWidth:1080, margin:'0 auto', padding:isPhone?'18px 14px 90px':'28px 30px 60px' }}>
        <Header title="Inventory" sub={`By embed type · ${rows.length} marks${seqFilter!=='all'?' · '+(seqMode==='wcg'?'WCG ':'')+seqLabelOf(seqFilter):''}${delivFilter!=='all'?' · '+DELIV_FILTERS.find(f=>f.value===delivFilter).label:''}`}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,.3)', border:'1px solid '+(seqFilter!=='all'?'rgba(126,120,240,.5)':T.color.line),
            borderRadius:T.radius.md, padding:'0 6px 0 8px', height:32 }} title="Filter to a PWJV sequence or a WCG pour">
            <Icon name="filter" size={13} style={{ color:seqFilter!=='all'?'#A6A0FF':T.color.steel400 }} />
            <Segmented size="sm" value={seqMode} onChange={m=>{ setSeqMode(m); setSeqFilter('all'); }} options={[{value:'pwjv',label:'PWJV'},{value:'wcg',label:'WCG'}]} />
            <select value={seqFilter} onChange={e=>setSeqFilter(e.target.value)}
              style={{ ...SELECT_STYLE, color:seqFilter!=='all'?'#fff':T.color.steel200, maxWidth:150 }}>
              <option value="all" style={SELECT_OPT}>{seqMode==='wcg'?'All WCG pours':'All sequences'}</option>
              {(seqMode==='wcg' ? wcgPours.map(w=>[w.id,w.label]) : SEQS.map(s=>[s,seqLabel(s)])).map(([v,l])=>
                <option key={v} value={v} style={SELECT_OPT}>{l}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.3)', border:'1px solid '+(delivFilter!=='all'?'rgba(245,194,75,.55)':T.color.line),
            borderRadius:T.radius.md, padding:'0 8px', height:32 }} title="Filter to a delivery status — pick Incoming to check off what's coming in">
            <Icon name="inventory" size={14} style={{ color:delivFilter!=='all'?'#F5C24B':T.color.steel400 }} />
            <select value={delivFilter} onChange={e=>setDelivFilter(e.target.value)}
              style={{ ...SELECT_STYLE, color:delivFilter!=='all'?'#fff':T.color.steel200 }}>
              {DELIV_FILTERS.map(f=><option key={f.value} value={f.value} style={SELECT_OPT}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.3)', border:'1px solid '+(q?'rgba(126,120,240,.5)':T.color.line),
            borderRadius:T.radius.md, padding:'0 10px', height:32 }}>
            <Icon name="search" size={14} style={{ color:q?'#A6A0FF':T.color.steel400 }} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search marks, types, supplier, grid…"
              style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontFamily:T.font.mono, fontSize:12.5, width:isPhone?140:210 }} />
            {q && <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400, whiteSpace:'nowrap' }}>{rows.length}</span>}
            {q && <button onClick={()=>setQ('')} title="Clear" style={{ color:T.color.steel400 }}><Icon name="close" size={12}/></button>}
          </div>
          <Segmented size="sm" value={viewMode} onChange={setViewMode} options={[{value:'table',label:'Table'},{value:'summary',label:'Summary'},{value:'log',label:'Log'}]} />
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.3)', border:'1px solid '+(sortBy!=='mark'?'rgba(126,120,240,.5)':T.color.line),
            borderRadius:T.radius.md, padding:'0 8px', height:32 }} title="Sort the inventory">
            <Icon name="filter" size={13} style={{ color:sortBy!=='mark'?'#A6A0FF':T.color.steel400 }} />
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
              style={{ ...SELECT_STYLE, color:sortBy!=='mark'?'#fff':T.color.steel200 }}>
              <option value="mark" style={SELECT_OPT}>Sort: Mark</option>
              <option value="recvDesc" style={SELECT_OPT}>Sort: Received (newest)</option>
              <option value="recvAsc" style={SELECT_OPT}>Sort: Received (oldest)</option>
            </select>
          </div>
          <Btn kind={deadlinesOpen?'primary':'ghost'} size="sm" icon="calendar" onClick={()=>setDeadlinesOpen(o=>!o)} title="Needed-by dates for every sequence">Deadlines</Btn>
          {canEdit && <Btn kind="ghost" size="sm" icon="bolt" onClick={()=>onSyncQtys && onSyncQtys()} title="Set every type's quantity to its current placed count on the plan">Sync to map</Btn>}
          {canEdit && <Btn kind="ghost" size="sm" icon="plus" onClick={()=>setAdding(a=>!a)}>Add type</Btn>}
          <Btn kind="ghost" size="sm" icon="export" onClick={()=>expInv('csv')}>CSV</Btn>
          <Btn kind="ghost" size="sm" icon="export" onClick={()=>expInv('xlsx')}>Excel</Btn>
          <Btn kind="navy" size="sm" icon="export" onClick={()=>expInv('pdf')}>PDF</Btn>
        </Header>

        {adding && canEdit && (
          <Card pad={14} glow style={{ marginTop:14, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <input autoFocus value={newMark} onChange={e=>setNewMark(e.target.value)} placeholder="Mark (e.g. 201A)"
              onKeyDown={e=>{ if(e.key==='Enter' && newMark.trim()){ onAddType(newMark.trim(), { desc:newDesc.trim() }); setNewMark(''); setNewDesc(''); setAdding(false); } }}
              style={{ ...inputStyle, width:140, fontFamily:T.font.mono, fontSize:13, padding:'8px 10px' }} />
            <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Description (optional)"
              style={{ ...inputStyle, flex:'1 1 200px', fontSize:13, padding:'8px 10px' }} />
            <Btn kind="primary" size="sm" icon="check" disabled={!newMark.trim()}
              onClick={()=>{ if(newMark.trim()){ onAddType(newMark.trim(), { desc:newDesc.trim() }); setNewMark(''); setNewDesc(''); setAdding(false); } }}>Add</Btn>
            <Btn kind="ghost" size="sm" onClick={()=>{ setAdding(false); setNewMark(''); setNewDesc(''); }}>Cancel</Btn>
          </Card>
        )}

        {deadlinesOpen && <SequencesPanel embeds={embeds} seqMeta={seqMeta} onSetSeqNeeded={onSetSeqNeeded} wcgPours={wcgPours} isPhone={isPhone} />}

        {/* sequence "needed by" bar — deadline + what's still needed, when one sequence is selected */}
        {seqFilter!=='all' && sStat && (
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginTop:16, padding:'12px 16px', borderRadius:T.radius.lg,
            background:'rgba(126,120,240,.07)', border:'1px solid '+(seqNi?seqNi.col+'66':T.color.line) }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <Icon name="calendar" size={16} style={{ color:T.color.amberHot }} />
              <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16 }}>{seqMode==='wcg'?'WCG · ':''}{seqLabelOf(seqFilter)}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:T.font.mono, fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:T.color.steel400 }}>Needed by</span>
              <div style={{ width:168 }}><DatePopover value={seqNeeded} onChange={d=>onSetSeqNeeded && onSetSeqNeeded(seqFilter, d)} /></div>
              {seqNi && <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:12, color:seqNi.col }}>{seqNi.lbl}</span>}
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:14, fontFamily:T.font.mono, fontSize:12, flexWrap:'wrap' }}>
              <span style={{ color:T.color.red }}><b>{sStat.none}</b> not delivered</span>
              <span style={{ color:T.color.yellow }}><b>{sStat.transit}</b> on the way</span>
              <span style={{ color:T.color.green }}><b>{sStat.deliv}</b> delivered</span>
            </div>
          </div>
        )}

        {/* headline stats — reflects the sequence filter ("selected region") */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${isPhone?2:5},1fr)`, gap:10, marginTop:18 }}>
          <StatTile label="Embeds" value={stats.embeds} sub="placed in scope" />
          <StatTile label="Types" value={stats.types} sub="distinct marks" accent={T.color.amberHot} />
          <StatTile label="Delivered" value={stats.delivered} sub="on site" accent={T.color.green} />
          <StatTile label="On the way" value={stats.transit} sub="in transit" accent={T.color.yellow} />
          <StatTile label="Installed" value={stats.installed} sub="cast & set" accent={T.color.green} />
        </div>

        {/* summary view: group-by control */}
        {viewMode==='summary' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16, flexWrap:'wrap' }}>
            <span style={{ fontFamily:T.font.mono, fontSize:10.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>Group by</span>
            <Segmented size="sm" value={groupBy} onChange={setGroupBy}
              options={[{value:'sequence',label:'Sequence'},{value:'area',label:'Area'},{value:'delivery',label:'Delivery'},{value:'attr',label:'Type'}]} />
          </div>
        )}

        {viewMode==='log' ? (
          <ReceiptsView types={types} ql={ql} onRemove={removeReceipt} isPhone={isPhone} />
        ) : viewMode==='summary' ? (
          <SummaryGrid groups={groups} isPhone={isPhone} onBulkDelivery={onBulkDelivery} onBulkInstall={onBulkInstall} seqMeta={seqMeta} groupBy={groupBy} onLogReceipt={logReceipt} />
        ) : (
        <Card pad={0} glow style={{ marginTop:18 }}>
          {!isPhone && (
            <div style={{ display:'grid', gridTemplateColumns:INV_COLS, gap:12, padding:'13px 20px',
              borderBottom:'1px solid '+T.color.line, fontFamily:T.font.mono, fontSize:10.5, letterSpacing:'.14em',
              textTransform:'uppercase', color:T.color.steel400 }}>
              <span>Mark · description</span><span style={{ textAlign:'right' }}>Qty</span><span style={{ textAlign:'right' }}>Pinned</span>
              <span style={{ textAlign:'right' }}>Delivered</span><span style={{ textAlign:'right' }}>Installed</span><span style={{ textAlign:'right' }}>Remaining</span><span/>
            </div>
          )}
          {rows.map((r,i)=>{
            const n = num(r); const remaining = Math.max(0, n.qty - n.inst); const pct = n.qty?Math.round(n.inst/n.qty*100):0;
            const isOpen = open===r.id;
            return (
              <div key={r.id} style={{ borderBottom: i<rows.length-1?'1px solid '+T.color.lineSoft:'none' }}>
                <div onClick={()=>setOpen(isOpen?null:r.id)} style={{ display:'grid', cursor:'pointer',
                  gridTemplateColumns:isPhone?'1fr 1fr 1fr':INV_COLS, gap:12,
                  padding:isPhone?'14px 16px':'15px 20px', alignItems:'center', background:isOpen?'rgba(126,120,240,.06)':'transparent' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:11, gridColumn:isPhone?'1 / -1':'auto', minWidth:0 }}>
                    <span style={{ width:42, height:30, borderRadius:7, display:'grid', placeItems:'center', flex:'0 0 auto',
                      background:steelPlate('#26313F','#1A2230'), border:'1px solid '+T.color.line, fontFamily:T.font.mono, fontWeight:700, fontSize:12.5, color:T.color.amberHot }}>{r.id}</span>
                    <span style={{ minWidth:0 }}>
                      <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:15.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.desc||'Anchor Bolt'}{r.knifePlate&&<Badge color={T.color.blue} style={{ marginLeft:8, fontSize:9 }}>KP</Badge>}{r.stubColumn&&<Badge color="#FF9650" style={{ marginLeft:4, fontSize:9 }}>SC</Badge>}</div>
                      <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}>{r.seq?seqLabel(r.seq):'—'}{r.plate?' · '+r.plate:''}{recvTotal(r)>0?<span style={{ color:T.color.green }}> · Rec’d {recvScoped(r,n.qty,anyFilter)}/{n.qty}{recvLast(r)?' · '+window.shortDate(recvLast(r)):''}</span>:''}</div>
                    </span>
                  </div>
                  <Num label={isPhone?'Qty':null} v={n.qty} />
                  {!isPhone && <Num v={n.pinned} color={T.color.blue} />}
                  <DelivCell delv={n.delv} transit={n.transit} isPhone={isPhone} />
                  <Num label={isPhone?'Installed':null} v={n.inst} color={T.color.green} />
                  <div style={{ gridColumn:isPhone?'1 / -1':'auto' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontFamily:T.font.mono, fontSize:12, marginBottom:5 }}>
                      <span style={{ color:T.color.steel300 }}>{remaining} left</span>
                      <span style={{ color:pct>=100?T.color.green:T.color.steel400 }}>{pct}%</span>
                    </div>
                    <div style={{ height:8, borderRadius:5, background:'rgba(0,0,0,.32)', overflow:'hidden', border:'1px solid '+T.color.line }}>
                      <div style={{ width:Math.min(100,pct)+'%', height:'100%', background:'linear-gradient(90deg,#2FD6A6cc,#2FD6A6)', transition:'width .9s ease' }} />
                    </div>
                  </div>
                  {!isPhone && <Icon name="chevronDown" size={16} style={{ color:T.color.steel400, transform:isOpen?'rotate(180deg)':'none', transition:'transform .2s', justifySelf:'end' }} />}
                </div>
                {isOpen && <>
                  <DeliveryControls n={n} ids={markIds(r.id)} seqFilter={seqFilter} onBulkDelivery={onBulkDelivery} by={userName}
                    receipts={r.receipts} onSetReceipts={(arr)=>onEditType(r.id, { id:r.id, receipts:(arr&&arr.length)?arr:null })} />
                  <SeqBreakdown info={seqInfo[r.id]} deliv={delivInfo[r.id]} seqs={SEQS} />
                  <TypeEditor row={r} qty={n.qty} canEdit={canEdit} onSave={(patch)=>onEditType(r.id, patch)} onDelete={onDeleteType?()=>{ onDeleteType(r.id); setOpen(null); }:null} />
                </>}
              </div>
            );
          })}
          {/* total */}
          <div style={{ display:'grid', gridTemplateColumns:isPhone?'1fr 1fr 1fr':INV_COLS, gap:12,
            padding:isPhone?'14px 16px':'15px 20px', alignItems:'center', borderTop:'1px solid '+T.color.line, background:'rgba(30,58,107,.14)' }}>
            <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'.04em', gridColumn:isPhone?'1 / -1':'auto' }}>Total</span>
            <Num v={tot.qty} />
            {!isPhone && <Num v={tot.pinned} color={T.color.blue} />}
            <DelivCell delv={tot.delv} transit={tot.transit} isPhone={isPhone} />
            <Num v={tot.inst} color={T.color.green} />
            {!isPhone && <><Num v={Math.max(0,tot.qty-tot.inst)} suffix=" left" /><span/></>}
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}

/* per-mark sequence breakdown — installed / placed AND delivered / placed per sequence */
function SeqBreakdown({ info, deliv, seqs }){
  return (
    <div style={{ padding:'12px 20px 0' }}>
      <span style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>By sequence · installed / placed</span>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        {seqs.map(s=>{ const c=(info&&info.seq[s])||{pinned:0,inst:0}; const done=c.pinned>0&&c.inst===c.pinned;
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:T.radius.pill,
              background: c.pinned?'rgba(126,120,240,.12)':'rgba(0,0,0,.2)', border:'1px solid '+(c.pinned?'rgba(126,120,240,.4)':T.color.line) }}>
              <span style={{ fontFamily:T.font.mono, fontSize:10.5, letterSpacing:'.08em', color:T.color.steel300 }}>{seqLabel(s)}</span>
              <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:13, color: c.pinned?(done?T.color.green:'#fff'):T.color.steel600 }}>{c.inst}/{c.pinned}</span>
            </div>
          ); })}
      </div>
      <span style={{ display:'block', marginTop:12, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>By sequence · delivered / placed</span>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        {seqs.map(s=>{ const c=(deliv&&deliv.seq[s])||{placed:0,delivered:0,transit:0}; const done=c.placed>0&&c.delivered===c.placed;
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:T.radius.pill,
              background: c.placed?'rgba(47,214,166,.10)':'rgba(0,0,0,.2)', border:'1px solid '+(c.placed?'rgba(47,214,166,.32)':T.color.line) }}>
              <span style={{ fontFamily:T.font.mono, fontSize:10.5, letterSpacing:'.08em', color:T.color.steel300 }}>{seqLabel(s)}</span>
              <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:13, color: c.placed?(done?T.color.green:'#fff'):T.color.steel600 }}>{c.delivered}/{c.placed}</span>
              {c.transit>0 && <span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.yellow }} title="on the way">+{c.transit}</span>}
            </div>
          ); })}
      </div>
    </div>
  );
}

/* compact delivered count cell (green) with an in-transit "+N" hint (yellow) */
function DelivCell({ delv, transit, isPhone }){
  return (
    <div style={{ textAlign:isPhone?'left':'right' }}>
      {isPhone && <div style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400, marginBottom:2 }}>Delivered</div>}
      <span style={{ fontFamily:T.font.mono, fontWeight:500, fontSize:16, color:T.color.green }}>{delv}</span>
      {transit>0 && <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.yellow, marginLeft:4 }} title="on the way">+{transit}</span>}
    </div>
  );
}

/* bulk delivery check-off for a mark (scoped to the current sequence filter) — open to all signed-in users */
/* receiving log — log "received N on date D" as many times as needed; accumulates toward the type's qty */
function ReceiptLog({ qty, receipts, onChange, by }){
  const list = recvList({ receipts });
  const total = list.reduce((s,e)=>s+(+e.qty||0),0);
  const outstanding = Math.max(0, (qty||0) - total);
  const [addQty, setAddQty] = React.useState('');
  const [addDate, setAddDate] = React.useState(()=> new Date().toISOString().slice(0,10));
  function add(){ const nq=Math.round(+addQty); if(!nq || nq<=0 || !onChange) return;
    onChange([...list, { qty:nq, date:addDate||new Date().toISOString().slice(0,10), by:by||null }]); setAddQty(''); }
  function remove(i){ if(onChange) onChange(list.filter((_,k)=>k!==i)); }
  const indexed = list.map((e,i)=>({ e, i })).sort((a,b)=> String(b.e.date||'').localeCompare(String(a.e.date||'')));
  return (
    <div>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <span style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>Receiving log</span>
        <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel300 }}>received <b style={{ color:T.color.green }}>{total}</b> of {qty||'—'} · <b style={{ color:outstanding>0?T.color.red:T.color.green }}>{outstanding}</b> outstanding</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <input type="number" min="1" value={addQty} onChange={e=>setAddQty(e.target.value)} placeholder="Qty"
          onKeyDown={e=>{ if(e.key==='Enter') add(); }} style={{ ...inputStyle, width:74, padding:'7px 9px', fontSize:13, fontFamily:T.font.mono }} />
        <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>received on</span>
        <div style={{ width:158 }}><DatePopover value={addDate} onChange={setAddDate} /></div>
        <Btn size="sm" kind="primary" icon="plus" onClick={add}>Log receipt</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {indexed.length===0 && <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel600 }}>No receipts logged yet.</span>}
        {indexed.map(({e,i})=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 11px', borderRadius:8, background:'rgba(47,214,166,.08)', border:'1px solid rgba(47,214,166,.25)' }}>
            <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:13.5, color:T.color.green }}>{e.qty}</span>
            <span style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>received</span>
            <span style={{ fontFamily:T.font.mono, fontSize:12, color:'#fff' }}>{window.shortDate(e.date)||'—'}</span>
            <button onClick={()=>remove(i)} title="Remove receipt" style={{ marginLeft:'auto', color:T.color.steel400, padding:2 }}><Icon name="close" size={13}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveryControls({ n, ids, seqFilter, onBulkDelivery, receipts, onSetReceipts, by }){
  const notDel = Math.max(0, (n.qty||n.pinned||0) - n.delv - n.transit);
  const scope = seqFilter==='all' ? 'all sequences' : seqLabel(seqFilter);
  const B = (status, label, rgb) => (
    <button onClick={()=>ids.length && onBulkDelivery && onBulkDelivery(ids, status)} disabled={!ids.length}
      style={{ flex:1, padding:'9px 0', borderRadius:T.radius.md, fontFamily:T.font.display, fontWeight:700, fontSize:12, letterSpacing:'.03em',
        background:`rgba(${rgb},.14)`, border:`1px solid rgba(${rgb},.5)`, color:`rgb(${rgb})`, opacity:ids.length?1:.4, cursor:ids.length?'pointer':'default' }}>{label}</button>
  );
  return (
    <div style={{ padding:'12px 20px 0' }}>
      {/* receiving log — record partial deliveries (qty received on a date); independent of the plan */}
      <ReceiptLog qty={n.qty} receipts={receipts} onChange={onSetReceipts} by={by} />
      <span style={{ display:'block', marginTop:16, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>Delivery status on plan · {ids.length} pins · {scope}</span>
      <div style={{ display:'flex', gap:7, marginTop:8 }}>
        {B('delivered','Delivered','47,214,166')}
        {B('transit','On the way','245,194,75')}
        {B('none','Not delivered','240,85,107')}
      </div>
      <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400, marginTop:8 }}>
        Delivered <b style={{ color:T.color.green }}>{n.delv}</b> · On the way <b style={{ color:T.color.yellow }}>{n.transit}</b> · Not <b style={{ color:T.color.red }}>{notDel}</b>
        <span style={{ color:T.color.steel600 }}> · colors the plan dots</span>
      </div>
    </div>
  );
}

/* expandable per-type editor — input info for each embed mark */
function TypeEditor({ row, qty, canEdit, onSave, onDelete }){
  const F = ({ k, label, type='text', w }) => (
    <label style={{ display:'flex', flexDirection:'column', gap:5, width:w||'auto', flex:w?'none':'1 1 120px' }}>
      <span style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>{label}</span>
      <input type={type} defaultValue={row[k]!=null?row[k]:''} disabled={!canEdit}
        onBlur={e=>{ const v=type==='number'?(e.target.value===''?null:+e.target.value):e.target.value; if(v!==row[k]) onSave({ [k]: v }); }}
        style={{ ...inputStyle, padding:'8px 10px', fontSize:13, opacity:canEdit?1:.6 }} />
    </label>
  );
  return (
    <div style={{ padding:'4px 20px 18px', background:'rgba(0,0,0,.18)' }}>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <F k="desc" label="Description" />
        <F k="qty" label="Quantity" type="number" w={110} />
        <F k="bolts" label="# Bolts" type="number" w={90} />
        <F k="plate" label="Plate" w={110} />
        <F k="len" label="Length (in)" type="number" w={110} />
        <F k="supplier" label="Supplier" />
      </div>
      <label style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <span style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>Notes</span>
        <textarea defaultValue={row.notes||''} disabled={!canEdit} rows={2}
          onBlur={e=>{ if(e.target.value!==(row.notes||'')) onSave({ notes:e.target.value }); }}
          style={{ ...inputStyle, padding:'8px 10px', fontSize:13, resize:'vertical', opacity:canEdit?1:.6 }} />
      </label>
      {!canEdit && <div style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400, marginTop:8 }}>Sign in as a manager to edit type info.</div>}
      {canEdit && onDelete && <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
        <Btn kind="danger" size="sm" icon="trash" onClick={()=>{ if(confirm('Delete embed type '+row.id+'? Pins already on the plan stay; only the type record is removed.')) onDelete(); }}>Delete type</Btn>
      </div>}
    </div>
  );
}

/* headline stat tile (embeds / types / delivered / installed) */
function StatTile({ label, value, sub, accent='#fff' }){
  return (
    <div style={{ background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:'11px 14px' }}>
      <div style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>{label}</div>
      <div style={{ fontFamily:T.font.display, fontWeight:800, fontSize:26, lineHeight:1, marginTop:4, color:accent }}>{value}</div>
      <div style={{ fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400, marginTop:3 }}>{sub}</div>
    </div>
  );
}

/* Deadlines panel — every sequence (PWJV + WCG pour) with an editable needed-by date, days-left, and what's outstanding */
function SequencesPanel({ embeds, seqMeta={}, onSetSeqNeeded, wcgPours=[], isPhone }){
  const dS = window.deliveryState;
  const SEQS = window.SEQUENCES || ['1','2','3','4'];
  const count = (pred)=>{ let total=0,out=0,inst=0; embeds.forEach(e=>{ if(!pred(e)) return; total++; if(dS(e)!=='delivered') out++; if(e.installed) inst++; }); return { total, out, inst }; };
  const rows = [
    ...SEQS.map(s=>({ key:s, label:seqLabel(s), kind:'PWJV', defDate:'', ...count(e=>e.sequence===s) })),
    ...wcgPours.map(w=>({ key:w.id, label:w.label, kind:'WCG', defDate:w.date||'', ...count(e=>e.wcgPour===w.id) })),
  ];
  const COLS = isPhone ? '1fr 150px' : '74px minmax(0,1fr) 176px 70px 84px 96px';
  const head = { fontFamily:T.font.mono, fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:T.color.steel400 };
  return (
    <Card pad={0} glow style={{ marginTop:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', borderBottom:'1px solid '+T.color.line }}>
        <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase', letterSpacing:'.03em' }}>Sequence deadlines</span>
        <span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}>needed-by per sequence · WCG defaults to its pour date</span>
      </div>
      {!isPhone && (
        <div style={{ display:'grid', gridTemplateColumns:COLS, gap:12, padding:'9px 18px', borderBottom:'1px solid '+T.color.lineSoft, ...head }}>
          <span>Layer</span><span>Sequence · pour</span><span>Needed by</span><span style={{ textAlign:'right' }}>Days</span><span style={{ textAlign:'right' }}>Not deliv</span><span style={{ textAlign:'right' }}>Installed</span>
        </div>
      )}
      {rows.map((r,i)=>{ const needed=((seqMeta[r.key]||{}).needed) || r.defDate || ''; const ni=neededInfo(needed);
        return (
          <div key={r.kind+r.key} style={{ display:'grid', gridTemplateColumns:COLS, gap:12, padding:isPhone?'11px 14px':'10px 18px', alignItems:'center', borderBottom: i<rows.length-1?'1px solid '+T.color.lineSoft:'none' }}>
            <Badge color={r.kind==='WCG'?T.color.cyan:T.color.amberHot} style={{ fontSize:9 }}>{r.kind}</Badge>
            <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.label}{r.total?<span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}> · {r.total} embeds</span>:null}</span>
            <div style={{ width:170 }}><DatePopover value={needed} onChange={d=>onSetSeqNeeded && onSetSeqNeeded(r.key, d)} /></div>
            {!isPhone && <span style={{ textAlign:'right', fontFamily:T.font.mono, fontSize:12, fontWeight:700, color:ni?ni.col:T.color.steel600 }}>{ni?ni.lbl:'—'}</span>}
            {!isPhone && <span style={{ textAlign:'right', fontFamily:T.font.mono, fontSize:13, color:r.out?T.color.red:T.color.steel600 }}>{r.out}</span>}
            {!isPhone && <span style={{ textAlign:'right', fontFamily:T.font.mono, fontSize:13, color:T.color.green }}>{r.inst}<span style={{ color:T.color.steel500 }}>/{r.total}</span></span>}
          </div>
        ); })}
    </Card>
  );
}

/* Log view — chronological inventory log of every receipt across all types (date · mark · qty · who logged it) */
function ReceiptsView({ types, ql, onRemove, isPhone }){
  const all = [];
  Object.values(types||{}).forEach(t=>{ if(!t||!t.id) return; recvList(t).forEach((rc,i)=>{ all.push({ mark:t.id, desc:t.desc, qty:+rc.qty||0, date:rc.date||'', by:rc.by||'', i }); }); });
  const terms = (ql||'').split(/\s+/).filter(Boolean);
  const filtered = all.filter(e=> !terms.length || terms.every(t=> (e.mark+' '+(e.desc||'')).toLowerCase().includes(t)));
  filtered.sort((a,b)=> String(b.date).localeCompare(String(a.date)) || String(a.mark).localeCompare(String(b.mark), undefined, {numeric:true}));
  const totalQty = filtered.reduce((s,e)=>s+e.qty,0);
  const byDate = {}; filtered.forEach(e=>{ (byDate[e.date]=byDate[e.date]||[]).push(e); });
  const dates = Object.keys(byDate).sort((a,b)=> String(b).localeCompare(String(a)));
  if(!filtered.length) return <Card pad={22} glow style={{ marginTop:18 }}><div style={{ fontFamily:T.font.mono, fontSize:12.5, color:T.color.steel400, lineHeight:1.6 }}>No deliveries logged yet. Log receipts from a type's row (<b style={{ color:'#fff' }}>Table</b> → expand a mark) or from the <b style={{ color:'#fff' }}>Summary</b> view.</div></Card>;
  const COLS = isPhone ? '1fr 50px 26px' : '92px 1.4fr 70px 1.1fr 28px';
  const badge = { width:42, height:28, borderRadius:7, display:'grid', placeItems:'center', flex:'0 0 auto', background:steelPlate('#26313F','#1A2230'), border:'1px solid '+T.color.line, fontFamily:T.font.mono, fontWeight:700, fontSize:12, color:T.color.amberHot };
  return (
    <Card pad={0} glow style={{ marginTop:18 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, padding:'14px 20px', borderBottom:'1px solid '+T.color.line }}>
        <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase', letterSpacing:'.03em' }}>Delivery log</span>
        <span style={{ fontFamily:T.font.mono, fontSize:11.5, color:T.color.steel400 }}>{filtered.length} receipts · <b style={{ color:T.color.green }}>{totalQty}</b> received</span>
      </div>
      {!isPhone && (
        <div style={{ display:'grid', gridTemplateColumns:COLS, gap:12, padding:'10px 20px', borderBottom:'1px solid '+T.color.lineSoft, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>
          <span>Date</span><span>Mark · type</span><span style={{ textAlign:'right' }}>Qty</span><span>Logged by</span><span/>
        </div>
      )}
      {dates.map(d=>(
        <div key={d}>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 20px', background:'rgba(30,58,107,.14)', fontFamily:T.font.mono, fontSize:11, color:T.color.steel300 }}>
            <span style={{ fontWeight:700, color:'#fff' }}>{window.shortDate(d)||'No date'}</span>
            <span><b style={{ color:T.color.green }}>{byDate[d].reduce((s,e)=>s+e.qty,0)}</b> received</span>
          </div>
          {byDate[d].map((e,k)=>(
            <div key={k} style={{ display:'grid', gridTemplateColumns:COLS, gap:12, padding:isPhone?'11px 16px':'11px 20px', alignItems:'center', borderBottom:'1px solid '+T.color.lineSoft }}>
              {!isPhone && <span style={{ fontFamily:T.font.mono, fontSize:11.5, color:T.color.steel400 }}>{window.shortDate(e.date)||'—'}</span>}
              <span style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                <span style={badge}>{e.mark}</span>
                {!isPhone ? <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:13.5, color:T.color.steel200, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.desc||'Anchor Bolt'}</span>
                          : <span style={{ fontFamily:T.font.mono, fontSize:10, color:T.color.steel400 }}>{e.by||'—'}</span>}
              </span>
              <span style={{ textAlign:'right', fontFamily:T.font.mono, fontWeight:700, fontSize:14, color:T.color.green }}>+{e.qty}</span>
              {!isPhone && <span style={{ fontFamily:T.font.mono, fontSize:12, color:e.by?T.color.steel200:T.color.steel600 }}>{e.by||'—'}</span>}
              <button onClick={()=>onRemove && onRemove(e.mark, e.i)} title="Remove this receipt" style={{ color:T.color.steel400, justifySelf:'end', padding:3 }}><Icon name="trash" size={14}/></button>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

/* summary view — one card per group (sequence / area / delivery / type); click a card to drill into its marks */
function SummaryGrid({ groups, isPhone, onBulkDelivery, onBulkInstall, seqMeta={}, groupBy, onLogReceipt }){
  const [openKey, setOpenKey] = React.useState(null);
  const [secDate, setSecDate] = React.useState(()=> new Date().toISOString().slice(0,10));   // date for "delivered on" + receipt logs
  const [secQty, setSecQty] = React.useState('');     // partial qty to mark delivered for the open section
  const [logKey, setLogKey] = React.useState(null);   // 'groupKey|mark' of the open per-mark receipt logger
  const [logQty, setLogQty] = React.useState('');
  if(!groups.length) return <Card pad={20} glow style={{ marginTop:18 }}><div style={{ fontFamily:T.font.mono, fontSize:12.5, color:T.color.steel400 }}>No embeds in scope.</div></Card>;
  const MARK_COLS = 'minmax(0,1fr) 48px 26px 116px';   // mark | delivered/total | installed | per-mark actions (3 status + log)
  // auto-fit: few groups stretch to fill the width (more room to check off); many settle at ~340px and wrap
  return (
    <div style={{ display:'grid', gridTemplateColumns:isPhone?'1fr':'repeat(auto-fit, minmax(340px, 1fr))', gap:12, marginTop:18, alignItems:'start' }}>
      {groups.map(g=>{
        const dpct = g.embeds?Math.round(g.delivered/g.embeds*100):0;
        const ipct = g.embeds?Math.round(g.installed/g.embeds*100):0;
        const isOpen = openKey===g.key;
        const needed = groupBy==='sequence' ? ((seqMeta[g.key]||{}).needed||'') : '';   // per-sequence deadline
        const ni = neededInfo(needed);
        const outstanding = g.embeds - g.delivered;   // not yet on site (none + on the way)
        return (
          <Card key={g.key} pad={16} glow onClick={()=>setOpenKey(isOpen?null:g.key)}
            style={{ cursor:'pointer', border:'1px solid '+(isOpen?'rgba(126,120,240,.45)':T.color.line), transition:'border-color .15s' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:g.color, flex:'0 0 auto', boxShadow:`0 0 8px -1px ${g.color}` }} />
                <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:17, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.label}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:'0 0 auto' }}>
                <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:12, color:T.color.amberHot, background:'rgba(166,160,255,.12)', border:'1px solid rgba(166,160,255,.3)', borderRadius:T.radius.pill, padding:'2px 9px', whiteSpace:'nowrap' }}>{g.embeds} pins</span>
                <Icon name="chevronDown" size={15} style={{ color:T.color.steel400, transform:isOpen?'rotate(180deg)':'none', transition:'transform .2s' }} />
              </div>
            </div>
            {groupBy==='sequence' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontFamily:T.font.mono, fontSize:11 }}>
                <Icon name="calendar" size={12} style={{ color:ni?ni.col:T.color.steel400 }} />
                {needed ? <span style={{ color:ni?ni.col:T.color.steel300 }}>Needed {window.shortDate(needed)}{ni?' · '+ni.lbl:''}</span>
                        : <span style={{ color:T.color.steel500 }}>No deadline set</span>}
                {outstanding>0 && <span style={{ marginLeft:'auto', color:T.color.red }}>{outstanding} not on site</span>}
              </div>
            )}
            <div style={{ display:'flex', gap:18, marginTop:13 }}>
              <SumStat label="Embeds" v={g.embeds} />
              <SumStat label="Types" v={g.types} color={T.color.amberHot} />
              <SumStat label="Delivered" v={g.delivered} color={T.color.green} />
              <SumStat label="Installed" v={g.installed} color={T.color.green} />
            </div>
            <MiniBar label="Delivered" pct={dpct} note={g.transit?`+${g.transit} on the way`:null} color={T.color.green} />
            <MiniBar label="Installed" pct={ipct} color={T.color.green} />
            {isOpen && (
              <div style={{ marginTop:13, paddingTop:12, borderTop:'1px solid '+T.color.lineSoft }} onClick={e=>e.stopPropagation()}>
                {/* mark the whole section delivered / on the way / installed — Delivered uses the chosen date */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:7 }}>
                  <span style={{ fontFamily:T.font.mono, fontSize:9, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400 }}>Mark all {g.embeds} embeds</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontFamily:T.font.mono, fontSize:10, color:T.color.steel400 }}>on</span>
                    <div style={{ width:150 }}><DatePopover value={secDate} onChange={setSecDate} /></div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  {[['delivered','Delivered','47,214,166'],['transit','On the way','245,194,75'],['none','Not','240,85,107']].map(([st,lbl,rgb])=>(
                    <button key={st} onClick={()=>g.ids.length && onBulkDelivery && onBulkDelivery(g.ids, st, st==='delivered'?secDate:undefined)}
                      style={{ flex:'1 1 auto', padding:'7px 8px', borderRadius:T.radius.md, fontFamily:T.font.display, fontWeight:700, fontSize:11, letterSpacing:'.02em', whiteSpace:'nowrap',
                        background:`rgba(${rgb},.16)`, border:`1px solid rgba(${rgb},.5)`, color:`rgb(${rgb})` }}>{lbl}</button>
                  ))}
                  <button onClick={()=>g.ids.length && onBulkInstall && onBulkInstall(g.ids, true)}
                    style={{ flex:'1 1 auto', padding:'7px 8px', borderRadius:T.radius.md, fontFamily:T.font.display, fontWeight:700, fontSize:11, letterSpacing:'.02em', whiteSpace:'nowrap',
                      background:'rgba(79,163,242,.16)', border:'1px solid rgba(79,163,242,.5)', color:T.color.blue }}>Installed</button>
                </div>
                {/* or mark a partial quantity delivered on the chosen date (marks that many not-yet-delivered pins) */}
                {(g.undeliveredIds&&g.undeliveredIds.length>0) && (
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:12, padding:'8px 10px', borderRadius:T.radius.md, background:'rgba(47,214,166,.07)', border:'1px solid rgba(47,214,166,.25)' }}>
                    <span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel300 }}>Or mark</span>
                    <input type="number" min="1" max={g.undeliveredIds.length} value={secQty} onChange={e=>setSecQty(e.target.value)} placeholder={g.undeliveredIds.length}
                      style={{ ...inputStyle, width:62, padding:'6px 8px', fontSize:12.5, fontFamily:T.font.mono }} />
                    <span style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}>of {g.undeliveredIds.length} not delivered, on {window.shortDate(secDate)}</span>
                    <Btn size="sm" kind="primary" icon="check" style={{ marginLeft:'auto' }}
                      onClick={()=>{ const avail=g.undeliveredIds||[]; const nn=Math.min(Math.max(1,Math.round(+secQty||avail.length)), avail.length);
                        if(nn>0 && onBulkDelivery) onBulkDelivery(avail.slice(0,nn), 'delivered', secDate); setSecQty(''); }}>Mark delivered</Btn>
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:MARK_COLS, gap:8, fontFamily:T.font.mono, fontSize:8.5, letterSpacing:'.1em', textTransform:'uppercase', color:T.color.steel400, paddingBottom:7 }}>
                  <span>Mark · {g.types} types</span><span style={{ textAlign:'right' }}>Deliv</span><span style={{ textAlign:'right' }}>Inst</span><span style={{ textAlign:'right' }}>Set</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:320, overflowY:'auto' }}>
                  {g.marksList.map(m=>{ const lk=g.key+'|'+m.mark; const logOpen=logKey===lk; return (
                    <React.Fragment key={m.mark}>
                    <div style={{ display:'grid', gridTemplateColumns:MARK_COLS, gap:8, alignItems:'center' }}>
                      <span style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:11.5, color:T.color.amberHot, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.mark}</span>
                      <span style={{ textAlign:'right', fontFamily:T.font.mono, fontSize:12, color:T.color.green }}>{m.delivered}<span style={{ color:T.color.steel500 }}>/{m.embeds}</span>{m.transit?<span style={{ color:T.color.yellow }}> +{m.transit}</span>:null}</span>
                      <span style={{ textAlign:'right', fontFamily:T.font.mono, fontSize:12, color:T.color.green }}>{m.installed}</span>
                      <div style={{ display:'flex', gap:3, justifyContent:'flex-end' }}>
                        {[['delivered','check','47,214,166','delivered'],['transit','clock','245,194,75','on the way'],['none','close','240,85,107','not delivered']].map(([st,ic,rgb,word])=>(
                          <button key={st} title={`Mark ${m.mark} ${word}`} onClick={()=>m.ids.length && onBulkDelivery && onBulkDelivery(m.ids, st, st==='delivered'?secDate:undefined)}
                            style={{ width:23, height:23, display:'grid', placeItems:'center', borderRadius:6,
                              background:`rgba(${rgb},.14)`, border:`1px solid rgba(${rgb},.45)`, color:`rgb(${rgb})` }}>
                            <Icon name={ic} size={13} />
                          </button>
                        ))}
                        <button title={`Log a receipt for ${m.mark}`} onClick={()=>{ setLogKey(logOpen?null:lk); setLogQty(''); }}
                          style={{ width:23, height:23, display:'grid', placeItems:'center', borderRadius:6,
                            background:logOpen?'rgba(245,194,75,.3)':'rgba(245,194,75,.14)', border:'1px solid rgba(245,194,75,.5)', color:'#F5C24B' }}>
                          <Icon name="calendar" size={12} />
                        </button>
                      </div>
                    </div>
                    {logOpen && (
                      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'2px 2px 6px', flexWrap:'wrap' }}>
                        <span style={{ fontFamily:T.font.mono, fontSize:10, color:T.color.steel400 }}>Received</span>
                        <input type="number" min="1" value={logQty} onChange={e=>setLogQty(e.target.value)} placeholder="Qty" autoFocus
                          onKeyDown={e=>{ if(e.key==='Enter' && +logQty>0){ onLogReceipt && onLogReceipt(m.mark, logQty, secDate); setLogKey(null); setLogQty(''); } }}
                          style={{ ...inputStyle, width:64, padding:'6px 8px', fontSize:12.5, fontFamily:T.font.mono }} />
                        <span style={{ fontFamily:T.font.mono, fontSize:10, color:T.color.steel400 }}>of {m.embeds} on</span>
                        <div style={{ width:150 }}><DatePopover value={secDate} onChange={setSecDate} /></div>
                        <Btn size="sm" kind="primary" icon="plus" onClick={()=>{ if(+logQty>0){ onLogReceipt && onLogReceipt(m.mark, logQty, secDate); setLogKey(null); setLogQty(''); } }}>Log</Btn>
                      </div>
                    )}
                    </React.Fragment>
                  ); })}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
function SumStat({ label, v, color='#fff' }){
  return (
    <div>
      <div style={{ fontFamily:T.font.mono, fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:T.color.steel400 }}>{label}</div>
      <div style={{ fontFamily:T.font.mono, fontWeight:700, fontSize:18, color, marginTop:2 }}>{v}</div>
    </div>
  );
}
function MiniBar({ label, pct, note, color }){
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontFamily:T.font.mono, fontSize:10.5, marginBottom:4 }}>
        <span style={{ color:T.color.steel300 }}>{label}{note && <span style={{ color:T.color.yellow, marginLeft:6 }}>{note}</span>}</span>
        <span style={{ color:pct>=100?T.color.green:T.color.steel400 }}>{pct}%</span>
      </div>
      <div style={{ height:7, borderRadius:5, background:'rgba(0,0,0,.32)', overflow:'hidden', border:'1px solid '+T.color.line }}>
        <div style={{ width:Math.min(100,pct)+'%', height:'100%', background:`linear-gradient(90deg,${color}cc,${color})`, transition:'width .9s ease' }} />
      </div>
    </div>
  );
}

function Num({ v, color='#fff', label, suffix='' }){
  return (
    <div style={{ textAlign: label?'left':'right' }}>
      {label && <div style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400, marginBottom:2 }}>{label}</div>}
      <span style={{ fontFamily:T.font.mono, fontWeight:500, fontSize:16, color }}>{v}{suffix}</span>
    </div>
  );
}
window.Inventory = Inventory;
