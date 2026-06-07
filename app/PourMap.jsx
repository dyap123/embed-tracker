/* EmbedYap — Pour map: same plan + shared markups, with per-pour pre-pour checklists
   and a link to the live pour on the CUP dashboard. A "pour" = a markup zone. */
const CUP_LIVE_URL = 'https://dyap123.github.io/cup-dashboard/?view=live';

function PourMap(props){
  const { zones=[], onUpdateZone, user, isPhone, embeds=[] } = props;
  const [open, setOpen] = React.useState(!isPhone);
  const manager = !!user.manager;
  const today = ()=> new Date().toISOString().slice(0,10);

  const pours = [...zones].sort((a,b)=> (a.date||'9999').localeCompare(b.date||'9999') || (a.createdAt||0)-(b.createdAt||0));

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <MapScreen {...props} pourMode />

      {!open && (
        <button data-ui onClick={()=>setOpen(true)} title="Pours & pre-pour checklists"
          style={{ position:'absolute', top:64, right:14, zIndex:30, display:'flex', alignItems:'center', gap:7, height:34, padding:'0 13px',
            borderRadius:T.radius.pill, background:steelPlate('#1B2230','#10151E'), border:'1px solid '+T.color.line, color:'#fff',
            fontFamily:T.font.display, fontWeight:700, fontSize:12.5, letterSpacing:'.04em', boxShadow:T.shadow.card }}>
          <Icon name="clipboard" size={16} style={{ color:T.color.amberHot }} /> Pours · {pours.length}
        </button>
      )}

      {open && (
        <div data-ui style={{ position:'absolute', top:0, right:0, bottom:0, width:isPhone?'100%':360, zIndex:30, display:'flex', flexDirection:'column',
          background:steelPlate('#141B26','#0E131B'), borderLeft:'1px solid '+T.color.line, boxShadow:'-20px 0 60px -30px rgba(0,0,0,.9)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid '+T.color.line }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <Icon name="clipboard" size={18} style={{ color:T.color.amber }} />
              <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase' }}>Pours · pre-pour</span>
            </div>
            <button onClick={()=>setOpen(false)} style={{ color:T.color.steel400 }}><Icon name="close" size={16}/></button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px 16px' }}>
            {pours.length===0 && <div style={{ fontFamily:T.font.mono, fontSize:12.5, color:T.color.steel400, padding:'14px 8px', lineHeight:1.6 }}>
              No markups yet. Use <b style={{color:'#fff'}}>Box</b> or <b style={{color:'#fff'}}>Polygon</b> on the map to draw a pour, then it shows here with a pre-pour checklist.</div>}
            {pours.map(z=> <PourRow key={z.id} z={z} embeds={embeds} manager={manager} user={user} today={today} onUpdateZone={onUpdateZone} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function getItems(z){ return (z.checklist && z.checklist.length) ? z.checklist : (window.PREPOUR_DEFAULT||[]).map(t=>({ text:t, done:false })); }

function PourRow({ z, embeds, manager, user, today, onUpdateZone }){
  const [exp, setExp] = React.useState(false);
  const items = getItems(z);
  const doneN = items.filter(i=>i.done).length;
  const gc = z.done ? '47,214,166' : z.nextPour ? '82,230,224' : (z.color||'126,120,240');
  const title = `${seqLabel(z.pour)} · Area ${z.area}${z.date?' · '+shortDate(z.date):''}`;

  function writeItems(next){ onUpdateZone(z.id, { checklist:next }); }
  function toggle(i){ const it=items[i]; writeItems(items.map((x,k)=> k===i ? (it.done?{...x,done:false,by:null,at:null}:{...x,done:true,by:user.name,at:today()}) : x)); }
  function rename(i,text){ writeItems(items.map((x,k)=> k===i?{...x,text}:x)); }
  function remove(i){ writeItems(items.filter((_,k)=>k!==i)); }
  function add(){ writeItems([...items, { text:'New item', done:false }]); }

  return (
    <div style={{ border:'1px solid '+T.color.line, borderRadius:T.radius.lg, marginBottom:9, overflow:'hidden', background:'rgba(0,0,0,.18)' }}>
      <div onClick={()=>setExp(e=>!e)} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 12px', cursor:'pointer' }}>
        <span style={{ width:9, height:9, borderRadius:2, flex:'0 0 auto', background:`rgb(${gc})` }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
          <div style={{ fontFamily:T.font.mono, fontSize:10.5, color:T.color.steel400, marginTop:2 }}>{z.layer||'PWJV'}{z.nextPour?' · NEXT':''}</div>
        </div>
        <span style={{ fontFamily:T.font.mono, fontSize:12, color: doneN===items.length&&items.length?T.color.green:T.color.steel300 }}>{doneN}/{items.length}</span>
        <Icon name="chevronDown" size={15} style={{ color:T.color.steel400, transform:exp?'rotate(180deg)':'none', transition:'transform .2s' }} />
      </div>
      {exp && (
        <div style={{ padding:'2px 12px 13px', display:'flex', flexDirection:'column', gap:7 }}>
          {items.map((it,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:9 }}>
              <button onClick={()=>toggle(i)} title={it.done?'Uncheck':'Check'} style={{ width:22, height:22, flex:'0 0 auto', borderRadius:6, display:'grid', placeItems:'center',
                background:it.done?T.color.green:'rgba(0,0,0,.25)', border:'1px solid '+(it.done?T.color.green:T.color.line) }}>
                {it.done && <Icon name="check" size={14} style={{ color:'#06140e' }} />}
              </button>
              {manager
                ? <input defaultValue={it.text} onBlur={e=>{ if(e.target.value!==it.text) rename(i, e.target.value); }}
                    style={{ ...inputStyle, flex:1, padding:'6px 9px', fontSize:12.5 }} />
                : <span style={{ flex:1, fontSize:13, color:it.done?T.color.steel300:'#fff', textDecoration:it.done?'line-through':'none' }}>{it.text}</span>}
              {it.done && it.by && <span style={{ fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400, whiteSpace:'nowrap' }}>{it.by.split(' ')[0]}{it.at?' · '+shortDate(it.at):''}</span>}
              {manager && <button onClick={()=>remove(i)} title="Remove" style={{ color:T.color.steel400, padding:3 }}><Icon name="trash" size={13}/></button>}
            </div>
          ))}
          {manager && <button onClick={add} style={{ display:'flex', alignItems:'center', gap:6, color:T.color.amberHot, fontFamily:T.font.mono, fontSize:12, padding:'4px 0', letterSpacing:'.04em' }}>
            <Icon name="plus" size={13}/> ADD ITEM</button>}

          {/* CUP live pour */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, paddingTop:10, borderTop:'1px solid '+T.color.lineSoft }}>
            <input defaultValue={z.cupPourId||''} placeholder="CUP pour (e.g. B-2)" onBlur={e=>{ if(e.target.value!==(z.cupPourId||'')) onUpdateZone(z.id,{ cupPourId:e.target.value }); }}
              style={{ ...inputStyle, width:130, padding:'7px 9px', fontSize:12.5, fontFamily:T.font.mono }} />
            <Btn size="sm" kind="primary" icon="arrowRight" onClick={()=>window.open(CUP_LIVE_URL,'_blank','noopener')}>Go to live pour</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
window.PourMap = PourMap;
