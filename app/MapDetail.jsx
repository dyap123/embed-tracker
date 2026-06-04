/* EmbedYap — pin detail panel (sequence/area/install + RFI) and zone editor */

function PinDetail({ embed, seq, onClose, updateEmbed, isPhone, manager, onDelete }){
  const [celebrate, setCelebrate] = React.useState(false);
  const [mark, setMark] = React.useState(embed.mark||'');
  const st = pinState(embed, seq);

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
            <Field label="Type">
              <Segmented size="sm" value={embed.hasKnife?'knife':'anchor'} onChange={v=>updateEmbed(embed.id,{ knifePlate:v==='knife' })}
                options={[{value:'anchor',label:'Anchor rod'},{value:'knife',label:'Knife plate'}]} />
            </Field>
          </div>
        )}

        {/* sequence + area selectors */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }}>
          <Field label="Sequence">
            <Segmented size="sm" value={embed.sequence} onChange={v=>updateEmbed(embed.id,{ sequence:v, pour:`${embed.area}·${v==='CUP'?'CUP':'P'+v}` })}
              options={SEQUENCES.map(s=>({value:s,label:s}))} style={{ display:'flex', flexWrap:'wrap' }} />
          </Field>
          <Field label="Area">
            <Segmented size="sm" value={embed.area} onChange={v=>updateEmbed(embed.id,{ area:v, pour:`${v}·${embed.sequence==='CUP'?'CUP':'P'+embed.sequence}` })}
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
              {embed.installed? `Cast & set · ${embed.installedAt}` : 'Mark when cast into concrete'}</div>
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

const ZONE_COLORS = [['126,120,240','Indigo'],['79,163,242','Blue'],['196,92,203','Magenta'],['242,176,76','Amber'],['240,85,107','Coral']];
function ZoneEditor({ zone, onApply, onCancel, onDelete }){
  const [area, setArea] = React.useState(zone.area || 'B');
  const [pour, setPour] = React.useState(zone.pour || '2');
  const [done, setDone] = React.useState(!!zone.done);
  const [nextPour, setNextPour] = React.useState(!!zone.nextPour);
  const [assign, setAssign] = React.useState(!!zone.assign);
  const [color, setColor] = React.useState(zone.color || '126,120,240');

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
          <Tag on={nextPour} set={setNextPour} c="255,111,181" title="Next pour" sub="Pink layer · flags everything inside as the next pour" />
          <Tag on={done} set={setDone} c="47,214,166" title="Pour complete" sub="Green layer · marks every embed inside installed" />

          {/* optional: reassign area + sequence */}
          <div style={{ borderTop:'1px solid '+T.color.line, paddingTop:14 }}>
            <Tag on={assign} set={setAssign} c="126,120,240" title="Set area & sequence" sub="Only if this zone should overwrite area/pour on the embeds inside" />
            {assign && <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <Field label="Area"><Segmented value={area} onChange={setArea} options={AREAS} /></Field>
              <Field label="Pour / sequence"><Segmented value={pour} onChange={setPour} options={SEQUENCES} /></Field>
            </div>}
          </div>

          {!nextPour && !done && (
            <Field label="Highlight color">
              <div style={{ display:'flex', gap:8 }}>{ZONE_COLORS.map(([c,name])=>(
                <button key={c} title={name} onClick={()=>setColor(c)} style={{ width:30, height:30, borderRadius:8, cursor:'pointer',
                  background:`rgba(${c},.9)`, border:'2px solid '+(color===c?'#fff':'transparent'), boxShadow:color===c?`0 0 0 2px rgba(${c},.6)`:'none' }} />
              ))}</div>
            </Field>
          )}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22 }}>
          {onDelete && <Btn kind="danger" icon="trash" onClick={onDelete}>Delete</Btn>}
          <Btn kind="ghost" onClick={onCancel} style={{ marginLeft:onDelete?0:'auto' }}>Cancel</Btn>
          <Btn kind="primary" icon="check" onClick={()=>onApply({ ...zone, area, pour, done, nextPour, assign, color })} style={{ marginLeft:onDelete?'auto':0 }}>Apply</Btn>
        </div>
      </Card>
    </div>
  );
}

/* manager: drop a brand-new embed pin on the plan */
function NewPinEditor({ pos, onCreate, onCancel }){
  const [mark, setMark] = React.useState('');
  const [type, setType] = React.useState('anchor');
  const [sequence, setSequence] = React.useState('CUP');
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

Object.assign(window, { PinDetail, ZoneEditor, Celebrate, NewPinEditor });
