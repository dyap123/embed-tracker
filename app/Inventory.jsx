/* EmbedYap — Inventory by embed MARK (201A, 218A…) with editable per-type info */
function Inventory({ embeds, isPhone, types, onEditType, onAddType, onDeleteType, onSyncQtys, canEdit }){
  const [open, setOpen] = React.useState(null);   // expanded mark
  const [q, setQ] = React.useState('');           // search
  const [adding, setAdding] = React.useState(false);
  const [newMark, setNewMark] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');

  // build a row per mark from the master (types) + live pins
  const byMark = {};
  Object.values(types||{}).forEach(t=>{ if(t&&t.id) byMark[t.id] = { ...t }; });
  embeds.forEach(e=>{ const m = byMark[e.mark] || (byMark[e.mark] = { id:e.mark, desc:e.typeLabel, seq:e.sequence });
    m._pinned = (m._pinned||0)+1; if(e.installed) m._inst = (m._inst||0)+1; if(e.hasKnife) m.knifePlate = true; });
  const ql = q.trim().toLowerCase();
  const rows = Object.values(byMark)
    .filter(r=> !ql || String(r.id).toLowerCase().includes(ql) || String(r.desc||'').toLowerCase().includes(ql) || String(r.supplier||'').toLowerCase().includes(ql))
    .sort((a,b)=> String(a.id).localeCompare(String(b.id), undefined, {numeric:true}));
  const num = (r)=>({ qty: r.qty!=null?r.qty:(r._pinned||0), pinned:r._pinned||0, inst:r._inst||0 });
  const tot = rows.reduce((a,r)=>{ const n=num(r); return { qty:a.qty+n.qty, pinned:a.pinned+n.pinned, inst:a.inst+n.inst }; }, {qty:0,pinned:0,inst:0});
  // per-mark × sequence breakdown
  const SEQS = window.SEQUENCES || ['1','2','3','4'];
  const seqInfo = {}; window.embedsBySequence(embeds).marks.forEach(m=> seqInfo[m.mark]=m);
  function expInv(kind){ const data = rows.map(r=>{ const n=num(r); const info=seqInfo[r.id];
    const seq={}; SEQS.forEach(s=>{ const c=(info&&info.seq[s])||{pinned:0,inst:0}; seq[s]=c; });
    return { id:r.id, desc:r.desc, seqLabel:r.seq, qty:n.qty, pinned:n.pinned, inst:n.inst,
      remaining:Math.max(0,n.qty-n.inst), pct:n.qty?Math.round(n.inst/n.qty*100):0,
      bolts:r.bolts, plate:r.plate, len:r.len, supplier:r.supplier, seq }; });
    window.exportInventory(data, kind, SEQS); }

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
      <div className="ey-fade" style={{ maxWidth:1080, margin:'0 auto', padding:isPhone?'18px 14px 90px':'28px 30px 60px' }}>
        <Header title="Inventory" sub={`By embed type · ${rows.length} marks`}>
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.3)', border:'1px solid '+T.color.line,
            borderRadius:T.radius.md, padding:'0 10px', height:32 }}>
            <Icon name="search" size={14} style={{ color:T.color.steel400 }} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search mark / desc / supplier…"
              style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontFamily:T.font.mono, fontSize:12.5, width:isPhone?140:200 }} />
            {q && <button onClick={()=>setQ('')} style={{ color:T.color.steel400 }}><Icon name="close" size={12}/></button>}
          </div>
          {canEdit && <Btn kind="ghost" size="sm" icon="bolt" onClick={()=>onSyncQtys && onSyncQtys()} title="Set every type's quantity to its current placed count on the plan">Sync to map</Btn>}
          {canEdit && <Btn kind="ghost" size="sm" icon="plus" onClick={()=>setAdding(a=>!a)}>Add type</Btn>}
          <Btn kind="ghost" size="sm" icon="export" onClick={()=>expInv('csv')}>CSV</Btn>
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

        <Card pad={0} glow style={{ marginTop:18 }}>
          {!isPhone && (
            <div style={{ display:'grid', gridTemplateColumns:'1.5fr .7fr .7fr .7fr 1.3fr 30px', gap:12, padding:'13px 20px',
              borderBottom:'1px solid '+T.color.line, fontFamily:T.font.mono, fontSize:10.5, letterSpacing:'.14em',
              textTransform:'uppercase', color:T.color.steel400 }}>
              <span>Mark · description</span><span style={{ textAlign:'right' }}>Qty</span><span style={{ textAlign:'right' }}>Pinned</span>
              <span style={{ textAlign:'right' }}>Installed</span><span style={{ textAlign:'right' }}>Remaining</span><span/>
            </div>
          )}
          {rows.map((r,i)=>{
            const n = num(r); const remaining = Math.max(0, n.qty - n.inst); const pct = n.qty?Math.round(n.inst/n.qty*100):0;
            const isOpen = open===r.id;
            return (
              <div key={r.id} style={{ borderBottom: i<rows.length-1?'1px solid '+T.color.lineSoft:'none' }}>
                <div onClick={()=>setOpen(isOpen?null:r.id)} style={{ display:'grid', cursor:'pointer',
                  gridTemplateColumns:isPhone?'1fr 1fr 1fr':'1.5fr .7fr .7fr .7fr 1.3fr 30px', gap:12,
                  padding:isPhone?'14px 16px':'15px 20px', alignItems:'center', background:isOpen?'rgba(126,120,240,.06)':'transparent' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:11, gridColumn:isPhone?'1 / -1':'auto', minWidth:0 }}>
                    <span style={{ width:42, height:30, borderRadius:7, display:'grid', placeItems:'center', flex:'0 0 auto',
                      background:steelPlate('#26313F','#1A2230'), border:'1px solid '+T.color.line, fontFamily:T.font.mono, fontWeight:700, fontSize:12.5, color:T.color.amberHot }}>{r.id}</span>
                    <span style={{ minWidth:0 }}>
                      <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:15.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.desc||'Anchor Bolt'}{r.knifePlate&&<Badge color={T.color.blue} style={{ marginLeft:8, fontSize:9 }}>KP</Badge>}</div>
                      <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400 }}>{r.seq?seqLabel(r.seq):'—'}{r.plate?' · '+r.plate:''}</div>
                    </span>
                  </div>
                  <Num label={isPhone?'Qty':null} v={n.qty} />
                  <Num label={isPhone?'Pinned':null} v={n.pinned} color={T.color.blue} />
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
                {isOpen && <><SeqBreakdown info={seqInfo[r.id]} seqs={SEQS} /><TypeEditor row={r} qty={n.qty} canEdit={canEdit} onSave={(patch)=>onEditType(r.id, patch)} onDelete={onDeleteType?()=>{ onDeleteType(r.id); setOpen(null); }:null} /></>}
              </div>
            );
          })}
          {/* total */}
          <div style={{ display:'grid', gridTemplateColumns:isPhone?'1fr 1fr 1fr':'1.5fr .7fr .7fr .7fr 1.3fr 30px', gap:12,
            padding:isPhone?'14px 16px':'15px 20px', alignItems:'center', borderTop:'1px solid '+T.color.line, background:'rgba(30,58,107,.14)' }}>
            <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'.04em', gridColumn:isPhone?'1 / -1':'auto' }}>Total</span>
            <Num v={tot.qty} /><Num v={tot.pinned} color={T.color.blue} /><Num v={tot.inst} color={T.color.green} />
            {!isPhone && <><Num v={Math.max(0,tot.qty-tot.inst)} suffix=" left" /><span/></>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* per-mark sequence breakdown — installed / pinned per sequence */
function SeqBreakdown({ info, seqs }){
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

function Num({ v, color='#fff', label, suffix='' }){
  return (
    <div style={{ textAlign: label?'left':'right' }}>
      {label && <div style={{ fontFamily:T.font.mono, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase', color:T.color.steel400, marginBottom:2 }}>{label}</div>}
      <span style={{ fontFamily:T.font.mono, fontWeight:500, fontSize:16, color }}>{v}{suffix}</span>
    </div>
  );
}
window.Inventory = Inventory;
