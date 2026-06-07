/* EmbedYap — Sign in: full-screen immersive "badge-in" terminal */
const ADD_PIN = '050103';   // gate to add a new crew member from the badge-in screen
function SignIn({ onSignIn, onAddCrew, crew, embeds=[] }){
  const ROSTER = (crew && crew.length) ? crew : (window.CREW || CREW);
  const [sel, setSel] = React.useState(null);
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(false);
  const user = ROSTER.find(c=>c.id===sel);
  const needPin = user && user.manager;

  // add-crew flow
  const [adding, setAdding] = React.useState(false);
  const [nf, setNf] = React.useState({ name:'', role:'', manager:false, pin:'' });
  const [apin, setApin] = React.useState('');
  const [aerr, setAerr] = React.useState('');

  function badgeIn(){
    if (!user) return;
    if (needPin && pin !== user.pin){ setErr(true); return; }
    onSignIn(user);
  }
  React.useEffect(()=>{ setPin(''); setErr(false); }, [sel]);

  function initialsOf(name){ const p=name.trim().split(/\s+/).filter(Boolean);
    const two=((p[0]||'')[0]||'')+((p[1]||'')[0]||''); return (two||name.trim().slice(0,2)||'?').toUpperCase(); }
  function slugOf(name){ const base=(name.trim().toLowerCase().split(/\s+/)[0]||'crew').replace(/[^a-z0-9]/g,'')||'crew';
    const ids=new Set(ROSTER.map(c=>c.id)); let id=base, n=2; while(ids.has(id)){ id=base+n; n++; } return id; }
  function createCrew(){
    if (apin !== ADD_PIN){ setAerr('Incorrect add PIN'); return; }
    const name = nf.name.trim(); if(!name){ setAerr('Enter a name'); return; }
    if (nf.manager && nf.pin.length < 4){ setAerr('Manager needs a 4–6 digit PIN'); return; }
    const c = { id:slugOf(name), name, role:(nf.role.trim()||'PWJV'), initials:initialsOf(name),
      manager:!!nf.manager, pin: nf.manager ? nf.pin : null };
    onAddCrew && onAddCrew(c);
    setAdding(false); setNf({ name:'', role:'', manager:false, pin:'' }); setApin(''); setAerr(''); setSel(c.id);
  }

  const k = kpis(embeds);
  const nextCount = embeds.filter(e=>e.nextPour).length;
  const ticker = [
    { dot:T.color.green, label:`${k.pct}% installed` },
    { dot:T.color.blue,  label:`${k.pinned} pinned` },
    { dot:T.color.pink,  label:`${nextCount} next pour` },
    { dot:T.color.red,   label:`${k.openRFI} open RFIs` },
  ];

  return (
    <div style={{ position:'absolute', inset:0, overflow:'auto', background:'radial-gradient(130% 100% at 50% -10%, #1A2740 0%, #0B0F18 55%, #070A11 100%)' }}>
      {/* drifting blueprint grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:.55,
        backgroundImage:'repeating-linear-gradient(0deg, transparent 0 45px, rgba(120,150,210,.08) 45px 46px), repeating-linear-gradient(90deg, transparent 0 45px, rgba(120,150,210,.08) 45px 46px)',
        animation:'eyDrift 26s linear infinite' }} />
      {/* scattered pulsing pins */}
      {[['12%','22%',T.color.green,0],['82%','18%',T.color.pink,.6],['68%','72%',T.color.blue,1.2],['22%','78%',T.color.yellow,1.8],['46%','34%',T.color.red,2.4],['90%','58%',T.color.green,3]].map(([l,t,c,d],i)=>(
        <span key={i} style={{ position:'absolute', left:l, top:t, width:9, height:9, borderRadius:'50%', background:c,
          boxShadow:`0 0 12px 2px ${c}`, opacity:.0, animation:`eyPulse 4s ${d}s ease-in-out infinite`, pointerEvents:'none' }} />
      ))}
      {/* vignette + corner brackets */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', boxShadow:'inset 0 0 220px 40px rgba(0,0,0,.6)' }} />
      {['tl','tr','bl','br'].map(p=>{
        const b='2px solid rgba(166,160,255,.35)'; const s={ position:'absolute', width:26, height:26, pointerEvents:'none' };
        const m={ tl:{top:18,left:18,borderTop:b,borderLeft:b}, tr:{top:18,right:18,borderTop:b,borderRight:b},
          bl:{bottom:18,left:18,borderBottom:b,borderLeft:b}, br:{bottom:18,right:18,borderBottom:b,borderRight:b} }[p];
        return <div key={p} style={{ ...s, ...m }} />;
      })}

      {/* top status strip */}
      <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 40px', fontFamily:T.font.mono, fontSize:11, letterSpacing:'.14em', color:'rgba(180,200,235,.6)', pointerEvents:'none' }}>
        <span>LA CONVENTION CENTER · FOUNDATIONS</span>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:T.color.green, boxShadow:`0 0 8px ${T.color.green}`, animation:'eyPulse 2.4s ease-in-out infinite' }} />
          SYSTEM ONLINE · EMB-1.0.0
        </span>
      </div>

      {/* center stack */}
      <div style={{ position:'relative', minHeight:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:22, padding:'72px 20px 48px' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, animation:'eyRise .5s cubic-bezier(.2,.8,.2,1) both' }}>
          <LogoMark size={64} />
          <div style={{ fontFamily:T.font.display, fontWeight:800, fontSize:42, letterSpacing:'.02em', textTransform:'uppercase', color:'#fff', lineHeight:1 }}>
            Embed<span style={{ color:T.color.amberHot }}>Yap</span>
          </div>
          <div style={{ fontFamily:T.font.mono, fontSize:12, letterSpacing:'.22em', textTransform:'uppercase', color:'rgba(180,200,235,.55)' }}>Embed install tracker</div>
        </div>

        {/* live stat ticker */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:10, animation:'eyRise .5s .05s cubic-bezier(.2,.8,.2,1) both' }}>
          {ticker.map((s,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:T.radius.pill,
              background:'rgba(10,16,28,.55)', border:'1px solid rgba(146,164,196,.16)', fontFamily:T.font.mono, fontSize:12.5, color:'#dbe3f2' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:s.dot, boxShadow:`0 0 8px ${s.dot}` }} />{s.label}
            </div>
          ))}
        </div>

        {/* badge-in card */}
        <div style={{ width:'min(620px,100%)', marginTop:8, background:'linear-gradient(180deg, rgba(22,30,45,.9), rgba(12,17,26,.92))',
          border:'1px solid rgba(146,164,196,.18)', borderRadius:T.radius.xl, boxShadow:T.shadow.panel, overflow:'hidden',
          backdropFilter:'blur(8px)', animation:'eyRise .5s .1s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ padding:'16px 22px', borderBottom:'1px solid '+T.color.line, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:16, textTransform:'uppercase', letterSpacing:'.05em' }}>Badge in</span>
            <span style={{ fontFamily:T.font.mono, fontSize:11, letterSpacing:'.12em', color:T.color.steel400 }}>TAP YOUR NAME · CREW {ROSTER.length}</span>
          </div>

          {/* avatar roster */}
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:18, padding:'24px 22px' }}>
            {ROSTER.map(c=>{
              const on=c.id===sel;
              return (
                <button key={c.id} onClick={()=>setSel(c.id)} title={c.name} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:88, transition:'transform .15s', transform:on?'translateY(-2px)':'none' }}>
                  <span style={{ position:'relative', width:60, height:60, borderRadius:'50%', display:'grid', placeItems:'center',
                    background: on?accentPlate:steelPlate('#26313F','#1A2230'), color:'#fff',
                    fontFamily:T.font.display, fontWeight:800, fontSize:c.avatarEmoji?28:22,
                    border:'2px solid '+(on?'#fff':'rgba(146,164,196,.25)'),
                    boxShadow: on?`0 0 0 4px rgba(126,120,240,.35), 0 10px 26px -10px rgba(126,120,240,.8)`:'0 6px 18px -10px rgba(0,0,0,.8)' }}>
                    {c.avatarEmoji||c.initials}
                    {c.manager && <span title="Manager · PIN" style={{ position:'absolute', bottom:-2, right:-2, width:19, height:19, borderRadius:'50%',
                      background:T.color.amber, border:'2px solid #11161f', display:'grid', placeItems:'center' }}><Icon name="lock" size={9} style={{ color:'#0A0B16' }} /></span>}
                  </span>
                  <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:12.5, color:on?'#fff':T.color.steel300, textAlign:'center', lineHeight:1.15, whiteSpace:'nowrap' }}>
                    {c.name.split(' ')[0]}{c.goat?' 🐐':''}
                  </span>
                </button>
              );
            })}
            {/* add a new crew member */}
            <button onClick={()=>{ setAdding(true); setSel(null); }} title="Add crew member"
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:88, transition:'transform .15s', transform:adding?'translateY(-2px)':'none' }}>
              <span style={{ width:60, height:60, borderRadius:'50%', display:'grid', placeItems:'center',
                background:'rgba(146,164,196,.06)', color:adding?'#fff':T.color.steel300,
                border:'2px dashed '+(adding?'#A6A0FF':'rgba(146,164,196,.4)') }}>
                <Icon name="plus" size={26} />
              </span>
              <span style={{ fontFamily:T.font.display, fontWeight:600, fontSize:12.5, color:adding?'#fff':T.color.steel300 }}>Add</span>
            </button>
          </div>

          {adding ? (
          /* add-crew form */
          <div style={{ borderTop:'1px solid '+T.color.line, background:'rgba(0,0,0,.22)', padding:'16px 22px', display:'flex', flexDirection:'column', gap:13 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Kicker>New crew member</Kicker>
              <button onClick={()=>{ setAdding(false); setAerr(''); }} style={{ color:T.color.steel400 }}><Icon name="close" size={16}/></button>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 200px' }}><Field label="Name"><input value={nf.name} autoFocus onChange={e=>{ setAerr(''); setNf(f=>({...f,name:e.target.value})); }}
                placeholder="e.g. Danzel Yap" style={{ ...inputStyle, padding:'9px 11px', fontSize:14 }} /></Field></div>
              <div style={{ flex:'1 1 200px' }}><Field label="Role"><input value={nf.role} onChange={e=>setNf(f=>({...f,role:e.target.value}))}
                placeholder="e.g. PWJV · PE" style={{ ...inputStyle, padding:'9px 11px', fontSize:14 }} /></Field></div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(0,0,0,.22)', border:'1px solid '+T.color.line, borderRadius:T.radius.lg, padding:'10px 14px' }}>
                <div><div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:13.5, textTransform:'uppercase', color:nf.manager?T.color.amber:'#fff' }}>Manager</div>
                  <div style={{ fontSize:11, color:T.color.steel300 }}>Needs a PIN to badge in</div></div>
                <Toggle on={nf.manager} onChange={()=>setNf(f=>({...f,manager:!f.manager}))} />
              </div>
              {nf.manager && <Field label="Manager PIN"><input value={nf.pin} onChange={e=>setNf(f=>({...f,pin:e.target.value.replace(/\D/g,'').slice(0,6)}))}
                inputMode="numeric" placeholder="4–6 digits" style={{ ...inputStyle, width:140, fontFamily:T.font.mono, padding:'9px 11px', fontSize:15, letterSpacing:'.12em' }} /></Field>}
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:14, flexWrap:'wrap' }}>
              <Field label="Add PIN"><div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="lock" size={16} style={{ color:aerr?T.color.red:T.color.steel300 }} />
                <input value={apin} onChange={e=>{ setAerr(''); setApin(e.target.value.replace(/\D/g,'').slice(0,6)); }}
                  inputMode="numeric" placeholder="••••••" maxLength={6} onKeyDown={e=>e.key==='Enter'&&createCrew()}
                  style={{ ...inputStyle, width:150, fontFamily:T.font.mono, fontSize:20, letterSpacing:'.24em', textAlign:'center', padding:'9px 12px', borderColor:aerr?T.color.red:T.color.line }} />
              </div></Field>
              <Btn kind="primary" size="lg" icon="check" style={{ marginLeft:'auto' }} onClick={createCrew}>Create</Btn>
            </div>
            {aerr
              ? <div style={{ color:T.color.red, fontSize:13, fontFamily:T.font.mono }}>✕ {aerr}</div>
              : <div style={{ color:T.color.steel400, fontSize:12, fontFamily:T.font.mono }}>Enter the add PIN to create this crew member.</div>}
          </div>
          ) : (
          <>
          {/* dock: selected + PIN + badge-in */}
          <div style={{ borderTop:'1px solid '+T.color.line, background:'rgba(0,0,0,.22)', padding:'16px 22px',
            display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 160px', minWidth:0 }}>
              <Kicker>{user? (needPin?'Manager PIN required':'Ready to badge in') : 'Select a crew member'}</Kicker>
              <div style={{ fontFamily:T.font.display, fontWeight:700, fontSize:20, marginTop:4, color:user?'#fff':T.color.steel400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user? user.name : '—'}</div>
              {user && <div style={{ fontFamily:T.font.mono, fontSize:11.5, color:T.color.steel400, marginTop:1 }}>{user.role}</div>}
            </div>
            {needPin && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="lock" size={17} style={{ color:err?T.color.red:T.color.steel300 }} />
                <input value={pin} onChange={e=>{ setErr(false); setPin(e.target.value.replace(/\D/g,'').slice(0,6)); }}
                  inputMode="numeric" placeholder="••••••" maxLength={6} autoFocus
                  onKeyDown={e=>e.key==='Enter'&&badgeIn()}
                  style={{ ...inputStyle, width:150, fontFamily:T.font.mono, fontSize:22, letterSpacing:'.28em', textAlign:'center',
                    padding:'9px 12px', borderColor: err?T.color.red:T.color.line }} />
              </div>
            )}
            <Btn kind="primary" size="lg" icon="power" disabled={!user} onClick={badgeIn}
              style={{ opacity:user?1:.5, cursor:user?'pointer':'not-allowed' }}>Badge in</Btn>
          </div>
          {err && <div style={{ color:T.color.red, fontSize:13, padding:'0 22px 14px', fontFamily:T.font.mono }}>✕ Incorrect PIN — try again.</div>}
          {needPin && !err && <div style={{ color:T.color.steel400, fontSize:12, padding:'0 22px 14px', fontFamily:T.font.mono }}>Enter your 6-digit manager PIN</div>}
          </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes eyDrift { to { background-position: 46px 46px, 46px 46px; } }
        @keyframes eyPulse { 0%,100%{ opacity:.15; transform:scale(.8);} 50%{ opacity:.9; transform:scale(1.15);} }
        @keyframes eyRise { from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:translateY(0);} }
      `}</style>
    </div>
  );
}

function LogoMark({ size=42 }){
  return (
    <span style={{ width:size, height:size, borderRadius:size*0.26, display:'grid', placeItems:'center', position:'relative',
      background:steelPlate('#1B2236','#0F1320'), border:'1px solid rgba(126,120,240,.5)',
      boxShadow:'0 0 0 1px rgba(126,120,240,.12), 0 8px 24px -10px rgba(126,120,240,.7), inset 0 1px 0 rgba(255,255,255,.06)' }}>
      <span style={{ position:'absolute', inset:0, borderRadius:size*0.26,
        background:'radial-gradient(120% 120% at 30% 20%, rgba(126,120,240,.22), transparent 60%)' }} />
      {/* hex bolt-head — the embed anchor mark */}
      <svg width={size*0.64} height={size*0.64} viewBox="0 0 24 24" fill="none" style={{ position:'relative' }}>
        <path d="M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z" stroke="#A6A0FF" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3.5" stroke="#7E78F0" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.05" fill="#A6A0FF" />
      </svg>
    </span>
  );
}

function Logo({ size=1 }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <LogoMark size={38*size} />
      <span style={{ fontFamily:T.font.display, fontWeight:700, fontSize:27*size, letterSpacing:'.02em', color:'#fff', textTransform:'uppercase' }}>
        Embed<span style={{ color:T.color.amberHot }}>Yap</span>
      </span>
    </div>
  );
}
Object.assign(window, { SignIn, Logo, LogoMark });
