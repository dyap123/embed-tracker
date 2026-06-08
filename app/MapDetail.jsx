/* EmbedYap — pin detail panel (sequence/area/install + RFI) and zone editor */

function PinDetail({ embed, onClose, updateEmbed, isPhone, manager, onDelete }){
  const [celebrate, setCelebrate] = React.useState(false);
  const [mark, setMark] = React.useState(embed.mark||'');
  const st = pinState(embed);

  function toggleInstall(){
    const now = !embed.installed;
    updateEmbed(embed.id, { installed: now });   // App stamps installedAt + credits the user
    if (now){ setCelebrate(true); setTimeout(()=>setCelebrate(false), 900); }
  }
  function setRfiField(patch){
    const base = embed.rfi || { number:`RFI-${300+Math.floor(Math.random()*99)}`, status:'Open', description:'', links:[] };
    updateEmbed(embed.id, { rfi: { ...base, ...patch } });
  }
  function addLink(){
    const base = embed.rfi || { number:`RFI-${300+Math.floor(Math.random()*99)}`, status:'Open', description:'', links:[] };
    setRfiField({ links:[...base.links, { label:'New link', url:'https://' }] });
  }
  function editLink(i, patch){ const links=embed.rfi.links.map((l,k)=>k===i?{...l,...patch}:l); setRfiField({ links }); }
  function rmLink(i){ setRfiField({ links: embed.rfi.links.filter((_,k)=>k!==i) }); }

  const wrap = isPhone ? {
    position:'absolute', left:0, right:0, bottom:0, maxHeight:'74%', borderRadius:'18px 18px 0 0',
    animation:'panelInUp .3s cubic-bezier(.2,.8,.2,1) both',
  } : {
    position:'absolute', top:14, right:14, bottom:14, width:380, borderRadius:T.radius.xl,
    animation:'panelIn .3s cubic-bezier(.2,.8,.2,1) both',
  };

  return (
    <div data-ui style={{ ...wrap, background:steelPlate('#171F2C','#0E141D'), border:'1px solid '+T.color.line,
      boxShadow:T.shadow.panel, display:'flex', flexDirection:'column', overflow:'hidden', zIndex:20 }}>
      {/* header */}
      <div style={{ padding:'16px 18px', borderBottom:'1px solid '+T.color.line, position:'relative',
        background:'linear-gradient(180deg, rgba(30,58,107,.25), transparent)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Dot color={STATE[st].color} size={11} pulse={st!=='installed'&&st==='next'} />
              <span style={{ fontFamily:T.font.mono, fontSize:12.5, color:T.color.steel300, letterSpacing:'.08em', whiteSpace:'nowrap' }}>{embed.grid}</span>
            </div>
            <h3 style={{ fontFamily:T.font.display, fontWeight:700, fontSize:27, margin:'4px 0 0', letterSpacing:'.01em', whiteSpace:'nowrap' }}>{embed.mark||embed.id}</h3>
            <div style={{ fontSize:13.5, color:T.color.steel200, marginTop:2 }}>{embed.typeLabel}</div>
          </div>
          <button onClick={onClose} style={{ color:T.color.steel300, padding:6, background:'rgba(0,0,0,.25)', borderRadius:8 }}><Icon name="close" size={16}/></button>
        </div>
        <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
          <Badge color={STATE[st].color} fill={st==='installed'}>{STATE[st].label}</Badge>
          {embed.hasKnife && <Badge color={T.color.blue}>Knife plate</Badge>}
          {embed.hasStub && <Badge color="#FF9650">Stub column</Badge>}
          <Badge color={T.color.steel300}>{embed.pour}</Badge>
        </div>
        {celebrate && <Celebrate />}
      </div>

      <div style={{ padding:18, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>
        {/* manager: edit / delete this embed */}
        {manager && (
          <div style={{ background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:14, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'.04em' }}>Edit embed</span>
              {onDelete && <Btn size="sm" kind="danger" icon="trash" onClick={onDelete}>Delete</Btn>}
            </div>
            <Field label="Mark">
              <input value={mark} onChange={e=>setMark(e.target.value)}
                onBlur={()=>{ if(mark!==embed.mark) updateEmbed(embed.id,{ embedId:mark }); }}
                onKeyDown={e=>{ if(e.key==='Enter') e.currentTarget.blur(); }}
                style={{ ...inputStyle, padding:'8px 10px', fontSize:13, fontFamily:T.font.mono }} />
            </Field>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14, color:embed.hasKnife?T.color.blue:'#fff' }}>Knife plate</span>
              <Toggle on={!!embed.hasKnife} onChange={()=>updateEmbed(embed.id,{ knifePlate:!embed.hasKnife })} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:14, color:embed.hasStub?'#FF9650':'#fff' }}>Stub column</span>
              <Toggle on={!!embed.hasStub} onChange={()=>updateEmbed(embed.id,{ stubColumn:!embed.hasStub })} />
            </div>
          </div>
        )}

        {/* sequence · phase · area selectors */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
          <Field label="Sequence">
            <Segmented size="sm" value={embed.sequence} onChange={v=>updateEmbed(embed.id,{ sequence:v, pour:`${embed.area}·P${v}` })}
              options={SEQUENCES.map(s=>({value:s,label:s}))} style={{ display:'flex', flexWrap:'wrap' }} />
          </Field>
          <Field label="Phase">
            <Segmented size="sm" value={embed.phase||'1'} onChange={v=>updateEmbed(embed.id,{ phase:v })}
              options={PHASES.map(s=>({value:s,label:s}))} style={{ display:'flex', flexWrap:'wrap' }} />
          </Field>
          <Field label="Area">
            <Segmented size="sm" value={embed.area} onChange={v=>updateEmbed(embed.id,{ area:v, pour:`${v}·P${embed.sequence}` })}
              options={AREAS.map(a=>({value:a,label:a}))} />
          </Field>
        </div>

        {/* install toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          background: embed.installed?'linear-gradient(180deg,rgba(47,214,166,.16),rgba(47,214,166,.04))':'rgba(0,0,0,.22)',
          border:'1px solid '+(embed.installed?'rgba(47,214,166,.42)':T.color.line), borderRadius:T.radius.lg, padding:'14px 16px' }}>
          <div>
            <div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:17, textTransform:'uppercase', letterSpacing:'.03em' }}>Install</div>
            <div style={{ fontSize:12, color:T.color.steel300, marginTop:2 }}>
              {embed.installed? `Cast & set · ${embed.installedAt||'—'}${embed.installedBy?' · by '+embed.installedBy:''}` : 'Mark when cast into concrete'}</div>
          </div>
          <Toggle on={embed.installed} onChange={toggleInstall} />
        </div>

        {/* RFI section */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Icon name="rfi" size={16} style={{ color:T.color.steel300 }} />
              <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase', letterSpacing:'.04em' }}>RFI</span>
            </div>
            {!embed.rfi && <Btn size="sm" kind="ghost" icon="plus" onClick={()=>setRfiField({})}>Add RFI</Btn>}
          </div>

          {embed.rfi ? (
            <div style={{ background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:14, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
                <input value={embed.rfi.number} onChange={e=>setRfiField({ number:e.target.value })}
                  style={{ ...inputStyle, width:120, fontFamily:T.font.mono, fontSize:13, padding:'7px 10px' }} />
                <Segmented size="sm" value={embed.rfi.status} onChange={v=>setRfiField({ status:v })}
                  options={[{value:'Open',label:'Open'},{value:'Answered',label:'Ans'},{value:'Closed',label:'Closed'}]} />
              </div>
              <textarea value={embed.rfi.description} onChange={e=>setRfiField({ description:e.target.value })}
                rows={3} placeholder="Describe the request…"
                style={{ ...inputStyle, resize:'vertical', fontSize:13, lineHeight:1.5 }} />
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {embed.rfi.links.map((l,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Icon name="link" size={14} style={{ color:T.color.blue, flex:'0 0 auto' }} />
                    <input value={l.label} onChange={e=>editLink(i,{ label:e.target.value })}
                      style={{ ...inputStyle, padding:'6px 9px', fontSize:12.5, flex:'1 1 0' }} />
                    <button onClick={()=>rmLink(i)} style={{ color:T.color.steel400, padding:5 }}><Icon name="trash" size={14}/></button>
                  </div>
                ))}
                <button onClick={addLink} style={{ display:'flex', alignItems:'center', gap:7, color:T.color.blue,
                  fontSize:12.5, fontFamily:T.font.mono, padding:'5px 0', letterSpacing:'.04em' }}>
                  <Icon name="plus" size={13}/> ADD DRIVE / URL LINK</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize:13, color:T.color.steel400, padding:'10px 0' }}>No open requests on this embed.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Celebrate(){
  const sparks = Array.from({length:9});
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:30 }}>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-14deg)',
        fontFamily:T.font.display, fontWeight:800, fontSize:34, letterSpacing:'.06em', color:T.color.green,
        border:'4px solid '+T.color.green, padding:'4px 16px', borderRadius:8, textTransform:'uppercase',
        animation:'stampIn .55s cubic-bezier(.2,.9,.25,1) both', background:'rgba(8,16,12,.6)',
        boxShadow:'0 0 30px rgba(47,214,166,.5)' }}>Installed</div>
      {sparks.map((_,i)=>{
        const a=(i/sparks.length)*Math.PI*2; const d=70;
        return <span key={i} style={{ position:'absolute', top:'50%', left:'50%', width:6, height:6, borderRadius:'50%',
          background:i%2?T.color.green:T.color.cyan, boxShadow:'0 0 8px '+T.color.green,
          transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px)`,
          animation:`spark .7s ${i*0.02}s ease-out both` }} />;
      })}
    </div>
  );
}

const ZONE_COLORS = [
  ['126,120,240','Indigo'],['79,163,242','Blue'],['82,230,224','Teal'],
  ['170,220,70','Lime'],['245,194,75','Gold'],['255,150,60','Orange'],
  ['196,92,203','Magenta'],['240,85,107','Coral'],['151,166,200','Steel'],
];
function ZoneEditor({ zone, onApply, onCancel, onDelete }){
  const [area, setArea] = React.useState(zone.area || 'A');
  const [pour, setPour] = React.useState(zone.pour || '1');
  const [phase, setPhase] = React.useState(zone.phase || '1');
  const [done, setDone] = React.useState(!!zone.done);
  const [nextPour, setNextPour] = React.useState(!!zone.nextPour);
  const [assign, setAssign] = React.useState(!!zone.assign);
  const [color, setColor] = React.useState(zone.color || '126,120,240');
  const [layer, setLayer] = React.useState(zoneLayer(zone));
  const [date, setDate] = React.useState(zone.date || '');

  const Tag = ({ on, set, c, title, sub }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      background: on?`linear-gradient(180deg,rgba(${c},.16),rgba(${c},.04))`:'rgba(0,0,0,.22)',
      border:'1px solid '+(on?`rgba(${c},.5)`:T.color.line), borderRadius:T.radius.lg, padding:'12px 14px' }}>
      <div onClick={()=>set(v=>!v)} style={{ cursor:'pointer', flex:1 }}>
        <div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:15, textTransform:'uppercase', letterSpacing:'.03em', color:on?`rgb(${c})`:'#fff' }}>{title}</div>
        <div style={{ fontSize:12, color:T.color.steel300, marginTop:2 }}>{sub}</div></div>
      <Toggle on={on} onChange={()=>set(v=>!v)} />
    </div>
  );

  return (
    <div data-ui style={{ position:'absolute', inset:0, background:'rgba(6,9,14,.55)', zIndex:40, display:'grid', placeItems:'center', padding:18 }}
      onClick={onCancel}>
      <Card onClick={e=>e.stopPropagation()} pad={22} glow style={{ width:'min(420px,100%)', maxHeight:'92%', overflowY:'auto', boxShadow:T.shadow.panel }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
          <Icon name="zone" size={18} style={{ color:T.color.amber }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:20, textTransform:'uppercase', letterSpacing:'.03em' }}>{zone._new?'Tag zone':'Edit zone'}</span>
        </div>
        <p style={{ fontSize:13, color:T.color.steel300, margin:'0 0 18px' }}>Tag every embed inside this zone. Area &amp; sequence stay as-is unless you choose to reassign them.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Tag on={nextPour} set={setNextPour} c="82,230,224" title="Next pour" sub="Cyan layer · flags everything inside as the next pour" />
          <Tag on={done} set={setDone} c="47,214,166" title="Pour complete" sub="Green layer · marks every embed inside installed" />

          {/* layer + pour date */}
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 130px' }}><Field label="Layer"><Segmented value={layer} onChange={setLayer} options={['PWJV','WCG Pours']} /></Field></div>
            <div style={{ flex:'1 1 150px' }}><Field label="Pour date">
              <DatePopover value={date} onChange={setDate} />
            </Field></div>
          </div>

          {/* optional: reassign area + sequence */}
          <div style={{ borderTop:'1px solid '+T.color.line, paddingTop:14 }}>
            <Tag on={assign} set={setAssign} c="126,120,240" title="Set sequence · phase · area" sub="Only if this zone should overwrite the embeds inside" />
            {assign && <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <Field label="Sequence"><Segmented value={pour} onChange={setPour} options={SEQUENCES} /></Field>
              <Field label="Phase"><Segmented value={phase} onChange={setPhase} options={PHASES} /></Field>
              <Field label="Area"><Segmented value={area} onChange={setArea} options={AREAS} /></Field>
            </div>}
          </div>

          {!nextPour && !done && (
            <Field label="Highlight color">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{ZONE_COLORS.map(([c,name])=>(
                <button key={c} title={name} onClick={()=>setColor(c)} style={{ width:30, height:30, borderRadius:8, cursor:'pointer',
                  background:`rgba(${c},.9)`, border:'2px solid '+(color===c?'#fff':'transparent'), boxShadow:color===c?`0 0 0 2px rgba(${c},.6)`:'none' }} />
              ))}</div>
            </Field>
          )}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22 }}>
          {onDelete && <Btn kind="danger" icon="trash" onClick={onDelete}>Delete</Btn>}
          <Btn kind="ghost" onClick={onCancel} style={{ marginLeft:onDelete?0:'auto' }}>Cancel</Btn>
          <Btn kind="primary" icon="check" onClick={()=>onApply({ ...zone, area, pour, phase, done, nextPour, assign, color, layer, date })} style={{ marginLeft:onDelete?'auto':0 }}>Apply</Btn>
        </div>
      </Card>
    </div>
  );
}

/* manager: drop a brand-new embed pin on the plan */
function NewPinEditor({ pos, onCreate, onCancel }){
  const [mark, setMark] = React.useState('');
  const [type, setType] = React.useState('anchor');
  const [sequence, setSequence] = React.useState('1');
  const [area, setArea] = React.useState('A');
  return (
    <div data-ui style={{ position:'absolute', inset:0, background:'rgba(6,9,14,.55)', zIndex:40, display:'grid', placeItems:'center', padding:18 }}
      onClick={onCancel}>
      <Card onClick={e=>e.stopPropagation()} pad={22} glow style={{ width:'min(420px,100%)', boxShadow:T.shadow.panel }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
          <Icon name="pinAdd" size={18} style={{ color:T.color.amber }} />
          <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:20, textTransform:'uppercase', letterSpacing:'.03em' }}>Add embed</span>
        </div>
        <p style={{ fontSize:13, color:T.color.steel300, margin:'0 0 18px' }}>Dropped at {Math.round(pos.x*100)}%, {Math.round(pos.y*100)}% — it snaps to the nearest grid intersection.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Field label="Mark / piece"><input autoFocus value={mark} onChange={e=>setMark(e.target.value)} placeholder="e.g. 218A"
            onKeyDown={e=>{ if(e.key==='Enter') onCreate({ embedId:mark||'NEW', knifePlate:type==='knife', sequence, area }); }}
            style={{ ...inputStyle, padding:'10px 12px', fontSize:14, fontFamily:T.font.mono }} /></Field>
          <Field label="Type"><Segmented value={type} onChange={setType}
            options={[{value:'anchor',label:'Anchor rod'},{value:'knife',label:'Knife plate'}]} /></Field>
          <Field label="Sequence"><Segmented value={sequence} onChange={setSequence} options={SEQUENCES} /></Field>
          <Field label="Area"><Segmented value={area} onChange={setArea} options={AREAS} /></Field>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22 }}>
          <Btn kind="ghost" onClick={onCancel} style={{ marginLeft:'auto' }}>Cancel</Btn>
          <Btn kind="primary" icon="check" onClick={()=>onCreate({ embedId:mark||'NEW', knifePlate:type==='knife', sequence, area })}>Add embed</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---- clean date picker (calendar popover; writes 'YYYY-MM-DD') ---- */
const DP_WD = ['S','M','T','W','T','F','S'];
const DP_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dpParts(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); return m?{ y:+m[1], mo:+m[2], d:+m[3] }:null; }
function dpPad(n){ return String(n).padStart(2,'0'); }
function DatePopover({ value, onChange, disabled }){
  const [open,setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const sel = dpParts(value);
  const now = new Date();
  const [cur,setCur] = React.useState(()=> sel?{ y:sel.y, mo:sel.mo }:{ y:now.getFullYear(), mo:now.getMonth()+1 });
  React.useEffect(()=>{ if(open && sel) setCur({ y:sel.y, mo:sel.mo }); },[open]);
  React.useEffect(()=>{ if(!open) return; const h=e=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h,true); return ()=>document.removeEventListener('mousedown',h,true); },[open]);
  const startWd = new Date(cur.y,cur.mo-1,1).getDay();
  const days = new Date(cur.y,cur.mo,0).getDate();
  const cells = []; for(let i=0;i<startWd;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d);
  const prev = ()=> setCur(c=>{ let mo=c.mo-1,y=c.y; if(mo<1){mo=12;y--;} return { y,mo }; });
  const next = ()=> setCur(c=>{ let mo=c.mo+1,y=c.y; if(mo>12){mo=1;y++;} return { y,mo }; });
  const pick = d => { onChange(`${cur.y}-${dpPad(cur.mo)}-${dpPad(d)}`); setOpen(false); };
  const tIso = `${now.getFullYear()}-${dpPad(now.getMonth()+1)}-${dpPad(now.getDate())}`;
  const label = sel ? `${DP_MON[sel.mo-1]} ${sel.d}, ${sel.y}` : 'Set date';
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button disabled={disabled} onClick={()=>!disabled&&setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', height:34, padding:'0 11px', borderRadius:T.radius.md,
        background:'rgba(0,0,0,.25)', border:'1px solid '+(value?'rgba(82,230,224,.4)':T.color.line), color:value?'#fff':T.color.steel400, cursor:disabled?'default':'pointer', fontFamily:T.font.mono, fontSize:12.5 }}>
        <Icon name="calendar" size={14} style={{ color:value?T.color.cyan:T.color.steel400 }} />
        <span style={{ flex:1, textAlign:'left' }}>{label}</span>
        {value && !disabled && <span onClick={e=>{ e.stopPropagation(); onChange(''); }} title="Clear"><Icon name="close" size={12} style={{ color:T.color.steel400 }} /></span>}
      </button>
      {open && (
        <div data-ui style={{ position:'absolute', top:38, left:0, zIndex:60, width:240, background:steelPlate('#161D29','#0F141C'), border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:12, boxShadow:T.shadow.panel }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <button onClick={prev} style={{ color:T.color.steel300, padding:4 }}><Icon name="chevronDown" size={16} style={{ transform:'rotate(90deg)' }}/></button>
            <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:14 }}>{DP_MON[cur.mo-1]} {cur.y}</span>
            <button onClick={next} style={{ color:T.color.steel300, padding:4 }}><Icon name="chevronDown" size={16} style={{ transform:'rotate(-90deg)' }}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {DP_WD.map((w,i)=><div key={'w'+i} style={{ textAlign:'center', fontFamily:T.font.mono, fontSize:9.5, color:T.color.steel400, padding:'2px 0' }}>{w}</div>)}
            {cells.map((d,i)=>{ if(d==null) return <div key={'e'+i} />;
              const iso=`${cur.y}-${dpPad(cur.mo)}-${dpPad(d)}`; const on=value===iso; const isToday=iso===tIso;
              return <button key={'d'+i} onClick={()=>pick(d)} style={{ height:28, borderRadius:6, fontFamily:T.font.mono, fontSize:12,
                background:on?T.color.cyan:'transparent', color:on?'#06140e':'#dfe7f2', fontWeight:on?700:400,
                border:'1px solid '+(isToday&&!on?'rgba(82,230,224,.5)':'transparent') }}>{d}</button>; })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:9, paddingTop:9, borderTop:'1px solid '+T.color.line }}>
            <button onClick={()=>{ onChange(''); setOpen(false); }} style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.steel400 }}>Clear</button>
            <button onClick={()=>{ onChange(tIso); setOpen(false); }} style={{ fontFamily:T.font.mono, fontSize:11, color:T.color.cyan }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PinDetail, ZoneEditor, Celebrate, NewPinEditor, DatePopover });
